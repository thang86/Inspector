# L1 Headend/Encoder Monitoring Integration Guide

## Overview

This guide explains how to add **L1: Headend/Encoder** monitoring capabilities to Inspector system for UDP/SRT/RTMP inputs from encoders.

## What is L1 Monitoring?

L1 (Layer 1) monitors encoder outputs **before** they reach the packager:

```
[Encoder] --UDP/SRT/RTMP--> [L1 Monitor] ---> [Packager] ---> [L2 Monitor]
   ↓                            ↓                                   ↓
4K HDR Content          TR 101 290 ✓              HLS/DASH ✓
Dolby Atmos            HDR Metadata ✓             Segment Quality ✓
                       Audio Loudness ✓            ABR Ladder ✓
```

## Components to Monitor

### 1. TR 101 290 (MPEG-TS Compliance)

**Priority 1 Errors** (Critical - Must fix immediately):
- TS sync loss
- Sync byte error (not 0x47)
- PAT (Program Association Table) error
- Continuity counter error
- PMT (Program Map Table) error
- PID error

**Priority 2 Errors** (Should fix soon):
- Transport error indicator
- CRC error
- PCR (Program Clock Reference) error
- PCR repetition error
- PCR discontinuity
- PTS error

**Priority 3 Errors** (Monitor):
- NIT, SDT, EIT errors
- SI repetition errors
- Unreferenced PIDs

### 2. HDR Metadata Validation

**Required for 4K HDR Content**:
- Transfer characteristics: PQ (SMPTE 2084) or HLG
- Color primaries: BT.2020
- Color space: BT.2020
- Mastering display metadata (white point, display primaries, max/min luminance)
- Content light level metadata (MaxCLL, MaxFALL)

**Example valid HDR metadata**:
```json
{
  "transfer_characteristics": "SMPTE 2084 (PQ)",
  "color_primaries": "BT.2020",
  "mastering_display": {
    "white_point": "0.3127, 0.3290",
    "primaries": "0.708, 0.292, 0.170, 0.797, 0.131, 0.046",
    "max_luminance": "1000 cd/m²",
    "min_luminance": "0.0001 cd/m²"
  },
  "content_light_level": {
    "MaxCLL": "1000 cd/m²",
    "MaxFALL": "400 cd/m²"
  }
}
```

### 3. Dolby Atmos Validation

**Requirements**:
- Codec: E-AC-3 (Enhanced AC-3) with JOC (Joint Object Coding)
- Sample rate: 48 kHz
- Bitrate: ≥ 384 kbps (384-768 kbps typical)
- Channels: At least 5.1 bed channels
- Objects: Up to 128 audio objects

**Detection**:
- Check audio codec is `eac3`
- Verify bitrate and sample rate
- Check for JOC metadata in stream

### 4. Audio Loudness (EBU R128 / ATSC A/85)

**Standards**:
- **EBU R128** (Europe): -23 LUFS ± 2 LU
- **ATSC A/85** (USA): -24 LKFS ± 2 dB
- **True Peak**: < -1 dBTP (to avoid clipping)
- **Loudness Range (LRA)**: Typical 6-20 LU

**Measurements**:
- Integrated Loudness (LUFS/LKFS)
- Loudness Range (LU)
- True Peak (dBTP)
- Short-term loudness (optional)
- Momentary loudness (optional)

---

## Implementation

### Step 1: Install L1 Monitor Module

The `l1_headend_monitor.py` module is already created. Install dependencies:

```bash
# On packager servers
sudo apt install -y ffmpeg ffprobe

# Verify ffmpeg has loudnorm filter
ffmpeg -filters | grep loudnorm

# Should see: loudnorm  A->A  EBU R128 loudness normalization
```

### Step 2: Configure Monitor Service

Add L1 analysis configuration to `monitor_config.env`:

```bash
# L1 Headend Monitoring
ENABLE_L1_ANALYSIS=true
L1_ANALYSIS_INTERVAL=300  # Run every 5 minutes (less frequent than L2)
L1_ANALYSIS_DURATION=10   # Analyze 10 seconds of stream
```

### Step 3: Integrate into Packager Monitor

Add to `1_packager_monitor_service.py`:

