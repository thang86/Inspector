#!/usr/bin/env python3
"""
Inspector - Snapshot Service
Captures video frames from MPEG-TS input streams and extracts detailed metadata
"""

import subprocess
import os
import json
import logging
import time
from datetime import datetime
from typing import Dict, Optional
from pathlib import Path
import requests

# ============================================================================
# CONFIGURATION
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/snapshot-service.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

SNAPSHOT_DIR = os.getenv('SNAPSHOT_DIR', '/var/snapshots')
CMS_API_URL = os.getenv('CMS_API_URL', 'http://cms-api:5000/api/v1')
SNAPSHOT_INTERVAL = int(os.getenv('SNAPSHOT_INTERVAL', '300'))  # 5 minutes
SNAPSHOT_QUALITY = int(os.getenv('SNAPSHOT_QUALITY', '2'))  # FFmpeg quality (1-31, lower is better)

# Create snapshot directory
Path(SNAPSHOT_DIR).mkdir(parents=True, exist_ok=True)

# ============================================================================
# SNAPSHOT CAPTURE
# ============================================================================

def capture_snapshot(input_url: str, input_id: int, timeout: int = 10) -> Optional[str]:
    """
    Capture a single frame from MPEG-TS stream using FFmpeg

    Args:
        input_url: URL of the MPEG-TS stream (udp://, http://, etc.)
        input_id: Database ID of the input
        timeout: Timeout in seconds

    Returns:
        Path to the captured snapshot file, or None if failed
    """
    try:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        snapshot_filename = f"input_{input_id}_{timestamp}.jpg"
        snapshot_path = os.path.join(SNAPSHOT_DIR, snapshot_filename)

        # FFmpeg command to capture one frame
        cmd = [
            'ffmpeg',
            '-y',  # Overwrite output file
            '-i', input_url,
            '-frames:v', '1',  # Capture one frame
            '-q:v', str(SNAPSHOT_QUALITY),  # Quality (1-31)
            '-timeout', str(timeout * 1000000),  # Timeout in microseconds
            snapshot_path
        ]

        logger.info(f"Capturing snapshot for input {input_id} from {input_url}")

        result = subprocess.run(
            cmd,
            capture_output=True,
            timeout=timeout + 5,
            text=True
        )

        if result.returncode == 0 and os.path.exists(snapshot_path):
            logger.info(f"Snapshot captured successfully: {snapshot_path}")
            return snapshot_filename
        else:
            logger.error(f"FFmpeg failed: {result.stderr}")
            return None

    except subprocess.TimeoutExpired:
        logger.error(f"Timeout capturing snapshot for input {input_id}")
        return None
    except Exception as e:
        logger.error(f"Error capturing snapshot for input {input_id}: {e}")
        return None

# ============================================================================
# METADATA EXTRACTION
# ============================================================================

def extract_metadata(input_url: str, timeout: int = 10) -> Optional[Dict]:
    """
    Extract detailed stream metadata using FFprobe

    Args:
        input_url: URL of the MPEG-TS stream
        timeout: Timeout in seconds

    Returns:
        Dictionary containing stream metadata
    """
    try:
        cmd = [
            'ffprobe',
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            '-timeout', str(timeout * 1000000),
            input_url
        ]

        logger.info(f"Extracting metadata from {input_url}")

        result = subprocess.run(
            cmd,
            capture_output=True,
            timeout=timeout + 5,
            text=True
        )

        if result.returncode == 0:
            data = json.loads(result.stdout)

            # Parse metadata
            metadata = {
                'format': {},
                'video_streams': [],
                'audio_streams': [],
                'data_streams': [],
                'analyzed_at': datetime.now().isoformat()
            }

            # Format information
            if 'format' in data:
                fmt = data['format']
                metadata['format'] = {
                    'format_name': fmt.get('format_name', 'unknown'),
                    'format_long_name': fmt.get('format_long_name', 'unknown'),
                    'duration': float(fmt.get('duration', 0)),
                    'size': int(fmt.get('size', 0)),
                    'bit_rate': int(fmt.get('bit_rate', 0)),
                    'probe_score': int(fmt.get('probe_score', 0)),
                    'nb_streams': int(fmt.get('nb_streams', 0))
                }

            # Stream information
            if 'streams' in data:
                for stream in data['streams']:
                    codec_type = stream.get('codec_type', 'unknown')

                    stream_info = {
                        'index': stream.get('index', 0),
                        'codec_name': stream.get('codec_name', 'unknown'),
                        'codec_long_name': stream.get('codec_long_name', 'unknown'),
                        'codec_type': codec_type,
                        'codec_tag_string': stream.get('codec_tag_string', ''),
                        'bit_rate': int(stream.get('bit_rate', 0))
                    }

                    if codec_type == 'video':
                        stream_info.update({
                            'width': stream.get('width', 0),
                            'height': stream.get('height', 0),
                            'coded_width': stream.get('coded_width', 0),
                            'coded_height': stream.get('coded_height', 0),
                            'display_aspect_ratio': stream.get('display_aspect_ratio', 'N/A'),
                            'pix_fmt': stream.get('pix_fmt', 'unknown'),
                            'level': stream.get('level', 0),
                            'profile': stream.get('profile', 'unknown'),
                            'r_frame_rate': stream.get('r_frame_rate', '0/0'),
                            'avg_frame_rate': stream.get('avg_frame_rate', '0/0'),
                            'is_avc': stream.get('is_avc', 'false'),
                            'field_order': stream.get('field_order', 'unknown')
                        })
                        metadata['video_streams'].append(stream_info)

                    elif codec_type == 'audio':
                        stream_info.update({
                            'sample_rate': stream.get('sample_rate', '0'),
                            'channels': stream.get('channels', 0),
                            'channel_layout': stream.get('channel_layout', 'unknown'),
                            'sample_fmt': stream.get('sample_fmt', 'unknown'),
                            'bits_per_sample': stream.get('bits_per_sample', 0)
                        })
                        metadata['audio_streams'].append(stream_info)

                    else:
                        metadata['data_streams'].append(stream_info)

            logger.info(f"Metadata extracted successfully: {len(metadata['video_streams'])} video, "
                       f"{len(metadata['audio_streams'])} audio streams")
            return metadata

        else:
            logger.error(f"FFprobe failed: {result.stderr}")
            return None

    except subprocess.TimeoutExpired:
        logger.error(f"Timeout extracting metadata from {input_url}")
        return None
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse FFprobe output: {e}")
        return None
    except Exception as e:
        logger.error(f"Error extracting metadata: {e}")
        return None

