# Inspector LIVE Multi-Layer Probe (Rust Implementation)

## I. KIẾN TRÚC 6 LAYERS MONITORING

```
┌────────────────────────────────────────────────────────────────────┐
│                    PROBE INSPECTOR LIVE - 6 LAYERS                 │
└────────────────────────────────────────────────────────────────────┘

L0 - CONTRIBUTION INPUT
├─ Signal Loss / Black / Freeze Detection
├─ Audio Silence Monitor
└─ SDI/ASI → IP conversion check

    ▼

L1 - HEADEND ENCODER (MPEG-TS → HEVC/H264 4K HDR)
├─ PCR/PTS/DTS Analysis
├─ GOP Structure Validation
├─ HEVC Main10 Profile Check
├─ HDR Metadata Validation (MaxCLL/MaxFALL)
├─ Dolby Atmos JOC Analysis
├─ Audio Loudness (BS-1770-3)
├─ Macroblocking Detection
├─ Black/Freeze Frame Detection
├─ Closed Caption Validation
├─ SCTE-35 Splice Detection
└─ TR 101 290 (Priority 1/2/3 Errors)

    ▼

L2 - PACKAGER / DRM (HLS/DASH + ABR Ladder)
├─ ABR Manifest Validation (m3u8/mpd)
├─ Segment Continuity Check
├─ EBP (Elementary Bitstream Partition) Alignment
├─ fMP4 Box Validation
├─ DRM Metadata Preservation
├─ Audio Track Sync
├─ Subtitle Stream Integrity
└─ ABR Bitrate Ladder Consistency

    ▼

L3 - ORIGIN / MID-CACHE (CDN CORE)
├─ HTTP Video Flow Monitoring
├─ Segment Fetch Latency
├─ Cache Hit/Miss Ratio
├─ 4xx/5xx Error Rate
├─ Throughput Analysis
├─ Random Decode Test (MOS sampling)
└─ HDR Metadata Preservation in Cache

    ▼

L4 - EDGE POP / ISP HANDOVER (Anycast/GSLB)
├─ Regional Stream Quality Snapshot
├─ Segment Latency per Region
├─ Buffering Events (ABR metric)
├─ Packet Loss per Region
├─ ISP Correlation Analysis
└─ Cross-Layer Comparison (Headend vs Edge)

    ▼

L5 - CLIENT ANALYTICS (Player SDK + End-User Metrics)
├─ Startup Time
├─ Rebuffering Ratio
├─ Average Bitrate
├─ Device/OS/ISP/Region Analysis
├─ DRM Failure Rate
└─ Correlation with L1-L4 alarms
```

---

## II. MODULE CẤU TRÚC RUST

```rust
probe-inspector-multi-layer/
├── Cargo.toml (dependencies)
├── src/
│   ├── main.rs (entry point)
│   ├── config.rs (configuration loader)
│   ├── lib.rs
│   ├── layers/
│   │   ├── mod.rs
│   │   ├── l0_contribution.rs
│   │   ├── l1_headend.rs (DETAILED)
│   │   ├── l2_packager.rs (DETAILED)
│   │   ├── l3_cdn_core.rs
│   │   ├── l4_edge_pop.rs
│   │   └── l5_client.rs
│   ├── analyzers/
│   │   ├── mod.rs
│   │   ├── ts_parser.rs (TS/ES demuxer)
│   │   ├── hdr_analyzer.rs (HEVC Main10, HDR10/HLG)
│   │   ├── audio_atmos.rs (Dolby Digital+/Atmos)
│   │   ├── hls_dash_parser.rs (Manifest & Segment)
│   │   ├── qoe_metrics.rs (MOS, freeze, macro-blocking)
│   │   └── abr_ladder.rs (ABR validation)
│   ├── detection/
│   │   ├── mod.rs
│   │   ├── tr101290.rs (ETSI spec errors)
│   │   ├── scte35.rs (Splice detection)
│   │   ├── caption.rs (CEA-608/708)
│   │   ├── hdr_events.rs (HDR anomalies)
│   │   └── alert_rules.rs (threshold config)
│   ├── output/
│   │   ├── mod.rs
│   │   ├── snmp_traps.rs (NMS integration)
│   │   ├── ivms_export.rs (iVMS 5.x API)
│   │   ├── metrics_db.rs (InfluxDB/Prometheus)
│   │   ├── dashboard.rs (Grafana/REST API)
│   │   └── report_gen.rs
│   ├── correlation/
│   │   ├── mod.rs
│   │   ├── layer_correlation.rs (L1-L4 comparison)
│   │   └── anomaly_detection.rs (ML-based)
│   └── utils.rs
├── config/
│   ├── probe_template.yaml (default config)
│   ├── event_types.yaml (SNMP events)
│   └── alert_thresholds.yaml
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   └── API.md
└── Dockerfile
```

