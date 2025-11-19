# Codec Analysis & LUFS Implementation - Progress Report
**Date**: 2025-11-19
**Status**: Backend Complete, Frontend Pending

---

## ✅ COMPLETED: Backend Implementation

### 1. Codec Detection System

**New Dataclass**: `CodecInfo` (lines 239-259)
```python
@dataclass
class CodecInfo:
    input_id: int
    input_name: str

    # Video Codec Information
    video_codec: str = "Unknown"       # h264, hevc, mpeg2video
    video_profile: str = "Unknown"     # High, Main, Baseline
    video_level: str = "Unknown"       # 4.0, 5.1, etc.
    video_resolution: str = "Unknown"  # 1920x1080, 3840x2160
    video_fps: str = "Unknown"         # 25.00, 29.97, 50.00
    video_bitrate_kbps: float = 0.0

    # Audio Codec Information
    audio_codec: str = "Unknown"       # aac, mp3, ac3, eac3
    audio_channels: str = "Unknown"    # stereo, mono, 5.1, 7.1
    audio_sample_rate: str = "Unknown" # 48000 Hz, 44100 Hz
    audio_bitrate_kbps: float = 0.0

    timestamp: datetime = None
```

### 2. Enhanced QoE Metrics

**Updated**: `QoEMetrics` dataclass (lines 261-286)
- Added `audio_loudness_i`: Integrated loudness (LUFS)
- Added `audio_loudness_lra`: Loudness range (LU)
- Maintains existing `audio_loudness_lufs` for backward compatibility

### 3. ffprobe Analysis Method

**New Method**: `_analyze_stream_with_ffprobe()` (lines 521-673)

**What it does**:
1. Saves TS stream data to temporary file
2. Runs `ffprobe` to extract codec information
3. Parses video stream: codec, profile, resolution, FPS, bitrate
4. Parses audio stream: codec, channels, sample rate, bitrate
5. Runs `ffmpeg` with `ebur128` filter for LUFS analysis
6. Extracts Integrated Loudness (I) and Loudness Range (LRA)
7. Cleans up temporary files

**Command used for LUFS**:
```bash
ffmpeg -i <temp_file> -t 5 -af ebur128=framelog=verbose -f null -
```

**Parsing logic**:
- Looks for `I: XX.X LUFS` in ffmpeg stderr output
- Looks for `LRA: XX.X LU` for loudness range
- Handles parsing errors gracefully

### 4. Enhanced MOS Calculation

**New Method**: `_calculate_mos()` (lines 1558-1590)

**Scoring Algorithm**:
```python
Start: MOS = 5.0 (perfect)

Deductions:
- TR 101 290 P1 errors: -0.1 per error (max -2.0)
- TR 101 290 P2 errors: -0.02 per error (max -0.5)
- Packet loss: -10 * loss_rate (max -1.5)
- Low bitrate (<0.5 Mbps): -1.0
- Low bitrate (<0.8 Mbps): -0.5
- Very high bitrate (>20 Mbps): -0.3

Result: MOS clamped to 1.0 - 5.0
```

### 5. InfluxDB Integration

**New Method**: `_push_codec_info()` (lines 1529-1556)

**Measurement**: `codec_info`
**Tags**:
- input_id
- input_name
- video_codec
- audio_codec

**Fields**:
- video_profile, video_level, video_resolution, video_fps
- video_bitrate_kbps
- audio_channels, audio_sample_rate, audio_bitrate_kbps

**Updated Method**: `_push_qoe_metrics()` (lines 1497-1527)
- Added `audio_loudness_i` field
- Added `audio_loudness_lra` field

### 6. Integration Point

**Modified**: UDP probe method (line 847-866)

**Flow**:
1. Analyze TR 101 290 errors
2. Calculate MDI metrics
3. **NEW**: Analyze codec with ffprobe
4. **NEW**: Calculate enhanced MOS
5. Push codec info to InfluxDB
6. Push QoE metrics to InfluxDB

**Log output**:
```
Stream analysis for VTV %HD:
  Video=h264 1920x1080@25.00fps,
  Audio=aac stereo,
  LUFS=-23.5, MOS=4.85
```

---

## 🔄 TODO: Frontend Implementation

### Required Changes to UI (deploy/ui-app/src/App.jsx)

#### 1. Create Codec Display Component

**Location**: Before MetricsTab (around line 570)

