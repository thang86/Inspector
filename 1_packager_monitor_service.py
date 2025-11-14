#!/usr/bin/env python3
"""
FPT Play - Packager Monitoring Service (L2)
Real-time HLS/DASH segment validation, ABR ladder check, quality metrics
Pushes metrics to InfluxDB / Prometheus
"""

import requests
import time
import json
import logging
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import List, Dict, Optional
import m3u8
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
import hashlib
import socket
import struct
import psycopg2
from psycopg2.extras import RealDictCursor
import os
import subprocess
import tempfile
import base64

# ============================================================================
# CONFIGURATION
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/packager-monitor.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class MonitorConfig:
    packager_url: str = "http://packager-01.internal"
    influxdb_url: str = "http://influxdb.monitor.local:8086"
    influxdb_token: str = "your_influxdb_token"
    influxdb_org: str = "fpt-play"
    influxdb_bucket: str = "packager_metrics"

    # Database
    database_url: str = None

    # Channels to monitor (legacy, will be replaced by database inputs)
    channels: List[str] = None

    # Thresholds
    segment_duration_target: float = 6.0
    segment_duration_tolerance: float = 0.1  # 10%
    min_segment_size: int = 50000  # 50KB
    max_download_time: float = 2.0  # 2 seconds
    min_playlist_segments: int = 3

    # UDP/MPEGTS monitoring
    udp_timeout: float = 5.0  # seconds
    udp_buffer_size: int = 188 * 7  # TS packets (188 bytes each)
    min_ts_packets: int = 100  # minimum packets to receive for valid probe

    # Snapshot/Thumbnail
    enable_snapshots: bool = True
    snapshot_duration: int = 3  # seconds to capture for snapshot
    snapshot_interval: int = 60  # take snapshot every N seconds
    snapshot_dir: str = "/tmp/inspector_snapshots"

    # Polling
    poll_interval: int = 30  # seconds
    max_workers: int = 10

    def __post_init__(self):
        if self.database_url is None:
            self.database_url = os.getenv(
                'DATABASE_URL',
                'postgresql://monitor_app:secure_password@db.monitor.local/fpt_play_monitoring'
            )
        if self.channels is None:
            self.channels = [
                f"CH_TV_HD_{i:03d}" for i in range(1, 51)
            ]

config = MonitorConfig()

# ============================================================================
# DATA MODELS
# ============================================================================

@dataclass
class SegmentMetric:
    channel_id: str
    rung_id: str
    segment_number: int
    duration: float
    size_bytes: int
    download_time_ms: float
    http_status: int
    content_hash: str
    timestamp: datetime

@dataclass
class ABRLadderInfo:
    channel_id: str
    rungs: List[Dict]  # [{'name': '4K', 'bitrate_kbps': 15000, 'resolution': '3840x2160'}]
    min_bitrate_kbps: float
    max_bitrate_kbps: float
    rung_count: int

@dataclass
class PlaylistValidation:
    channel_id: str
    rung_id: str
    is_valid: bool
    duration: float
    segment_count: int
    errors: List[str]
    last_updated: datetime


@dataclass
class InputSource:
    input_id: int
    input_name: str
    input_url: str
    input_type: str  # MPEGTS_UDP, HTTP, HLS, etc.
    input_protocol: str
    input_port: int
    channel_id: int
    channel_name: str
    probe_id: int
    is_primary: bool
    enabled: bool


@dataclass
class UDPProbeMetric:
    input_id: int
    input_name: str
    packets_received: int
    bytes_received: int
    duration_sec: float
    bitrate_mbps: float
    is_valid: bool
    errors: List[str]
    timestamp: datetime

# ============================================================================
# PACKAGER MONITOR SERVICE
# ============================================================================