---

## III. L1 HEADEND PROBE - DETAILED SPEC

### **3.1 TR 101 290 Priority Errors**

**Priority 1 (Service Outage):**
- TS_SYNC_LOSS: 0x47 sync byte lost
- PAT_ERROR: Program Association Table invalid
- PMT_ERROR: Program Map Table invalid
- PID_ERROR: Unexpected or missing PID

**Priority 2 (Significant Faults):**
- TRANSPORT_ERROR: transport_error_indicator = 1
- CRC_ERROR: TS section CRC failure
- PCR_ERROR: PCR repetition > 40ms
- PCR_ACCURACY: PCR discontinuity > 500µs
- PTS_ERROR: PTS/DTS inversion
- CAT_ERROR: Conditional Access Table error

**Priority 3 (Minor Issues):**
- UNREFERENCED_PID: PID in PAT/PMT not found
- PID_CONFLICT: Duplicate PID types
- UNUSED_PID: PID received but not in PMT
- SLOW_BITRATE: Bitrate lower than expected

### **3.2 HDR Metadata Monitoring (4K HDR10/HLG)**

Kiểm tra HEVC SEI messages:
- Master Display Color Volume (MDCV)
- Content Light Level (CLL) - MaxCLL, MaxFALL
- Color Space (BT2020, BT709)
- Transfer Function (HDR10, HLG, PQ)

### **3.3 Dolby Digital+ & Atmos**

Phát hiện:
- AC-4 Immersive Audio Presence
- JOC (Joint Object Codec) frame structure
- Loudness per object/channel (LKFS)

### **3.4 Audio Quality (BS-1770-3)**

- LUFS Target: -23.0 (Broadcast), -16.0 (Amazon Prime)
- Loudness Range (LRA)
- True Peak (max +3dBFS)
- Alert nếu: |ΔdB| > 2.0 LUFS

### **3.5 GOP & Compression**

- I-frame (Keyframe) interval: 30 frames (1080p/30fps)
- P-frame distribution
- Compression artifacts (Banding, blockiness)
- Bitrate consistency vs resolution

### **3.6 QoE Metrics**

- **Video MOS**: 1-5 scale (based on H.264/H.265 decoder)
  - 5 = Excellent
  - 4 = Good (slight distortion)
  - 3 = Fair (noticeable distortion)
  - 2 = Poor (major distortion)
  - 1 = Bad (unwatchable)

- **Freeze Frame Detection**: Screen unchanged > 100ms
- **Black Frame Detection**: Pixel avg < 10
- **Macroblocking Ratio**: % of blocks with edges > threshold
- **Temporal Consistency**: Motion smoothness over time

---

## IV. L2 PACKAGER PROBE - DETAILED SPEC

### **4.1 ABR Ladder Validation**

```yaml
Expected ABR Ladder (Example):
- Rung 1: 256k   (SD)
- Rung 2: 512k   (SD)
- Rung 3: 1.5M   (HD 720p)
- Rung 4: 3M     (HD 1080p)
- Rung 5: 6M     (Full HD)
- Rung 6: 15M    (4K)
- Rung 7: 25M    (4K HDR)
- Rung 8: 40M    (4K HDR High Tier)

Validasi:
- Bitrate ordering: sequential, no gaps > 100%
- Segment duration: uniform (8s, 10s, etc)
- Keyframe alignment: GOP at segment boundary
- FPS consistency: 24/25/30fps maintained
```

### **4.2 HLS Manifest Validation (m3u8)**

```
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:100

#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
http://cdn.example.com/stream_5000k/segment-101.ts

✓ Check:
- EXT-X-TARGETDURATION ≤ max segment duration
- BANDWIDTH consistency
- RESOLUTION declared correctly
- Segment sequence continuity
- No duplicate segments
```

