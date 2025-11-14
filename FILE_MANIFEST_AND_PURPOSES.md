# Inspector System - Complete File Manifest & Purposes

## Overview
This document lists all relevant files in the Inspector codebase with their absolute paths, purposes, and key functions.

---

## ABSOLUTE FILE PATHS & PURPOSES

### 1. USER INTERFACE LAYER (React Dashboard)

**File**: `/home/user/Inspector/3_react_dashboard.jsx`
- **Size**: 17 KB (566 lines)
- **Purpose**: React component for the web dashboard UI
- **Key Components**:
  - `Dashboard` (Main component with tab navigation)
  - `ChannelsTab` (Displays channel list - WHERE INPUTS SHOULD SHOW)
  - `ChannelCard` (Individual channel display)
  - `AlertsTab` (Alert management and acknowledgment)
  - `MetricsTab` (Real-time metric visualizations)
- **API Calls**:
  - `GET /api/v1/channels` (Line 40)
  - `GET /api/v1/alerts/active` (Line 52)
  - `POST /api/v1/alerts/{alertId}/acknowledge` (Line 62)
  - `POST /api/v1/alerts/{alertId}/resolve` (Line 76)
- **Issue**: Does NOT display `input_url` or `input_type` fields
- **Related Files**: 4_dashboard_styles.css

---

**File**: `/home/user/Inspector/4_dashboard_styles.css`
- **Size**: 12 KB (700+ lines)
- **Purpose**: CSS styling for React dashboard
- **Key Classes**:
  - `.dashboard` (main container)
  - `.channel-card` (channel display styling)
  - `.alert-row` (alert row styling)
  - `.metric-chart` (chart styling)
- **No input type specific styling**

---

### 2. REST API LAYER (Flask Backend)

**File**: `/home/user/Inspector/2_cms_api_flask.py`
- **Size**: 20 KB (572 lines)
- **Purpose**: Flask REST API for channel, probe, template, and alert management
- **Database Models** (SQLAlchemy ORM):
  ```
  Channel       - Lines 38-82   (channel_code, channel_name, channel_type, tier, codec, resolution, fps, is_4k, is_hdr, has_atmos, probe_id FK, input_url, template_id FK, enabled)
  Probe         - Lines 85-110  (probe_name, layer, location, ip_address, port, api_token, snmp_enabled, snmp_version)
  Template      - Lines 113-145 (template_name, codec, min_mos, max_mos, loudness_target, loudness_tolerance, thresholds)
  Alert         - Lines 148-179 (channel_id FK, alert_type, severity, message, acknowledged, resolved)
  ```
- **API Endpoints**:
  - `GET /api/v1/channels` (Lines 185-206)
  - `GET /api/v1/channels/<channel_id>` (Lines 209-222)
  - `POST /api/v1/channels` (Lines 225-272)
  - `PUT /api/v1/channels/<channel_id>` (Lines 275-300)
  - `DELETE /api/v1/channels/<channel_id>` (Lines 303-322)
  - `GET /api/v1/probes` (Lines 477-486)
  - `POST /api/v1/probes` (Lines 489-520)
  - `GET /api/v1/templates` (Lines 328-337)
  - `POST /api/v1/templates` (Lines 340-374)
  - `GET /api/v1/alerts/active` (Lines 380-392)
  - `POST /api/v1/alerts/<alert_id>/acknowledge` (Lines 395-418)
  - `POST /api/v1/alerts/<alert_id>/resolve` (Lines 421-441)
  - `POST /api/v1/alerts` (Lines 444-471)
  - `GET /api/v1/health` (Lines 526-545)
- **Database**: PostgreSQL (configured via DATABASE_URL env var)
- **Issue #1**: No `input_type` field to classify MPEGTS_UDP vs HTTP
- **Issue #2**: No input port, protocol, or multicast fields
- **Issue #3**: `input_url` is just TEXT, no validation

---

### 3. MONITORING SERVICE LAYER (Python)

