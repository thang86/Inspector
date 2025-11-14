# Inspector System - Complete Codebase Structure & Overview

## Executive Summary

The Inspector system is a **multi-layered broadcast video monitoring solution** composed of:
1. **React Dashboard** (UI for displaying channels, metrics, and alerts)
2. **CMS API** (Flask REST API for configuration management)
3. **Packager Monitor Service** (Python service for real-time stream validation)
4. **Rust Analysis Modules** (Architecture/design for L1 Headend and L2 Packager analysis)

**Issue Context**: HBO example (MPEGTS_UDP type) inputs are not showing in UI and probes/analysis not running.

---

## 1. UI COMPONENTS - INPUT DISPLAY LAYER

### File: `/home/user/Inspector/3_react_dashboard.jsx` (500+ lines)

**Location**: React component for displaying channels and monitoring data

**Key Input Display Components**:

```
Dashboard (Main Component)
  ├── Header (system status)
  ├── Tab Navigation
  │   ├── Overview Tab
  │   ├── Channels Tab ← INPUT DISPLAY
  │   ├── Alerts Tab
  │   └── Metrics Tab
  └── Dashboard.css (styling)
```

**How Inputs Are Displayed**:

1. **ChannelsTab** (Lines 327-370)
   - Fetches channels from API: `GET /api/v1/channels`
   - Filters by: tier, is_4k type
   - Renders ChannelCard components

2. **ChannelCard** (Lines 372-398)
   - Displays: channel_name, channel_code, resolution, fps, codec, tier, 4K/HDR/Atmos badges
   - Shows status (enabled/inactive)
   - No field for input_url or input_type displayed

**Critical Issue #1**: The dashboard displays channels but **does NOT display input_type or input_url fields**. These are stored in the database but not shown in the UI.

### File: `/home/user/Inspector/4_dashboard_styles.css` (700+ lines)
- CSS styling for dashboard components
- No special styling for input types

---

## 2. REST API - DATA RETRIEVAL LAYER

### File: `/home/user/Inspector/2_cms_api_flask.py` (550+ lines)

**Location**: Flask REST API server running on port 5000

**Database Models**:

```python
Channel Table:
├── channel_id (PK)
├── channel_code (unique)
├── channel_name
├── channel_type (LIVE, VOD, EVENT)  ← Stream type
├── tier (1, 2, 3)
├── codec, resolution, fps
├── is_4k, is_hdr, has_atmos (booleans)
├── probe_id (FK to Probes) ← Required for monitoring
├── input_url (TEXT) ← Stream URL (HTTP/HLS/DASH format)
├── template_id (FK to Templates) ← Monitoring thresholds
├── enabled (boolean)
├── created_at, updated_at

Probe Table:
├── probe_id (PK)
├── probe_name (unique)
├── layer (1-5)
├── location
├── ip_address
├── port (default 8443)
├── api_token
├── snmp_enabled, snmp_version
├── created_at

Template Table:
├── template_id (PK)
├── template_name
├── codec
├── min_mos, max_mos
├── loudness_target, loudness_tolerance
├── macroblocking_threshold
├── freeze_threshold_ms, black_threshold_ms
├── pcr_jitter_threshold_ns
└── created_at
```

**Key API Endpoints**:

1. **GET /api/v1/channels** (Line 185-206)
   ```python
   Filters: tier (int), is_4k (bool), enabled (bool)
   Returns: List of Channel objects (to_dict())
   Issue: WORKS correctly - returns all channels matching filters
   ```

2. **GET /api/v1/channels/<channel_id>** (Line 209-222)
   ```python
   Returns: Channel details + Probe + Template
   ```

3. **POST /api/v1/channels** (Line 225-272)
   ```python
   Required Fields:
   - channel_code (string)
   - channel_name (string)
   - channel_type (string: LIVE/VOD/EVENT)
   - tier (int: 1-3)
   - probe_id (int) ← MUST reference existing probe
   - input_url (string) ← HTTP URL, NOT MPEGTS_UDP
   - template_id (int) ← MUST reference existing template
   - optional: codec, resolution, fps, is_4k, is_hdr, has_atmos
   ```