### **4.3 DASH MPD Validation (mpd)**

```xml
<Period start="PT0S">
  <AdaptationSet mimeType="video/mp4" segmentAlignment="true">
    <Representation id="480" bandwidth="1000000" width="854" height="480">
      <SegmentTemplate media="segment_$Number$.m4s" initialization="init.mp4"/>
    </Representation>
  </AdaptationSet>
</Period>

✓ Check:
- SegmentTemplate numbering: sequential
- Duration matching m3u8 equivalent
- CodecID: hev1 (HEVC) profile/level valid
- SAP (Sequence Access Point) present
```

### **4.4 EBP (Elementary Bitstream Partition) Alignment**

```
EBP Frame:
- SAP Type 1: Random Access Point (keyframe)
- SAP Type 2: Closed GOP boundary
- Timing: Must align with segment start

Validate:
✓ EBP present at keyframes
✓ EBP timing matches segment timeline
✓ No SAP gaps in ABR transitions
```

### **4.5 fMP4 Box Integrity**

```
fMP4 Structure (Fragmented MP4):
├── ftyp  (File type)
├── mdat  (Media data)
├── moof  (Movie fragment)
│   ├── mfhd (fragment header)
│   └── traf (track fragment)
│       ├── tfhd (track fragment header)
│       └── trun (track run)
└── mdat  (Media data)

Validate:
✓ Box size consistency
✓ Sample flags (keyframe, sample size, offset)
✓ Duration alignment
✓ No truncated boxes
```

---

## V. L3 CDN CORE PROBE

### **5.1 HTTP Video Flow Analysis**

```
Metrics:
- GET /manifest.m3u8 response: <200ms
- GET /segment_*.ts response: <500ms
- 4xx errors: < 0.1%
- 5xx errors: < 0.01%
- Throughput: avg/min/max/p95/p99
```

### **5.2 Cache Performance**

```
X-Cache Header Analysis:
X-Cache: HIT from mid-cache
X-Cache: MISS from origin

Metrics:
- Cache Hit Ratio: >95% for video/mp4
- Cache Miss Ratio: <5% (freshness vs efficiency)
- Time-to-First-Byte (TTFB): <100ms (HIT), <300ms (MISS)
```

### **5.3 Quality Sampling (Decode Test)**

Định kỳ decode một vài kênh/rung ABR để kiểm tra:
- MOS score (QoE)
- HDR metadata presence
- Audio loudness
- Freeze/black frame

---

## VI. L4 EDGE POP PROBE

### **6.1 Regional Metrics**

```yaml
POP Monitoring:
- Hanoi Edge:
    - Segment latency p95: <50ms
    - Packet loss: <0.1%
    - Jitter: <10ms
    - Available bandwidth: >50Mbps
    
- HCMC Edge:
    - Similar thresholds
    - Cross-region latency: <150ms

- Danang Edge (backup):
    - Monitored occasionally
```

### **6.2 Layer Comparison Logic**

```
If error appears ONLY at Edge (not Headend):
→ Cache issue / Route problem / ISP

If error appears at Headend AND Edge:
→ Encoder/Packager issue (upstream)

If error appears at Headend but NOT at Edge:
→ Self-healing or CDN corrected it
```

---

## VII. L5 CLIENT ANALYTICS INTEGRATION

### **7.1 Player SDK Metrics**

```javascript
{
  "session_id": "sess-12345",
  "device": {
    "os": "Android 13",
    "app_version": "2.5.1",
    "player_vendor": "ExoPlayer"
  },
  "stream_info": {
    "channel": "HBO Max",
    "content_id": "hbo-123",
    "content_type": "movie"
  },
  "qoe": {
    "startup_time_ms": 2300,
    "total_duration_ms": 3600000,
    "rebuffer_events": 2,
    "total_rebuffer_duration_ms": 15000,
    "rebuffer_ratio": 0.0042,
    "average_bitrate_kbps": 4500,
    "resolution_max": "1920x1080"
  },
  "errors": [
    {
      "timestamp_ms": 1500000,
      "error_code": "DRM_FAILURE",
      "error_msg": "License fetch failed"
    }
  ],
  "network": {
    "isp": "Viettel",
    "country": "VN",
    "region": "Hanoi",
    "connection_type": "4G"
  }
}
```