**File**: `/home/user/Inspector/1_packager_monitor_service.py`
- **Size**: 16 KB (433 lines)
- **Purpose**: Real-time packager stream monitoring service
- **Main Class**: `PackagerMonitor` (Lines 103-424)
  - `__init__` (Lines 104-112) - Initialize InfluxDB client, thread executor
  - `run()` (Lines 115-129) - Main monitoring loop
  - `monitor_cycle()` (Lines 131-144) - Process all channels in parallel
  - `monitor_channel()` (Lines 146-170) - Monitor single channel (downloads m3u8, parses variants)
  - `_monitor_rendition()` (Lines 172-197) - Validate individual rendition quality
  - `_validate_playlist()` (Lines 199-248) - Check m3u8 structure (segments, duration, discontinuity)
  - `_sample_segments()` (Lines 250-292) - Download & measure latest segments
  - `_validate_segment()` (Lines 294-312) - Check segment properties (size, download time, HTTP status)
  - `_extract_abr_ladder()` (Lines 314-339) - Parse bitrate/resolution/codec variants
  - `_extract_rung_id()` (Lines 341-345) - Extract rung name from playlist URI
  - Metrics Push Methods (Lines 351-424):
    - `_push_segment_metric()` → InfluxDB
    - `_push_playlist_validation()` → InfluxDB
    - `_push_abr_ladder_metrics()` → InfluxDB
    - `_push_channel_error()` → InfluxDB
- **Configuration** (Lines 35-63):
  - `packager_url` = "http://packager-01.internal" (HARDCODED!)
  - `channels` = [f"CH_TV_HD_{i:03d}" for i in range(1, 51)] (HARDCODED!)
  - `poll_interval` = 30 seconds
  - `max_workers` = 10 (ThreadPoolExecutor)
- **Issue #1**: CRITICAL - Hardcoded channels, doesn't read from PostgreSQL
- **Issue #2**: CRITICAL - No MPEGTS_UDP support, only HTTP/HLS
- **Issue #3**: Monitor not integrated with API/DB
- **Expected Input**: HTTP URLs for HLS/DASH manifests
- **Output**: InfluxDB time-series metrics

---

### 4. ANALYSIS MODULES (Rust - Design/Architecture)

**File**: `/home/user/Inspector/src_l1_headend.rs`
- **Size**: 17 KB (565 lines)
- **Purpose**: L1 Headend Analyzer module design (NOT INTEGRATED)
- **Main Struct**: `L1HeadendAnalyzer` (Lines 283-390)
- **Key Methods**:
  - `check_tr101290()` (Lines 393-414) - Validate TS sync byte, PAT, PMT
  - `analyze_loudness()` (Lines 417-440) - BS-1770-3 LUFS measurement
  - `analyze_hdr_metadata()` (Lines 443-464) - HEVC SEI, MaxCLL, MDCV
  - `analyze_atmos_joc()` (Lines 467-486) - Dolby Atmos detection
  - `detect_scte35()` (Lines 489-510) - Splice point tracking
  - `get_metrics()` (Lines 513-515) - Return current metrics
- **Data Structures**:
  - `L1HeadendMetrics` - TR101290 errors, video, audio, HDR, Atmos, signaling, alarms
  - `TR101290Errors` - P1/P2/P3 error counters
  - `VideoMetrics` - MOS, macroblocking, freeze/black detection
  - `AudioMetrics` - LUFS loudness, channel validation
  - `HDRMetadata` - HDR10/HLG, MaxCLL, MDCV
  - `AtmosMetadata` - JOC, object/bed loudness
  - `SignalingMetrics` - SCTE-35, captions, NIT/SDT
  - `L1Alarm` - Alarm type, severity, message
- **Input Expected**: MPEG-TS packets from encoder
- **Status**: Design template, NOT running/integrated

---

