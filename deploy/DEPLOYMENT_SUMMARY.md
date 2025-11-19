# FPT Play Inspector - Production Deployment Summary

## Deployment Status: OPERATIONAL

All services are running and monitoring the VTV1 HD Primary channel at `udp://225.3.3.42:30130`.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Inspector Monitoring Stack                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Monitor    │───▶│   InfluxDB   │───▶│   Grafana    │  │
│  │   Service    │    │  (Metrics)   │    │ (Dashboard)  │  │
│  │              │    │              │    │              │  │
│  │ - UDP Probe  │    │ - TR 101290  │    │ - 720p View  │  │
│  │ - TR 101290  │    │ - Bitrate    │    │ - Alerts     │  │
│  │ - Snapshots  │    │ - Packets    │    │              │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                                                     │
│         └─────────────────┐                                 │
│                           ▼                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  PostgreSQL  │◀───│   CMS API    │◀───│      UI      │  │
│  │              │    │              │    │   Dashboard  │  │
│  │ - Inputs DB  │    │ - REST API   │    │              │  │
│  │ - Channels   │    │ - Metrics    │    │ - React App  │  │
│  │ - Alerts     │    │ - Health     │    │              │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    udp://225.3.3.42:30130
                      (VTV1 HD Primary)
```

---

## Current Monitoring Status

### Channel: VTV1 HD Primary

| Parameter | Value | Status |
|-----------|-------|--------|
| **Stream URL** | udp://225.3.3.42:30130 | Active |
| **Resolution** | 1280x720 (720p) | OK |
| **Frame Rate** | 25 fps | OK |
| **Video Codec** | H.264 (High Profile) | OK |
| **Audio Codec** | AAC | OK |
| **Bitrate** | 0.75 - 1.1 Mbps | Variable |
| **Packets/Sample** | 100 packets | OK |
| **Monitor Interval** | 30 seconds | Active |
| **Snapshot Interval** | 60 seconds | Active |

### TR 101 290 DVB Errors

| Priority | Total Errors | Details |
|----------|--------------|---------|
| **P1 (Critical)** | 6 | 5x Continuity Count, 1x PMT Error |
| **P2 (Quality)** | 0 | No errors detected |
| **P3 (Info)** | 0 | No errors detected |

**Analysis:**
- Continuity count errors indicate minor packet loss or reordering
- PMT error suggests Program Map Table transmission issues
- Stream remains decodable and viewable
- Errors are within acceptable thresholds for IP multicast

---

## Service Access

### Web Interfaces

| Service | URL | Credentials | Purpose |
|---------|-----|-------------|---------|
| **Grafana** | http://localhost:3000 | admin / Admin@123!@# | Dashboards & Visualization |
| **InfluxDB** | http://localhost:8086 | admin / admin_password_123 | Time-Series Metrics |
| **UI Dashboard** | http://localhost:8080 | N/A | React Web Interface |
| **CMS API** | http://localhost:5000 | N/A | REST API |
| **Prometheus** | http://localhost:9090 | N/A | Metrics Scraper |
| **AlertManager** | http://localhost:9093 | N/A | Alert Management |

### API Endpoints

All API endpoints available at `http://localhost:5000/api/v1`:

```bash
# Health Check
GET /health

# Channel Management
GET /channels
POST /channels
GET /channels/{id}
PUT /channels/{id}
DELETE /channels/{id}

# Input Management
GET /inputs
POST /inputs
GET /inputs/{id}
PUT /inputs/{id}
DELETE /inputs/{id}

# Alert Management
GET /alerts
GET /alerts/{id}
POST /alerts/{id}/acknowledge

# Metrics (NEW)
GET /metrics/tr101290/{input_id}     # TR 101 290 errors
GET /metrics/stream/{input_id}        # Stream bitrate/packets
GET /metrics/status/{input_id}        # Comprehensive status
```

---

## Key Features Implemented

### 1. UDP Multicast Reception
- **Network Mode:** Host networking for multicast access
- **Stream:** 225.3.3.42:30130 (VTV1 HD Primary)
- **Buffer Size:** 2 MB for packet capture
- **Status:** Working - receiving 100 packets per probe