### **7.2 Correlation with Probe Alarms**

```
If player reports high rebuffer ratio (>2%) at 14:30 UTC
AND Probe L4 (Edge) reports high packet loss (>1%) at 14:25-14:35 UTC
→ Likely ISP/network issue at Edge

If many players in Hanoi report DRM errors
AND Probe L2 (Packager) reports DRM metadata corruption
→ Packager issue
```

---

## VIII. SNMP TRAP INTEGRATION

### **8.1 Event Type Mapping**

```yaml
Critical Events (Severity: Critical):
- TR_101_290_P1_ERROR: TS sync loss → TRAP_TS_OUTAGE
- AUDIO_SILENCE: Audio missing → TRAP_AUDIO_OUTAGE
- LOUDNESS_CRITICAL: LUFS out of spec → TRAP_AUDIO_LOUDNESS_ERROR
- HDR_METADATA_MISSING: HDR10 SEI lost → TRAP_HDR_ERROR
- DRM_KEY_ERROR: DRM failure → TRAP_DRM_ERROR

Major Events (Severity: Major):
- MACROBLOCKING_HIGH: >15% blocks → TRAP_VIDEO_QUALITY_DEGRADATION
- SCTE35_MISSING: Splice point missing → TRAP_SCTE35_ERROR
- CAPTION_ERROR: CEA-608 CRC fail → TRAP_CAPTION_ERROR
- SEGMENT_DISCONTINUITY: HLS gap → TRAP_MANIFEST_ERROR

Minor Events (Severity: Minor):
- PCR_DRIFT: >500µs → TRAP_PCR_WARNING
- BITRATE_DRIFT: >10% variance → TRAP_BITRATE_WARNING
```

### **8.2 NMS Trap Format (SNMPv2c)**

```
TRAP ENTERPRISE: 1.3.6.1.4.1.37211.100 (Telestream OID)
TRAP TYPE: linkDown (generic), or custom 100+index

Variables:
- sysUpTime: probe uptime
- snmpTrapOID: specific trap OID
- TriggeringEvent: "HDR_METADATA_MISSING"
- Severity: "CRITICAL"
- StreamID: "CH001_4K_HDR"
- Value: "Missing MaxCLL/MaxFALL"
- Timestamp: epoch ms
```

---

## IX. IVMS 5.X EXPORT API

### **9.1 Metrics Sent to iVMS**

```json
POST /api/v2/metrics/inspector-live

{
  "probe_id": "HEADEND-01",
  "probe_location": "L1",
  "timestamp_utc": "2025-01-13T15:30:00Z",
  "streams": [
    {
      "channel_id": "CH001",
      "stream_name": "HBO Max 4K HDR",
      "metrics": {
        "tr101290_p1_errors": 0,
        "tr101290_p2_errors": 3,
        "tr101290_p3_errors": 12,
        "pcr_drift_us": 245,
        "video_mos": 4.2,
        "macroblocking_ratio": 0.08,
        "audio_loudness_lufs": -22.5,
        "audio_lufs_deviation": 0.5,
        "hdr_metadata_present": true,
        "atmos_objects_count": 16,
        "scte35_splices": 5,
        "caption_frames": 150
      },
      "alarms": [
        {
          "event_type": "LOUDNESS_WARNING",
          "severity": "MAJOR",
          "message": "LUFS deviation exceeds 1.0"
        }
      ]
    }
  ]
}
```

### **9.2 iVMS Dashboard Integration**

```
iVMS Mosaic View:
├── Grid of thumbnails (channels)
├── LED Status per channel (Green/Yellow/Red/Black)
├── Hover → Stream details (MOS, loudness, errors)
├── Click → Drill-down analytics
└── Right-click → Generate report, archive logs
```

---

## X. ALERT THRESHOLD CONFIGURATION

### **10.1 Severity Levels**