**File**: `/home/user/Inspector/src_l2_packager.rs`
- **Size**: 21 KB (620 lines)
- **Purpose**: L2 Packager Analyzer module design (NOT INTEGRATED)
- **Main Struct**: `L2PackagerAnalyzer` (Lines 204-576)
- **Key Methods**:
  - `validate_hls_manifest()` (Lines 397-432) - Parse m3u8, extract target duration
  - `validate_dash_mpd()` (Lines 435-446) - Parse MPD XML
  - `validate_abr_ladder()` (Lines 449-494) - Check bitrate consistency & step sizes
  - `validate_segment_sequence()` (Lines 497-518) - Detect segment gaps
  - `validate_ebp_alignment()` (Lines 521-549) - EBP timing validation
  - `validate_fmp4_boxes()` (Lines 552-570) - fMP4 box structure validation
  - `get_metrics()` (Lines 573-575) - Return current metrics
- **Data Structures**:
  - `L2PackagerMetrics` - Manifest, ABR ladder, segments, tracks, EBP, fMP4, DRM, alarms
  - `ABRRung` - Rung ID, bitrate, resolution, fps, codec, profile, consistency
  - `ManifestMetrics` - Format, version, target duration, sequence number
  - `SegmentMetrics` - Received, missing, duration, size, gaps, jitter
  - `EBPMetrics` - Frame count, SAP types, timing errors
  - `FMP4Metrics` - Box validation, CENC, PSSH
  - `L2Alarm` - Alarm type, severity, message, rung_id
- **Default ABR Ladder**: 7 rungs (256kbps SD → 25Mbps 4K HDR)
- **Input Expected**: HLS/DASH manifests (HTTP URLs)
- **Status**: Design template, NOT running/integrated

---

**File**: `/home/user/Inspector/src_snmp_traps.rs`
- **Size**: 14 KB (350+ lines, referenced but not included in full)
- **Purpose**: SNMP trap integration design (NOT IMPLEMENTED)
- **Expected Functionality**: Map alarms to SNMP OIDs for NMS (Zabbix/Solarwinds)
- **21 Event Type Mappings** (partial):
  - 1.3.6.1.4.1.37211.100.1 → Video MOS Low
  - 1.3.6.1.4.1.37211.100.8 → TS Sync Loss
  - 1.3.6.1.4.1.37211.100.13 → HDR Metadata Missing
  - ... (21 total OID mappings)
- **Status**: Design template, NOT running

---

### 5. CONFIGURATION & INFRASTRUCTURE

**File**: `/home/user/Inspector/7_config_files.txt`
- **Size**: 11 KB (356 lines - concatenated configs)
- **Purpose**: Contains configuration file templates and SQL schema
- **Contents**:
  1. **requirements-cms-api.txt** (Flask dependencies)
  2. **requirements-packager-monitor.txt** (Python dependencies)
  3. **nginx.conf** (Reverse proxy config - routes /api/v1 → Flask)
  4. **init-db.sql** (Database schema & sample data)
     - CREATE TABLE probes (7 sample probes)
     - CREATE TABLE templates (3 sample templates: TPL_LIVE_HD, TPL_LIVE_4K_HDR, TPL_ABR_OTT)
     - CREATE TABLE channels (schema, no sample data)
     - CREATE TABLE alerts (schema)
     - CREATE INDEX statements
  5. **.env.example** (Environment variables template)
  6. **prometheus.yml** (Scrape config for metrics)
  7. **alertmanager.yml** (Alert routing to Slack/Email)
- **Database Connection**: PostgreSQL (set via DATABASE_URL env var)

---

**File**: `/home/user/Inspector/5_docker_compose.yml`
- **Size**: 5.6 KB (185 lines)
- **Purpose**: Docker Compose orchestration file
- **Services** (8 total):
  1. `postgres` - PostgreSQL database (port 5432)
  2. `influxdb` - Time-series metrics database (port 8086)
  3. `prometheus` - Metric aggregation & alerting (port 9090)
  4. `alertmanager` - Alert routing (port 9093)
  5. `grafana` - Dashboard visualization (port 3000)
  6. `cms-api` - Flask API (port 5000)
  7. `packager-monitor` - Python monitoring service
  8. `nginx` - Reverse proxy (ports 80/443)