```python
# At top of file
from l1_headend_monitor import L1HeadendMonitor

# In PackagerMonitor.__init__:
self.l1_monitor = L1HeadendMonitor()
self.last_l1_analysis = {}  # Track last analysis time

# Add new method to monitor_input:
def _run_l1_analysis(self, input_source: InputSource):
    """Run L1 headend analysis if enough time has passed"""
    if not self.l1_monitor:
        return

    current_time = time.time()
    last_analysis = self.last_l1_analysis.get(input_source.input_id, 0)

    # Run L1 analysis every 5 minutes (configurable)
    if current_time - last_analysis < 300:
        return

    try:
        logger.info(f"Running L1 analysis for {input_source.input_name}")

        results = self.l1_monitor.analyze_input(
            input_source.input_url,
            duration=10
        )

        # Push results to InfluxDB
        self._push_l1_metrics(input_source, results)

        # Update last analysis time
        self.last_l1_analysis[input_source.input_id] = current_time

        logger.info(f"L1 analysis complete for {input_source.input_name}")

    except Exception as e:
        logger.error(f"L1 analysis error for {input_source.input_name}: {e}")

# Add method to push L1 metrics:
def _push_l1_metrics(self, input_source: InputSource, results: Dict):
    """Push L1 analysis results to InfluxDB"""
    try:
        # TR 101 290 metrics
        if results.get('tr101290'):
            tr = results['tr101290']
            point = Point("l1_tr101290") \
                .tag("input_id", str(input_source.input_id)) \
                .tag("input_name", input_source.input_name) \
                .field("sync_byte_error", tr.sync_byte_error) \
                .field("pat_error", tr.pat_error) \
                .field("pmt_error", tr.pmt_error) \
                .field("continuity_error", tr.continuity_count_error) \
                .field("crc_error", tr.crc_error) \
                .field("pcr_error", tr.pcr_error) \
                .field("is_valid", int(tr.is_valid)) \
                .time(tr.timestamp)

            self.write_api.write(
                bucket=self.config.influxdb_bucket,
                org=self.config.influxdb_org,
                record=point
            )

        # HDR metrics
        if results.get('hdr'):
            hdr = results['hdr']
            point = Point("l1_hdr") \
                .tag("input_id", str(input_source.input_id)) \
                .tag("input_name", input_source.input_name) \
                .field("has_hdr", int(hdr.has_hdr)) \
                .field("is_valid", int(hdr.is_valid)) \
                .time(datetime.utcnow())

            if hdr.transfer_characteristics:
                point = point.tag("transfer", hdr.transfer_characteristics)

            self.write_api.write(
                bucket=self.config.influxdb_bucket,
                org=self.config.influxdb_org,
                record=point
            )

        # Atmos metrics
        if results.get('atmos'):
            atmos = results['atmos']
            point = Point("l1_atmos") \
                .tag("input_id", str(input_source.input_id)) \
                .tag("input_name", input_source.input_name) \
                .field("has_atmos", int(atmos.has_atmos)) \
                .field("bed_channels", atmos.bed_channels) \
                .field("sample_rate", atmos.sample_rate) \
                .field("bitrate", atmos.bitrate) \
                .field("is_valid", int(atmos.is_valid)) \
                .time(datetime.utcnow())

            self.write_api.write(
                bucket=self.config.influxdb_bucket,
                org=self.config.influxdb_org,
                record=point
            )

        # Loudness metrics
        if results.get('loudness'):
            loud = results['loudness']
            if loud.integrated_loudness is not None:
                point = Point("l1_loudness") \
                    .tag("input_id", str(input_source.input_id)) \
                    .tag("input_name", input_source.input_name) \
                    .field("integrated_loudness", loud.integrated_loudness) \
                    .field("loudness_range", loud.loudness_range or 0) \
                    .field("true_peak", loud.true_peak or 0) \
                    .field("is_compliant", int(loud.is_compliant)) \
                    .time(datetime.utcnow())

                self.write_api.write(
                    bucket=self.config.influxdb_bucket,
                    org=self.config.influxdb_org,
                    record=point
                )

        logger.debug(f"Pushed L1 metrics for {input_source.input_name}")

    except Exception as e:
        logger.error(f"Error pushing L1 metrics: {e}")
```

### Step 4: Call L1 Analysis

In the `monitor_input` method, add:

```python
def monitor_input(self, input_source: InputSource):
    """Monitor single input based on its type"""
    try:
        if input_source.input_type == 'MPEGTS_UDP':
            self._probe_mpegts_udp(input_source)

            # Run L1 analysis (less frequent)
            self._run_l1_analysis(input_source)

        elif input_source.input_type in ['HTTP', 'HLS']:
            self.monitor_channel(input_source.channel_name or f"input_{input_source.input_id}")
        # ... rest of code
```

### Step 5: Update Web UI

Add L1 metrics to the Debug tab in `3_react_dashboard.jsx`:

```jsx
// Add to InputInfoModal
<div className="info-section">
  <h4>L1 Headend Analysis</h4>
  <div className="l1-metrics">
    <div><strong>TR 101 290:</strong> {input.l1_tr101290_valid ? '✅ Pass' : '❌ Fail'}</div>
    <div><strong>HDR:</strong> {input.l1_hdr_detected ? '✅ Detected' : '—'}</div>
    <div><strong>Dolby Atmos:</strong> {input.l1_atmos_detected ? '✅ Detected' : '—'}</div>
    <div><strong>Loudness:</strong> {input.l1_loudness} LUFS {input.l1_loudness_compliant ? '✅' : '❌'}</div>
  </div>
</div>
```

### Step 6: Add API Endpoint

Add to `2_cms_api_flask.py`:

```python
@app.route('/api/v1/inputs/<int:input_id>/l1-metrics', methods=['GET'])
def get_input_l1_metrics(input_id):
    """Get latest L1 analysis results from InfluxDB"""
    inp = Input.query.get(input_id)

    if not inp:
        return jsonify({'status': 'error', 'message': 'Input not found'}), 404

    # Query InfluxDB for latest L1 metrics
    # (Implementation depends on InfluxDB client setup)

    return jsonify({
        'status': 'ok',
        'input_id': input_id,
        'l1_metrics': {
            'tr101290': { ... },
            'hdr': { ... },
            'atmos': { ... },
            'loudness': { ... }
        }
    })
```

---

## Testing

### Test 1: TR 101 290 Analysis

```bash
# Run L1 monitor standalone
python3 l1_headend_monitor.py

# Or test specific input
python3 <<EOF
from l1_headend_monitor import L1HeadendMonitor
import json

monitor = L1HeadendMonitor()
results = monitor.analyze_input("udp://225.3.3.42:30130", duration=10)
print(json.dumps(results, indent=2, default=str))
EOF
```

Expected output:
```json
{
  "tr101290": {
    "sync_byte_error": 0,
    "pat_error": 0,
    "pmt_error": 0,
    "continuity_count_error": 0,
    "is_valid": true,
    "errors": []
  }
}
```

### Test 2: HDR Detection

```bash
# Test with 4K HDR stream
ffprobe -v quiet -select_streams v:0 \
  -show_entries stream=color_transfer,color_primaries \
  -of json udp://225.3.3.42:30130
```

Expected:
```json
{
  "color_transfer": "smpte2084",
  "color_primaries": "bt2020"
}
```

### Test 3: Loudness Measurement

```bash
# Measure loudness manually
ffmpeg -i udp://225.3.3.42:30130 -t 10 \
  -af loudnorm=print_format=json -f null -
```

Expected output:
```json
{
  "input_i": "-23.2",
  "input_tp": "-2.1",
  "input_lra": "8.3"
}
```

---

## Alerting Thresholds

Configure alerts for L1 metrics:

### TR 101 290 Alerts

| Error Type | Threshold | Severity | Action |
|-----------|-----------|----------|--------|
| Priority 1 errors > 0 | Any | CRITICAL | Fix immediately |
| Priority 2 errors > 10 | Per minute | MAJOR | Investigate |
| Priority 3 errors > 50 | Per minute | MINOR | Monitor |

### HDR Alerts

| Condition | Severity | Action |
|-----------|----------|--------|
| HDR expected but not detected | MAJOR | Check encoder |
| HDR detected but invalid metadata | MAJOR | Check encoder config |
| Color primaries not BT.2020 | MAJOR | Fix encoder |

### Atmos Alerts

| Condition | Severity | Action |
|-----------|----------|--------|
| Atmos expected but not detected | MAJOR | Check encoder audio |
| Bitrate < 384 kbps | MAJOR | Increase bitrate |
| Sample rate != 48kHz | CRITICAL | Fix encoder |