```yaml
alert_rules:
  # VIDEO
  video_mos:
    critical: 2.0    # Unwatchable
    major: 3.0       # Poor
    warning: 3.5     # Fair

  macroblocking_ratio:
    critical: 0.30   # >30% blocks
    major: 0.20      # >20%
    warning: 0.15    # >15%

  # AUDIO
  audio_loudness_lufs:
    target: -23.0
    critical_under: -26.0
    critical_over: -20.0
    major_under: -25.0
    major_over: -21.0
    warning_under: -24.0
    warning_over: -22.0

  # NETWORK
  mdi:
    critical: 4.0
    major: 1.0
    warning: 0.5

  packet_loss_percent:
    critical: 5.0
    major: 1.0
    warning: 0.1

  # TS/MPEG
  pcr_drift_us:
    critical: 2000   # >2ms
    major: 1000      # >1ms
    warning: 500     # >500µs

  # HDR
  hdr_metadata_discontinuity:
    critical: true   # Any discontinuity
    
  # DOLBY
  atmos_joc_error:
    critical: true   # Any error in Atmos frame
```

---

## XI. REPORTING & EXPORT

### **11.1 Auto-Generated Reports**

**Hourly Report:**
- Performance summary (video/audio/network)
- TR 101 290 error counts (P1/P2/P3)
- Alarms triggered
- Top 5 errors
- Trending graphs

**Daily Report:**
- 24-hour statistics
- Peak hours analysis
- Recurring issues
- Recommendations

**Weekly Report:**
- Network health
- Quality trends
- SLA compliance
- Top issues across all streams

### **11.2 Export Formats**

```
- JSON: API consumption
- PDF: NOC printing/email
- CSV: Spreadsheet analysis
- Parquet: Big data analytics
- InfluxDB: Time-series DB
- Prometheus: Metrics scraping
```

---

## XII. DEPLOYMENT CHECKLIST

### **12.1 Phase 1: L1 Deployment (Week 1)**

```
□ Headend Probe physical/VM setup
□ Network config (multicast join, VLAN)
□ TS input from encoder (UDP/RTP test)
□ TR 101 290 rules enabled
□ TR threshold tuning for your content
□ SNMP traps → test NMS delivery
□ iVMS integration test
□ Baseline metrics collection (24h)
```

### **12.2 Phase 2: L2 Deployment (Week 2)**

```
□ Packager Probe setup
□ HLS/DASH manifest polling
□ ABR ladder validation rules
□ EBP alignment checker
□ Correlate L1 ↔ L2 (any degradation?)
□ Sample decode test setup (random rung)
□ iVMS dashboard update
```

### **12.3 Phase 3: L3 Deployment (Week 3)**

```
□ CDN Core Probe (Origin/MidCache)
□ HTTP flow monitoring
□ Cache hit ratio analysis
□ Segment latency baseline
□ Quality sampling (decode 1-2 streams)
□ Layer comparison rules
```

### **12.4 Phase 4: L4 Deployment (Week 4)**

```
□ Edge POP probes (1-2 critical regions)
□ Regional metrics collection
□ Cross-layer comparison dashboard
□ Player SDK integration test (if possible)
```

### **12.5 Phase 5: Tuning & Optimization (Ongoing)**

```
□ Threshold fine-tuning based on baseline
□ False alarm reduction
□ ML-based anomaly detection (optional)
□ Capacity planning (storage, CPU)
□ Documentation update
```

---

## XIII. PERFORMANCE TARGETS (Production)

| Component | Metric | Target |
|-----------|--------|--------|
| **Probe CPU** | 1 stream @ 1080p/30fps | 3-5% |
| **Probe Memory** | Per instance | <100MB |
| **Latency (analysis)** | Real-time alerting | <2s after error |
| **Throughput** | Concurrent streams | 50+ @ 10Gbps NIC |
| **SNMP Trap delivery** | To NMS | <100ms |
| **iVMS export interval** | Metrics push | 30-60s |
| **Report generation** | Hourly | <5s |

---

## XIV. OPTIONAL: ML-BASED ANOMALY DETECTION

### **14.1 Unsupervised Learning Models**

```rust
// Isolation Forest for outlier detection
// Input: PCR drift, bitrate, MOS, latency metrics
// Output: Anomaly score per sample

// LSTM for time-series forecasting
// Predict next hour's metrics, alert on large deviation
// Example: bitrate suddenly drops from 15Mbps → 3Mbps
```

### **14.2 Integration with Probe**

```rust
// Every hour, collect baseline metrics
baseline = {
    bitrate_mean: 15.0,
    bitrate_std: 1.2,
    mos_mean: 4.3,
    pcr_drift_mean: 150.0,
    ...
}

// Run model, if anomaly_score > 0.8
→ Generate alert: "Unusual pattern detected"
```