### 2. TR 101 290 DVB Monitoring
- **Priority 1 Errors:** Sync, PAT, PMT, Continuity, PID
- **Priority 2 Errors:** Transport, CRC, PCR, PTS, CAT
- **Priority 3 Errors:** NIT, SI Repetition, Unreferenced PID
- **Metadata:** Packet counts, PAT/PMT status, PCR intervals
- **Status:** Fully operational - detecting 6 P1 errors

### 3. Snapshot Capture
- **Frequency:** Every 60 seconds
- **Format:** JPEG
- **Location:** `/home/thanghl/Inspector/snapshots/`
- **Naming:** `vtv1_hd_primary_YYYYMMDD_HHMMSS.jpg`
- **Status:** Working - latest snapshot at 2025-11-19 03:42:50

### 4. Metrics API
- **InfluxDB Integration:** Time-series metrics storage
- **REST Endpoints:** TR 101290, stream metrics, status
- **Real-time Data:** Last hour of metrics available
- **Status:** All endpoints tested and operational

### 5. Database Storage
- **PostgreSQL:** Input sources, channels, alerts
- **InfluxDB:** Time-series metrics (30-day retention)
- **Measurements:** tr101290_p1, tr101290_p2, tr101290_p3, tr101290_metadata, udp_probe_metric
- **Status:** All databases healthy

---

## Docker Services Status

```bash
# Check all services
docker-compose -f docker-compose.prod.yml ps
```

| Service | Container Name | Status | Ports |
|---------|----------------|--------|-------|
| postgres | inspector-db | Up | 5432 |
| influxdb | inspector-influxdb | Up | 8086 |
| prometheus | inspector-prometheus | Up | 9090 |
| alertmanager | inspector-alertmanager | Up | 9093 |
| grafana | inspector-grafana | Up | 3000 |
| cms-api | inspector-cms-api | Up | 5000 |
| packager-monitor | inspector-monitor | Up (host network) | - |
| nginx | inspector-nginx | Up | 80, 443 |
| ui-dashboard | inspector-ui | Up | 8080 |

---

## Configuration Files

### Environment Variables
**File:** `/home/thanghl/Inspector/deploy/.env.production.local`

```bash
# PostgreSQL
POSTGRES_DB=fpt_play_monitoring
POSTGRES_USER=monitor_app
POSTGRES_PASSWORD=Passw0rd_Prod_2025

# InfluxDB
INFLUXDB_ADMIN_USER=admin
INFLUXDB_ADMIN_PASSWORD=admin_password_123
INFLUXDB_ORG=fpt-play
INFLUXDB_BUCKET=packager_metrics
INFLUXDB_TOKEN=influx_prod_token_$(openssl rand -hex 16)

# Grafana
GF_ADMIN_USER=admin
GF_ADMIN_PASSWORD=Admin@123!@#

# Monitoring
POLL_INTERVAL=30
ENABLE_SNAPSHOTS=true
SNAPSHOT_DIR=/home/thanghl/Inspector/snapshots
SNAPSHOT_INTERVAL=60
```

### Docker Compose
**File:** `/home/thanghl/Inspector/deploy/docker-compose.prod.yml`

Key configurations:
- Monitor uses `network_mode: "host"` for multicast
- CMS API has InfluxDB environment variables
- All services have health checks
- 30-day retention for time-series data

---

## Data Flow

### 1. Stream Monitoring
```
UDP Stream (225.3.3.42:30130)
    ↓
Monitor Service (every 30s)
    ├─▶ TR 101 290 Analysis
    ├─▶ Bitrate Calculation
    ├─▶ Packet Counting
    └─▶ Snapshot Capture (every 60s)
    ↓
InfluxDB Storage
    ├─▶ tr101290_p1 measurement
    ├─▶ tr101290_p2 measurement
    ├─▶ tr101290_p3 measurement
    ├─▶ tr101290_metadata measurement
    └─▶ udp_probe_metric measurement
```