```jsx
const CodecPanel = ({ codecInfo }) => {
  if (!codecInfo) return null;

  return (
    <div className="codec-panel">
      <h3>Stream Codec Information</h3>

      <div className="codec-grid">
        {/* Video Codec */}
        <div className="codec-section">
          <h4>Video Codec</h4>
          <div className="codec-info">
            <div className="codec-item">
              <span className="label">Codec:</span>
              <span className="value codec-badge">{codecInfo.video_codec.toUpperCase()}</span>
            </div>
            <div className="codec-item">
              <span className="label">Profile:</span>
              <span className="value">{codecInfo.video_profile}</span>
            </div>
            <div className="codec-item">
              <span className="label">Level:</span>
              <span className="value">{codecInfo.video_level}</span>
            </div>
            <div className="codec-item">
              <span className="label">Resolution:</span>
              <span className="value">{codecInfo.video_resolution}</span>
            </div>
            <div className="codec-item">
              <span className="label">Frame Rate:</span>
              <span className="value">{codecInfo.video_fps} fps</span>
            </div>
            <div className="codec-item">
              <span className="label">Bitrate:</span>
              <span className="value">{codecInfo.video_bitrate_kbps.toFixed(0)} kbps</span>
            </div>
          </div>
        </div>

        {/* Audio Codec */}
        <div className="codec-section">
          <h4>Audio Codec</h4>
          <div className="codec-info">
            <div className="codec-item">
              <span className="label">Codec:</span>
              <span className="value codec-badge">{codecInfo.audio_codec.toUpperCase()}</span>
            </div>
            <div className="codec-item">
              <span className="label">Channels:</span>
              <span className="value">{codecInfo.audio_channels}</span>
            </div>
            <div className="codec-item">
              <span className="label">Sample Rate:</span>
              <span className="value">{codecInfo.audio_sample_rate}</span>
            </div>
            <div className="codec-item">
              <span className="label">Bitrate:</span>
              <span className="value">{codecInfo.audio_bitrate_kbps.toFixed(0)} kbps</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
```

#### 2. Create Enhanced MOS Component

**Replace**: Current placeholder (lines 932-949)

```jsx
const VideoMOSPanel = ({ qoeMetrics, tr101290Metrics, mdiMetrics }) => {
  if (!qoeMetrics || !tr101290Metrics) return null;

  const getMOSColor = (mos) => {
    if (mos >= 4.5) return 'excellent';
    if (mos >= 4.0) return 'good';
    if (mos >= 3.5) return 'fair';
    if (mos >= 2.5) return 'poor';
    return 'bad';
  };

  const getMOSLabel = (mos) => {
    if (mos >= 4.5) return 'Excellent';
    if (mos >= 4.0) return 'Good';
    if (mos >= 3.5) return 'Fair';
    if (mos >= 2.5) return 'Poor';
    return 'Bad';
  };

  const mosColor = getMOSColor(qoeMetrics.overall_mos);

  return (
    <div className="mos-panel">
      <h3>Video MOS (Mean Opinion Score)</h3>

      <div className="mos-display">
        <div className={`mos-score mos-${mosColor}`}>
          <div className="mos-value">{qoeMetrics.overall_mos.toFixed(2)}</div>
          <div className="mos-label">{getMOSLabel(qoeMetrics.overall_mos)}</div>
        </div>

        <div className="mos-factors">
          <h4>Quality Factors</h4>

          <div className="factor-item">
            <span className="factor-label">TR 101 290 P1 Errors:</span>
            <span className={`factor-value ${tr101290Metrics.priority_1.total_p1_errors > 0 ? 'error' : 'success'}`}>
              {tr101290Metrics.priority_1.total_p1_errors}
            </span>
          </div>

          <div className="factor-item">
            <span className="factor-label">TR 101 290 P2 Errors:</span>
            <span className={`factor-value ${tr101290Metrics.priority_2.total_p2_errors > 0 ? 'warning' : 'success'}`}>
              {tr101290Metrics.priority_2.total_p2_errors}
            </span>
          </div>

          {mdiMetrics && (
            <>
              <div className="factor-item">
                <span className="factor-label">Packet Loss:</span>
                <span className={`factor-value ${mdiMetrics.packets_lost > 0 ? 'error' : 'success'}`}>
                  {mdiMetrics.packets_lost} packets
                </span>
              </div>

              <div className="factor-item">
                <span className="factor-label">Jitter:</span>
                <span className={`factor-value ${mdiMetrics.jitter_ms > 10 ? 'warning' : 'success'}`}>
                  {mdiMetrics.jitter_ms?.toFixed(2)} ms
                </span>
              </div>
            </>
          )}

          <div className="factor-item">
            <span className="factor-label">Video Stream:</span>
            <span className={`factor-value ${qoeMetrics.video_pid_active ? 'success' : 'error'}`}>
              {qoeMetrics.video_pid_active ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div className="factor-item">
            <span className="factor-label">Audio Stream:</span>
            <span className={`factor-value ${qoeMetrics.audio_pid_active ? 'success' : 'error'}`}>
              {qoeMetrics.audio_pid_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
```