# ============================================================================
# API INTEGRATION
# ============================================================================

def update_input_snapshot(input_id: int, snapshot_filename: str, metadata: Dict = None) -> bool:
    """
    Update probe input with snapshot and metadata via CMS API

    Args:
        input_id: Database ID of the input
        snapshot_filename: Filename of the captured snapshot
        metadata: Optional metadata dictionary

    Returns:
        True if successful, False otherwise
    """
    try:
        url = f"{CMS_API_URL}/probe-inputs/{input_id}/snapshot"

        payload = {
            'snapshot_url': f"/snapshots/{snapshot_filename}",
            'last_snapshot_at': datetime.now().isoformat()
        }

        if metadata:
            payload['metadata'] = metadata

        response = requests.post(url, json=payload, timeout=10)

        if response.status_code == 200:
            logger.info(f"Updated snapshot for input {input_id}")
            return True
        else:
            logger.error(f"Failed to update snapshot: HTTP {response.status_code}")
            return False

    except Exception as e:
        logger.error(f"Error updating snapshot via API: {e}")
        return False

def get_probe_inputs() -> list:
    """
    Fetch all enabled probe inputs from CMS API

    Returns:
        List of probe input dictionaries
    """
    try:
        url = f"{CMS_API_URL}/probe-inputs?enabled=true"
        response = requests.get(url, timeout=10)

        if response.status_code == 200:
            data = response.json()
            return data.get('probe_inputs', [])
        else:
            logger.error(f"Failed to fetch probe inputs: HTTP {response.status_code}")
            return []

    except Exception as e:
        logger.error(f"Error fetching probe inputs: {e}")
        return []

# ============================================================================
# MAIN LOOP
# ============================================================================

def process_input(input_data: Dict):
    """
    Process a single probe input: capture snapshot and extract metadata

    Args:
        input_data: Probe input dictionary from API
    """
    input_id = input_data.get('input_id')
    input_url = input_data.get('input_url')
    input_name = input_data.get('input_name', f'Input {input_id}')

    logger.info(f"Processing {input_name} (ID: {input_id})")

    # Capture snapshot
    snapshot_filename = capture_snapshot(input_url, input_id)

    if snapshot_filename:
        # Extract metadata
        metadata = extract_metadata(input_url)

        # Update via API
        update_input_snapshot(input_id, snapshot_filename, metadata)
    else:
        logger.warning(f"Skipping metadata extraction for {input_name} (snapshot failed)")

def main():
    """
    Main monitoring loop
    """
    logger.info("Starting Snapshot Service")
    logger.info(f"Snapshot directory: {SNAPSHOT_DIR}")
    logger.info(f"Snapshot interval: {SNAPSHOT_INTERVAL} seconds")
    logger.info(f"CMS API URL: {CMS_API_URL}")

    while True:
        try:
            # Fetch enabled probe inputs
            inputs = get_probe_inputs()
            logger.info(f"Found {len(inputs)} enabled probe inputs")

            # Process each input
            for input_data in inputs:
                try:
                    process_input(input_data)
                except Exception as e:
                    logger.error(f"Error processing input {input_data.get('input_id')}: {e}")

                # Small delay between inputs
                time.sleep(2)

            # Wait for next cycle
            logger.info(f"Sleeping for {SNAPSHOT_INTERVAL} seconds...")
            time.sleep(SNAPSHOT_INTERVAL)

        except KeyboardInterrupt:
            logger.info("Shutting down Snapshot Service")
            break
        except Exception as e:
            logger.error(f"Error in main loop: {e}")
            time.sleep(30)  # Wait before retrying

if __name__ == '__main__':
    main()
