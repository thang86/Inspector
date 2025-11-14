#!/usr/bin/env python3
"""
Inspector - CDN Edge Monitoring Service (L3/L4)
Real-time CDN edge performance monitoring, cache hit rate, latency tracking
Pushes metrics to InfluxDB / Prometheus
"""

import requests
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
        logging.FileHandler('/var/log/cdn-monitor.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class CDNConfig:
    cdn_endpoints: List[str] = None
    influxdb_url: str = "http://influxdb:8086"
    influxdb_token: str = "your_influxdb_token"
    influxdb_org: str = "fpt-play"
    influxdb_bucket: str = "cdn_metrics"

    # Sample URLs to test
    test_urls: List[str] = None

    # Thresholds
    max_latency_ms: float = 500.0
    min_cache_hit_rate: float = 0.85  # 85%
    max_error_rate: float = 0.01  # 1%

    # Polling
    poll_interval: int = 60  # seconds
    max_workers: int = 5

    def __post_init__(self):
        if self.cdn_endpoints is None:
            self.cdn_endpoints = [
                "http://cdn-edge-hn.internal",
                "http://cdn-edge-hcm.internal",
                "http://cdn-edge-dn.internal"
            ]

        if self.test_urls is None:
            self.test_urls = [
                "/live/CH_TV_HD_001/master.m3u8",
                "/live/CH_TV_HD_002/master.m3u8"
            ]

config = CDNConfig()

# ============================================================================
# DATA MODELS
# ============================================================================

@dataclass
class CDNMetric:
    endpoint: str
    url: str
    status_code: int
    latency_ms: float
    response_size_bytes: int
    cache_status: str  # HIT, MISS, BYPASS
    ttfb_ms: float  # Time to first byte
    timestamp: datetime
    error_message: Optional[str] = None

@dataclass
class CDNHealthCheck:
    endpoint: str
    is_healthy: bool
    total_requests: int
    successful_requests: int
    cache_hits: int
    cache_misses: int
    avg_latency_ms: float
    error_rate: float
    timestamp: datetime

# ============================================================================
# CDN MONITOR SERVICE
# ============================================================================

class CDNMonitor:
    def __init__(self, config: CDNConfig):
        self.config = config
        self.influx_client = InfluxDBClient(
            url=config.influxdb_url,
            token=config.influxdb_token,
            org=config.influxdb_org
        )
        self.write_api = self.influx_client.write_api(write_options=SYNCHRONOUS)
        self.executor = ThreadPoolExecutor(max_workers=config.max_workers)
        self.health_stats = {}

    def run(self):
        """Main monitoring loop"""
        logger.info("Starting CDN Monitor Service")

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
        logger.info(f"Starting CDN monitor cycle for {len(self.config.cdn_endpoints)} endpoints")

        futures = {}
        for endpoint in self.config.cdn_endpoints:
            future = self.executor.submit(self.monitor_endpoint, endpoint)
            futures[future] = endpoint

        for future in futures:
            try:
                future.result(timeout=60)
            except Exception as e:
                logger.error(f"Error monitoring {futures[future]}: {e}")

    def monitor_endpoint(self, endpoint: str):
        """Monitor single CDN endpoint"""
        try:
            metrics = []

            # Test each URL
            for test_url in self.config.test_urls:
                full_url = f"{endpoint}{test_url}"
                metric = self._test_url(endpoint, full_url)
                metrics.append(metric)

                # Push metric
                self._push_cdn_metric(metric)

            # Calculate health stats
            health = self._calculate_health(endpoint, metrics)
            self._push_health_check(health)

            # Check thresholds
            self._check_thresholds(health)

        except Exception as e:
            logger.error(f"Error monitoring endpoint {endpoint}: {e}", exc_info=True)

    def _test_url(self, endpoint: str, url: str) -> CDNMetric:
        """Test single URL and collect metrics"""
        try:
            # Measure request timing
            start_time = time.time()

            response = requests.get(
                url,
                timeout=10,
                headers={'User-Agent': 'Inspector-CDN-Monitor/1.0'}
            )

            latency_ms = (time.time() - start_time) * 1000

            # Extract cache status from headers
            cache_status = response.headers.get('X-Cache', 'UNKNOWN')

            # Time to first byte (approximate)
            ttfb_ms = latency_ms  # Simplified

            return CDNMetric(
                endpoint=endpoint,
                url=url,
                status_code=response.status_code,
                latency_ms=latency_ms,
                response_size_bytes=len(response.content),
                cache_status=cache_status,
                ttfb_ms=ttfb_ms,
                timestamp=datetime.utcnow(),
                error_message=None if response.status_code < 400 else f"HTTP {response.status_code}"
            )

        except requests.exceptions.Timeout:
            return CDNMetric(
                endpoint=endpoint,
                url=url,
                status_code=0,
                latency_ms=10000.0,
                response_size_bytes=0,
                cache_status='ERROR',
                ttfb_ms=10000.0,
                timestamp=datetime.utcnow(),
                error_message="Timeout"
            )

        except Exception as e:
            logger.error(f"Error testing {url}: {e}")
            return CDNMetric(
                endpoint=endpoint,
                url=url,
                status_code=0,
                latency_ms=0,
                response_size_bytes=0,
                cache_status='ERROR',
                ttfb_ms=0,
                timestamp=datetime.utcnow(),
                error_message=str(e)
            )

    def _calculate_health(self, endpoint: str, metrics: List[CDNMetric]) -> CDNHealthCheck:
        """Calculate health metrics for endpoint"""
        total_requests = len(metrics)
        successful_requests = sum(1 for m in metrics if m.status_code == 200)
        cache_hits = sum(1 for m in metrics if 'HIT' in m.cache_status.upper())
        cache_misses = sum(1 for m in metrics if 'MISS' in m.cache_status.upper())

        avg_latency = sum(m.latency_ms for m in metrics) / total_requests if total_requests > 0 else 0
        error_rate = (total_requests - successful_requests) / total_requests if total_requests > 0 else 0

        is_healthy = (
            avg_latency < self.config.max_latency_ms and
            error_rate < self.config.max_error_rate and
            successful_requests > 0
        )

        return CDNHealthCheck(
            endpoint=endpoint,
            is_healthy=is_healthy,
            total_requests=total_requests,
            successful_requests=successful_requests,
            cache_hits=cache_hits,
            cache_misses=cache_misses,
            avg_latency_ms=avg_latency,
            error_rate=error_rate,
            timestamp=datetime.utcnow()
        )

    def _check_thresholds(self, health: CDNHealthCheck):
        """Check if thresholds are violated"""
        if not health.is_healthy:
            logger.warning(f"CDN endpoint unhealthy: {health.endpoint}")

        if health.avg_latency_ms > self.config.max_latency_ms:
            logger.warning(
                f"High latency on {health.endpoint}: {health.avg_latency_ms:.0f}ms "
                f"(threshold: {self.config.max_latency_ms}ms)"
            )

        if health.error_rate > self.config.max_error_rate:
            logger.warning(
                f"High error rate on {health.endpoint}: {health.error_rate*100:.1f}% "
                f"(threshold: {self.config.max_error_rate*100:.1f}%)"
            )

        cache_hit_rate = health.cache_hits / health.total_requests if health.total_requests > 0 else 0
        if cache_hit_rate < self.config.min_cache_hit_rate:
            logger.warning(
                f"Low cache hit rate on {health.endpoint}: {cache_hit_rate*100:.1f}% "
                f"(threshold: {self.config.min_cache_hit_rate*100:.1f}%)"
            )

    # ========================================================================
    # METRICS PUSH (InfluxDB)
    # ========================================================================

    def _push_cdn_metric(self, metric: CDNMetric):
        """Push CDN metric to InfluxDB"""
        try:
            point = Point("cdn_request") \
                .tag("endpoint", metric.endpoint) \
                .tag("url", metric.url) \
                .tag("cache_status", metric.cache_status) \
                .field("status_code", metric.status_code) \
                .field("latency_ms", metric.latency_ms) \
                .field("response_size_bytes", metric.response_size_bytes) \
                .field("ttfb_ms", metric.ttfb_ms) \
                .time(metric.timestamp)

            self.write_api.write(
                bucket=self.config.influxdb_bucket,
                org=self.config.influxdb_org,
                record=point
            )
        except Exception as e:
            logger.error(f"Error pushing CDN metric: {e}")

    def _push_health_check(self, health: CDNHealthCheck):
        """Push health check result"""
        try:
            cache_hit_rate = health.cache_hits / health.total_requests if health.total_requests > 0 else 0

            point = Point("cdn_health") \
                .tag("endpoint", health.endpoint) \
                .field("is_healthy", int(health.is_healthy)) \
                .field("total_requests", health.total_requests) \
                .field("successful_requests", health.successful_requests) \
                .field("cache_hits", health.cache_hits) \
                .field("cache_misses", health.cache_misses) \
                .field("cache_hit_rate", cache_hit_rate) \
                .field("avg_latency_ms", health.avg_latency_ms) \
                .field("error_rate", health.error_rate) \
                .time(health.timestamp)

            self.write_api.write(
                bucket=self.config.influxdb_bucket,
                org=self.config.influxdb_org,
                record=point
            )
        except Exception as e:
            logger.error(f"Error pushing health check: {e}")

# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    # Load config from environment
    config = CDNConfig(
        cdn_endpoints=os.getenv('CDN_ENDPOINTS', '').split(',') if os.getenv('CDN_ENDPOINTS') else None,
        influxdb_url=os.getenv('INFLUXDB_URL', 'http://influxdb:8086'),
        influxdb_token=os.getenv('INFLUXDB_TOKEN', 'your_influxdb_token'),
        influxdb_org=os.getenv('INFLUXDB_ORG', 'fpt-play'),
        influxdb_bucket=os.getenv('INFLUXDB_BUCKET', 'cdn_metrics'),
        poll_interval=int(os.getenv('POLL_INTERVAL', '60'))
    )

    monitor = CDNMonitor(config)
    monitor.run()