---

## XV. SECURITY CONSIDERATIONS

### **15.1 Network**

```yaml
Probe network isolation:
  - Probe on separate VLAN if possible
  - Firewall rules: only required ports open
  - Multicast join only on needed groups
  - Disable unnecessary services (SSH, Telnet)
```

### **15.2 API Security**

```yaml
iVMS/REST API:
  - TLS 1.3 mandatory
  - API key rotation monthly
  - Rate limiting: 100 req/s per endpoint
  - Log all API access
```

### **15.3 Data**

```yaml
Sensitive data:
  - Stream URLs (DRM key URLs) → encrypt in logs
  - Player analytics → anonymize IP addresses
  - Metrics DB → restrict access to NOC staff
```

---

## XVI. TROUBLESHOOTING GUIDE

### **16.1 High Macroblocking Detected**

```
Checklist:
1. Check encoder bitrate (too low?)
2. Check encoder GOP length (too long?)
3. Check network packet loss (jitter causing frame drops?)
4. Compare with downstream probes (L2/L3/L4) - is it earlier or later?
5. Check CPU utilization on encoder
6. Check if motion is high (sports = more blocking risk)
```

### **16.2 HDR Metadata Missing**

```
Checklist:
1. Verify HEVC Main10 profile is enabled on encoder
2. Check SEI (Supplemental Enhancement Info) emission
3. Verify fMP4 box contains hev1 + SEI VPS/SPS/PPS
4. Check if packager strips SEI during segment creation
5. Verify CDN cache doesn't truncate SEI
```

### **16.3 SCTE-35 Splice Points Missing**

```
Checklist:
1. Confirm SCTE-35 stream input to encoder
2. Check if encoder is configured to pass-through SCTE-35 table
3. Verify PAT/PMT includes SCTE-35 PID (0x13)
4. Check if packager includes splice event in manifest
5. Verify HLS m3u8 has #EXT-X-DATERANGE tags
```

---

## XVII. OPERATIONAL RUNBOOK

### **17.1 Morning NOC Check (Daily)**

```
0. Log into iVMS dashboard
1. Check alarm count overnight (Critical/Major)
2. Review top 5 alarms
3. Cross-check L1 vs L4 (upstream vs downstream issue?)
4. If Critical alarm:
   → Get engineer on-call
   → Pull capture (PCAP) from probe
   → Escalate to encoder ops / CDN ops
5. Send dashboard link to stakeholders
```

### **17.2 Alert Response Procedure**

```
Trigger: TR 101 290 P1 Error (TS sync loss)

1. Severity: CRITICAL → Page on-call engineer
2. Scope:
   - Single stream? → Encoder issue
   - All streams? → Network/multicast group issue
3. Immediate action:
   - Restart encoder PCR clock
   - Check multicast group (join status)
   - Check switch/router for port errors
4. Root cause analysis:
   - Pull 5min PCAP from probe
   - Inspect TS packets for sync byte pattern
   - Check encoder logs for timestamp discontinuity
5. Recovery:
   - Restart encoder (if needed)
   - Restore multicast routing
   - Verify TR 101 290 P1 errors clear
6. Post-incident:
   - Document in ticket system
   - Update alert threshold if false alarm
```

---

## XVIII. COST ESTIMATION (Multi-Layer Deployment)

```
Hardware:
- Headend Probe (L1):           $8,000 (1U server)
- Packager Probe (L2):          $8,000 (1U server)
- CDN Core Probe (L3):          $12,000 (2U redundant)
- Edge Probes x 4 (L4):         $32,000 (8k per PoP)
- Total Hardware:               $60,000

Software:
- Inspector LIVE License (4 probes × $3k/yr): $12,000/yr
- iVMS 5.x License:             $25,000/yr
- NMS (Zabbix/Prometheus):      $5,000/yr (OSS free)
- Grafana + InfluxDB:           $8,000/yr
- Total Software:               $50,000/yr

Staffing:
- NOC monitoring (1 FTE):       $50,000/yr
- Incident response (0.5 FTE):  $25,000/yr
- Total Staffing:               $75,000/yr

TOTAL (Year 1): $185,000
TOTAL (Year 2+): $125,000/yr
```

---

