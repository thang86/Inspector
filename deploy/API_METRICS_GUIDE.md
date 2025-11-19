# Inspector Metrics API Guide

## Overview

The CMS API now provides real-time access to stream metrics, TR 101 290 DVB errors, and comprehensive channel status through REST endpoints.

## Base URL

```
http://localhost:5000/api/v1
```

## Endpoints

### 1. TR 101 290 Metrics

**GET** `/metrics/tr101290/<input_id>`

Returns DVB TR 101 290 measurement metrics with Priority 1, 2, and 3 error counts.

**Example Request:**
```bash
curl http://localhost:5000/api/v1/metrics/tr101290/1
```

**Example Response:**
```json
{
  "input_id": 1,
  "priority_1": {
    "ts_sync_loss": 0,
    "sync_byte_error": 0,
    "pat_error": 0,
    "continuity_count_error": 5,
    "pmt_error": 1,
    "pid_error": 0,
    "total_p1_errors": 6
  },
  "priority_2": {
    "transport_error": 0,
    "crc_error": 0,
    "pcr_error": 0,
    "pcr_accuracy_error": 0,
    "pts_error": 0,
    "cat_error": 0,
    "total_p2_errors": 0
  },
  "priority_3": {
    "nit_error": 0,
    "si_repetition_error": 0,
    "unreferenced_pid": 0,
    "total_p3_errors": 0
  },
  "metadata": {
    "total_packets": 700,
    "pat_received": 1,
    "pmt_received": 0,
    "pcr_interval_ms": 23.74
  },
  "status": "ok"
}
```

**Priority Levels:**
- **P1 (Critical)**: Stream-breaking errors that prevent decoding
- **P2 (Quality)**: Errors affecting stream quality
- **P3 (Informational)**: Non-critical issues

---

### 2. Stream Metrics

**GET** `/metrics/stream/<input_id>`

Returns time-series stream metrics including bitrate, packets, and bytes over the last hour.

**Query Parameters:**
- `range` (optional): Time range in minutes (default: 60)

**Example Request:**
```bash
curl http://localhost:5000/api/v1/metrics/stream/1
```

**Example Response:**
```json
{
  "input_id": 1,
  "count": 27,
  "metrics": [
    {
      "time": "2025-11-19T03:43:59.899716+00:00",
      "field": "bitrate_mbps",
      "value": 0.759,
      "input_name": "VTV1 HD Primary"
    },
    {
      "time": "2025-11-19T03:43:59.899716+00:00",
      "field": "bytes_received",
      "value": 131600,
      "input_name": "VTV1 HD Primary"
    },
    {
      "time": "2025-11-19T03:43:59.899716+00:00",
      "field": "packets_received",
      "value": 100,
      "input_name": "VTV1 HD Primary"
    }
  ],
  "status": "ok"
}
```

**Fields:**
- `bitrate_mbps`: Current bitrate in Mbps
- `bytes_received`: Total bytes in sample
- `packets_received`: Total packets in sample

---

### 3. Comprehensive Status

**GET** `/metrics/status/<input_id>`

Returns complete input status combining database info with latest metrics.

**Example Request:**
```bash
curl http://localhost:5000/api/v1/metrics/status/1
```

**Example Response:**
```json
{
  "status": "ok",
  "data": {
    "input_id": 1,
    "input_name": "VTV1 HD Primary",
    "input_url": "udp://225.3.3.42:30130",
    "input_type": "MPEGTS_UDP",
    "enabled": true,
    "bitrate_mbps": 0.759,
    "tr101290_p1_errors": 5,
    "last_snapshot": "2025-11-19T03:42:50.616977",
    "last_update": "2025-11-19T03:43:59.899716+00:00"
  }
}
```

---

## Integration with UI

### Real-time Monitoring

To display real-time metrics in your React UI:

```javascript
// Fetch TR 101 290 errors
const fetchTR101290 = async (inputId) => {
  const response = await fetch(`/api/v1/metrics/tr101290/${inputId}`);
  const data = await response.json();

  // Display P1 errors (critical)
  console.log('Critical Errors:', data.priority_1.total_p1_errors);

  // Check for specific errors
  if (data.priority_1.continuity_count_error > 0) {
    console.warn('Continuity errors detected!');
  }
};

// Fetch stream metrics for chart
const fetchStreamMetrics = async (inputId) => {
  const response = await fetch(`/api/v1/metrics/stream/${inputId}`);
  const data = await response.json();

  // Filter bitrate data points
  const bitrateData = data.metrics
    .filter(m => m.field === 'bitrate_mbps')
    .map(m => ({ time: m.time, value: m.value }));

  // Use for charts/graphs
  return bitrateData;
};

// Poll for updates every 10 seconds
setInterval(() => {
  fetchTR101290(1);
  fetchStreamMetrics(1);
}, 10000);
```

### Error Visualization

```javascript
// Color-code based on error severity
const getErrorSeverity = (p1Errors) => {
  if (p1Errors === 0) return 'success';  // Green
  if (p1Errors < 10) return 'warning';   // Yellow
  return 'error';                         // Red
};

// Display in UI
const ErrorIndicator = ({ inputId }) => {
  const [errors, setErrors] = useState(0);

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/v1/metrics/tr101290/${inputId}`);
      const data = await res.json();
      setErrors(data.priority_1.total_p1_errors);
    }, 5000);

    return () => clearInterval(interval);
  }, [inputId]);

  return (
    <div className={`error-badge ${getErrorSeverity(errors)}`}>
      P1 Errors: {errors}
    </div>
  );
};
```

---

## Grafana Integration

### InfluxDB Access

All metrics are also stored in InfluxDB for historical analysis.

**InfluxDB Login:**
- URL: http://localhost:8086
- Username: admin
- Password: admin_password_123
- Organization: fpt-play
- Bucket: packager_metrics

### Sample Flux Queries

**Query Bitrate Over Time:**
```flux
from(bucket: "packager_metrics")
  |> range(start: -1h)
  |> filter(fn: (r) => r["_measurement"] == "udp_probe_metric")
  |> filter(fn: (r) => r["_field"] == "bitrate_mbps")
  |> filter(fn: (r) => r["input_id"] == "1")
```

**Query TR 101 290 P1 Errors:**
```flux
from(bucket: "packager_metrics")
  |> range(start: -1h)
  |> filter(fn: (r) => r["_measurement"] == "tr101290_p1")
  |> filter(fn: (r) => r["input_id"] == "1")
  |> aggregateWindow(every: 1m, fn: last)
```

---

## Testing

### Test All Endpoints

```bash
# Test TR 101 290
curl -s http://localhost:5000/api/v1/metrics/tr101290/1 | jq

# Test Stream Metrics
curl -s http://localhost:5000/api/v1/metrics/stream/1 | jq

# Test Status
curl -s http://localhost:5000/api/v1/metrics/status/1 | jq
```

### Verify Data Collection

```bash
# Check monitor logs
docker logs inspector-monitor --tail 50

# Check CMS API health
curl http://localhost:5000/api/v1/health
```

---

## Current Metrics (VTV1 HD Primary)

Based on the latest data:

- **Input ID:** 1
- **Stream:** udp://225.3.3.42:30130
- **Bitrate:** 0.75 - 1.1 Mbps (variable)
- **Resolution:** 720p
- **Frame Rate:** 25 fps
- **Codec:** H.264 + AAC
- **TR 101 290 P1 Errors:** 5 continuity count errors, 1 PMT error
- **Snapshots:** Captured every 60 seconds
- **Monitoring Interval:** 30 seconds

---

## Troubleshooting

### No Data Returned

1. Check monitor service is running:
   ```bash
   docker ps | grep inspector-monitor
   ```

2. Verify InfluxDB connection:
   ```bash
   docker logs inspector-cms-api | grep -i influx
   ```

3. Check metrics are being written:
   ```bash
   docker logs inspector-monitor | grep "Pushed TR 101 290"
   ```

### Old Data

The API returns data from the last hour by default. If you need older data, query InfluxDB directly using Grafana or the InfluxDB UI.

### Authentication Errors

Ensure the `INFLUXDB_TOKEN` in `.env.production.local` matches the token in InfluxDB. The token should be:
```
influx_prod_token_$(openssl rand -hex 16)
```
