# Inspector System - Visual Architecture & Data Flow

## 1. SYSTEM LAYERS & COMPONENTS

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE LAYER                              │
│                    (3_react_dashboard.jsx)                               │
│  - Dashboard Overview (KPI cards, charts)                                │
│  - Channels Tab (channel list with filters)                              │
│  - Alerts Tab (alert management, acknowledge/resolve)                    │
│  - Metrics Tab (real-time graphs)                                        │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                  ┌────────────┴────────────┐
                  │                         │
                  ▼                         ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│   NGINX Reverse Proxy        │  │   GRAFANA Dashboards         │
│   (routing & SSL)            │  │   (metrics visualization)    │
└──────────────────┬───────────┘  └──────────────────┬───────────┘
                   │                                 │
                   ▼                                 │
┌─────────────────────────────────────────────────────────────────┐
│              REST API LAYER                                      │
│        (2_cms_api_flask.py on port 5000)                        │
│                                                                  │
│  Endpoints:                                                      │
│  ├─ GET  /api/v1/channels           (fetch all)                 │
│  ├─ GET  /api/v1/channels/<id>      (fetch one)                 │
│  ├─ POST /api/v1/channels           (create)                    │
│  ├─ PUT  /api/v1/channels/<id>      (update)                    │
│  ├─ DELETE /api/v1/channels/<id>    (disable)                   │
│  ├─ GET  /api/v1/probes             (fetch probes)              │
│  ├─ POST /api/v1/probes             (create probe)              │
│  ├─ GET  /api/v1/templates          (fetch templates)           │
│  ├─ POST /api/v1/templates          (create template)           │
│  ├─ GET  /api/v1/alerts/active      (fetch active)              │
│  ├─ POST /api/v1/alerts/<id>/acknowledge                        │
│  ├─ POST /api/v1/alerts/<id>/resolve                            │
│  └─ GET  /api/v1/health             (status check)              │
└──────────────────────┬────────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
┌───────────────────────┐    ┌─────────────────────────────┐
│  PostgreSQL Database  │    │  ERROR: DISCONNECT POINT    │
│  (Configuration)      │    │  Packager Monitor NOT        │
│                       │    │  reading from DB!           │
│ Tables:               │    │                             │
│ ├─ channels           │    │ Should read:                │
│ ├─ probes             │    │ • probe list                │
│ ├─ templates          │    │ • channel assignments       │
│ ├─ alerts             │    │ • input URLs                │
│ └─ indexes            │    │ But uses: hardcoded config  │
└───────────────────────┘    └─────────────────────────────┘
```

## 2. MONITORING FLOW (The "Broken" Path)

```
┌─────────────────────────────────────────────────────┐
│  Packager Monitor Service                            │
│  (1_packager_monitor_service.py)                    │
│                                                      │
│  ISSUE: Does NOT integrate with REST API!           │
└─────────────────────────────────────────────────────┘
                       │
                       │ Uses: hardcoded config
                       ▼
        ┌──────────────────────────────┐
        │  MonitorConfig               │
        │  • packager_url (hardcoded)  │ ← PROBLEM #1
        │  • channels list (hardcoded) │ ← PROBLEM #2
        │  • poll_interval: 30s        │
        │  • influxdb_url              │
        └──────────────────┬───────────┘
                           │
        ┌──────────────────┴──────────────────┐
        │                                     │
        ▼                                     ▼
┌────────────────────┐          ┌──────────────────────────┐
│  Hardcoded         │          │  Expected URL Pattern    │
│  Channels:         │          │                          │
│ CH_TV_HD_001       │          │ http://{packager_url}/   │
│ CH_TV_HD_002       │          │   live/{channel_id}/     │
│ ...                │          │   master.m3u8            │
│ CH_TV_HD_050       │          │                          │
└────────────────────┘          └──────────────────────────┘
                                        │
                            ┌───────────┴──────────────┐
                            │                          │
                            ▼                          ▼
                    ┌───────────────┐        ┌──────────────────┐
                    │ Success:      │        │ Failure:         │
                    │ Found HTTP    │        │ Input is:        │
                    │ packager      │        │ • MPEGTS_UDP     │
                    └───────┬───────┘        │ • RTP            │
                            │                │ • Raw TS         │
                            ▼                └──────────────────┘
                    ┌────────────────────┐        │
                    │ Download m3u8,     │        ▼
                    │ parse variants,    │   Packager Monitor
                    │ validate segments, │   CRASHES or
                    │ measure metrics    │   FAILS SILENTLY
                    └────────┬───────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │ Push to InfluxDB:  │
                    │ • segment_metric   │
                    │ • playlist_valid   │
                    │ • abr_ladder       │
                    │ • channel_error    │
                    └────────┬───────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │ Grafana reads      │
                    │ metrics, displays  │
                    │ dashboards         │
                    └────────────────────┘