#### 3. Create Audio LUFS Component

**Replace**: Current placeholder (lines 951-958)

```jsx
const AudioLUFSPanel = ({ qoeMetrics }) => {
  if (!qoeMetrics) return null;

  const getLUFSCompliance = (lufs) => {
    // EBU R128 target: -23 LUFS ± 1 LU
    if (Math.abs(lufs + 23) <= 1.0) return 'compliant';
    if (Math.abs(lufs + 23) <= 2.0) return 'acceptable';
    return 'non-compliant';
  };

  const compliance = getLUFSCompliance(qoeMetrics.audio_loudness_lufs);

  return (
    <div className="lufs-panel">
      <h3>Audio Loudness (LUFS)</h3>
      <p className="lufs-desc">EBU R128 Compliance Measurement</p>

      <div className="lufs-display">
        <div className={`lufs-meter lufs-${compliance}`}>
          <div className="lufs-value">
            {qoeMetrics.audio_loudness_lufs?.toFixed(1) || 'N/A'}
            <span className="lufs-unit">LUFS</span>
          </div>
          <div className="lufs-label">
            Integrated Loudness
          </div>
        </div>

        <div className="lufs-details">
          <div className="lufs-metric">
            <span className="metric-label">Integrated (I):</span>
            <span className="metric-value">
              {qoeMetrics.audio_loudness_i?.toFixed(1) || 'N/A'} LUFS
            </span>
          </div>

          <div className="lufs-metric">
            <span className="metric-label">Loudness Range (LRA):</span>
            <span className="metric-value">
              {qoeMetrics.audio_loudness_lra?.toFixed(1) || 'N/A'} LU
            </span>
          </div>

          <div className="lufs-metric">
            <span className="metric-label">EBU R128 Target:</span>
            <span className="metric-value">-23.0 LUFS ± 1 LU</span>
          </div>

          <div className={`compliance-status status-${compliance}`}>
            <span className="status-icon">
              {compliance === 'compliant' ? '✓' : compliance === 'acceptable' ? '⚠' : '✗'}
            </span>
            <span className="status-text">
              {compliance === 'compliant' ? 'EBU R128 Compliant' :
               compliance === 'acceptable' ? 'Acceptable Range' :
               'Non-Compliant'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
```

#### 4. Update MetricsTab to Fetch Codec Data

**Add state** (around line 574):
```jsx
const [codecInfo, setCodecInfo] = useState(null);
```

**Update fetch** (around line 650):
```jsx
const fetchMetrics = async () => {
  // ... existing code ...

  const [streamRes, tr101290Res, statusRes, mdiRes, qoeRes, codecRes] = await Promise.all([
    fetch(`${API_BASE}/metrics/stream/${selectedInput}?minutes=60`),
    fetch(`${API_BASE}/metrics/tr101290/${selectedInput}`),
    fetch(`${API_BASE}/metrics/status/${selectedInput}`),
    fetch(`${API_BASE}/metrics/mdi/${selectedInput}`),
    fetch(`${API_BASE}/metrics/qoe/${selectedInput}`),
    fetch(`${API_BASE}/metrics/codec/${selectedInput}`)  // NEW
  ]);

  // ... existing parsing ...

  if (codecRes.ok) {
    const codecData = await codecRes.json();
    setCodecInfo(codecData);
  }
};
```

**Render components** (replace placeholders around line 932):
```jsx
{/* Codec Information */}
{codecInfo && (
  <CodecPanel codecInfo={codecInfo} />
)}

{/* Video MOS */}
{qoeMetrics && tr101290Metrics && (
  <VideoMOSPanel
    qoeMetrics={qoeMetrics}
    tr101290Metrics={tr101290Metrics}
    mdiMetrics={mdiMetrics}
  />
)}

{/* Audio LUFS */}
{qoeMetrics && (
  <AudioLUFSPanel qoeMetrics={qoeMetrics} />
)}
```

---

## 🔄 TODO: API Endpoints

### Add to Flask API (2_cms_api_flask.py)

#### 1. Codec Endpoint

