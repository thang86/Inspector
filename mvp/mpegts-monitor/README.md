# MPEG-TS Input Monitor

Real-time monitoring of MPEG-TS input streams from encoders and sources.

## Features

- **Transport Stream Analysis**
  - Sync byte detection
  - Continuity counter checking
  - Transport error indicator monitoring
  - PAT/PMT presence validation

- **Bitrate Monitoring**
  - Real-time bitrate calculation
  - Configurable min/max thresholds
  - Per-channel tracking

- **PID Statistics**
  - Track all PIDs in the stream
  - Top 10 PID packet counts
  - Identify missing essential PIDs

- **Input Types Supported**
  - UDP (multicast and unicast)
  - RTP
  - HTTP/HTTPS streams

## Configuration

### Environment Variables

```bash
# InfluxDB Connection
INFLUXDB_URL=http://influxdb:8086
INFLUXDB_TOKEN=your_token_here
INFLUXDB_ORG=inspector
INFLUXDB_BUCKET=metrics

# Monitoring Configuration
POLL_INTERVAL=5                    # Seconds between checks
MAX_CC_ERRORS=10                   # Max continuity errors
MAX_SYNC_LOSS=5                    # Max sync losses
MIN_BITRATE_MBPS=1.0              # Minimum bitrate
MAX_BITRATE_MBPS=50.0             # Maximum bitrate

# Channels to Monitor
# Format: channel_id,input_url,probe_id;...
MPEGTS_CHANNELS=CH_001,udp://239.1.1.1:5000,1;CH_002,udp://239.1.1.2:5000,1
```

## Usage

### Via Docker Compose

The service is included in the main docker-compose.yml:

```bash
cd infrastructure
docker compose up -d mpegts-monitor
```

### Standalone

```bash
cd mpegts-monitor
pip install -r requirements.txt

# Set environment variables
export INFLUXDB_URL=http://influxdb:8086
export INFLUXDB_TOKEN=your_token
export MPEGTS_CHANNELS=CH_001,udp://239.1.1.1:5000,1

python monitor.py
```

### Via CMS API

Add probe inputs via the API:

```bash
curl -X POST http://localhost:5000/api/v1/probe-inputs \
  -H "Content-Type: application/json" \
  -d '{
    "probe_id": 1,
    "channel_id": 1,
    "input_name": "Primary Input",
    "input_type": "MPEGTS_UDP",
    "input_url": "udp://239.1.1.1:5000",
    "input_port": 5000,
    "bitrate_mbps": 10.0,
    "is_primary": true,
    "enabled": true
  }'
```

## Metrics

The monitor pushes metrics to InfluxDB:

### mpegts_input

| Field | Type | Description |
|-------|------|-------------|
| packets_received | int | Total TS packets received |
| sync_errors | int | Sync byte errors detected |
| continuity_errors | int | Continuity counter errors |
| transport_errors | int | Transport error indicators |
| bitrate_mbps | float | Calculated bitrate |
| has_pat | bool | PAT present in stream |
| has_pmt | bool | PMT present in stream |
| unique_pids | int | Number of unique PIDs |

### mpegts_pid_stats

| Field | Type | Description |
|-------|------|-------------|
| packet_count | int | Packets per PID |

## Monitoring Dashboards

### Grafana Queries

**Bitrate Over Time:**
```flux
from(bucket: "metrics")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "mpegts_input")
  |> filter(fn: (r) => r._field == "bitrate_mbps")
```

**Error Rate:**
```flux
from(bucket: "metrics")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "mpegts_input")
  |> filter(fn: (r) => r._field == "continuity_errors" or r._field == "sync_errors")
```

## Alerts

Configure alerts in Prometheus for:

- High continuity error rate
- Sync byte losses
- Bitrate out of range
- Missing PAT/PMT

Example alert rule:

```yaml
- alert: HighContinuityErrors
  expr: mpegts_continuity_errors > 10
  for: 1m
  labels:
    severity: major
  annotations:
    summary: "High continuity errors on {{ $labels.channel }}"
```

## Troubleshooting

### No metrics appearing

Check logs:
```bash
docker compose logs mpegts-monitor
```

Verify UDP stream:
```bash
# Test UDP multicast reception
ffprobe udp://239.1.1.1:5000
```

### High error rates

- Check network packet loss
- Verify encoder output quality
- Check multicast routing
- Verify firewall rules

### Bitrate fluctuations

- Check input source stability
- Verify network capacity
- Monitor CPU usage
- Check for packet drops

## Examples

### UDP Multicast

```bash
MPEGTS_CHANNELS=CH_SPORT1,udp://239.1.1.1:5000,1
```

### UDP Unicast

```bash
MPEGTS_CHANNELS=CH_NEWS,udp://10.10.10.100:5000,1
```

### HTTP Stream

```bash
MPEGTS_CHANNELS=CH_MOVIE,http://encoder.local:8080/stream.ts,1
```

### Multiple Channels

```bash
MPEGTS_CHANNELS=CH_001,udp://239.1.1.1:5000,1;CH_002,udp://239.1.1.2:5000,1;CH_003,http://encoder:8080/ch3.ts,1
```

## Architecture

```
MPEG-TS Sources (Encoders)
    │
    ▼
[UDP/RTP/HTTP Stream]
    │
    ▼
MPEG-TS Monitor
    ├─ Parse TS Packets
    ├─ Check Continuity
    ├─ Measure Bitrate
    ├─ Detect PAT/PMT
    └─ Track PIDs
    │
    ▼
InfluxDB (metrics)
    │
    ▼
Grafana (visualization)
```

## Performance

- **CPU**: 2-5% per stream
- **Memory**: 50-100MB base + 10MB/stream
- **Network**: Minimal overhead
- **Latency**: Real-time (<100ms)

## License

Internal use only