```

## 3. THE DISCONNECTION PROBLEM

```
┌─────────────────────────────────────────────────────────────┐
│                   DATABASE (PostgreSQL)                      │
│                                                               │
│  channels table has:                                         │
│  ├─ channel_id: 1                                           │
│  ├─ channel_name: "HBO Test"                                │
│  ├─ probe_id: 3                                             │
│  └─ input_url: "http://packager.../live/HBO/master.m3u8"   │
└────────────────┬────────────────────────────────────────────┘
                 │
    ┌────────────┴────────────┐
    │                         │
    ▼                         ▼
┌──────────────────┐   ┌─────────────────────────────┐
│ REST API         │   │ Packager Monitor            │
│ Reads channels   │   │ Ignores database!           │
│ from DB ✓        │   │                             │
│                  │   │ Hardcoded:                  │
│ Dashboard shows: │   │ channels = ['CH_001', ...]  │
│ - User can see   │   │                             │
│   channels exist │   │ Result:                     │
└──────────────────┘   │ - HBO not monitored         │
                       │ - No metrics collected      │
                       └─────────────────────────────┘
```

## 4. INPUT TYPE SUPPORT MATRIX

```
Input Type          Current Support    Dashboard Display    Monitoring Support
──────────────────────────────────────────────────────────────────────────────
HTTP/HLS            ✓ (API stores)      ✗ (not shown)       ✓ (works)
HTTP/DASH           ✓ (API stores)      ✗ (not shown)       ✓ (works)
MPEGTS_UDP          ✗ (no field)        ✗ (not shown)       ✗ (no code)
MPEGTS_RTP          ✗ (no field)        ✗ (not shown)       ✗ (no code)
MPEGTS_ASI          ✗ (no field)        ✗ (not shown)       ✗ (no code)
RTMP                ✗ (no field)        ✗ (not shown)       ✗ (no code)

Current Status:
- Only HTTP/HLS/DASH URLs are supported in monitoring
- Input type not differentiated in database
- No protocol-specific handling in monitor service
```

## 5. DATABASE SCHEMA - WHAT'S MISSING

```
Current Channel Table:
┌─────────────────────────────────────────┐
│ channel_id (PK)                         │
│ channel_code (unique)                   │
│ channel_name                            │
│ channel_type (LIVE/VOD/EVENT)           │  ← Stream category, not input type
│ tier (1-3)                              │
│ codec                                   │
│ resolution                              │
│ fps                                     │
│ is_4k, is_hdr, has_atmos                │
│ probe_id (FK) ───────────────────────┐  │
│ input_url (TEXT) ← No validation!     │  │
│ template_id (FK)                       │  │
│ enabled                                │  │
│ created_at, updated_at                 │  │
└─────────────────────────────────────────┘
                                          │
                                          ▼
                            ┌──────────────────────┐
                            │ Missing Fields:      │
                            │ input_type           │
                            │ input_protocol       │
                            │ input_port           │
                            │ input_multicast      │
                            │ input_timeout        │
                            │ input_bitrate        │
                            └──────────────────────┘

What Should Exist:
┌────────────────────────────────────┐
│ input_type (enum/string):          │
│  - HTTP_HLS                        │
│  - HTTP_DASH                       │
│  - MPEGTS_UDP                      │
│  - MPEGTS_RTP                      │
│  - MPEGTS_ASI                      │
│  - RTMP                            │
│  - SRT                             │
└────────────────────────────────────┘
```

## 6. COMPONENT INTERACTION FLOW

```
User creates channel via API:
┌──────────────────────────────────────────┐
│ POST /api/v1/channels                    │
│ {                                        │
│   channel_code: "HBO_TEST",              │
│   channel_name: "HBO Test",              │
│   channel_type: "LIVE",                  │
│   tier: 2,                               │
│   probe_id: 3,                           │
│   input_url: "http://packager/live/...",│
│   template_id: 1                         │
│ }                                        │
└──────────────────┬───────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │ Flask validates &    │
        │ inserts into DB ✓    │
        └──────────┬───────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