- **Volumes**: postgres, influxdb, prometheus, grafana persistent volumes
- **Environment**: Loaded from .env file

---

**File**: `/home/user/Inspector/6_dockerfiles.txt`
- **Size**: 1.6 KB (50+ lines)
- **Purpose**: Docker build specifications
- **Contains**:
  1. Dockerfile.cms-api - Python 3.11 Flask image
  2. Dockerfile.packager-monitor - Python 3.11 monitoring service image

---

### 6. DOCUMENTATION FILES

**File**: `/home/user/Inspector/00_START_HERE.md`
- **Size**: 8 KB (353 lines)
- **Purpose**: Quick start guide (Vietnamese & English)
- **Sections**: Reading order, file structure, FAQ, timeline, learning resources

---

**File**: `/home/user/Inspector/0_FINAL_INDEX.md`
- **Size**: 14 KB (500+ lines)
- **Purpose**: Complete file index with usage scenarios, deployment sequence, verification checklist
- **Key Sections**: Quick start, deployment sequence (4 phases), verification checklist, troubleshooting, file organization

---

**File**: `/home/user/Inspector/README.md`
- **Size**: 11 KB (483 lines)
- **Purpose**: Architecture overview and usage guide
- **Sections**: Architecture diagram, Rust performance comparison, file statistics, key features, learning path

---

**File**: `/home/user/Inspector/CODEBASE_STRUCTURE_OVERVIEW.md`
- **Size**: Generated (comprehensive analysis)
- **Purpose**: Detailed breakdown of all components and root cause analysis
- **Covers**: UI, API, Monitor, Rust modules, data flow, issues, implementation roadmap

---

**File**: `/home/user/Inspector/ARCHITECTURE_DIAGRAM.md`
- **Size**: Generated (visual diagrams)
- **Purpose**: Visual representation of system layers, data flows, disconnections
- **Diagrams**: System layers, monitoring flow, database schema, issue summary table

---

**File**: `/home/user/Inspector/probe-inspector-multi-layer.md`
- **Size**: 21 KB (900+ lines)
- **Purpose**: Detailed 6-layer architecture design document
- **Sections**: L0-L5 layers, Rust project structure, L1/L2 specifications, SNMP integration, deployment timeline

---

**File**: `/home/user/Inspector/8_deployment_guide_complete.md`
- **Size**: 19 KB (600+ lines)
- **Purpose**: Step-by-step deployment instructions
- **Sections**: Hardware requirements, installation, configuration, integration examples, operational procedures

---

**File**: `/home/user/Inspector/9_CHEAT_SHEET.md`
- **Size**: 14 KB (400+ lines)
- **Purpose**: Quick reference commands and API calls
- **Includes**: Docker commands, API examples (curl), database queries, troubleshooting

---

### 7. ADDITIONAL REFERENCE FILES

**File**: `/home/user/Inspector/1_START_HERE.txt`
- Purpose: Initial quick start guide

**File**: `/home/user/Inspector/START_HERE.txt`
- Purpose: Quick start instructions

**File**: `/home/user/Inspector/README_COMPLETE_PACKAGE.md`
- Size: 12 KB
- Purpose: Complete package overview with all files and usage scenarios

**File**: `/home/user/Inspector/FEATURES_SUMMARY.md`
- Size: 13 KB
- Purpose: Complete features list and capabilities

**File**: `/home/user/Inspector/DEPLOYMENT_GUIDE.md`
- Size: 17 KB
- Purpose: Deployment guide (alternative version)

**File**: `/home/user/Inspector/PACKAGER_CDN_DEPLOYMENT_FIRST_v1.0.md`
- Size: 42 KB
- Purpose: Week-by-week deployment strategy

**File**: `/home/user/Inspector/COMPLETE_PRODUCTION_SYSTEM_v2.0.txt`
- Size: 87 KB
- Purpose: Complete system design document