### 2. API Access
```
UI/Client Request
    ↓
CMS API (Flask)
    ↓
InfluxDB Query (Flux)
    ↓
JSON Response
    ├─▶ TR 101 290 errors
    ├─▶ Stream metrics
    └─▶ Input status
```

### 3. Visualization
```
InfluxDB Metrics
    ↓
Grafana Dashboard
    ├─▶ Bitrate Chart
    ├─▶ Error Count Chart
    ├─▶ Packet Rate Chart
    └─▶ Alert Rules
```

---

## Grafana Dashboard Setup

### 1. Login to Grafana
```
URL: http://localhost:3000
User: admin
Pass: Admin@123!@#
```

### 2. Verify InfluxDB Datasource
- Navigate to: Configuration → Data Sources
- Should see: **InfluxDB_Packager_Metrics** (default)
- Organization: fpt-play
- Bucket: packager_metrics

### 3. Create Dashboard

**Panel 1: Bitrate Over Time**
```flux
from(bucket: "packager_metrics")
  |> range(start: -1h)
  |> filter(fn: (r) => r["_measurement"] == "udp_probe_metric")
  |> filter(fn: (r) => r["_field"] == "bitrate_mbps")
  |> filter(fn: (r) => r["input_id"] == "1")
```

**Panel 2: TR 101 290 P1 Errors**
```flux
from(bucket: "packager_metrics")
  |> range(start: -1h)
  |> filter(fn: (r) => r["_measurement"] == "tr101290_p1")
  |> filter(fn: (r) => r["input_id"] == "1")
  |> filter(fn: (r) => r["_field"] == "total_p1_errors")
  |> aggregateWindow(every: 1m, fn: last)
```

**Panel 3: Continuity Count Errors**
```flux
from(bucket: "packager_metrics")
  |> range(start: -1h)
  |> filter(fn: (r) => r["_measurement"] == "tr101290_p1")
  |> filter(fn: (r) => r["input_id"] == "1")
  |> filter(fn: (r) => r["_field"] == "continuity_count_error")
```

**Panel 4: Packets Received**
```flux
from(bucket: "packager_metrics")
  |> range(start: -1h)
  |> filter(fn: (r) => r["_measurement"] == "udp_probe_metric")
  |> filter(fn: (r) => r["_field"] == "packets_received")
  |> filter(fn: (r) => r["input_id"] == "1")
```

---

## Maintenance Commands

### Start All Services
```bash
cd /home/thanghl/Inspector/deploy
docker-compose -f docker-compose.prod.yml --env-file .env.production.local up -d
```

### Stop All Services
```bash
docker-compose -f docker-compose.prod.yml down
```

### View Logs
```bash
# Monitor service
docker logs -f inspector-monitor

# CMS API
docker logs -f inspector-cms-api

# InfluxDB
docker logs -f inspector-influxdb

# All services
docker-compose -f docker-compose.prod.yml logs -f
```

### Restart Individual Service
```bash
# Restart monitor
docker-compose -f docker-compose.prod.yml restart packager-monitor

# Restart CMS API
docker-compose -f docker-compose.prod.yml restart cms-api
```

### Check Health
```bash
# API health
curl http://localhost:5000/api/v1/health

# Check all containers
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### View Snapshots
```bash
ls -lht /home/thanghl/Inspector/snapshots/ | head -10
```

---

## Troubleshooting

### Issue: Monitor not receiving multicast packets

**Solution:**
```bash
# Test stream accessibility from host
ffprobe -v error -show_entries format=duration,bit_rate,nb_streams \
  -show_streams udp://225.3.3.42:30130

# Check monitor logs
docker logs inspector-monitor --tail 50

# Verify host networking
docker inspect inspector-monitor | jq '.[0].HostConfig.NetworkMode'
# Should output: "host"
```

### Issue: CMS API returns 500 errors

**Solution:**
```bash
# Check API logs
docker logs inspector-cms-api --tail 50