class PackagerMonitor:
    def __init__(self, config: MonitorConfig):
        self.config = config
        self.influx_client = InfluxDBClient(
            url=config.influxdb_url,
            token=config.influxdb_token,
            org=config.influxdb_org
        )
        self.write_api = self.influx_client.write_api(write_options=SYNCHRONOUS)
        self.executor = ThreadPoolExecutor(max_workers=config.max_workers)
        self.metric_cache = {}  # Store last metrics for comparison
        self.last_snapshot_times = {}  # Track when we last took snapshots
        self.db_conn = None
        self._connect_db()
        self._setup_snapshot_dir()
    
    def _setup_snapshot_dir(self):
        """Create snapshot directory if it doesn't exist"""
        try:
            os.makedirs(self.config.snapshot_dir, exist_ok=True)
            logger.info(f"Snapshot directory ready: {self.config.snapshot_dir}")
        except Exception as e:
            logger.error(f"Failed to create snapshot directory: {e}")

    def _connect_db(self):
        """Connect to PostgreSQL database"""
        try:
            self.db_conn = psycopg2.connect(self.config.database_url)
            logger.info("Connected to database successfully")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            self.db_conn = None

    def _fetch_inputs_from_db(self) -> List[InputSource]:
        """Fetch enabled inputs from database"""
        if not self.db_conn:
            logger.warning("No database connection, using legacy channel list")
            return []

        try:
            with self.db_conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute("""
                    SELECT
                        i.input_id,
                        i.input_name,
                        i.input_url,
                        i.input_type,
                        i.input_protocol,
                        i.input_port,
                        i.channel_id,
                        c.channel_name,
                        i.probe_id,
                        i.is_primary,
                        i.enabled
                    FROM inputs i
                    LEFT JOIN channels c ON i.channel_id = c.channel_id
                    WHERE i.enabled = true
                    ORDER BY i.input_id
                """)
                rows = cursor.fetchall()

                inputs = []
                for row in rows:
                    inputs.append(InputSource(
                        input_id=row['input_id'],
                        input_name=row['input_name'],
                        input_url=row['input_url'],
                        input_type=row['input_type'],
                        input_protocol=row['input_protocol'],
                        input_port=row['input_port'],
                        channel_id=row['channel_id'],
                        channel_name=row['channel_name'],
                        probe_id=row['probe_id'],
                        is_primary=row['is_primary'],
                        enabled=row['enabled']
                    ))

                logger.info(f"Fetched {len(inputs)} inputs from database")
                return inputs

        except Exception as e:
            logger.error(f"Error fetching inputs from database: {e}")
            # Reconnect on error
            try:
                self.db_conn.close()
            except:
                pass
            self._connect_db()
            return []

    def run(self):
        """Main monitoring loop"""
        logger.info("Starting Packager Monitor Service")

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
            if self.db_conn:
                self.db_conn.close()
    
    def monitor_cycle(self):
        """Single monitoring cycle"""
        # Fetch inputs from database
        inputs = self._fetch_inputs_from_db()

        if not inputs:
            logger.warning("No inputs found in database, falling back to legacy channel monitoring")
            logger.debug(f"Starting monitor cycle for {len(self.config.channels)} channels")

            futures = {}
            for channel_id in self.config.channels:
                future = self.executor.submit(self.monitor_channel, channel_id)
                futures[future] = channel_id

            for future in futures:
                try:
                    future.result(timeout=60)
                except Exception as e:
                    logger.error(f"Error monitoring {futures[future]}: {e}")
            return

        logger.debug(f"Starting monitor cycle for {len(inputs)} inputs")

        futures = {}
        for input_source in inputs:
            future = self.executor.submit(self.monitor_input, input_source)
            futures[future] = input_source.input_name

        for future in futures:
            try:
                future.result(timeout=60)
            except Exception as e:
                logger.error(f"Error monitoring {futures[future]}: {e}")

    def monitor_input(self, input_source: InputSource):
        """Monitor single input based on its type"""
        try:
            if input_source.input_type == 'MPEGTS_UDP':
                self._probe_mpegts_udp(input_source)
            elif input_source.input_type in ['HTTP', 'HLS']:
                # Use existing HLS monitoring for HTTP/HLS inputs
                self.monitor_channel(input_source.channel_name or f"input_{input_source.input_id}")
            else:
                logger.warning(f"Unsupported input type: {input_source.input_type} for {input_source.input_name}")

        except Exception as e:
            logger.error(f"Error monitoring input {input_source.input_name}: {e}", exc_info=True)

    def _probe_mpegts_udp(self, input_source: InputSource):
        """Probe MPEGTS UDP input by joining multicast group and receiving packets"""
        errors = []
        packets_received = 0
        bytes_received = 0
        is_valid = False

        # Parse UDP URL (e.g., udp://225.3.3.42:30130)
        try:
            url_parts = input_source.input_url.replace('udp://', '').split(':')
            if len(url_parts) != 2:
                raise ValueError(f"Invalid UDP URL format: {input_source.input_url}")

            multicast_group = url_parts[0]
            port = int(url_parts[1])

        except Exception as e:
            errors.append(f"Failed to parse UDP URL: {e}")
            logger.error(f"Error parsing UDP URL for {input_source.input_name}: {e}")
            self._push_udp_probe_metric(UDPProbeMetric(
                input_id=input_source.input_id,
                input_name=input_source.input_name,
                packets_received=0,
                bytes_received=0,
                duration_sec=0,
                bitrate_mbps=0,
                is_valid=False,
                errors=errors,
                timestamp=datetime.utcnow()
            ))
            return

        # Create UDP socket
        sock = None
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

            # Bind to the port
            sock.bind(('', port))

            # Join multicast group
            mreq = struct.pack("4sl", socket.inet_aton(multicast_group), socket.INADDR_ANY)
            sock.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, mreq)

            # Set timeout
            sock.settimeout(self.config.udp_timeout)

            logger.debug(f"Probing UDP stream {input_source.input_name} at {multicast_group}:{port}")

            start_time = time.time()
            ts_packet_count = 0

            # Receive packets for the duration of the timeout
            while True:
                try:
                    data, addr = sock.recvfrom(self.config.udp_buffer_size)
                    packets_received += 1
                    bytes_received += len(data)

                    # Validate TS packets (each should be 188 bytes and start with 0x47)
                    if len(data) % 188 == 0:
                        for i in range(0, len(data), 188):
                            if data[i] == 0x47:  # TS sync byte
                                ts_packet_count += 1

                    # Stop after receiving minimum packets or timeout
                    if packets_received >= self.config.min_ts_packets:
                        break

                except socket.timeout:
                    break
                except Exception as e:
                    errors.append(f"Error receiving packets: {e}")
                    break

            duration = time.time() - start_time

            # Calculate bitrate
            if duration > 0:
                bitrate_mbps = (bytes_received * 8) / (duration * 1_000_000)
            else:
                bitrate_mbps = 0

            # Validate results
            if packets_received >= self.config.min_ts_packets and ts_packet_count > 0:
                is_valid = True
                logger.info(
                    f"UDP probe successful for {input_source.input_name}: "
                    f"{packets_received} packets, {bytes_received} bytes, "
                    f"{ts_packet_count} TS packets, {bitrate_mbps:.2f} Mbps"
                )
            else:
                errors.append(
                    f"Insufficient packets received: {packets_received} < {self.config.min_ts_packets}"
                )
                logger.warning(
                    f"UDP probe failed for {input_source.input_name}: "
                    f"{packets_received} packets received"
                )

            # Push metrics
            self._push_udp_probe_metric(UDPProbeMetric(
                input_id=input_source.input_id,
                input_name=input_source.input_name,
                packets_received=packets_received,
                bytes_received=bytes_received,
                duration_sec=duration,
                bitrate_mbps=bitrate_mbps,
                is_valid=is_valid,
                errors=errors,
                timestamp=datetime.utcnow()
            ))

        except Exception as e:
            errors.append(f"UDP probe error: {e}")
            logger.error(f"Error probing UDP stream {input_source.input_name}: {e}", exc_info=True)
            self._push_udp_probe_metric(UDPProbeMetric(
                input_id=input_source.input_id,
                input_name=input_source.input_name,
                packets_received=packets_received,
                bytes_received=bytes_received,
                duration_sec=0,
                bitrate_mbps=0,
                is_valid=False,
                errors=errors,
                timestamp=datetime.utcnow()
            ))

        finally:
            if sock:
                try:
                    sock.close()
                except:
                    pass

        # Capture snapshot if enabled and sufficient time has passed
        if is_valid and self.config.enable_snapshots:
            self._capture_snapshot(input_source)

    def _capture_snapshot(self, input_source: InputSource):
        """Capture snapshot/thumbnail from UDP stream using ffmpeg"""
        # Check if we should take a snapshot (throttle by interval)
        current_time = time.time()
        last_snapshot = self.last_snapshot_times.get(input_source.input_id, 0)

        if current_time - last_snapshot < self.config.snapshot_interval:
            logger.debug(f"Skipping snapshot for {input_source.input_name} (too soon)")
            return

        try:
            # Use ffmpeg to capture a frame from the UDP stream
            output_file = os.path.join(
                self.config.snapshot_dir,
                f"input_{input_source.input_id}_{int(current_time)}.jpg"
            )

            # FFmpeg command to capture one frame from UDP stream
            cmd = [
                'ffmpeg',
                '-hide_banner',
                '-loglevel', 'error',
                '-i', input_source.input_url,
                '-frames:v', '1',
                '-q:v', '2',
                '-t', str(self.config.snapshot_duration),
                '-y',
                output_file
            ]

            logger.debug(f"Capturing snapshot for {input_source.input_name}: {' '.join(cmd)}")

            # Run ffmpeg with timeout
            result = subprocess.run(
                cmd,
                timeout=self.config.snapshot_duration + 5,
                capture_output=True,
                text=True
            )

            if result.returncode == 0 and os.path.exists(output_file):
                # Update database with snapshot URL
                self._update_input_snapshot(input_source.input_id, output_file)
                self.last_snapshot_times[input_source.input_id] = current_time
                logger.info(f"Captured snapshot for {input_source.input_name}: {output_file}")
            else:
                logger.warning(
                    f"Failed to capture snapshot for {input_source.input_name}: "
                    f"{result.stderr}"
                )

        except subprocess.TimeoutExpired:
            logger.warning(f"Snapshot capture timeout for {input_source.input_name}")
        except Exception as e:
            logger.error(f"Error capturing snapshot for {input_source.input_name}: {e}")

    def _update_input_snapshot(self, input_id: int, snapshot_path: str):
        """Update input record with snapshot URL and timestamp"""
        if not self.db_conn:
            return

        try:
            with self.db_conn.cursor() as cursor:
                cursor.execute("""
                    UPDATE inputs
                    SET snapshot_url = %s,
                        last_snapshot_at = NOW()
                    WHERE input_id = %s
                """, (snapshot_path, input_id))
                self.db_conn.commit()
                logger.debug(f"Updated snapshot for input {input_id}")
        except Exception as e:
            logger.error(f"Error updating snapshot in database: {e}")
            self.db_conn.rollback()

    def monitor_channel(self, channel_id: str):
        """Monitor single channel"""
        try:
            # 1. Get master playlist
            master_url = f"{self.config.packager_url}/live/{channel_id}/master.m3u8"
            resp = requests.get(master_url, timeout=10)
            resp.raise_for_status()
            
            master = m3u8.loads(resp.text)
            
            # 2. Get ABR ladder info
            abr_info = self._extract_abr_ladder(channel_id, master)
            self._push_abr_ladder_metrics(abr_info)
            
            # 3. Validate each rendition
            for variant in master.variants:
                rung_id = self._extract_rung_id(variant.uri)
                self._monitor_rendition(channel_id, rung_id, variant)
        
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error monitoring {channel_id}: {e}")
            self._push_channel_error(channel_id, f"Network error: {str(e)}")
        except Exception as e:
            logger.error(f"Error monitoring {channel_id}: {e}", exc_info=True)
            self._push_channel_error(channel_id, f"Parsing error: {str(e)}")
    
    def _monitor_rendition(self, channel_id: str, rung_id: str, variant):
        """Monitor single rendition (quality rung)"""
        try:
            # Get variant playlist
            playlist_url = f"{self.config.packager_url}{variant.uri}"
            resp = requests.get(playlist_url, timeout=10)
            resp.raise_for_status()
            
            playlist = m3u8.loads(resp.text)
            
            # Validate playlist structure
            validation = self._validate_playlist(channel_id, rung_id, playlist)
            self._push_playlist_validation(validation)
            
            if not validation.is_valid:
                logger.warning(
                    f"Playlist validation failed for {channel_id}/{rung_id}: "
                    f"{validation.errors}"
                )
                return
            
            # Sample latest segments
            self._sample_segments(channel_id, rung_id, playlist, variant)
        
        except Exception as e:
            logger.error(f"Error monitoring rendition {channel_id}/{rung_id}: {e}")
    
    def _validate_playlist(self, channel_id: str, rung_id: str, playlist) -> PlaylistValidation:
        """Validate playlist structure"""
        errors = []
        
        # Check minimum segments
        if len(playlist.segments) < self.config.min_playlist_segments:
            errors.append(
                f"Too few segments: {len(playlist.segments)} < "
                f"{self.config.min_playlist_segments}"
            )
        
        # Check target duration
        if playlist.target_duration:
            tolerance = self.config.segment_duration_tolerance * self.config.segment_duration_target
            if abs(playlist.target_duration - self.config.segment_duration_target) > tolerance:
                errors.append(
                    f"Target duration mismatch: {playlist.target_duration} "
                    f"(expected ~{self.config.segment_duration_target})"
                )
        
        # Check segment durations
        duration_variance = []
        for seg in playlist.segments:
            if seg.duration:
                duration_variance.append(seg.duration)
        
        if duration_variance:
            avg_duration = sum(duration_variance) / len(duration_variance)
            tolerance = self.config.segment_duration_tolerance * self.config.segment_duration_target
            if abs(avg_duration - self.config.segment_duration_target) > tolerance:
                errors.append(
                    f"Avg segment duration off: {avg_duration:.2f}s "
                    f"(expected {self.config.segment_duration_target}s)"
                )
        
        # Check for discontinuity
        if playlist.is_discontinuity:
            logger.warning(f"DISCONTINUITY detected in {channel_id}/{rung_id}")
        
        is_valid = len(errors) == 0
        
        return PlaylistValidation(
            channel_id=channel_id,
            rung_id=rung_id,
            is_valid=is_valid,
            duration=avg_duration if duration_variance else 0,
            segment_count=len(playlist.segments),
            errors=errors,
            last_updated=datetime.utcnow()
        )
    
    def _sample_segments(self, channel_id: str, rung_id: str, playlist, variant):
        """Download and validate latest segments"""
        if not playlist.segments:
            return
        
        # Sample latest 2 segments
        for seg in playlist.segments[-2:]:
            try:
                seg_url = f"{self.config.packager_url}{variant.uri.rsplit('/', 1)[0]}/{seg.uri}"
                
                # Measure download time
                start_time = time.time()
                resp = requests.get(seg_url, timeout=10)
                download_time = (time.time() - start_time) * 1000  # ms
                
                resp.raise_for_status()
                
                content = resp.content
                content_hash = hashlib.md5(content).hexdigest()
                
                # Extract segment number
                seg_number = int(seg.uri.split('-')[-1].split('.')[0])
                
                metric = SegmentMetric(
                    channel_id=channel_id,
                    rung_id=rung_id,
                    segment_number=seg_number,
                    duration=seg.duration or 0,
                    size_bytes=len(content),
                    download_time_ms=download_time,
                    http_status=resp.status_code,
                    content_hash=content_hash,
                    timestamp=datetime.utcnow()
                )
                
                # Validate segment
                self._validate_segment(metric)
                
                # Push metric
                self._push_segment_metric(metric)
            
            except Exception as e:
                logger.error(f"Error sampling segment {seg.uri}: {e}")
    
    def _validate_segment(self, metric: SegmentMetric):
        """Validate segment properties"""
        if metric.size_bytes < self.config.min_segment_size:
            logger.warning(
                f"Segment {metric.channel_id}/{metric.segment_number} too small: "
                f"{metric.size_bytes} bytes"
            )
        
        if metric.download_time_ms > self.config.max_download_time * 1000:
            logger.warning(
                f"Segment {metric.channel_id}/{metric.segment_number} download slow: "
                f"{metric.download_time_ms:.0f}ms"
            )
        
        if metric.http_status != 200:
            logger.error(
                f"Segment {metric.channel_id}/{metric.segment_number} HTTP error: "
                f"{metric.http_status}"
            )
    
    def _extract_abr_ladder(self, channel_id: str, master) -> ABRLadderInfo:
        """Extract ABR ladder information"""
        rungs = []
        bitrates = []
        
        for variant in master.variants:
            rung_id = self._extract_rung_id(variant.uri)
            bitrate = variant.stream_info.bandwidth / 1000 if variant.stream_info.bandwidth else 0
            resolution = variant.stream_info.resolution or "unknown"
            
            rungs.append({
                'name': rung_id,
                'bitrate_kbps': bitrate,
                'resolution': resolution,
                'uri': variant.uri
            })
            
            bitrates.append(bitrate)
        
        return ABRLadderInfo(
            channel_id=channel_id,
            rungs=rungs,
            min_bitrate_kbps=min(bitrates) if bitrates else 0,
            max_bitrate_kbps=max(bitrates) if bitrates else 0,
            rung_count=len(rungs)
        )
    
    @staticmethod
    def _extract_rung_id(uri: str) -> str:
        """Extract rung ID from playlist URI"""
        # Example: /live/CH_001/CH_001_HD_5M.m3u8 → CH_001_HD_5M
        return uri.split('/')[-1].replace('.m3u8', '')
    
    # ========================================================================
    # METRICS PUSH (InfluxDB)
    # ========================================================================
    
    def _push_segment_metric(self, metric: SegmentMetric):
        """Push segment metric to InfluxDB"""
        try:
            point = Point("segment_metric") \
                .tag("channel", metric.channel_id) \
                .tag("rung", metric.rung_id) \
                .field("segment_number", metric.segment_number) \
                .field("duration_sec", metric.duration) \
                .field("size_bytes", metric.size_bytes) \
                .field("download_time_ms", metric.download_time_ms) \
                .field("http_status", metric.http_status) \
                .time(metric.timestamp)
            
            self.write_api.write(
                bucket=self.config.influxdb_bucket,
                org=self.config.influxdb_org,
                record=point
            )
        except Exception as e:
            logger.error(f"Error pushing segment metric: {e}")
    
    def _push_playlist_validation(self, validation: PlaylistValidation):
        """Push playlist validation result"""
        try:
            point = Point("playlist_validation") \
                .tag("channel", validation.channel_id) \
                .tag("rung", validation.rung_id) \
                .field("is_valid", int(validation.is_valid)) \
                .field("duration_sec", validation.duration) \
                .field("segment_count", validation.segment_count) \
                .field("error_count", len(validation.errors)) \
                .time(validation.last_updated)
            
            self.write_api.write(
                bucket=self.config.influxdb_bucket,
                org=self.config.influxdb_org,
                record=point
            )
        except Exception as e:
            logger.error(f"Error pushing playlist validation: {e}")
    
    def _push_abr_ladder_metrics(self, abr_info: ABRLadderInfo):
        """Push ABR ladder metrics"""
        try:
            point = Point("abr_ladder") \
                .tag("channel", abr_info.channel_id) \
                .field("rung_count", abr_info.rung_count) \
                .field("min_bitrate_kbps", abr_info.min_bitrate_kbps) \
                .field("max_bitrate_kbps", abr_info.max_bitrate_kbps) \
                .time(datetime.utcnow())
            
            self.write_api.write(
                bucket=self.config.influxdb_bucket,
                org=self.config.influxdb_org,
                record=point
            )
        except Exception as e:
            logger.error(f"Error pushing ABR ladder metrics: {e}")
    
    def _push_channel_error(self, channel_id: str, error_msg: str):
        """Push channel error"""
        try:
            point = Point("channel_error") \
                .tag("channel", channel_id) \
                .field("error_message", error_msg) \
                .time(datetime.utcnow())

            self.write_api.write(
                bucket=self.config.influxdb_bucket,
                org=self.config.influxdb_org,
                record=point
            )
        except Exception as e:
            logger.error(f"Error pushing channel error: {e}")

    def _push_udp_probe_metric(self, metric: UDPProbeMetric):
        """Push UDP probe metric to InfluxDB"""
        try:
            point = Point("udp_probe_metric") \
                .tag("input_id", str(metric.input_id)) \
                .tag("input_name", metric.input_name) \
                .field("packets_received", metric.packets_received) \
                .field("bytes_received", metric.bytes_received) \
                .field("duration_sec", metric.duration_sec) \
                .field("bitrate_mbps", metric.bitrate_mbps) \
                .field("is_valid", int(metric.is_valid)) \
                .field("error_count", len(metric.errors)) \
                .time(metric.timestamp)

            self.write_api.write(
                bucket=self.config.influxdb_bucket,
                org=self.config.influxdb_org,
                record=point
            )

            logger.debug(f"Pushed UDP probe metric for {metric.input_name}: {metric.bitrate_mbps:.2f} Mbps")

        except Exception as e:
            logger.error(f"Error pushing UDP probe metric: {e}")

# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    monitor = PackagerMonitor(config)
    monitor.run()
