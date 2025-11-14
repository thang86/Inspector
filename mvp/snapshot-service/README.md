# Inspector - Snapshot Service

Automated video frame capture and metadata extraction from MPEG-TS input streams.

## Features

- **Automatic Snapshot Capture**: Periodically captures video frames from live MPEG-TS streams
- **Metadata Extraction**: Extracts detailed codec, resolution, bitrate, and stream information using FFprobe
- **Multi-Protocol Support**: Works with UDP multicast/unicast, HTTP, RTP, SRT, and RTMP streams
- **API Integration**: Automatically updates probe inputs via CMS API
- **Configurable Quality**: Adjustable JPEG quality for snapshots
- **Error Handling**: Robust error handling with logging

## How It Works

1. **Fetch Probe Inputs**: Queries CMS API for all enabled probe inputs
2. **Capture Snapshot**: Uses FFmpeg to extract a single frame from each stream
3. **Extract Metadata**: Uses FFprobe to analyze stream properties (codec, resolution, bitrate, etc.)
4. **Update Database**: Sends snapshot URL and metadata back to CMS API
5. **Repeat**: Waits for configured interval and repeats the process

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `SNAPSHOT_DIR` | `/var/snapshots` | Directory to store snapshot images |
| `CMS_API_URL` | `http://cms-api:5000/api/v1` | CMS API base URL |
| `SNAPSHOT_INTERVAL` | `300` | Interval between snapshot captures (seconds) |
| `SNAPSHOT_QUALITY` | `2` | JPEG quality (1-31, lower is better) |

## Snapshot Output

Snapshots are saved as:
```
/var/snapshots/input_{input_id}_{timestamp}.jpg
```

Example: `input_123_20250114_143025.jpg`

## Metadata Structure

Extracted metadata includes:

```json
{
  "format": {
    "format_name": "mpegts",
    "format_long_name": "MPEG-TS (MPEG-2 Transport Stream)",
    "bit_rate": 10000000,
    "nb_streams": 2
  },
  "video_streams": [{
    "codec_name": "h264",
    "codec_long_name": "H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10",
    "width": 1920,
    "height": 1080,
    "r_frame_rate": "25/1",
    "pix_fmt": "yuv420p",
    "profile": "High",
    "bit_rate": 8000000
  }],
  "audio_streams": [{
    "codec_name": "aac",
    "codec_long_name": "AAC (Advanced Audio Coding)",
    "sample_rate": "48000",
    "channels": 2,
    "channel_layout": "stereo",
    "bit_rate": 192000
  }],
  "analyzed_at": "2025-01-14T14:30:25.123456"
}
```

## API Integration

### Update Snapshot Endpoint

**POST** `/api/v1/probe-inputs/{input_id}/snapshot`

Request body:
```json
{
  "snapshot_url": "/snapshots/input_123_20250114_143025.jpg",
  "last_snapshot_at": "2025-01-14T14:30:25.123456",
  "metadata": { /* metadata structure above */ }
}
```

## Logs

Logs are written to `/var/log/snapshot-service.log` with the following information:
- Snapshot capture attempts
- FFmpeg/FFprobe execution
- API communication
- Errors and warnings

## Requirements

- FFmpeg (for frame capture)
- FFprobe (for metadata extraction)
- Python 3.11+
- Access to MPEG-TS streams (network connectivity)
- CMS API availability

## Docker Deployment

The service is included in the main docker-compose.yml:

```yaml
snapshot-service:
  build:
    context: ../snapshot-service
  environment:
    SNAPSHOT_INTERVAL: 300
    SNAPSHOT_QUALITY: 2
  volumes:
    - snapshot_data:/var/snapshots
  depends_on:
    - cms-api
```

## Troubleshooting

### No snapshots captured

- Check FFmpeg can access the input URL (firewall, network routing)
- Verify stream is active and transmitting data
- Check logs for FFmpeg errors
- Test manually: `ffmpeg -i {input_url} -frames:v 1 test.jpg`

### Metadata extraction fails

- Ensure FFprobe is installed
- Verify stream format is supported
- Check timeout settings (default: 10 seconds)

### API updates failing

- Verify CMS API is accessible
- Check API endpoint URL configuration
- Review CMS API logs for errors

## Performance

- **Capture Time**: ~2-5 seconds per input (depends on stream responsiveness)
- **Storage**: ~50-200 KB per snapshot (1920x1080 JPEG)
- **CPU**: Minimal (FFmpeg is efficient for single frame extraction)
- **Network**: Low bandwidth (only captures one frame)

## Example Usage

View snapshots in the UI Dashboard:
1. Navigate to "Probe Inputs" tab
2. Snapshots appear as thumbnails in the table
3. Click on a thumbnail or "Info" button to view full metadata
4. Metadata includes codec details, resolution, bitrate, and more

## Future Enhancements

- On-demand snapshot capture via API
- Snapshot history/carousel
- Motion detection
- Black frame/freeze frame detection
- Thumbnail generation at multiple resolutions
- S3/cloud storage integration