4. **GET /api/v1/probes** (Line 477-486)
   ```python
   Returns: List of all probes
   Issue: No MPEGTS_UDP probe type - only HTTP-based probes defined
   ```

5. **GET /api/v1/health** (Line 526-545)
   ```python
   Health check endpoint
   ```

**Critical Issue #2**: The system **does NOT support MPEGTS_UDP input types**. 
- Database schema only has `input_url` field (TEXT)
- No input_type enum or classification field
- Assumes HTTP-based URLs (packager outputs: HLS/DASH)
- No UDP socket or MPEG-TS capture capability in CMS API

---

## 3. MONITORING SERVICE - PROBE EXECUTION LAYER

### File: `/home/user/Inspector/1_packager_monitor_service.py` (400+ lines)

**Location**: Python service that actually monitors packager streams

**Architecture**:

```python
PackagerMonitor (Main class)
├── Config: packager_url, influxdb_url, channels list
├── ThreadPoolExecutor: max_workers (parallel monitoring)
└── Methods:
    ├── run() - Main loop, 30s polling interval
    ├── monitor_cycle() - Processes each channel
    ├── monitor_channel() - Downloads & validates M3U8 playlists
    │   ├── _extract_abr_ladder() - Parse bitrate ladder
    │   ├── _monitor_rendition() - Check quality variations
    │   ├── _sample_segments() - Download & measure segments
    │   ├── _validate_playlist() - Check m3u8 structure
    │   └── _validate_segment() - Check segment properties
    └── Metrics Push:
        ├── _push_segment_metric() → InfluxDB
        ├── _push_playlist_validation() → InfluxDB
        ├── _push_abr_ladder_metrics() → InfluxDB
        └── _push_channel_error() → InfluxDB
```

**How It Works**:

1. **Initialization** (Lines 104-112)
   - Connects to InfluxDB
   - Creates thread executor
   - Initializes metric cache

2. **Monitor Cycle** (Lines 131-144)
   ```python
   for channel_id in config.channels:
       future = executor.submit(monitor_channel, channel_id)
       # Monitors in parallel
   ```

3. **Channel Monitoring** (Lines 146-170)
   ```python
   Steps:
   1. Fetch master.m3u8 from packager:
      GET {packager_url}/live/{channel_id}/master.m3u8
   2. Parse variants (HLS/DASH renditions)
   3. For each rendition:
      - Download playlist m3u8
      - Validate structure (segment count, target duration, discontinuity)
      - Sample latest 2 segments
      - Measure download time, size, HTTP status
   4. Push metrics to InfluxDB
   5. Log errors to InfluxDB
   ```

**Input Type Support**:
- Only HTTP-based URLs (HLS playlists)
- Only packager outputs (m3u8 and m4s segments)
- **Does NOT support MPEGTS_UDP** (raw transport stream over UDP socket)

**Critical Issue #3**: Packager Monitor expects:
```python
config.packager_url = "http://packager-01.internal"
# Then automatically constructs:
GET http://packager-01.internal/live/{channel_id}/master.m3u8
```

If input_url is MPEGTS_UDP format, monitor cannot fetch/parse it.

---

## 4. RUST ANALYSIS MODULES - ARCHITECTURE LAYER

### Files:
- `/home/user/Inspector/src_l1_headend.rs` (500 lines)
- `/home/user/Inspector/src_l2_packager.rs` (450 lines)
- `/home/user/Inspector/src_snmp_traps.rs` (350 lines)

**Status**: These are **DESIGN/ARCHITECTURE DOCUMENTS**, not integrated with the dashboard.

**L1 Headend Analyzer** (src_l1_headend.rs):
```rust
L1HeadendAnalyzer {
    check_tr101290() - TS sync, PAT, PMT validation
    analyze_loudness() - BS-1770-3 loudness (LUFS)
    analyze_hdr_metadata() - HEVC SEI, MaxCLL, MDCV
    analyze_atmos_joc() - Dolby Atmos detection
    detect_scte35() - Splice point tracking
    analyze_macroblocking() - Video quality MOS
}
```

