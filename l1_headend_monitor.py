#!/usr/bin/env python3
"""
Inspector - L1 Headend/Encoder Monitor
Monitors MPEG-TS streams for TR 101 290, HDR, Atmos, and Audio Loudness
"""

import subprocess
import json
import logging
from dataclasses import dataclass
from typing import List, Dict, Optional
import re
import struct
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class TR101290Metrics:
    """TR 101 290 Priority 1, 2, 3 metrics"""
    # Priority 1 (Must fix immediately)
    ts_sync_loss: int = 0
    sync_byte_error: int = 0
    pat_error: int = 0
    continuity_count_error: int = 0
    pmt_error: int = 0
    pid_error: int = 0

    # Priority 2 (Should fix soon)
    transport_error: int = 0
    crc_error: int = 0
    pcr_error: int = 0
    pcr_repetition_error: int = 0
    pcr_discontinuity: int = 0
    pcr_accuracy_error: int = 0
    pts_error: int = 0
    cat_error: int = 0

    # Priority 3 (Monitor)
    nit_error: int = 0
    si_repetition_error: int = 0
    unreferenced_pid: int = 0
    sdt_error: int = 0
    eit_error: int = 0
    rst_error: int = 0
    tdt_error: int = 0

    is_valid: bool = True
    errors: List[str] = None
    timestamp: datetime = None

    def __post_init__(self):
        if self.errors is None:
            self.errors = []
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()


@dataclass
class HDRMetrics:
    """HDR metadata validation"""
    has_hdr: bool = False
    transfer_characteristics: Optional[str] = None  # PQ (SMPTE 2084) or HLG
    color_primaries: Optional[str] = None  # BT.2020
    matrix_coefficients: Optional[str] = None
    mastering_display_metadata: Optional[Dict] = None
    content_light_level: Optional[Dict] = None
    is_valid: bool = True
    errors: List[str] = None

    def __post_init__(self):
        if self.errors is None:
            self.errors = []


@dataclass
class AtmosMetrics:
    """Dolby Atmos audio validation"""
    has_atmos: bool = False
    codec: Optional[str] = None  # E-AC-3 with JOC
    channel_layout: Optional[str] = None
    bed_channels: int = 0
    object_count: int = 0
    sample_rate: int = 0
    bitrate: int = 0
    is_valid: bool = True
    errors: List[str] = None

    def __post_init__(self):
        if self.errors is None:
            self.errors = []


@dataclass
class LoudnessMetrics:
    """Audio loudness (EBU R128 / ATSC A/85)"""
    integrated_loudness: Optional[float] = None  # LUFS
    loudness_range: Optional[float] = None  # LU
    true_peak: Optional[float] = None  # dBTP
    target_loudness: float = -23.0  # LUFS (EBU R128 standard)
    tolerance: float = 2.0  # LUFS
    is_compliant: bool = True
    errors: List[str] = None

    def __post_init__(self):
        if self.errors is None:
            self.errors = []


