# FPT PLAY MONITORING - COMPLETE DEPLOYMENT GUIDE
## Packager Layer (L2) Implementation with Code

---

## 📋 TABLE OF CONTENTS

1. [Architecture Overview](#architecture)
2. [Quick Start](#quick-start)
3. [Installation Steps](#installation)
4. [Configuration](#configuration)
5. [Deployment](#deployment)
6. [Usage & Monitoring](#usage)
7. [Troubleshooting](#troubleshooting)
8. [Integration Points](#integration)

---

## <a name="architecture"></a>1. ARCHITECTURE OVERVIEW

```
PACKAGER LAYER (L2) MONITORING STACK:

┌─────────────────────────────────────────────────────────┐
│ Packager Servers (Elemental, Unified, Wowza)           │
│ ├─ Input: MPEG-TS Multicast (239.1.x.x, 239.2.x.x)     │
│ └─ Output: HLS/DASH HTTP (http://packager/live/)       │
└─────────────────────┬───────────────────────────────────┘
                      │
                      │ Monitor via HTTP
                      v
┌─────────────────────────────────────────────────────────┐
│ Packager Monitor Service (Python)                       │
│ ├─ Download master.m3u8                                 │
│ ├─ Validate ABR ladder                                  │
│ ├─ Check segment continuity                             │
│ ├─ Verify segment quality                               │
│ └─ Push metrics to InfluxDB/Prometheus                  │
└─────────────────────┬───────────────────────────────────┘
                      │
    ┌─────────────────┼─────────────────┐
    │                 │                 │
    v                 v                 v
┌────────────┐  ┌──────────────┐  ┌────────────────┐
│ InfluxDB   │  │ Prometheus   │  │ PostgreSQL DB  │
│ (Metrics)  │  │ (Alerts)     │  │ (Configuration)│
└────────────┘  └──────────────┘  └────────────────┘
    │                 │                 │
    └─────────────────┼─────────────────┘
                      │
        ┌─────────────┴──────────────┐
        │                            │
        v                            v
    ┌────────────┐            ┌─────────────┐
    │ Grafana    │            │ CMS API     │
    │ Dashboard  │            │ (Config)    │
    └────────────┘            └─────────────┘
        │                            │
        │  Web UI (localhost:3000)   │ REST API (localhost:5000)
        │  Real-time Metrics         │ Channel Management
        │  Alert Status              │ Template Management
        │  Segment Quality           │ Alert Management
        │                            │
        └────────────────┬───────────┘
                         │
                    NOC Dashboard
                  (React Frontend)
```

---

## <a name="quick-start"></a>2. QUICK START (5 MIN)

### Prerequisites
- Docker + Docker Compose installed
- 8GB+ RAM available
- Network access to packager servers
- Git (for cloning configs)

### One-Command Deployment

```bash
# Clone monitoring stack
git clone https://github.com/fptplay/monitoring-system.git
cd monitoring-system

# Copy environment variables
cp .env.example .env

# Start all services
docker-compose up -d

# Verify services are running
docker-compose ps

# Access UIs
# - Grafana:  http://localhost:3000 (admin/admin)
# - API:      http://localhost:5000/api/v1/health
# - Prometheus: http://localhost:9090
```

### Verify Everything Is Running

```bash
# Check database
docker-compose exec postgres psql -U monitor_app -d fpt_play_monitoring -c "SELECT COUNT(*) FROM channels;"

# Check InfluxDB
curl -H "Authorization: Token your_influxdb_token" \
  http://localhost:8086/api/v2/buckets

# Check API health
curl http://localhost:5000/api/v1/health

# Check Prometheus scrape targets
curl http://localhost:9090/api/v1/targets
```

---

## <a name="installation"></a>3. INSTALLATION STEPS

### STEP 1: Deploy Infrastructure (PostgreSQL, InfluxDB, Prometheus)

```bash
# Create volumes and networks
docker-compose up -d postgres influxdb prometheus

# Wait for services to be healthy
docker-compose exec postgres pg_isready
docker-compose exec influxdb influx ping

# Verify database initialized
docker-compose exec postgres psql -U monitor_app -d fpt_play_monitoring -c "\dt"

# Expected output:
#              List of relations
#  Schema |     Name     | Type  |    Owner
# --------+--------------+-------+-----------
#  public | alerts       | table | monitor_app
#  public | channels     | table | monitor_app
#  public | probes       | table | monitor_app
#  public | templates    | table | monitor_app
```

### STEP 2: Deploy CMS API

```bash
# Build and start CMS API
docker-compose up -d cms-api

# Wait for service to be healthy
docker-compose logs -f cms-api

# Test API endpoints
curl http://localhost:5000/api/v1/health

# Expected response:
# {
#   "status": "healthy",
#   "database": "connected",
#   "timestamp": "2025-01-14T10:30:45.123456"
# }
```

### STEP 3: Deploy Packager Monitor Service

```bash
# Build and start Packager Monitor
docker-compose up -d packager-monitor

# View logs
docker-compose logs -f packager-monitor

# Expected log output:
# INFO:__main__:Starting Packager Monitor Service
# INFO:__main__:Starting monitor cycle for 50 channels
# DEBUG:__main__:Downloading: http://packager-01/live/CH_001/master.m3u8
# DEBUG:__main__:Found 4 renditions for CH_001
# ...
```

### STEP 4: Deploy Grafana & Dashboards

```bash
# Start Grafana
docker-compose up -d grafana

# Wait for Grafana to initialize
sleep 30

# Access Grafana
# URL: http://localhost:3000
# User: admin
# Password: admin_password_change_me (from .env)

# Import dashboards
# - Packager L2 Overview
# - Segment Quality
# - ABR Ladder Distribution
# - Real-time Metrics
```

### STEP 5: Deploy Alert Manager

```bash
# Start Alert Manager
docker-compose up -d alertmanager

# Verify Prometheus can reach it
curl http://localhost:9090/api/v1/rules

# Test alert (optional)
curl -X POST http://localhost:9093/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '[{
    "labels": {"alertname": "TestAlert", "severity": "major"},
    "annotations": {"description": "Test alert"}
  }]'
```

### STEP 6: Deploy Reverse Proxy (Nginx)

```bash
# Generate self-signed certificates (dev)
mkdir -p ssl
openssl req -x509 -newkey rsa:2048 -keyout ssl/key.pem \
  -out ssl/cert.pem -days 365 -nodes -subj "/CN=monitoring.local"

# Start Nginx
docker-compose up -d nginx

# Test reverse proxy
curl https://localhost/api/v1/health --insecure
```

---

## <a name="configuration"></a>4. CONFIGURATION

### Configure Packager Monitor

Edit `.env` file:

```bash
# Packager URLs
PACKAGER_URL=http://packager-01.internal

# Which channels to monitor (update based on your setup)
CHANNELS=CH_TV_HD_001,CH_TV_HD_002,...,CH_TV_HD_050

# InfluxDB credentials
INFLUXDB_URL=http://influxdb:8086
INFLUXDB_TOKEN=your_token_here

# Monitoring thresholds
SEGMENT_DURATION_TARGET=6.0
SEGMENT_DURATION_TOLERANCE=0.1  # 10%
MAX_DOWNLOAD_TIME=2.0  # seconds
```

### Configure Monitoring Thresholds (Database)

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U monitor_app -d fpt_play_monitoring

# Update template thresholds
UPDATE templates SET 
  min_mos = 3.5,
  loudness_target = -23.0,
  loudness_tolerance = 2.0,
  macroblocking_threshold = 0.15,
  freeze_threshold_ms = 1000
WHERE template_name = 'TPL_LIVE_HD';

UPDATE templates SET
  min_mos = 4.0,
  loudness_target = -23.0,
  loudness_tolerance = 2.0
WHERE template_name = 'TPL_LIVE_4K_HDR';
```

### Create Channel Configuration (API)

```bash
# Create a channel via API
curl -X POST http://localhost:5000/api/v1/channels \
  -H "Content-Type: application/json" \
  -d '{
    "channel_code": "CH_TV_HD_001",
    "channel_name": "FPT Channel 1 HD",
    "channel_type": "LIVE",
    "tier": 1,
    "codec": "H.264",
    "resolution": "1920x1080",
    "fps": 25,
    "is_4k": false,
    "is_hdr": false,
    "probe_id": 3,
    "input_url": "http://packager-01/live/CH_TV_HD_001/master.m3u8",
    "template_id": 1,
    "enabled": true
  }'

# Expected response:
# {
#   "status": "ok",
#   "channel_id": 1,
#   "message": "Channel created successfully"
# }
```

### Import Bulk Channels (CSV)

```bash
# Create channels.csv
channel_code,channel_name,channel_type,tier,codec,resolution,fps,is_4k,is_hdr,probe_id,input_url,template_id
CH_TV_HD_001,FPT Channel 1,LIVE,1,H.264,1920x1080,25,false,false,3,http://packager-01/live/CH_TV_HD_001/master.m3u8,1
CH_TV_HD_002,FPT Channel 2,LIVE,1,H.264,1920x1080,25,false,false,3,http://packager-01/live/CH_TV_HD_002/master.m3u8,1
CH_TV_4K_001,FPT 4K Channel,LIVE,1,HEVC,3840x2160,25,true,true,3,http://packager-01/live/CH_TV_4K_001/master.m3u8,2

# Use Python script to import
python3 - << 'EOF'
import pandas as pd
import requests

df = pd.read_csv('channels.csv')
api_url = 'http://localhost:5000/api/v1/channels'

for idx, row in df.iterrows():
    payload = row.to_dict()
    resp = requests.post(api_url, json=payload)
    print(f"Row {idx}: {resp.status_code} - {resp.json()}")
EOF
```

---

## <a name="deployment"></a>5. DEPLOYMENT

### Production Deployment Checklist

```
☐ Environment variables set correctly (.env)
☐ Database backed up
☐ SSL certificates configured (non-self-signed)
☐ Firewall rules allowing:
  - Port 80/443 (Nginx)
  - Port 5000 (API internal)
  - Port 3000 (Grafana internal)
  - Port 9090 (Prometheus internal)
☐ Network connectivity to packager servers verified
☐ DNS entries created:
  - monitoring.fpt.com.vn
  - api.monitor.local
  - grafana.monitor.local
☐ Backup strategy planned (PostgreSQL daily, InfluxDB daily)
☐ Alert routing configured (Slack/Email)
☐ Team trained on dashboard usage
```

### Deploy to Production

```bash
# 1. Pull latest code
git pull origin main

# 2. Update environment
cp .env.production .env
# Edit .env with production values

# 3. Stop and backup current deployment
docker-compose down
docker-compose exec postgres pg_dump -U monitor_app fpt_play_monitoring > backup-$(date +%s).sql

# 4. Deploy new version
docker-compose pull
docker-compose up -d

# 5. Verify health
docker-compose ps
docker-compose exec postgres psql -U monitor_app -d fpt_play_monitoring -c "SELECT COUNT(*) FROM channels;"

# 6. Check alerts
curl http://localhost:9090/api/v1/alerts

# 7. Verify metrics flow
curl -s http://localhost:8086/api/v2/query \
  -H "Authorization: Token $INFLUXDB_TOKEN" \
  --data-urlencode 'org=fpt-play' \
  --data-urlencode 'query=from(bucket:"packager_metrics") |> range(start: -1h)'
```

---

## <a name="usage"></a>6. USAGE & MONITORING

### Access Dashboards

#### Grafana - Real-time Monitoring

```
URL: http://grafana.monitor.local:3000
Login: admin / admin_password_change_me

Dashboards:
├─ L2 Packager Overview
│  ├─ Active channels count
│  ├─ Average segment duration
│  ├─ Segment download time distribution
│  └─ ABR ladder completeness
│
├─ Segment Quality
│  ├─ Segment duration variance
│  ├─ Segment size distribution
│  ├─ Download time p50/p95/p99
│  └─ HTTP error rate
│
├─ ABR Ladder Analysis
│  ├─ Bitrate ladder per channel
│  ├─ Resolution distribution
│  └─ Rung availability percentage
│
└─ Real-time Alerts
   ├─ Active CRITICAL alerts
   ├─ Active MAJOR alerts
   ├─ Recent alert history
   └─ Alert trend over time
```

#### CMS API - Channel Management

```
URL: http://api.monitor.local:5000

Endpoints:

GET /api/v1/channels
  - List all channels
  Query params: tier, is_4k, enabled

GET /api/v1/channels/{id}
  - Get channel details

POST /api/v1/channels
  - Create new channel
  Body: {channel_code, channel_name, ...}

PUT /api/v1/channels/{id}
  - Update channel

DELETE /api/v1/channels/{id}
  - Disable channel (soft delete)

GET /api/v1/alerts/active
  - List active alerts

POST /api/v1/alerts/{id}/acknowledge
  - Acknowledge alert

POST /api/v1/alerts/{id}/resolve
  - Resolve alert
```

#### React Dashboard - Web UI

```
URL: http://monitoring.fpt.com.vn

Features:
├─ Real-time KPI cards
│  ├─ Active channels
│  ├─ 4K channels
│  ├─ CRITICAL alerts
│  └─ MAJOR alerts
│
├─ Channels Tab
│  ├─ Filter by tier/type
│  ├─ Per-channel status
│  ├─ Codec/resolution info
│  └─ Edit configuration
│
├─ Alerts Tab
│  ├─ Active alerts list
│  ├─ Severity filtering
│  ├─ Acknowledge/Resolve actions
│  └─ Alert timeline
│
└─ Metrics Tab
   ├─ Video MOS trend (60s)
   ├─ Audio loudness trend
   └─ Bitrate trend
```

### Example Monitoring Queries

#### Prometheus - Query Metrics

```promql
# Average segment download time per channel
avg(segment_download_time_ms) by (channel)

# Segment validation errors per hour
sum(rate(playlist_validation_error_count[1h])) by (channel)

# ABR ladder completeness
abr_rung_count by (channel)

# Channels with issues
playlist_validation_is_valid == 0

# Segment availability
segment_metric{http_status="200"}
```

#### InfluxDB - Query Metrics

```bash
# Get segment metrics for last hour
curl -s http://localhost:8086/api/v2/query \
  -H "Authorization: Token $INFLUXDB_TOKEN" \
  --data-urlencode 'org=fpt-play' \
  --data-urlencode 'query=
from(bucket:"packager_metrics")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "segment_metric")
  |> filter(fn: (r) => r.channel == "CH_TV_HD_001")
'

# Get ABR ladder info
curl -s http://localhost:8086/api/v2/query \
  -H "Authorization: Token $INFLUXDB_TOKEN" \
  --data-urlencode 'org=fpt-play' \
  --data-urlencode 'query=
from(bucket:"packager_metrics")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "abr_ladder")
'
```

---

## <a name="troubleshooting"></a>7. TROUBLESHOOTING

### Service Won't Start

```bash
# Check logs
docker-compose logs cms-api
docker-compose logs packager-monitor
docker-compose logs postgres

# Common issues:
# - Port already in use: docker ps | grep 5000
# - Database not initialized: docker-compose exec postgres psql -U postgres
# - Network issues: docker network ls
```

### Packager Monitor Not Receiving Data

```bash
# Check packager connectivity
docker-compose exec packager-monitor curl -v http://packager-01/live/CH_001/master.m3u8

# Check InfluxDB connectivity
docker-compose exec packager-monitor python3 -c "
from influxdb_client import InfluxDBClient
client = InfluxDBClient(url='http://influxdb:8086', token='YOUR_TOKEN', org='fpt-play')
print(client.ping())
"

# Check packager-monitor logs for errors
docker-compose logs packager-monitor -n 100
```

### Metrics Not Appearing in Prometheus

```bash
# Check Prometheus scrape config
curl http://localhost:9090/api/v1/query?query=up

# View recent scrape errors
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.health != "up")'

# Manually trigger scrape (for testing)
curl http://cms-api:5000/metrics  # if metrics endpoint exists
```

### Alerts Not Firing

```bash
# Check alert rules
curl http://localhost:9090/api/v1/rules

# Check alert manager status
curl http://localhost:9093/api/v2/status

# Test alertmanager
curl -X POST http://localhost:9093/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '[{
    "labels": {"alertname": "TestAlert"},
    "annotations": {"description": "Test"}
  }]'
```

### Database Connection Issues

```bash
# Check database status
docker-compose exec postgres pg_isready

# Connect and verify
docker-compose exec postgres psql -U monitor_app -d fpt_play_monitoring -c "SELECT 1;"

# View database size
docker-compose exec postgres psql -U monitor_app -d fpt_play_monitoring -c "SELECT pg_size_pretty(pg_database_size('fpt_play_monitoring'));"

# Backup database
docker-compose exec postgres pg_dump -U monitor_app fpt_play_monitoring > backup.sql

# Restore database
docker-compose exec -T postgres psql -U monitor_app fpt_play_monitoring < backup.sql
```

---

## <a name="integration"></a>8. INTEGRATION POINTS

### With Inspector LIVE Probes

```python
# Inspector LIVE REST API → CMS Database sync

import requests

def sync_inspector_live_to_cms():
    # Fetch channels from Inspector LIVE probe
    inspector_url = "https://live-packager-01:8443/api/v1/programs"
    resp = requests.get(inspector_url, headers={"Authorization": f"Bearer {token}"})
    programs = resp.json()['programs']
    
    # Push to CMS
    for prog in programs:
        payload = {
            'channel_code': prog['id'],
            'channel_name': prog['name'],
            'channel_type': 'LIVE',
            'tier': 1,
            'codec': prog.get('codec'),
            'resolution': prog.get('resolution'),
            'fps': prog.get('fps'),
            'is_4k': 'UHD' in prog.get('resolution', ''),
            'probe_id': 3,
            'input_url': f"http://packager-01/live/{prog['id']}/master.m3u8",
            'template_id': 2 if '4K' in prog['name'] else 1
        }
        
        requests.post('http://cms-api:5000/api/v1/channels', json=payload)
```

### With NMS (Zabbix)

```bash
# Push alerts from Prometheus → Zabbix

# Create Zabbix alerting in alertmanager.yml:

receivers:
  - name: 'zabbix-integration'
    webhook_configs:
      - url: 'http://zabbix-server:10051/api/zabixtrigger'
        send_resolved: true
```

### With Slack/Email

```python
# Configure Slack notifications

# In alertmanager.yml:
global:
  slack_api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'

receivers:
  - name: 'slack'
    slack_configs:
      - channel: '#fpt-play-alerts'
        title: 'FPT Play Alert'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

---

## 📞 SUPPORT & ESCALATION

```
For Issues:

1. Packager Monitor Not Starting
   └─ Contact: DevOps Team / devops@fpt.com.vn

2. Database Issues
   └─ Contact: Database Admin / dba@fpt.com.vn

3. Network/Firewall
   └─ Contact: Network Team / network@fpt.com.vn

4. Packager Configuration
   └─ Contact: Packager Team / packager-ops@fpt.com.vn

Emergency:
   └─ NOC Hotline: +84-xxx-yyy-zzzz (24/7)
```

---

**END - Complete Deployment Guide**