**Expected Input**: MPEG-TS packets from encoder
**Issue**: Not connected to dashboard or API

**L2 Packager Analyzer** (src_l2_packager.rs):
```rust
L2PackagerAnalyzer {
    validate_hls_manifest() - M3U8 parsing
    validate_dash_mpd() - MPD parsing
    validate_abr_ladder() - Bitrate consistency
    validate_segment_sequence() - Continuity
    validate_ebp_alignment() - EBP timing
    validate_fmp4_boxes() - MP4 box structure
}
```

**Expected Input**: HLS/DASH manifests (HTTP URLs)
**Status**: Design template, not running

---

## 5. CONFIGURATION & DEPLOYMENT

### File: `/home/user/Inspector/7_config_files.txt`

**Database Schema** (init-db.sql):
```sql
CREATE TABLE probes (probe_id, probe_name, layer, location, ip_address, port, api_token, snmp_enabled, snmp_version, created_at)
CREATE TABLE templates (template_id, template_name, description, codec, min_mos, max_mos, loudness_target, loudness_tolerance, ...)
CREATE TABLE channels (channel_id, channel_code, channel_name, channel_type, tier, codec, resolution, fps, is_4k, is_hdr, has_atmos, probe_id FK, input_url, template_id FK, enabled, created_at, updated_at)
CREATE TABLE alerts (alert_id, channel_id FK, alert_type, severity, message, acknowledged, acknowledged_by, acknowledged_at, resolved, resolved_at, created_at)

Sample Probes:
- LIVE-HEADEND-01 (layer 1, 10.10.10.21)
- LIVE-HEADEND-02 (layer 1, 10.10.10.22)
- LIVE-PACKAGER-01 (layer 2, 10.10.20.21)
- LIVE-PACKAGER-02 (layer 2, 10.10.20.22)
- LIVE-CDNCORE-01 (layer 3, 10.10.30.21)
- LIVE-EDGE-HN-01 (layer 4, 10.20.10.21)
- LIVE-EDGE-HCM-01 (layer 4, 10.20.20.21)

Sample Templates:
- TPL_LIVE_HD (H.264, 3.5-5.0 MOS)
- TPL_LIVE_4K_HDR (HEVC, 4.0-5.0 MOS)
- TPL_ABR_OTT (HEVC, 3.5-5.0 MOS)
```

### File: `/home/user/Inspector/5_docker_compose.yml`

**Services**:
```yaml
postgres:     # Channel, probe, template, alert storage
influxdb:     # Time-series metrics (segment, playlist, ABR, errors)
prometheus:   # Alert rule evaluation
alertmanager: # Alert routing (Slack, email)
grafana:      # Dashboards
cms-api:      # Flask API (port 5000)
packager-monitor:  # Python monitoring service
nginx:        # Reverse proxy
```

---

## 6. DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│                     USER BROWSER                             │
│           (3_react_dashboard.jsx)                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTP requests
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              NGINX REVERSE PROXY                             │
│         (routes /api/v1 → Flask backend)                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         CMS API (2_cms_api_flask.py)                         │
│  • GET /api/v1/channels → Fetch from PostgreSQL             │
│  • POST /api/v1/channels → Insert into PostgreSQL           │
│  • GET /api/v1/probes → Fetch probe list                    │
│  • GET /api/v1/templates → Fetch templates                  │
│  • GET /api/v1/alerts/active → Fetch alerts                │
└──────┬───────────────────────────────────────────────────────┘
       │
       ├──► PostgreSQL Database
       │    ├── channels table (stores input_url, probe_id, template_id)
       │    ├── probes table (stores probe definitions)
       │    ├── templates table (stores alert thresholds)
       │    └── alerts table (stores alert instances)
       │
       └──► (NOT USED BY API - see next flow)