```python
@app.route('/api/v1/metrics/codec/<int:input_id>', methods=['GET'])
def get_codec_info(input_id):
    """Get latest codec information for input"""
    try:
        # Query latest codec info from InfluxDB
        query = f'''
        from(bucket: "{INFLUXDB_BUCKET}")
            |> range(start: -1h)
            |> filter(fn: (r) => r["_measurement"] == "codec_info")
            |> filter(fn: (r) => r["input_id"] == "{input_id}")
            |> last()
        '''

        result = query_api.query(query, org=INFLUXDB_ORG)

        if not result or len(result) == 0:
            return jsonify({"error": "No codec data found"}), 404

        # Parse results
        codec_data = {
            "video_codec": "Unknown",
            "audio_codec": "Unknown"
        }

        for table in result:
            for record in table.records:
                field = record.get_field()
                value = record.get_value()

                if field in ['video_profile', 'video_level', 'video_resolution',
                             'video_fps', 'video_bitrate_kbps', 'audio_channels',
                             'audio_sample_rate', 'audio_bitrate_kbps']:
                    codec_data[field] = value

        # Get tags
        if result and len(result) > 0 and result[0].records:
            tags = result[0].records[0].values
            codec_data['video_codec'] = tags.get('video_codec', 'Unknown')
            codec_data['audio_codec'] = tags.get('audio_codec', 'Unknown')

        return jsonify(codec_data)

    except Exception as e:
        return jsonify({"error": str(e)}), 500
```

#### 2. Update QoE Endpoint

Add LUFS fields to existing `/api/v1/metrics/qoe/<input_id>` endpoint:

```python
# Add to query fields:
|> filter(fn: (r) =>
    r["_field"] == "audio_loudness_lufs" or
    r["_field"] == "audio_loudness_i" or
    r["_field"] == "audio_loudness_lra" or
    r["_field"] == "overall_mos" or
    r["_field"] == "video_pid_active" or
    r["_field"] == "audio_pid_active")
```

---

## 📊 Required CSS Styles

### Add to Dashboard.css

