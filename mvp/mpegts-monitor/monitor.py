#!/usr/bin/env python3
"""
Inspector - MPEG-TS Input Stream Monitor
Real-time monitoring of MPEG-TS input streams from encoders/sources
Analyzes transport stream health, bitrate, and errors
"""

import socket
import struct
import time
import logging
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import List, Dict, Optional
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
import os

# ============================================================================
# CONFIGURATION
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/mpegts-monitor.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class MPEGTSConfig:
    influxdb_url: str = "http://influxdb:8086"
    influxdb_token: str = "your_influxdb_token"
    influxdb_org: str = "inspector"
    influxdb_bucket: str = "metrics"

    # Monitoring configuration
    poll_interval: int = 5  # seconds
    max_workers: int = 10
    buffer_size: int = 188 * 7  # 7 TS packets

    # Thresholds
    max_cc_errors: int = 10  # Continuity counter errors per interval
    max_sync_loss: int = 5   # Sync byte losses per interval
    min_bitrate_mbps: float = 1.0
    max_bitrate_mbps: float = 50.0

# TS Packet constants
TS_PACKET_SIZE = 188
TS_SYNC_BYTE = 0x47

# ============================================================================
# DATA MODELS
# ============================================================================

@dataclass
class TSPacket:
    sync_byte: int
    transport_error: bool
    payload_start: bool
    priority: bool
    pid: int
    scrambling: int
    adaptation_field: int
    continuity_counter: int
    payload: bytes

@dataclass
class StreamMetrics:
    channel_id: str
    input_url: str
    probe_id: int

    # Transport Stream metrics
    packets_received: int = 0
    sync_errors: int = 0
    continuity_errors: int = 0
    transport_errors: int = 0

    # Bitrate
    bytes_received: int = 0
    bitrate_mbps: float = 0.0

    # PID statistics
    pid_counts: Dict[int, int] = None

    # PAT/PMT presence
    has_pat: bool = False
    has_pmt: bool = False

    # Timing
    timestamp: datetime = None

    def __post_init__(self):
        if self.pid_counts is None:
            self.pid_counts = {}
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()

# ============================================================================
# MPEG-TS PARSER
# ============================================================================

class MPEGTSParser:
    """Parse MPEG-TS packets and extract metrics"""

    def __init__(self):
        self.cc_counters = {}  # Track continuity counters per PID

    def parse_packet(self, data: bytes) -> Optional[TSPacket]:
        """Parse a single 188-byte TS packet"""
        if len(data) != TS_PACKET_SIZE:
            return None

        if data[0] != TS_SYNC_BYTE:
            return None

        # Parse header
        sync_byte = data[0]
        byte1 = data[1]
        byte2 = data[2]
        byte3 = data[3]

        transport_error = bool(byte1 & 0x80)
        payload_start = bool(byte1 & 0x40)
        priority = bool(byte1 & 0x20)
        pid = ((byte1 & 0x1F) << 8) | byte2

        scrambling = (byte3 >> 6) & 0x03
        adaptation_field = (byte3 >> 4) & 0x03
        continuity_counter = byte3 & 0x0F

        payload = data[4:]

        return TSPacket(
            sync_byte=sync_byte,
            transport_error=transport_error,
            payload_start=payload_start,
            priority=priority,
            pid=pid,
            scrambling=scrambling,
            adaptation_field=adaptation_field,
            continuity_counter=continuity_counter,
            payload=payload
        )

    def check_continuity(self, pid: int, cc: int) -> bool:
        """Check continuity counter for errors"""
        if pid not in self.cc_counters:
            self.cc_counters[pid] = cc
            return True

        expected_cc = (self.cc_counters[pid] + 1) & 0x0F
        self.cc_counters[pid] = cc

        if cc != expected_cc:
            return False

        return True

# ============================================================================
# MPEG-TS MONITOR
# ============================================================================

