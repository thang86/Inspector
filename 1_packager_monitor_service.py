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
import subprocess
import sys

# Try to import L1 Headend Monitor
sys.path.append('/opt/Inspector')
try:
    from l1_headend_monitor import L1HeadendMonitor
    L1_MONITOR_AVAILABLE = True
except ImportError:
    L1_MONITOR_AVAILABLE = False

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
    
    # Channels to monitor
    channels: List[str] = None
    
    # Thresholds
    segment_duration_target: float = 6.0
    segment_duration_tolerance: float = 0.1  # 10%
    min_segment_size: int = 50000  # 50KB
    max_download_time: float = 2.0  # 2 seconds
    min_playlist_segments: int = 3
    
    # Polling
    poll_interval: int = 30  # seconds
    max_workers: int = 10
    
    def __post_init__(self):
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
        self.l1_monitor = L1HeadendMonitor() if L1_MONITOR_AVAILABLE else None
        self.last_l1_analysis = {}  # Track last L1 analysis time per input
    
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
    
    def monitor_cycle(self):
        """Single monitoring cycle"""
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

# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    monitor = PackagerMonitor(config)
    monitor.run()
