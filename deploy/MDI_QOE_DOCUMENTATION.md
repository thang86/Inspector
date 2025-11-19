# MDI/QoE Monitoring System - Comprehensive Documentation

## Table of Contents

1. [Overview](#overview)
2. [Media Delivery Index (MDI) - RFC 4445](#media-delivery-index-mdi---rfc-4445)
3. [Quality of Experience (QoE) Metrics](#quality-of-experience-qoe-metrics)
4. [API Reference](#api-reference)
5. [UI User Guide](#ui-user-guide)
6. [Troubleshooting Guide](#troubleshooting-guide)
7. [Network Metrics and DVB Errors Relationship](#network-metrics-and-dvb-errors-relationship)
8. [Best Practices](#best-practices)

---

## Overview

The Inspector IPTV Monitoring System has been enhanced with comprehensive network transport and quality of experience metrics to provide deeper insights into video streaming quality and identify root causes of viewer-impacting issues.

### Key Features

- **MDI (RFC 4445) Network Transport Metrics**: Measure IP network quality for video streams
- **QoE Metrics**: Assess viewer-perceived quality with video/audio quality scoring
- **TR 101 290 DVB Error Detection**: Industry-standard MPEG-TS error monitoring
- **Real-time Visualization**: Auto-refreshing dashboards with color-coded alerts
- **Comprehensive API**: RESTful endpoints for all metrics

---

## Media Delivery Index (MDI) - RFC 4445

### What is MDI?

Media Delivery Index (MDI) is an industry-standard metric defined in **RFC 4445** for measuring the quality of IP networks carrying video streams. MDI provides objective measurements of network behavior that directly impact video quality.

### Core MDI Metrics

#### 1. Delay Factor (DF)

**Definition**: Maximum jitter observed in the IP packet arrival times

**Measurement**: Expressed in milliseconds (ms)

**Meaning**:
- DF indicates the minimum buffer size required at the decoder to absorb network jitter
- Higher DF values mean more jitter in the network
- DF correlates directly with TR 101 290 **Continuity Count Errors**

**Interpretation**:
```
DF < 5ms     : Excellent - Minimal jitter, stable network
DF 5-15ms    : Good - Acceptable jitter for most applications
DF 15-30ms   : Warning - Significant jitter, may cause issues
DF > 30ms    : Critical - High jitter, likely causing CC errors
```

**Example**:
```
DF = 12.5ms means the decoder needs at least 12.5ms of buffering
to handle the worst-case packet delay variation
```

#### 2. Media Loss Rate (MLR)

**Definition**: Number of lost packets per second

**Measurement**: Expressed in packets per second (pps)

**Meaning**:
- MLR directly measures packet loss in the network
- Any MLR > 0 indicates network problems
- Each lost packet typically results in multiple TR 101 290 errors

**Interpretation**:
```
MLR = 0        : Perfect - No packet loss
MLR = 0.1-1    : Warning - Occasional packet loss
MLR > 1        : Critical - Significant packet loss
```

**Impact**:
- 1 lost packet = 7 consecutive Continuity Count Errors (typical)
- 10 packets/sec lost = ~70 CC errors/sec = Severe degradation

### Additional MDI Metrics

#### Jitter Analysis

**Inter-arrival Time**:
- Average time between packet arrivals
- Ideally should be constant for CBR streams
- Variation indicates network congestion

**Jitter (Standard Deviation)**:
- Measures variation in packet arrival times
- Lower jitter = more stable network
- Calculated using standard deviation of inter-arrival times

**Max Jitter**:
- Worst-case packet delay variation
- Used to calculate Delay Factor (DF)

#### Buffer Management

**Buffer Depth**:
- Estimated bytes needed in decoder buffer
- Calculated based on bitrate and maximum jitter
- Formula: `Buffer = (Bitrate × Max_Jitter) / 8`

**Buffer Utilization**:
- Percentage of buffer capacity being used
- Shows how close the system is to buffer overflow/underflow

**Interpretation**:
```
Buffer Util < 60%   : Excellent - Plenty of headroom
Buffer Util 60-85%  : Good - Adequate buffering
Buffer Util > 85%   : Warning - Risk of buffer issues
Buffer Util > 95%   : Critical - Imminent buffer overflow/underflow
```

#### Traffic Rate Analysis

**Input Rate (Mbps)**:
- Actual measured bitrate of incoming stream
- Should match expected stream bitrate

**Output Rate (Mbps)**:
- Expected nominal bitrate
- Used for comparison with actual rate

**Traffic Overhead**:
- Percentage difference between actual and expected
- Includes IP/UDP/RTP headers and network overhead

### MDI Formula Reference

According to RFC 4445:

```
DF (Delay Factor) = Maximum Jitter (ms)

MLR (Media Loss Rate) = Lost Packets / Time Period (pps)

Virtual Buffer Size = (Bitrate × DF) / 8

Jitter = StdDev(Packet Inter-Arrival Times)
```

### Network Quality Assessment

The system provides intelligent analysis based on MDI metrics:

**Excellent Network Quality**:
- DF < 5ms
- MLR = 0
- Jitter < 3ms
- Buffer Utilization < 50%

**Good Network Quality**:
- DF 5-15ms
- MLR = 0
- Jitter 3-10ms
- Buffer Utilization 50-70%

**Warning - Network Issues**:
- DF 15-30ms
- MLR 0-1 pps
- Jitter 10-20ms
- Buffer Utilization 70-85%

**Critical - Network Failure**:
- DF > 30ms
- MLR > 1 pps
- Jitter > 20ms
- Buffer Utilization > 85%

---

## Quality of Experience (QoE) Metrics

### What is QoE?

Quality of Experience (QoE) measures the viewer-perceived quality of the video stream, going beyond technical metrics to assess actual viewing experience.

### QoE Components

#### 1. Video Quality Metrics

**Video PID Active**:
- Indicates if video packets are being received
- Boolean: true/false
- Inactive = no video signal

**Video Bitrate (Mbps)**:
- Measured bitrate of video elementary stream
- Should be stable for CBR encoding
- Drops indicate encoder issues or packet loss

**Black Frame Detection**:
- Counts instances of completely black video frames
- May indicate:
  - Signal loss
  - Encoder failure
  - Source feed issues

**Freeze Frame Detection**:
- Counts instances of repeated identical frames
- May indicate:
  - Encoder processing issues
  - Source feed stalls
  - Buffer underruns

**Video Quality Score**:
- Range: 1.0 (poor) to 5.0 (excellent)
- Calculated based on TR 101 290 errors and PID activity
- Factors considered:
  - Continuity Count Errors
  - TS Sync Loss
  - PAT/PMT errors
  - PCR errors

#### 2. Audio Quality Metrics

**Audio PID Active**:
- Indicates if audio packets are being received
- Boolean: true/false
- Inactive = no audio signal

**Audio Bitrate (kbps)**:
- Measured bitrate of audio elementary stream
- Typical values: 128-384 kbps for stereo

**Audio Silence Detection**:
- Counts instances of complete audio silence
- May indicate:
  - Audio encoder failure
  - Source audio loss
  - Mute condition

**Audio Loudness (LUFS)**:
- Measures perceived audio loudness
- Standard: EBU R128 (Europe), ATSC A/85 (USA)
- Target: -23 LUFS ± 1 LU (EBU R128)

**LUFS Interpretation**:
```
-23 LUFS ± 1    : Perfect - Compliant with EBU R128
-23 LUFS ± 2    : Good - Acceptable deviation
-23 LUFS ± 5    : Warning - Outside recommended range
Other values    : Critical - Non-compliant loudness
```

**Audio Quality Score**:
- Range: 1.0 (poor) to 5.0 (excellent)
- Based on silence detection and PID activity

#### 3. Overall Quality Score (MOS)

**Mean Opinion Score (MOS)**:
- Industry-standard subjective quality metric
- Range: 1.0 (bad) to 5.0 (excellent)
- Calculated from video and audio quality scores

**MOS Interpretation**:
```
MOS 4.5-5.0   : Excellent - Imperceptible quality degradation
MOS 4.0-4.5   : Good - Perceptible but not annoying
MOS 3.5-4.0   : Fair - Slightly annoying degradation
MOS 2.5-3.5   : Poor - Annoying degradation
MOS 1.0-2.5   : Bad - Very annoying, unusable
```

**MOS Calculation**:
```
Overall MOS = (Video Quality Score + Audio Quality Score) / 2
```

### QoE Scoring Algorithm

The system calculates quality scores based on error rates and activity:

```python
# Video Quality Score Calculation
base_score = 5.0

# Deduct for errors
if cc_errors > 0:
    score -= min(cc_errors / 100, 2.0)  # Max -2.0 points

if sync_loss > 0:
    score -= min(sync_loss / 10, 1.0)   # Max -1.0 points

if not video_pid_active:
    score = 1.0  # No video = worst score

# Audio Quality Score Calculation
base_score = 5.0

if silence_detected > 0:
    score -= min(silence_detected / 50, 2.0)  # Max -2.0 points

if not audio_pid_active:
    score = 1.0  # No audio = worst score
```

---

## API Reference

### Base URL

```
http://localhost:5050/api/v1
```

### Authentication

Currently no authentication required (internal monitoring system)

### Endpoints

#### 1. Get MDI Metrics

**Endpoint**: `GET /api/v1/metrics/mdi/<input_id>`

**Description**: Retrieve Media Delivery Index (RFC 4445) network transport metrics

**Parameters**:
- `input_id` (path): Input stream ID
- `minutes` (query, optional): Time range in minutes (default: 5)

**Example Request**:
```bash
curl http://localhost:5050/api/v1/metrics/mdi/1?minutes=5
```

**Example Response**:
```json
{
  "status": "ok",
  "data": {
    "input_id": 1,
    "df": 12.45,
    "mlr": 0.0,
    "jitter_ms": 8.32,
    "max_jitter_ms": 12.45,
    "buffer_utilization": 62.3,
    "buffer_depth": 15680,
    "buffer_max": 25200,
    "packets_lost": 0,
    "packets_out_of_order": 0,
    "input_rate_mbps": 10.125,
    "inter_arrival_time_ms": 1.23,
    "timestamp": "2025-01-15T10:30:45.123456Z"
  }
}
```

**Response Fields**:
- `df`: Delay Factor in milliseconds (max jitter)
- `mlr`: Media Loss Rate in packets per second
- `jitter_ms`: Standard deviation of packet inter-arrival times
- `max_jitter_ms`: Maximum jitter observed (same as DF)
- `buffer_utilization`: Buffer fill percentage (0-100)
- `buffer_depth`: Estimated buffer bytes needed
- `buffer_max`: Maximum buffer capacity
- `packets_lost`: Total packets lost
- `packets_out_of_order`: Packets received out of sequence
- `input_rate_mbps`: Measured input bitrate in Mbps

#### 2. Get QoE Metrics

**Endpoint**: `GET /api/v1/metrics/qoe/<input_id>`

**Description**: Retrieve Quality of Experience metrics

**Parameters**:
- `input_id` (path): Input stream ID
- `minutes` (query, optional): Time range in minutes (default: 5)

**Example Request**:
```bash
curl http://localhost:5050/api/v1/metrics/qoe/1
```

**Example Response**:
```json
{
  "status": "ok",
  "data": {
    "input_id": 1,
    "black_frames_detected": 0,
    "freeze_frames_detected": 0,
    "video_pid_active": true,
    "video_bitrate_mbps": 8.5,
    "audio_silence_detected": 0,
    "audio_pid_active": true,
    "audio_loudness_lufs": -23.1,
    "audio_bitrate_kbps": 192,
    "video_quality_score": 4.8,
    "audio_quality_score": 5.0,
    "overall_mos": 4.9,
    "timestamp": "2025-01-15T10:30:45.123456Z"
  }
}
```

**Response Fields**:
- `black_frames_detected`: Count of black frame occurrences
- `freeze_frames_detected`: Count of frozen frame occurrences
- `video_pid_active`: Is video stream transmitting
- `video_bitrate_mbps`: Video stream bitrate
- `audio_silence_detected`: Count of silence occurrences
- `audio_pid_active`: Is audio stream transmitting
- `audio_loudness_lufs`: Audio loudness in LUFS
- `audio_bitrate_kbps`: Audio stream bitrate
- `video_quality_score`: 1.0-5.0 video quality score
- `audio_quality_score`: 1.0-5.0 audio quality score
- `overall_mos`: Mean Opinion Score (1.0-5.0)

#### 3. Get Comprehensive Metrics

**Endpoint**: `GET /api/v1/metrics/comprehensive/<input_id>`

**Description**: Retrieve all metrics (TR 101 290, MDI, QoE) in one call

**Parameters**:
- `input_id` (path): Input stream ID
- `minutes` (query, optional): Time range in minutes (default: 5)

**Example Request**:
```bash
curl http://localhost:5050/api/v1/metrics/comprehensive/1
```

**Example Response**:
```json
{
  "status": "ok",
  "data": {
    "input_id": 1,
    "input_name": "VTV1 HD Primary",
    "tr101290": {
      "priority1_errors": 0,
      "priority2_errors": 0,
      "priority3_errors": 0,
      "errors": []
    },
    "mdi": {
      "df": 12.45,
      "mlr": 0.0,
      "jitter_ms": 8.32,
      ...
    },
    "qoe": {
      "overall_mos": 4.9,
      "video_quality_score": 4.8,
      "audio_quality_score": 5.0,
      ...
    },
    "stream_info": {
      "bitrate_mbps": 10.125,
      "protocol": "udp",
      "multicast_address": "225.3.3.42:30130"
    }
  }
}
```

#### 4. Get Input List

**Endpoint**: `GET /api/v1/inputs`

**Description**: Retrieve list of all configured inputs

**Example Request**:
```bash
curl http://localhost:5050/api/v1/inputs
```

**Example Response**:
```json
{
  "status": "ok",
  "data": [
    {
      "input_id": 1,
      "input_name": "VTV1 HD Primary",
      "url": "udp://225.3.3.42:30130",
      "active": true
    }
  ]
}
```

### Error Responses

**404 Not Found**:
```json
{
  "error": "Input not found",
  "input_id": 999
}
```

**503 Service Unavailable**:
```json
{
  "error": "InfluxDB not available"
}
```

**500 Internal Server Error**:
```json
{
  "error": "Error message description"
}
```

---

## UI User Guide

### Accessing the Dashboard

1. Open web browser
2. Navigate to: `http://localhost:3000`
3. Click on the **Metrics** tab

### Understanding the MDI Panel

The MDI panel displays network transport quality metrics with color-coded indicators:

#### Panel Sections

**1. Core MDI Metrics**
- **DF (Delay Factor)**: Shows maximum jitter
- **MLR (Media Loss Rate)**: Shows packet loss rate
- Color codes:
  - Green: Excellent network quality
  - Yellow: Warning - potential issues
  - Red: Critical - network problems

**2. Buffer Management**
- **Buffer Depth**: Current estimated buffer fill
- **Buffer Max**: Maximum buffer capacity
- **Buffer Utilization**: Percentage of buffer used
- Shows if decoder buffer is adequate for network jitter

**3. Network Statistics**
- **Jitter**: Average packet delay variation
- **Max Jitter**: Worst-case jitter (same as DF)
- **Inter-arrival Time**: Average packet spacing
- **Packets Lost**: Total packet loss count
- **Input Rate**: Measured stream bitrate

**4. Network Analysis**
- Intelligent alerts explaining network conditions
- Examples:
  - "Excellent network quality - Low jitter, no packet loss"
  - "High delay factor (35ms) indicates network congestion"
  - "Packet loss detected (2.5 pps) - This causes CC errors"

#### Interpreting MDI Panel Colors

**Green Border/Indicators**:
- Network is performing excellently
- No action needed

**Yellow Border/Indicators**:
- Network has some jitter or minor issues
- Monitor closely, may need investigation

**Red Border/Indicators**:
- Network has serious problems
- Immediate investigation required
- Likely causing viewer-visible issues

### Understanding the QoE Panel

The QoE panel displays viewer-perceived quality metrics:

#### Panel Sections

**1. Overall MOS Score**
- Large circular indicator at top
- Shows 1.0-5.0 Mean Opinion Score
- Color-coded: Green (excellent), Yellow (fair), Red (poor)
- Rating text: Excellent, Good, Fair, Poor, Bad

**2. Video Quality Section**
- **Quality Score**: 1.0-5.0 video quality rating
- **Video Bitrate**: Stream bitrate in Mbps
- **Black Frames**: Count of black frame events
- **Freeze Frames**: Count of frozen frame events
- **PID Status**: Active/Inactive indicator

**3. Audio Quality Section**
- **Quality Score**: 1.0-5.0 audio quality rating
- **Audio Bitrate**: Stream bitrate in kbps
- **Loudness (LUFS)**: Audio level measurement
- **Silence Events**: Count of silence detections
- **PID Status**: Active/Inactive indicator

**4. Quality Alerts**
- Appears when issues are detected
- Lists specific quality problems:
  - Black frame warnings
  - Freeze frame warnings
  - Audio silence warnings

#### Interpreting QoE Scores

**MOS 4.5-5.0 (Excellent)**:
- Viewer experience is excellent
- No noticeable quality issues
- Broadcast-quality video

**MOS 4.0-4.5 (Good)**:
- Viewer experience is good
- Minor quality issues that are not annoying
- Acceptable for most broadcasting

**MOS 3.5-4.0 (Fair)**:
- Viewer experience is fair
- Noticeable quality degradation
- Investigation recommended

**MOS 2.5-3.5 (Poor)**:
- Viewer experience is poor
- Annoying quality issues
- Immediate action required

**MOS 1.0-2.5 (Bad)**:
- Viewer experience is very poor
- Severe quality problems
- Service is unusable

### Bitrate Display

All bitrate values are now displayed in **Mbps** (Megabits per second):

- Stream bitrate charts show Mbps on Y-axis
- Video bitrate displayed as "X.XXX Mbps"
- Audio bitrate remains in kbps for precision

**Example**:
- Old: "10125.5 kbps"
- New: "10.126 Mbps"

### Auto-Refresh

The dashboard automatically refreshes every **10 seconds** to show real-time data:
- Latest TR 101 290 errors
- Current MDI network metrics
- Updated QoE scores

---

## Troubleshooting Guide

### Common Issues and Solutions

#### Issue: High Delay Factor (DF > 30ms)

**Symptoms**:
- Red indicator on MDI panel
- High jitter values
- Continuity Count Errors in TR 101 290

**Possible Causes**:
1. Network congestion on multicast path
2. Switch buffer overflows
3. Competing traffic on network
4. QoS not properly configured

**Troubleshooting Steps**:
1. Check network switch utilization
2. Verify QoS/DSCP markings on video traffic
3. Test with `iperf` to measure network jitter
4. Check for competing multicast streams
5. Verify switch multicast snooping configuration

**Solution**:
- Implement QoS to prioritize video traffic
- Increase switch buffer sizes if possible
- Isolate video traffic on dedicated VLAN
- Reduce competing traffic

#### Issue: Media Loss Rate (MLR > 0)

**Symptoms**:
- Packet loss shown in MDI panel
- Severe Continuity Count Errors
- Video artifacts, pixelation, freezing

**Possible Causes**:
1. Network congestion causing packet drops
2. Switch port buffer overflows
3. Multicast routing issues
4. Receiver buffer too small

**Troubleshooting Steps**:
1. Check switch port error counters
2. Verify multicast routing (IGMP/PIM)
3. Test end-to-end connectivity with `mcast-test`
4. Check for duplicate multicast streams
5. Verify network path MTU

**Solution**:
- Fix network congestion (add bandwidth, QoS)
- Configure switch multicast buffering
- Fix multicast routing configuration
- Ensure proper IGMP snooping

#### Issue: Low QoE Score (MOS < 3.5)

**Symptoms**:
- Red or yellow MOS indicator
- Quality alerts showing issues
- Poor viewer experience

**Possible Causes**:
1. Network transport issues (check MDI)
2. Encoder problems
3. Source feed quality issues
4. Black frames or freeze frames detected

**Troubleshooting Steps**:
1. Check MDI metrics first (network layer)
2. Review TR 101 290 errors (transport layer)
3. Check for black/freeze frames in QoE
4. Verify encoder health and configuration
5. Check source feed quality

**Solution**:
- If MDI shows issues: Fix network (see above)
- If encoder issues: Restart encoder, check config
- If source issues: Check upstream source
- If MPEG-TS errors: Check encoder TS generation

#### Issue: Black Frames Detected

**Symptoms**:
- QoE panel shows black frame count > 0
- Occasional black screens reported by viewers

**Possible Causes**:
1. Source feed signal loss
2. Encoder input failure
3. Scene changes to black content (false positive)
4. Decoder issues

**Troubleshooting Steps**:
1. Check if black frames are actual content (test pattern)
2. Verify encoder input signal presence
3. Check source feed stability
4. Review encoder logs for input errors

**Solution**:
- Fix source feed connection
- Restart encoder if input failed
- Configure encoder for input loss handling
- If false positive: Adjust detection threshold

#### Issue: Audio Silence Detected

**Symptoms**:
- QoE panel shows silence detection count > 0
- Viewers report no audio

**Possible Causes**:
1. Source audio feed loss
2. Encoder audio input failure
3. Audio PID missing from TS
4. Actual silent content (false positive)

**Troubleshooting Steps**:
1. Check audio PID active status
2. Verify encoder audio input levels
3. Check source feed audio presence
4. Review audio bitrate (should be > 0)

**Solution**:
- Fix source audio feed
- Restart encoder audio input
- Verify audio encoding configuration
- Check audio mapping in encoder

#### Issue: Audio Loudness Non-Compliant

**Symptoms**:
- LUFS value far from -23 LUFS target
- Loudness complaints from viewers

**Possible Causes**:
1. Encoder loudness control not enabled
2. Source feed loudness incorrect
3. Audio processing misconfigured

**Troubleshooting Steps**:
1. Measure source feed loudness
2. Check encoder loudness normalization settings
3. Verify EBU R128 compliance configuration

**Solution**:
- Enable encoder loudness normalization
- Set target to -23 LUFS ± 1 LU
- Configure True Peak limiting to -1 dBTP
- Fix source loudness if possible

#### Issue: No Metrics Displayed

**Symptoms**:
- MDI/QoE panels show "No data" or empty
- API returns null values

**Possible Causes**:
1. Monitor service not running
2. InfluxDB connection issue
3. No data collected yet (new deployment)

**Troubleshooting Steps**:
1. Check monitor service status: `ps aux | grep monitor`
2. Check monitor logs: `tail -f /home/thanghl/Inspector/deploy/monitor.log`
3. Verify InfluxDB is running: `docker ps | grep influxdb`
4. Wait 30 seconds for first collection cycle

**Solution**:
- Start monitor service: `cd /home/thanghl/Inspector && python3 1_packager_monitor_service.py &`
- Check InfluxDB connection in monitor logs
- Wait for first metrics collection (30 second interval)
- Verify input ID is correct

---

## Network Metrics and DVB Errors Relationship

### Understanding the Connection

Network transport issues directly cause MPEG-TS errors. The MDI metrics help identify the **root cause** of DVB errors:

### Mapping: Network Issues → DVB Errors

#### 1. Packet Loss (MLR > 0) → Continuity Count Errors

**Mechanism**:
```
Network packet lost
  ↓
Missing TS packets (7 packets per UDP packet typically)
  ↓
Discontinuous CC (Continuity Counter)
  ↓
TR 101 290 Priority 1: Continuity Count Error
```

**Example**:
- MLR = 2.0 pps (2 packets lost per second)
- Each packet contains ~7 TS packets
- Result: ~14 CC errors per second
- Viewer impact: Video pixelation, brief freezes

**Solution Path**:
1. MDI shows MLR > 0
2. Identify network packet loss
3. Check switch port errors, congestion
4. Fix network issue (QoS, bandwidth, routing)
5. MLR returns to 0
6. CC errors stop

#### 2. High Jitter (DF > 30ms) → Buffer Overflow/Underflow → CC Errors

**Mechanism**:
```
High network jitter (DF = 45ms)
  ↓
Decoder buffer too small (designed for DF < 20ms)
  ↓
Buffer overflow/underflow
  ↓
Dropped packets or stalled playback
  ↓
TR 101 290 Continuity Count Errors
```

**Example**:
- DF = 45ms, but decoder buffer only handles 20ms
- Jitter causes buffer to overflow
- Decoder drops packets to prevent overflow
- Result: CC errors even though no network packet loss

**Solution Path**:
1. MDI shows high DF (45ms)
2. Identify excessive jitter
3. Check for network congestion, competing traffic
4. Implement QoS to stabilize packet delivery
5. DF drops to acceptable level (< 20ms)
6. Buffer operates normally, CC errors stop

#### 3. Out-of-Order Packets → TS Sync Loss

**Mechanism**:
```
Packets arrive out of sequence
  ↓
TS packet order scrambled
  ↓
0x47 sync byte not found in expected position
  ↓
TR 101 290 Priority 1: TS Sync Loss
```

**Example**:
- Multicast packets arrive out of order due to routing changes
- TS packet sequence disrupted
- Decoder loses synchronization
- Result: TS Sync Loss errors, severe video disruption

**Solution Path**:
1. MDI shows packets_out_of_order > 0
2. Check multicast routing stability
3. Verify single path to receiver (no ECMP)
4. Fix routing to ensure in-order delivery
5. TS sync maintained

#### 4. Low Bitrate → PCR Errors

**Mechanism**:
```
Network throughput insufficient
  ↓
Actual bitrate < nominal bitrate
  ↓
PCR packets delayed or lost
  ↓
TR 101 290 Priority 1: PCR Error
```

**Example**:
- Stream nominal bitrate: 10 Mbps
- MDI input_rate_mbps: 8.5 Mbps
- PCR intervals exceed 40ms limit
- Result: PCR repetition errors, decoder clock issues

**Solution Path**:
1. MDI shows input_rate_mbps below expected
2. Network bandwidth insufficient
3. Add bandwidth or reduce competing traffic
4. input_rate matches nominal bitrate
5. PCR timing correct

### Diagnostic Decision Tree

```
Problem: Continuity Count Errors
  ↓
Check MDI Metrics
  ↓
  ├─ MLR > 0?
  │    ↓ YES
  │    └─ Network packet loss → Fix network (switches, QoS)
  │
  ├─ DF > 30ms?
  │    ↓ YES
  │    └─ High jitter → Implement QoS, check congestion
  │
  ├─ Packets out of order > 0?
  │    ↓ YES
  │    └─ Routing issues → Fix multicast routing
  │
  └─ Input rate < nominal?
       ↓ YES
       └─ Bandwidth insufficient → Add capacity
```

### Priority Investigation Order

When investigating errors:

1. **Check MDI First**: Network layer is most common cause
2. **Check TR 101 290**: MPEG-TS layer validation
3. **Check QoE**: Viewer-perceived impact

**Example Investigation**:
```
Viewer reports: "Video keeps freezing"
  ↓
Step 1: Check QoE
  - MOS: 2.8 (Poor)
  - Freeze frames: 15 detected
  - Confirms viewer report
  ↓
Step 2: Check TR 101 290
  - CC Errors: 250 in last minute
  - PCR Errors: 0
  - Indicates packet loss
  ↓
Step 3: Check MDI
  - MLR: 3.5 pps
  - DF: 18ms
  - ROOT CAUSE: Network packet loss
  ↓
Solution: Fix network packet loss
  - Check switch port errors
  - Implement QoS
  - MLR → 0, CC Errors → 0, MOS → 4.5
```

---

## Best Practices

### Monitoring Strategy

#### 1. Set Up Alerts

Configure alerts based on these thresholds:

**Critical Alerts** (Immediate Response):
- MLR > 1.0 pps
- DF > 50ms
- MOS < 2.5
- TR 101 290 Priority 1 errors > 10

**Warning Alerts** (Investigation):
- MLR > 0 pps
- DF > 30ms
- MOS < 3.5
- Jitter > 20ms

**Info Alerts** (Monitoring):
- DF > 15ms
- MOS < 4.0
- Buffer utilization > 85%

#### 2. Regular Health Checks

**Daily**:
- Review MOS scores for all channels
- Check for any MDI warnings
- Verify no persistent packet loss

**Weekly**:
- Analyze DF trends (improving or degrading?)
- Review jitter patterns (time of day correlation?)
- Check audio loudness compliance

**Monthly**:
- Capacity planning based on input_rate trends
- Network performance review
- QoE trend analysis

#### 3. Baseline Your Streams

Establish normal operating parameters:

**Example Baseline**:
```
Channel: VTV1 HD
Normal DF: 8-12ms
Normal Jitter: 5-8ms
Normal MOS: 4.7-5.0
Normal Bitrate: 10.125 Mbps
Packet Loss: 0 pps
```

Alert when metrics deviate significantly from baseline.

#### 4. Network Quality Maintenance

**Ensure**:
- QoS policies prioritize video traffic (DSCP EF or AF41)
- Switch buffers adequate for multicast video
- Multicast routing stable (no route flapping)
- No competing high-bandwidth traffic on video VLAN
- Regular switch firmware updates

#### 5. Integration with Workflow

**Operator Workflow**:
1. Start shift: Check all MOS scores
2. Green (MOS > 4.5): No action
3. Yellow (MOS 3.5-4.5): Investigate, monitor
4. Red (MOS < 3.5): Immediate troubleshooting
5. Use MDI to identify root cause
6. Fix underlying issue
7. Verify MOS returns to green

#### 6. Documentation

**Maintain**:
- Network topology diagram
- Multicast routing configuration
- QoS policy documentation
- Encoder configuration backups
- Incident log with MDI/QoE metrics

**Incident Template**:
```
Date: 2025-01-15 14:30
Channel: VTV1 HD
Symptom: Viewer reports freezing video
MOS: 2.8
MDI DF: 18ms
MDI MLR: 3.5 pps
Root Cause: Switch port buffer overflow
Action: Increased buffer size, enabled QoS
Result: MLR → 0, MOS → 4.8
```

---

## Appendix

### RFC 4445 Reference

Full specification: https://tools.ietf.org/html/rfc4445

### EBU R128 Reference

Loudness specification: https://tech.ebu.ch/docs/r/r128.pdf

### TR 101 290 Reference

DVB error specification: https://www.etsi.org/deliver/etsi_tr/101200_101299/101290/

### Formulas Quick Reference

```
DF = Max Jitter (ms)

MLR = Lost Packets / Time Period (pps)

Jitter = StdDev(Inter-arrival Times)

Buffer Size = (Bitrate bps × DF sec) / 8

MOS = (Video Quality + Audio Quality) / 2

Video Quality = 5.0 - (CC_Errors/100) - (Sync_Loss/10) - (Black_Frames/20)

Audio Quality = 5.0 - (Silence_Count/50)
```

### Support

For issues or questions:
- GitHub: https://github.com/thang86/Inspector/issues
- Documentation: /home/thanghl/Inspector/deploy/MDI_QOE_DOCUMENTATION.md
- Logs: /home/thanghl/Inspector/deploy/monitor.log

---

**Document Version**: 1.0
**Last Updated**: 2025-01-15
**Author**: Inspector Monitoring System
**License**: MIT