```css
/* ============================================================================
   Codec Panel Styles
   ============================================================================ */
.codec-panel {
  background: linear-gradient(135deg, #1e2530 0%, #252d3a 100%);
  border: 1px solid rgba(0, 255, 255, 0.15);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
}

.codec-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 20px;
  margin-top: 15px;
}

.codec-section h4 {
  color: #00E5FF;
  font-size: 16px;
  margin-bottom: 12px;
  border-bottom: 2px solid rgba(0, 229, 255, 0.3);
  padding-bottom: 8px;
}

.codec-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.codec-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
}

.codec-item .label {
  color: #8B95A5;
  font-size: 13px;
  font-weight: 500;
}

.codec-item .value {
  color: #E2E8F0;
  font-size: 14px;
  font-weight: 600;
}

.codec-badge {
  background: linear-gradient(135deg, #00E5FF 0%, #00B8D4 100%);
  color: #0a0e17;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

/* ============================================================================
   MOS Panel Styles
   ============================================================================ */
.mos-panel {
  background: linear-gradient(135deg, #1e2530 0%, #252d3a 100%);
  border: 1px solid rgba(0, 255, 255, 0.15);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
}

.mos-display {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 30px;
  margin-top: 15px;
}

.mos-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px;
  border-radius: 12px;
  border: 3px solid;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.mos-score.mos-excellent {
  background: rgba(72, 187, 120, 0.15);
  border-color: #48BB78;
  box-shadow: 0 0 20px rgba(72, 187, 120, 0.3);
}

.mos-score.mos-good {
  background: rgba(0, 217, 163, 0.15);
  border-color: #00D9A3;
  box-shadow: 0 0 20px rgba(0, 217, 163, 0.3);
}

.mos-score.mos-fair {
  background: rgba(255, 184, 0, 0.15);
  border-color: #FFB800;
  box-shadow: 0 0 20px rgba(255, 184, 0, 0.3);
}

.mos-score.mos-poor {
  background: rgba(255, 140, 0, 0.15);
  border-color: #FF8C00;
  box-shadow: 0 0 20px rgba(255, 140, 0, 0.3);
}

.mos-score.mos-bad {
  background: rgba(255, 59, 59, 0.15);
  border-color: #FF3B3B;
  box-shadow: 0 0 20px rgba(255, 59, 59, 0.3);
}

.mos-value {
  font-size: 48px;
  font-weight: 700;
  color: #00FFFF;
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
}

.mos-label {
  font-size: 16px;
  color: #B0BAC9;
  margin-top: 8px;
  font-weight: 600;
}

.mos-factors {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 20px;
}

.mos-factors h4 {
  color: #00E5FF;
  font-size: 15px;
  margin-bottom: 15px;
}

.factor-item {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.factor-label {
  color: #8B95A5;
  font-size: 13px;
}

.factor-value {
  font-weight: 600;
  font-size: 14px;
}

.factor-value.success {
  color: #48BB78;
}

.factor-value.warning {
  color: #FFB800;
}

.factor-value.error {
  color: #FF3B3B;
}

/* ============================================================================
   LUFS Panel Styles
   ============================================================================ */
.lufs-panel {
  background: linear-gradient(135deg, #1e2530 0%, #252d3a 100%);
  border: 1px solid rgba(0, 255, 255, 0.15);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
}

.lufs-desc {
  color: #8B95A5;
  font-size: 13px;
  margin: 5px 0 15px 0;
}

.lufs-display {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 30px;
  margin-top: 15px;
}

.lufs-meter {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px;
  border-radius: 12px;
  border: 3px solid;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.lufs-meter.lufs-compliant {
  background: rgba(72, 187, 120, 0.15);
  border-color: #48BB78;
  box-shadow: 0 0 20px rgba(72, 187, 120, 0.3);
}

.lufs-meter.lufs-acceptable {
  background: rgba(255, 184, 0, 0.15);
  border-color: #FFB800;
  box-shadow: 0 0 20px rgba(255, 184, 0, 0.3);
}

.lufs-meter.lufs-non-compliant {
  background: rgba(255, 59, 59, 0.15);
  border-color: #FF3B3B;
  box-shadow: 0 0 20px rgba(255, 59, 59, 0.3);
}

.lufs-value {
  font-size: 42px;
  font-weight: 700;
  color: #00FFFF;
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
}

.lufs-unit {
  font-size: 18px;
  margin-left: 8px;
  color: #B0BAC9;
  font-weight: 500;
}

.lufs-label {
  font-size: 14px;
  color: #B0BAC9;
  margin-top: 8px;
  font-weight: 500;
}

.lufs-details {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.lufs-metric {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.metric-label {
  color: #8B95A5;
  font-size: 13px;
  font-weight: 500;
}

.metric-value {
  color: #E2E8F0;
  font-size: 14px;
  font-weight: 600;
}

.compliance-status {
  margin-top: 10px;
  padding: 12px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
}

.compliance-status.status-compliant {
  background: rgba(72, 187, 120, 0.2);
  color: #48BB78;
}

.compliance-status.status-acceptable {
  background: rgba(255, 184, 0, 0.2);
  color: #FFB800;
}

.compliance-status.status-non-compliant {
  background: rgba(255, 59, 59, 0.2);
  color: #FF3B3B;
}

.status-icon {
  font-size: 18px;
}
```

---

## 🎯 Next Steps for Completion

1. **Add API endpoints** to Flask (codec, update qoe)
2. **Create UI components** (CodecPanel, VideoMOSPanel, AudioLUFSPanel)
3. **Add CSS styles** to Dashboard.css
4. **Update MetricsTab** to fetch and display codec/LUFS data
5. **Test with real streams**
6. **Rebuild monitor service** Docker image (includes ffprobe/ffmpeg)
7. **Deploy and verify** all features working

---

## 📦 Dependencies Required

### Monitor Service Container (Dockerfile.packager-monitor)

Must include:
```dockerfile
RUN apk add --no-cache ffmpeg ffmpeg-libs
```

### Python Packages (requirements.txt)

Already included:
- `psycopg2-binary`
- `influxdb-client`
- `subprocess` (built-in)
- `tempfile` (built-in)
- `json` (built-in)

---

## ✅ Success Criteria

- [ ] Backend collecting codec info every 30s
- [ ] Backend measuring LUFS every 30s
- [ ] InfluxDB storing codec_info measurement
- [ ] InfluxDB storing enhanced qoe_metrics
- [ ] API endpoint `/api/v1/metrics/codec/<id>` working
- [ ] API endpoint `/api/v1/metrics/qoe/<id>` returning LUFS
- [ ] UI displaying codec information
- [ ] UI displaying MOS score with factors
- [ ] UI displaying LUFS with EBU R128 compliance
- [ ] All components styled professionally
- [ ] Zero console errors
- [ ] Real-time updates every 30s

---

**Current Status**: Backend complete (commit 71a8950), Frontend pending implementation