### Loudness Alerts

| Condition | Threshold | Severity | Action |
|-----------|-----------|----------|--------|
| Out of range | ±2 LUFS from -23 | MAJOR | Adjust encoder |
| True peak > -1 dBTP | Any | MAJOR | Reduce levels |
| Loudness range < 3 LU | Unusual | MINOR | Check dynamics |

---

## Performance Considerations

### Resource Usage

L1 analysis is CPU intensive. Optimize by:

1. **Run less frequently**: Every 5 minutes instead of 30 seconds
2. **Shorter duration**: Analyze 10 seconds instead of full segment
3. **Parallel processing**: Use ThreadPoolExecutor
4. **Cache results**: Store last analysis to avoid repeats

### Recommended Settings

```python
L1_ANALYSIS_INTERVAL = 300  # 5 minutes
L1_ANALYSIS_DURATION = 10   # 10 seconds
L1_MAX_CONCURRENT = 2       # Max 2 L1 analyses at once
```

### CPU Impact

- TR 101 290: Low (passive analysis)
- HDR detection: Low (metadata only)
- Atmos detection: Low (stream info only)
- Loudness measurement: **HIGH** (full audio decoding)

**Tip**: Run loudness analysis separately or less frequently (every 15-30 minutes).

---

## Grafana Dashboards

Create dashboard panels for L1 metrics:

### Panel 1: TR 101 290 Error Rate

```flux
from(bucket: "packager_metrics")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "l1_tr101290")
  |> filter(fn: (r) => r._field =~ /.*_error/)
  |> aggregateWindow(every: 1m, fn: sum)
```

### Panel 2: Loudness Compliance

```flux
from(bucket: "packager_metrics")
  |> range(start: -6h)
  |> filter(fn: (r) => r._measurement == "l1_loudness")
  |> filter(fn: (r) => r._field == "integrated_loudness")
```

Add horizontal lines at -25 LUFS and -21 LUFS to show compliance zone.

### Panel 3: HDR/Atmos Status

Table showing current status of all inputs:
- Input name
- HDR detected (✅/❌)
- Atmos detected (✅/❌)
- Last analysis time

---

## Troubleshooting

### Issue: ffmpeg not found

```bash
sudo apt install -y ffmpeg
ffmpeg -version
```

### Issue: Loudness filter not available

```bash
# Check if loudnorm filter exists
ffmpeg -filters | grep loudnorm

# If not, install full ffmpeg with all filters
sudo apt install -y ffmpeg libavfilter-dev
```

### Issue: TR 101 290 errors not detected

The basic implementation uses ffmpeg's built-in checks. For more comprehensive TR 101 290 analysis, consider:

1. **TSAnalyze**: Professional MPEG-TS analyzer
2. **DVB Inspector**: Java-based TS analyzer
3. **OpenCaster**: Open source DVB tools

Example with TSAnalyze:
```bash
tsanalyze udp://225.3.3.42:30130 --tr101290 --json
```

### Issue: High CPU usage

Reduce analysis frequency and duration:

```python
# In monitor_config.env
L1_ANALYSIS_INTERVAL=600  # Every 10 minutes
L1_ANALYSIS_DURATION=5    # Only 5 seconds
```

Or run L1 analysis on dedicated server.

---

## Next Steps

1. **Implement** L1 module integration
2. **Test** with sample streams
3. **Configure** alerting thresholds
4. **Create** Grafana dashboards
5. **Train** operators on L1 metrics
6. **Document** encoder configurations

---

## References

- [TR 101 290 Standard](https://www.etsi.org/deliver/etsi_tr/101200_101299/101290/01.03.01_60/tr_101290v010301p.pdf)
- [EBU R128 Loudness](https://tech.ebu.ch/docs/r/r128.pdf)
- [SMPTE 2084 (PQ HDR)](https://ieeexplore.ieee.org/document/7291452)
- [Dolby Atmos Technical](https://professional.dolby.com/tv/dolby-atmos/)
- [ffmpeg Loudnorm Filter](https://ffmpeg.org/ffmpeg-filters.html#loudnorm)

---

**Document Version**: 1.0
**Last Updated**: 2025-01-18
**Author**: Inspector Development Team