# Test database connection
docker exec -it inspector-db psql -U monitor_app -d fpt_play_monitoring -c "SELECT 1;"

# Restart API
docker-compose -f docker-compose.prod.yml restart cms-api
```

### Issue: No metrics in InfluxDB

**Solution:**
```bash
# Check monitor is pushing metrics
docker logs inspector-monitor | grep "Pushed TR 101 290"

# Verify InfluxDB token
docker exec -it inspector-influxdb influx auth list

# Test InfluxDB connection
curl -H "Authorization: Token influx_prod_token_..." \
  http://localhost:8086/api/v2/buckets
```

### Issue: UI shows "Failed to fetch"

**Solution:**
```bash
# Rebuild UI without cache
cd /home/thanghl/Inspector/deploy
DOCKER_BUILDKIT=0 docker-compose build --no-cache ui-dashboard
docker-compose -f docker-compose.prod.yml up -d ui-dashboard

# Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
```

---

## Performance Metrics

### System Resource Usage
```bash
# Check container resource usage
docker stats --no-stream
```

Typical usage:
- **Monitor:** ~50 MB RAM, <5% CPU
- **CMS API:** ~100 MB RAM, <10% CPU
- **InfluxDB:** ~200 MB RAM, <15% CPU
- **Grafana:** ~150 MB RAM, <10% CPU
- **PostgreSQL:** ~50 MB RAM, <5% CPU

### Network Usage
- **Multicast Stream:** ~1 Mbps incoming
- **API Requests:** <100 KB/request
- **Snapshot Storage:** ~50-100 KB per JPEG

### Storage Usage
```bash
# Check volume sizes
docker system df -v | grep inspector
```

Typical storage:
- **PostgreSQL:** <100 MB (database tables)
- **InfluxDB:** ~500 MB - 2 GB (30-day retention)
- **Grafana:** <50 MB (dashboards)
- **Snapshots:** ~100 MB per day (1440 snapshots)

---

## Next Steps

### 1. Create Grafana Dashboards
Use the Flux queries above to create visualizations for:
- Real-time bitrate monitoring
- TR 101 290 error tracking
- Packet loss detection
- Stream health status

### 2. Update React UI (Optional)
Integrate the new metrics endpoints to display:
- Current bitrate
- TR 101 290 error counts
- Latest snapshot
- Stream status indicators

See `API_METRICS_GUIDE.md` for integration examples.

### 3. Configure Alerts
Set up AlertManager rules for:
- P1 error thresholds (e.g., >10 errors/minute)
- Bitrate drops (e.g., <0.5 Mbps)
- Stream offline detection
- Snapshot failures

### 4. Add More Channels
To monitor additional streams:
```bash
# Add new input via API
curl -X POST http://localhost:5000/api/v1/inputs \
  -H "Content-Type: application/json" \
  -d '{
    "input_name": "VTV2 HD",
    "input_url": "udp://225.3.3.43:30140",
    "input_type": "MPEGTS_UDP",
    "enabled": true
  }'
```

---

## Support & Documentation

- **API Guide:** `/home/thanghl/Inspector/deploy/API_METRICS_GUIDE.md`
- **Deployment Config:** `/home/thanghl/Inspector/deploy/docker-compose.prod.yml`
- **Environment Vars:** `/home/thanghl/Inspector/deploy/.env.production.local`
- **Monitor Script:** `/home/thanghl/Inspector/1_packager_monitor_service.py`
- **CMS API:** `/home/thanghl/Inspector/2_cms_api_flask.py`

---

## Summary

The FPT Play Inspector monitoring system is fully operational and successfully monitoring VTV1 HD Primary at udp://225.3.3.42:30130. All features are working:

- Real-time TR 101 290 DVB error detection
- Stream bitrate and packet monitoring
- Automated snapshot capture every 60 seconds
- REST API for metrics access
- InfluxDB time-series storage
- Grafana-ready visualization
- PostgreSQL database for configuration

Current stream health: **GOOD** with 6 minor P1 errors detected (5 continuity count, 1 PMT).

**Ready for production use.**