class MPEGTSMonitor:
    """Monitor MPEG-TS input streams"""

    def __init__(self, config: MPEGTSConfig):
        self.config = config
        self.influx_client = InfluxDBClient(
            url=config.influxdb_url,
            token=config.influxdb_token,
            org=config.influxdb_org
        )
        self.write_api = self.influx_client.write_api(write_options=SYNCHRONOUS)
        self.executor = ThreadPoolExecutor(max_workers=config.max_workers)
        self.parser = MPEGTSParser()
        self.streams = {}  # Store stream info

    def add_stream(self, channel_id: str, input_url: str, probe_id: int):
        """Add a stream to monitor"""
        self.streams[channel_id] = {
            'input_url': input_url,
            'probe_id': probe_id,
            'type': self._detect_input_type(input_url)
        }

    def _detect_input_type(self, url: str) -> str:
        """Detect input type from URL"""
        if url.startswith('udp://'):
            return 'udp'
        elif url.startswith('rtp://'):
            return 'rtp'
        elif url.startswith('http://') or url.startswith('https://'):
            return 'http'
        else:
            return 'file'

    def run(self):
        """Main monitoring loop"""
        logger.info("Starting MPEG-TS Monitor Service")

        try:
            while True:
                try:
                    self.monitor_cycle()
                    time.sleep(self.config.poll_interval)
                except Exception as e:
                    logger.error(f"Error in monitor cycle: {e}", exc_info=True)
                    time.sleep(self.config.poll_interval)
        except KeyboardInterrupt:
            logger.info("Shutting down...")
            self.executor.shutdown(wait=True)

    def monitor_cycle(self):
        """Single monitoring cycle"""
        logger.debug(f"Starting monitor cycle for {len(self.streams)} streams")

        futures = {}
        for channel_id, stream_info in self.streams.items():
            future = self.executor.submit(
                self.monitor_stream,
                channel_id,
                stream_info['input_url'],
                stream_info['probe_id']
            )
            futures[future] = channel_id

        for future in futures:
            try:
                future.result(timeout=60)
            except Exception as e:
                logger.error(f"Error monitoring {futures[future]}: {e}")

    def monitor_stream(self, channel_id: str, input_url: str, probe_id: int):
        """Monitor a single MPEG-TS stream"""
        try:
            metrics = StreamMetrics(
                channel_id=channel_id,
                input_url=input_url,
                probe_id=probe_id
            )

            # Monitor based on input type
            input_type = self._detect_input_type(input_url)

            if input_type == 'udp':
                self._monitor_udp_stream(input_url, metrics)
            elif input_type == 'http':
                self._monitor_http_stream(input_url, metrics)
            else:
                logger.warning(f"Unsupported input type for {channel_id}: {input_type}")
                return

            # Analyze metrics
            self._analyze_metrics(metrics)

            # Push metrics
            self._push_metrics(metrics)

        except Exception as e:
            logger.error(f"Error monitoring stream {channel_id}: {e}", exc_info=True)

    def _monitor_udp_stream(self, url: str, metrics: StreamMetrics):
        """Monitor UDP multicast/unicast stream"""
        # Parse UDP URL: udp://239.1.1.1:5000
        parts = url.replace('udp://', '').split(':')
        if len(parts) != 2:
            raise ValueError(f"Invalid UDP URL: {url}")

        host = parts[0]
        port = int(parts[1])

        # Create UDP socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.settimeout(self.config.poll_interval)

        # Bind to port
        sock.bind(('', port))

        # Join multicast group if multicast address
        if host.startswith('224.') or host.startswith('239.'):
            mreq = struct.pack('4sl', socket.inet_aton(host), socket.INADDR_ANY)
            sock.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, mreq)

        start_time = time.time()

        try:
            while time.time() - start_time < self.config.poll_interval:
                try:
                    data, addr = sock.recvfrom(self.config.buffer_size)
                    metrics.bytes_received += len(data)

                    # Parse TS packets
                    offset = 0
                    while offset + TS_PACKET_SIZE <= len(data):
                        packet_data = data[offset:offset + TS_PACKET_SIZE]
                        packet = self.parser.parse_packet(packet_data)

                        if packet:
                            self._process_packet(packet, metrics)
                        else:
                            metrics.sync_errors += 1

                        offset += TS_PACKET_SIZE

                except socket.timeout:
                    break
                except Exception as e:
                    logger.error(f"Error receiving UDP data: {e}")
                    break

        finally:
            sock.close()

        # Calculate bitrate
        elapsed = time.time() - start_time
        if elapsed > 0:
            metrics.bitrate_mbps = (metrics.bytes_received * 8) / (elapsed * 1_000_000)

    def _monitor_http_stream(self, url: str, metrics: StreamMetrics):
        """Monitor HTTP stream"""
        import requests

        start_time = time.time()

        try:
            response = requests.get(url, stream=True, timeout=10)
            response.raise_for_status()

            for chunk in response.iter_content(chunk_size=self.config.buffer_size):
                if time.time() - start_time > self.config.poll_interval:
                    break

                metrics.bytes_received += len(chunk)

                # Parse TS packets
                offset = 0
                while offset + TS_PACKET_SIZE <= len(chunk):
                    packet_data = chunk[offset:offset + TS_PACKET_SIZE]
                    packet = self.parser.parse_packet(packet_data)

                    if packet:
                        self._process_packet(packet, metrics)
                    else:
                        metrics.sync_errors += 1

                    offset += TS_PACKET_SIZE

        except Exception as e:
            logger.error(f"Error monitoring HTTP stream: {e}")

        # Calculate bitrate
        elapsed = time.time() - start_time
        if elapsed > 0:
            metrics.bitrate_mbps = (metrics.bytes_received * 8) / (elapsed * 1_000_000)

    def _process_packet(self, packet: TSPacket, metrics: StreamMetrics):
        """Process a single TS packet"""
        metrics.packets_received += 1

        # Check transport error indicator
        if packet.transport_error:
            metrics.transport_errors += 1

        # Check continuity counter
        if packet.pid != 0x1FFF:  # Skip null packets
            if not self.parser.check_continuity(packet.pid, packet.continuity_counter):
                metrics.continuity_errors += 1

        # Track PID statistics
        metrics.pid_counts[packet.pid] = metrics.pid_counts.get(packet.pid, 0) + 1

        # Check for PAT (PID 0x0000)
        if packet.pid == 0x0000:
            metrics.has_pat = True

        # Check for PMT (typically PID 0x0010-0x1FFE)
        if 0x0010 <= packet.pid <= 0x1FFE and packet.payload_start:
            metrics.has_pmt = True

    def _analyze_metrics(self, metrics: StreamMetrics):
        """Analyze metrics and log issues"""
        # Check sync errors
        if metrics.sync_errors > self.config.max_sync_loss:
            logger.warning(
                f"High sync errors on {metrics.channel_id}: {metrics.sync_errors}"
            )

        # Check continuity errors
        if metrics.continuity_errors > self.config.max_cc_errors:
            logger.warning(
                f"High continuity errors on {metrics.channel_id}: "
                f"{metrics.continuity_errors}"
            )

        # Check bitrate
        if metrics.bitrate_mbps < self.config.min_bitrate_mbps:
            logger.warning(
                f"Low bitrate on {metrics.channel_id}: {metrics.bitrate_mbps:.2f} Mbps"
            )
        elif metrics.bitrate_mbps > self.config.max_bitrate_mbps:
            logger.warning(
                f"High bitrate on {metrics.channel_id}: {metrics.bitrate_mbps:.2f} Mbps"
            )

        # Check for PAT/PMT
        if not metrics.has_pat:
            logger.warning(f"No PAT detected on {metrics.channel_id}")
        if not metrics.has_pmt:
            logger.warning(f"No PMT detected on {metrics.channel_id}")

    def _push_metrics(self, metrics: StreamMetrics):
        """Push metrics to InfluxDB"""
        try:
            # Stream health metrics
            point = Point("mpegts_input") \
                .tag("channel", metrics.channel_id) \
                .tag("probe_id", str(metrics.probe_id)) \
                .field("packets_received", metrics.packets_received) \
                .field("sync_errors", metrics.sync_errors) \
                .field("continuity_errors", metrics.continuity_errors) \
                .field("transport_errors", metrics.transport_errors) \
                .field("bitrate_mbps", metrics.bitrate_mbps) \
                .field("has_pat", int(metrics.has_pat)) \
                .field("has_pmt", int(metrics.has_pmt)) \
                .field("unique_pids", len(metrics.pid_counts)) \
                .time(metrics.timestamp)

            self.write_api.write(
                bucket=self.config.influxdb_bucket,
                org=self.config.influxdb_org,
                record=point
            )

            # PID statistics (top 10 PIDs)
            top_pids = sorted(metrics.pid_counts.items(), key=lambda x: x[1], reverse=True)[:10]
            for pid, count in top_pids:
                pid_point = Point("mpegts_pid_stats") \
                    .tag("channel", metrics.channel_id) \
                    .tag("probe_id", str(metrics.probe_id)) \
                    .tag("pid", f"0x{pid:04X}") \
                    .field("packet_count", count) \
                    .time(metrics.timestamp)

                self.write_api.write(
                    bucket=self.config.influxdb_bucket,
                    org=self.config.influxdb_org,
                    record=pid_point
                )

        except Exception as e:
            logger.error(f"Error pushing metrics: {e}")

# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    # Load config from environment
    config = MPEGTSConfig(
        influxdb_url=os.getenv('INFLUXDB_URL', 'http://influxdb:8086'),
        influxdb_token=os.getenv('INFLUXDB_TOKEN', 'your_influxdb_token'),
        influxdb_org=os.getenv('INFLUXDB_ORG', 'inspector'),
        influxdb_bucket=os.getenv('INFLUXDB_BUCKET', 'metrics'),
        poll_interval=int(os.getenv('POLL_INTERVAL', '5'))
    )

    monitor = MPEGTSMonitor(config)

    # Example: Add streams from environment or database
    # In production, load from CMS API
    channels_env = os.getenv('MPEGTS_CHANNELS', '')
    if channels_env:
        for channel_def in channels_env.split(';'):
            parts = channel_def.split(',')
            if len(parts) == 3:
                channel_id, input_url, probe_id = parts
                monitor.add_stream(channel_id, input_url, int(probe_id))

    monitor.run()