**File**: `/home/user/Inspector/MEGA_FILE_ALL_IN_ONE.txt`
- Size: 36 KB
- Purpose: All code concatenated in one file

**File**: `/home/user/Inspector/ALL_CONTENT.html`
- Size: 16 KB
- Purpose**: HTML version of all content

---

## QUICK REFERENCE - KEY FILE LOCATIONS

| Component | File | Path | Purpose |
|-----------|------|------|---------|
| React UI | 3_react_dashboard.jsx | `/home/user/Inspector/3_react_dashboard.jsx` | Channel display, dashboard |
| React CSS | 4_dashboard_styles.css | `/home/user/Inspector/4_dashboard_styles.css` | Dashboard styling |
| Flask API | 2_cms_api_flask.py | `/home/user/Inspector/2_cms_api_flask.py` | REST API, Channel/Probe/Template CRUD |
| Monitor | 1_packager_monitor_service.py | `/home/user/Inspector/1_packager_monitor_service.py` | Stream monitoring service |
| L1 Analysis | src_l1_headend.rs | `/home/user/Inspector/src_l1_headend.rs` | Headend analyzer design |
| L2 Analysis | src_l2_packager.rs | `/home/user/Inspector/src_l2_packager.rs` | Packager analyzer design |
| SNMP Integration | src_snmp_traps.rs | `/home/user/Inspector/src_snmp_traps.rs` | SNMP trap design |
| Docker Compose | 5_docker_compose.yml | `/home/user/Inspector/5_docker_compose.yml` | Service orchestration |
| Config Templates | 7_config_files.txt | `/home/user/Inspector/7_config_files.txt` | nginx, SQL, prometheus, alertmanager |
| Dockerfiles | 6_dockerfiles.txt | `/home/user/Inspector/6_dockerfiles.txt` | Docker build files |

---

## GITHUB/GIT INFORMATION

**Current Branch**: `claude/fix-analyzer-input-example-01EnwXZvYqwxaeRsWWFqDGcD`

**Recent Commits**:
1. `09c3333` - Add complete Inspector system with packager monitor, CMS API, React dashboard, and deployment configuration
2. `f6abbec` - Initial commit

**Git Status**: Clean (no uncommitted changes at time of analysis)

---

## DATABASE INITIALIZATION CHECKLIST

To get the system running:

1. **Initialize PostgreSQL**:
   ```bash
   # Extract init-db.sql from 7_config_files.txt
   # Run: psql -U monitor_app -d fpt_play_monitoring < init-db.sql
   # Creates: 7 sample probes, 3 templates, channels table, alerts table
   ```

2. **Start Docker Services**:
   ```bash
   docker-compose -f 5_docker_compose.yml up -d
   # Starts: postgres, influxdb, prometheus, alertmanager, grafana, cms-api, packager-monitor, nginx
   ```

3. **Verify API Health**:
   ```bash
   curl http://localhost:5000/api/v1/health
   ```

4. **Create Sample Channel**:
   ```bash
   curl -X POST http://localhost:5000/api/v1/channels \
     -H "Content-Type: application/json" \
     -d '{ "channel_code": "HBO_TEST", "channel_name": "HBO", "channel_type": "LIVE", "tier": 2, "codec": "H.264", "resolution": "1920x1080", "fps": 25, "is_4k": false, "probe_id": 3, "input_url": "http://packager-01.internal/live/HBO_TEST/master.m3u8", "template_id": 1, "enabled": true }'
   ```

5. **Verify in Dashboard**:
   ```
   http://localhost:3000  (Grafana)
   http://localhost       (React dashboard)
   ```

---

## SUMMARY

**Total Files Analyzed**: 25+ files
**Total Lines of Code**: 7,000+ (code + docs)
**Key Components**: 4 (UI, API, Monitor, Analysis)
**Main Issue**: **Monitor not integrated with API/DB, no MPEGTS_UDP support**