```

```
┌──────────────────────────────────────────────────────────┐
│   Packager Monitor Service (1_packager_monitor_service.py)  │
│        (Separate Python process)                         │
└──────┬───────────────────────────────────────────────────┘
       │
       ├─► Reads config: packager_url, channels list
       │                 (NOT from PostgreSQL!)
       │
       ├─► For each channel_id:
       │   │
       │   └─► HTTP GET {packager_url}/live/{channel_id}/master.m3u8
       │       │
       │       ├─ Parse M3U8
       │       ├─ Extract variants/renditions
       │       ├─ Download & validate segments
       │       ├─ Measure metrics (duration, size, speed)
       │       │
       │       └─► Push metrics to InfluxDB
       │           • segment_metric
       │           • playlist_validation
       │           • abr_ladder
       │           • channel_error
       │
       └─► Grafana reads from InfluxDB
           └─► Displays dashboards
```

---

## 7. ROOT CAUSE ANALYSIS - WHY HBO MPEGTS_UDP NOT SHOWING

### Issue 1: Input Type Not Supported

**Problem**: MPEGTS_UDP is a raw transport stream over UDP socket
```
MPEGTS_UDP Input:
├── Protocol: UDP (socket-based, not HTTP)
├── Data Format: Raw MPEG-2 Transport Stream packets (0x47 sync byte)
├── Transport: Multicast or unicast UDP to specific port
└── Example: udp://224.0.0.1:5000
```

**Why System Doesn't Support It**:
1. **CMS API** (Flask) - Only has `input_url` TEXT field
   - Assumes HTTP URLs: `http://packager-01/live/CH_001/master.m3u8`
   - No input_type enum to classify MPEGTS_UDP

2. **Packager Monitor** (Python) - Only monitors HTTP/HLS
   - Uses `requests.get()` to download m3u8 playlists
   - No UDP socket code
   - No MPEG-TS packet parsing

3. **Dashboard** (React) - No input type display
   - Displays channels but not input_url or input_type
   - Only shows: name, code, resolution, fps, codec, tier, 4K/HDR/Atmos

### Issue 2: Database Schema Missing Input Type Field

```python
# Current schema:
class Channel(db.Model):
    input_url = db.Column(db.Text)  # Just a string, no validation

# Should be:
class Channel(db.Model):
    input_type = db.Column(db.String(20))  # HTTP, MPEGTS_UDP, RTP, etc.
    input_url = db.Column(db.Text)
    input_protocol = db.Column(db.String(20))  # HTTP, UDP, RTP
    input_port = db.Column(db.Integer)  # For UDP inputs
    input_multicast = db.Column(db.Boolean)  # For UDP inputs
```

### Issue 3: Probe System Not Fully Integrated

**Current State**:
- Probes are stored in PostgreSQL
- Dashboard shows 0 probes in use (likely not initialized)
- Packager Monitor doesn't read from PostgreSQL probe list
- Monitor uses hardcoded `config.channels` instead of database channels

**What Should Happen**:
```python
# Packager Monitor SHOULD:
1. Fetch probe list from API: GET /api/v1/probes
2. For each probe, fetch assigned channels: GET /api/v1/channels?probe_id=X
3. For each channel, parse input_url based on input_type
4. Launch appropriate monitor (HTTP for HLS, UDP for MPEGTS, etc.)
```

**What Actually Happens**:
```python
# Current hardcoded config:
config.channels = [
    f"CH_TV_HD_{i:03d}" for i in range(1, 51)  # Hardcoded!
]
config.packager_url = "http://packager-01.internal"  # Hardcoded!

# Monitor then constructs:
GET http://packager-01.internal/live/CH_TV_HD_001/master.m3u8
```

---

## 8. COMPLETE FILE REFERENCE

### UI Layer
- **3_react_dashboard.jsx** (500 lines)
  - Components: Dashboard, Header, ChannelsTab, ChannelCard, AlertsTab, MetricsTab
  - Issue: No input_url or input_type display

- **4_dashboard_styles.css** (700 lines)
  - CSS styling for dashboard components

### API Layer
- **2_cms_api_flask.py** (550 lines)
  - Models: Channel, Probe, Template, Alert
  - Endpoints: /api/v1/channels, /api/v1/probes, /api/v1/templates, /api/v1/alerts
  - Database: PostgreSQL
  - Issue: No input_type field in Channel model