┌──────────────────┐  ┌────────────────────────────┐
│ Dashboard shows  │  │ Packager Monitor should    │
│ channel in list  │  │ pick up from DB            │
│ (API GET works)  │  │ BUT: Does NOT! ✗           │
│ ✓                │  │                            │
└──────────────────┘  │ Instead uses hardcoded     │
                      │ config.channels = [...]    │
                      │                            │
                      │ Result: No monitoring! ✗   │
                      └────────────────────────────┘
```

## 7. RUST MODULES - WHERE THEY SHOULD INTEGRATE

```
Currently (Disconnected):

API Layer           Analysis Layer
┌─────────────┐     ┌──────────────────────┐
│ Flask API   │     │ L1HeadendAnalyzer    │
│             │     │ (Rust)               │
│ Channels    │     │ • check_tr101290()   │
│ Probes      │     │ • analyze_loudness() │
│ Templates   │     │ • analyze_hdr()      │
└─────────────┘     │ • analyze_atmos()    │
      │             └──────────────────────┘
      │                     │
      │                     │ Not integrated!
      │                     │ Design doc only
      └────────────────────X

Should Be:

API Layer           Monitor              Analysis
┌─────────────┐     ┌───────────┐     ┌──────────────┐
│ Flask API   │────▶│ Monitor   │────▶│ L1Headend    │
│             │     │ Service   │     │ Analyzer     │
│ Channels    │     │ (reads DB)│     │ (Rust)       │
│ Probes      │     └───────────┘     └──────────────┘
│ Templates   │           │
└─────────────┘           ├──────────────────────────┐
                          ▼                          ▼
                    ┌──────────────┐      ┌────────────────┐
                    │ L2Packager   │      │ SNMP Traps     │
                    │ Analyzer     │      │ (Integration)  │
                    │ (Rust)       │      └────────────────┘
                    └──────────────┘
                          │
                          ▼
                    ┌──────────────┐
                    │ InfluxDB     │
                    │ (metrics)    │
                    └────────┬─────┘
                             ▼
                    ┌──────────────────┐
                    │ Grafana          │
                    │ (visualization)  │
                    └──────────────────┘
```

## 8. ISSUE SUMMARY TABLE

| # | Component | Issue | Impact | Severity |
|---|-----------|-------|--------|----------|
| 1 | React Dashboard | Doesn't display input_url or input_type | Users can't see what's being monitored | MEDIUM |
| 2 | CMS API | No input_type field in Channel model | Can't classify MPEGTS_UDP vs HTTP | HIGH |
| 3 | Packager Monitor | Hardcoded channels, doesn't read DB | HBO example ignored completely | CRITICAL |
| 4 | Packager Monitor | No MPEGTS_UDP parsing code | MPEGTS inputs fail | CRITICAL |
| 5 | Rust Modules | Not integrated with dashboard/API | L1/L2 analysis unavailable | HIGH |
| 6 | Database | No input_port, input_protocol fields | Can't specify UDP ports | HIGH |
| 7 | Monitoring Loop | 30s poll only for HTTP/HLS | Slow detection of issues | MEDIUM |

---

## 9. FIX IMPLEMENTATION SEQUENCE

**Phase 1: Quick Fix (Enable HTTP inputs)**
```
1. Initialize database with sample probes & templates
2. Create HTTP test channels via API (HBO → packager URL)
3. Start Packager Monitor with hardcoded HBO channel
4. Verify metrics flow to InfluxDB
5. Display in Grafana
```

**Phase 2: UI Improvements**
```
1. Add input_url display to React dashboard
2. Add input_type field to database
3. Update API to accept input_type
4. Show input details in ChannelCard component
```

**Phase 3: Database Integration**
```
1. Modify Packager Monitor to read from PostgreSQL
2. Fetch probes, then their channels
3. Parse input_url based on input_type
4. Dispatch to appropriate handler
```

**Phase 4: MPEGTS_UDP Support**
```
1. Create UDP socket handler
2. Implement MPEG-TS packet parser
3. Create probe type dispatcher
4. Integrate L1 Headend Analyzer
5. Wire metrics to dashboard
```

---

## Key Takeaway

The system has **four disconnected subsystems**:
1. UI (displays channels from API)
2. API (stores channels in DB)
3. Monitor (ignores DB, uses hardcoded config)
4. Analysis (design only, not running)

**To fix**: Connect the monitor to the API/DB and expand input type support.