class L1HeadendMonitor:
    """Monitor encoder outputs for TR 101 290, HDR, Atmos, Loudness"""

    def __init__(self):
        self.ffmpeg_path = self._find_ffmpeg()
        self.ffprobe_path = self._find_ffprobe()
        self.tsanalyze_available = self._check_tsanalyze()

    def _find_ffmpeg(self) -> str:
        """Find ffmpeg binary"""
        try:
            result = subprocess.run(['which', 'ffmpeg'], capture_output=True, text=True)
            if result.returncode == 0:
                return result.stdout.strip()
        except Exception as e:
            logger.warning(f"ffmpeg not found: {e}")
        return 'ffmpeg'

    def _find_ffprobe(self) -> str:
        """Find ffprobe binary"""
        try:
            result = subprocess.run(['which', 'ffprobe'], capture_output=True, text=True)
            if result.returncode == 0:
                return result.stdout.strip()
        except Exception as e:
            logger.warning(f"ffprobe not found: {e}")
        return 'ffprobe'

    def _check_tsanalyze(self) -> bool:
        """Check if TSAnalyze or similar tool is available"""
        try:
            result = subprocess.run(['which', 'tsanalyze'], capture_output=True, text=True)
            return result.returncode == 0
        except:
            return False

    def analyze_input(self, input_url: str, duration: int = 10) -> Dict:
        """
        Comprehensive analysis of encoder output

        Args:
            input_url: UDP/SRT/RTMP URL
            duration: Analysis duration in seconds

        Returns:
            Dict with all metrics
        """
        logger.info(f"Starting L1 analysis for {input_url}")

        results = {
            'input_url': input_url,
            'timestamp': datetime.utcnow().isoformat(),
            'tr101290': None,
            'hdr': None,
            'atmos': None,
            'loudness': None,
            'stream_info': None
        }

        try:
            # Get stream info first
            results['stream_info'] = self._analyze_stream_info(input_url)

            # TR 101 290 analysis
            results['tr101290'] = self._analyze_tr101290(input_url, duration)

            # HDR metadata analysis
            results['hdr'] = self._analyze_hdr(input_url, duration)

            # Dolby Atmos analysis
            results['atmos'] = self._analyze_atmos(input_url, results['stream_info'])

            # Audio loudness analysis
            results['loudness'] = self._analyze_loudness(input_url, duration)

        except Exception as e:
            logger.error(f"Error analyzing {input_url}: {e}", exc_info=True)
            results['error'] = str(e)

        return results

    def _analyze_stream_info(self, input_url: str) -> Dict:
        """Get basic stream information using ffprobe"""
        try:
            cmd = [
                self.ffprobe_path,
                '-v', 'quiet',
                '-print_format', 'json',
                '-show_format',
                '-show_streams',
                '-i', input_url
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=10
            )

            if result.returncode == 0:
                return json.loads(result.stdout)
            else:
                logger.error(f"ffprobe error: {result.stderr}")
                return {}

        except Exception as e:
            logger.error(f"Error getting stream info: {e}")
            return {}

    def _analyze_tr101290(self, input_url: str, duration: int) -> TR101290Metrics:
        """
        Analyze MPEG-TS for TR 101 290 compliance
        Uses ffmpeg's mpegts analyzer
        """
        metrics = TR101290Metrics()

        try:
            # Use ffmpeg to analyze TS stream
            cmd = [
                self.ffmpeg_path,
                '-v', 'verbose',
                '-i', input_url,
                '-t', str(duration),
                '-f', 'null',
                '-'
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=duration + 5
            )

            stderr = result.stderr

            # Parse ffmpeg output for errors
            # Priority 1 errors
            if 'TS sync loss' in stderr or 'invalid sync byte' in stderr:
                metrics.sync_byte_error += stderr.count('invalid sync byte')
                metrics.errors.append('Sync byte errors detected')
                metrics.is_valid = False

            if 'PAT not found' in stderr or 'PAT error' in stderr:
                metrics.pat_error += 1
                metrics.errors.append('PAT (Program Association Table) error')
                metrics.is_valid = False

            if 'PMT not found' in stderr or 'PMT error' in stderr:
                metrics.pmt_error += 1
                metrics.errors.append('PMT (Program Map Table) error')
                metrics.is_valid = False

            if 'continuity check failed' in stderr:
                metrics.continuity_count_error = len(re.findall(r'continuity check failed', stderr))
                if metrics.continuity_count_error > 0:
                    metrics.errors.append(f'Continuity counter errors: {metrics.continuity_count_error}')
                    metrics.is_valid = False

            # Priority 2 errors
            if 'CRC mismatch' in stderr or 'CRC error' in stderr:
                metrics.crc_error += stderr.count('CRC')
                if metrics.crc_error > 0:
                    metrics.errors.append(f'CRC errors: {metrics.crc_error}')

            if 'PCR' in stderr and ('discontinuity' in stderr or 'error' in stderr):
                metrics.pcr_error += 1
                metrics.errors.append('PCR (Program Clock Reference) errors detected')

            # Transport errors
            if 'transport_error' in stderr or 'Transport Error Indicator' in stderr:
                metrics.transport_error += 1
                metrics.errors.append('Transport error indicator set')
                metrics.is_valid = False

            logger.info(f"TR 101 290 analysis: valid={metrics.is_valid}, errors={len(metrics.errors)}")

        except subprocess.TimeoutExpired:
            logger.error(f"TR 101 290 analysis timeout for {input_url}")
            metrics.errors.append('Analysis timeout')
            metrics.is_valid = False
        except Exception as e:
            logger.error(f"TR 101 290 analysis error: {e}")
            metrics.errors.append(f'Analysis error: {str(e)}')
            metrics.is_valid = False

        return metrics

    def _analyze_hdr(self, input_url: str, duration: int) -> HDRMetrics:
        """Analyze HDR metadata"""
        metrics = HDRMetrics()

        try:
            # Get detailed video stream info
            cmd = [
                self.ffprobe_path,
                '-v', 'quiet',
                '-select_streams', 'v:0',
                '-show_entries', 'stream=color_transfer,color_primaries,color_space',
                '-show_entries', 'stream_side_data',
                '-of', 'json',
                '-i', input_url
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=10
            )

            if result.returncode == 0:
                data = json.loads(result.stdout)

                if 'streams' in data and len(data['streams']) > 0:
                    stream = data['streams'][0]

                    # Check transfer characteristics
                    transfer = stream.get('color_transfer', '')
                    if 'smpte2084' in transfer.lower() or 'pq' in transfer.lower():
                        metrics.has_hdr = True
                        metrics.transfer_characteristics = 'PQ (SMPTE 2084)'
                    elif 'arib-std-b67' in transfer.lower() or 'hlg' in transfer.lower():
                        metrics.has_hdr = True
                        metrics.transfer_characteristics = 'HLG'

                    # Check color primaries
                    primaries = stream.get('color_primaries', '')
                    if 'bt2020' in primaries.lower():
                        metrics.color_primaries = 'BT.2020'

                    # Check color space
                    metrics.matrix_coefficients = stream.get('color_space', '')

                    # Check side data for mastering display metadata
                    if 'side_data_list' in stream:
                        for side_data in stream['side_data_list']:
                            if side_data.get('side_data_type') == 'Mastering display metadata':
                                metrics.mastering_display_metadata = side_data
                            elif side_data.get('side_data_type') == 'Content light level metadata':
                                metrics.content_light_level = side_data

                    # Validation
                    if metrics.has_hdr:
                        if not metrics.color_primaries or 'bt2020' not in metrics.color_primaries.lower():
                            metrics.errors.append('HDR detected but color primaries not BT.2020')
                            metrics.is_valid = False

                        if not metrics.mastering_display_metadata:
                            metrics.errors.append('HDR detected but missing mastering display metadata')
                            metrics.is_valid = False

                    logger.info(f"HDR analysis: has_hdr={metrics.has_hdr}, valid={metrics.is_valid}")

        except Exception as e:
            logger.error(f"HDR analysis error: {e}")
            metrics.errors.append(f'Analysis error: {str(e)}')
            metrics.is_valid = False

        return metrics

    def _analyze_atmos(self, input_url: str, stream_info: Dict) -> AtmosMetrics:
        """Analyze Dolby Atmos audio"""
        metrics = AtmosMetrics()

        try:
            if not stream_info or 'streams' not in stream_info:
                return metrics

            # Find audio streams
            for stream in stream_info['streams']:
                if stream.get('codec_type') != 'audio':
                    continue

                codec_name = stream.get('codec_name', '').lower()
                codec_long = stream.get('codec_long_name', '').lower()

                # Check for Dolby Atmos (E-AC-3 with JOC)
                if 'eac3' in codec_name or 'e-ac-3' in codec_long:
                    # Check for Atmos/JOC in stream
                    # This is a simplified check - production would need more detailed analysis
                    channel_layout = stream.get('channel_layout', '')
                    channels = stream.get('channels', 0)

                    if channels >= 6:  # At least 5.1
                        metrics.has_atmos = True
                        metrics.codec = stream.get('codec_long_name', 'E-AC-3')
                        metrics.channel_layout = channel_layout
                        metrics.bed_channels = channels
                        metrics.sample_rate = int(stream.get('sample_rate', 0))
                        metrics.bitrate = int(stream.get('bit_rate', 0))

                        logger.info(f"Atmos detected: {channels} channels, {metrics.sample_rate}Hz")
                        break

            if metrics.has_atmos:
                # Validate Atmos requirements
                if metrics.sample_rate not in [48000]:
                    metrics.errors.append(f'Invalid sample rate for Atmos: {metrics.sample_rate}Hz (should be 48kHz)')
                    metrics.is_valid = False

                if metrics.bitrate < 384000:  # 384 kbps minimum for Atmos
                    metrics.errors.append(f'Low bitrate for Atmos: {metrics.bitrate/1000}kbps')
                    metrics.is_valid = False

        except Exception as e:
            logger.error(f"Atmos analysis error: {e}")
            metrics.errors.append(f'Analysis error: {str(e)}')
            metrics.is_valid = False

        return metrics

    def _analyze_loudness(self, input_url: str, duration: int) -> LoudnessMetrics:
        """Analyze audio loudness (EBU R128)"""
        metrics = LoudnessMetrics()

        try:
            # Use ffmpeg loudnorm filter to measure loudness
            cmd = [
                self.ffmpeg_path,
                '-i', input_url,
                '-t', str(duration),
                '-af', 'loudnorm=print_format=json',
                '-f', 'null',
                '-'
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=duration + 10
            )

            # Parse JSON output from loudnorm filter
            stderr = result.stderr

            # Find JSON block in output
            json_match = re.search(r'\{[^{}]*"input_i"[^{}]*\}', stderr)
            if json_match:
                loudness_data = json.loads(json_match.group(0))

                metrics.integrated_loudness = float(loudness_data.get('input_i', 0))
                metrics.loudness_range = float(loudness_data.get('input_lra', 0))
                metrics.true_peak = float(loudness_data.get('input_tp', 0))

                # Check compliance with EBU R128 (-23 LUFS ±2)
                if abs(metrics.integrated_loudness - metrics.target_loudness) > metrics.tolerance:
                    metrics.is_compliant = False
                    metrics.errors.append(
                        f'Loudness out of range: {metrics.integrated_loudness:.1f} LUFS '
                        f'(target: {metrics.target_loudness} ±{metrics.tolerance} LUFS)'
                    )

                # Check true peak (should be < -1 dBTP to avoid clipping)
                if metrics.true_peak > -1.0:
                    metrics.is_compliant = False
                    metrics.errors.append(
                        f'True peak too high: {metrics.true_peak:.1f} dBTP (should be < -1.0 dBTP)'
                    )

                logger.info(
                    f"Loudness analysis: {metrics.integrated_loudness:.1f} LUFS, "
                    f"LRA: {metrics.loudness_range:.1f} LU, "
                    f"True Peak: {metrics.true_peak:.1f} dBTP"
                )
            else:
                logger.warning("Could not parse loudness data from ffmpeg output")
                metrics.errors.append('Failed to parse loudness data')
                metrics.is_compliant = False

        except subprocess.TimeoutExpired:
            logger.error(f"Loudness analysis timeout for {input_url}")
            metrics.errors.append('Analysis timeout')
            metrics.is_compliant = False
        except Exception as e:
            logger.error(f"Loudness analysis error: {e}")
            metrics.errors.append(f'Analysis error: {str(e)}')
            metrics.is_compliant = False

        return metrics


# Example usage
if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)

    monitor = L1HeadendMonitor()

    # Test with sample input
    test_url = "udp://225.3.3.42:30130"
    results = monitor.analyze_input(test_url, duration=10)

    print("\n=== L1 Headend Analysis Results ===")
    print(json.dumps(results, indent=2, default=str))