### Monitoring Layer
- **1_packager_monitor_service.py** (400 lines)
  - Class: PackagerMonitor
  - Methods: monitor_cycle(), monitor_channel(), _validate_playlist(), _sample_segments()
  - Integration: InfluxDB metrics push
  - Issue: Only HTTP/HLS support, not MPEGTS_UDP

### Analysis Modules (Design/Architecture Only)
- **src_l1_headend.rs** (500 lines) - L1 Headend Analyzer design
- **src_l2_packager.rs** (450 lines) - L2 Packager Analyzer design
- **src_snmp_traps.rs** (350 lines) - SNMP trap integration design

### Configuration & Infrastructure
- **5_docker_compose.yml** - Service orchestration
- **6_dockerfiles.txt** - Docker build files
- **7_config_files.txt** - Config templates, SQL schema, nginx.conf, prometheus.yml, alertmanager.yml

### Documentation
- **00_START_HERE.md** - Quick start guide
- **0_FINAL_INDEX.md** - File index
- **README.md** - Architecture overview
- **README_COMPLETE_PACKAGE.md** - Complete package guide
- **8_deployment_guide_complete.md** - Deployment instructions
- **9_CHEAT_SHEET.md** - Quick reference commands
- **probe-inspector-multi-layer.md** - Detailed 6-layer architecture

---

## 9. HOW TO FIX - IMPLEMENTATION ROADMAP

### Quick Fix (1-2 hours)
1. Add sample channels via API using existing probe
   ```bash
   curl -X POST http://localhost:5000/api/v1/channels \
     -H "Content-Type: application/json" \
     -d '{
       "channel_code": "HBO_TEST",
       "channel_name": "HBO Test Channel",
       "channel_type": "LIVE",
       "tier": 2,
       "codec": "H.264",
       "resolution": "1920x1080",
       "fps": 25,
       "is_4k": false,
       "probe_id": 3,
       "input_url": "http://packager-01.internal/live/HBO_TEST/master.m3u8",
       "template_id": 1,
       "enabled": true
     }'
   ```

2. Verify channels appear in dashboard
3. Check packager monitor logs for monitoring activity

### Medium Fix (4-6 hours)
1. Add input_type field to Channel model
2. Add input type validation in API
3. Update React dashboard to display input_url and input_type
4. Enhance packager monitor to read channels from PostgreSQL

### Full Fix for MPEGTS_UDP Support (2-3 days)
1. Create UDP socket handler module
2. Implement MPEG-TS packet parser
3. Add probe type dispatcher (HTTP vs UDP vs RTP)
4. Create L1 Headend analysis for MPEGTS_UDP inputs
5. Wire into dashboard for MPEGTS_UDP stream status

---

## 10. SUMMARY TABLE

| Component | File | Lines | Purpose | Input Support |
|-----------|------|-------|---------|----------------|
| **UI Dashboard** | 3_react_dashboard.jsx | 500+ | Channel display, metrics, alerts | Display only (no input_url shown) |
| **CMS API** | 2_cms_api_flask.py | 550+ | Channel/probe/template CRUD | HTTP URLs only |
| **Packager Monitor** | 1_packager_monitor_service.py | 400+ | Segment validation, ABR check | HTTP/HLS only |
| **L1 Analysis** | src_l1_headend.rs | 500 | TR101290, HDR, Atmos analysis | MPEG-TS (design only) |
| **L2 Analysis** | src_l2_packager.rs | 450 | Manifest, ABR, EBP validation | HLS/DASH (design only) |
| **Docker Setup** | 5_docker_compose.yml | - | Service orchestration | - |
| **Database Schema** | 7_config_files.txt | - | PostgreSQL tables | HTTP URLs only |

---

## Conclusion

**Current State**: The system is designed for HTTP-based inputs (HLS/DASH from packagers)

**Why HBO MPEGTS_UDP Not Working**:
1. Database has no `input_type` field
2. No UDP socket or MPEG-TS parsing capability
3. Monitor only handles HTTP URLs
4. Dashboard doesn't display input format

**To Get It Working**:
- Add HTTP test channels first (HBO example should use packager HTTP URL)
- Then implement MPEGTS_UDP support if needed
- Wire up PostgreSQL probe system to monitor service
