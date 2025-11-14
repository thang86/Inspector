# Inspector MVP - Deployment Guide

Complete step-by-step deployment guide for the Inspector MVP system.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Configuration](#configuration)
4. [Deployment](#deployment)
5. [Verification](#verification)
6. [Post-Deployment](#post-deployment)

## Prerequisites

### System Requirements

**Minimum**:
- CPU: 4 cores
- RAM: 4GB
- Disk: 20GB SSD
- OS: Ubuntu 20.04 LTS or later

**Recommended**:
- CPU: 8 cores
- RAM: 8GB
- Disk: 50GB SSD
- OS: Ubuntu 22.04 LTS

### Software Requirements

```bash
# Docker
Docker version 20.10+
Docker Compose version 2.0+

# Network
- Port 80, 443 (HTTP/HTTPS)
- Port 3000 (Grafana)
- Port 5000 (CMS API)
- Port 8080 (UI Dashboard)
- Port 8086 (InfluxDB)
- Port 9090 (Prometheus)
- Port 9093 (AlertManager)
```

### Install Docker

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y docker.io docker-compose-plugin

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker compose version
```

## Initial Setup

### 1. Clone Repository

```bash
cd /opt
git clone <repository-url> inspector
cd inspector/mvp
```

### 2. Directory Structure

```bash
mvp/
├── packager-monitor/       # Packager monitoring service
├── cdn-monitor/           # CDN monitoring service
├── cms-api/              # Channel management API
├── ui-dashboard/         # React UI
├── infrastructure/       # Docker compose & configs
└── docs/                # Documentation
```

## Configuration

### 1. Infrastructure Configuration

```bash
cd infrastructure
cp .env.example .env
nano .env
```

**Required settings** in `.env`:

```bash
# CRITICAL: Change all passwords!
POSTGRES_PASSWORD=YOUR_SECURE_PASSWORD_HERE
INFLUXDB_PASSWORD=YOUR_INFLUXDB_PASSWORD
INFLUXDB_TOKEN=YOUR_INFLUXDB_TOKEN_MIN_32_CHARS
GRAFANA_PASSWORD=YOUR_GRAFANA_PASSWORD

# Packager Configuration
PACKAGER_URL=http://YOUR_PACKAGER_HOST
POLL_INTERVAL=30

# CDN Configuration
CDN_ENDPOINTS=http://cdn-edge-1,http://cdn-edge-2
CDN_POLL_INTERVAL=60

# Channels to monitor
CHANNELS=CH_TV_HD_001,CH_TV_HD_002,CH_TV_HD_003
```

### 2. Generate Secure Passwords

```bash
# Generate random passwords
openssl rand -base64 32  # For POSTGRES_PASSWORD
openssl rand -base64 32  # For INFLUXDB_PASSWORD
openssl rand -base64 48  # For INFLUXDB_TOKEN
openssl rand -base64 32  # For GRAFANA_PASSWORD
```

### 3. Network Configuration

```bash
# Verify network connectivity to:
# - Packager endpoints
# - CDN endpoints
# - External services

# Test packager connectivity
curl -I http://YOUR_PACKAGER_HOST/live/CH_TV_HD_001/master.m3u8

# Test CDN connectivity
curl -I http://YOUR_CDN_EDGE/health
```

## Deployment

### Step 1: Start Infrastructure Services

```bash
cd infrastructure

# Start database services first
docker compose up -d postgres influxdb

# Wait for databases to be ready (30 seconds)
sleep 30

# Verify databases are healthy
docker compose ps
```

Expected output:
```
NAME                    STATUS              PORTS
inspector-postgres      Up (healthy)        5432->5432
inspector-influxdb      Up (healthy)        8086->8086
```

### Step 2: Initialize Databases

```bash
# PostgreSQL should auto-initialize from init_db.sql
# Verify tables were created
docker compose exec postgres psql -U inspector_app -d inspector_monitoring -c "\dt"

# Expected tables:
# - channels
# - probes
# - templates
# - alerts
```

### Step 3: Start Monitoring Services

```bash
# Start Prometheus and Grafana
docker compose up -d prometheus grafana

# Wait 10 seconds
sleep 10

# Start monitoring services
docker compose up -d cms-api packager-monitor cdn-monitor

# Verify services
docker compose ps
```

### Step 4: Start UI Dashboard

```bash
# Start UI dashboard
docker compose up -d ui-dashboard

# Verify all services are running
docker compose ps
```

All services should show "Up" status.

### Step 5: Start AlertManager

```bash
# Start AlertManager
docker compose up -d alertmanager

# Final verification
docker compose ps
```

## Verification

### 1. Service Health Checks

```bash
# CMS API
curl http://localhost:5000/api/v1/health
# Expected: {"status":"healthy"...}

# Prometheus
curl http://localhost:9090/-/healthy
# Expected: Prometheus is Healthy.

# InfluxDB
curl http://localhost:8086/health
# Expected: {"status":"pass"...}
```

### 2. Check Service Logs

```bash
# All services
docker compose logs --tail=50

# Specific service
docker compose logs -f packager-monitor
docker compose logs -f cms-api
docker compose logs -f cdn-monitor
```

Look for:
- No ERROR messages
- Successful database connections
- Metrics being pushed to InfluxDB

### 3. Verify Metrics Flow

```bash
# Check InfluxDB buckets
docker compose exec influxdb influx bucket list

# Query recent metrics
docker compose exec influxdb influx query 'from(bucket:"metrics") |> range(start:-1h) |> limit(n:10)'
```

### 4. Access Dashboards

Open in browser:

1. **UI Dashboard**: http://localhost:8080
   - Should show channel list
   - Should show KPIs

2. **Grafana**: http://localhost:3000
   - Login: admin / [your GRAFANA_PASSWORD]
   - Check datasources

3. **Prometheus**: http://localhost:9090
   - Check targets: Status → Targets
   - All should be "UP"

4. **CMS API**: http://localhost:5000/api/v1/channels
   - Should return channel list JSON

## Post-Deployment

### 1. Add Sample Channels

```bash
# Create sample channel via API
curl -X POST http://localhost:5000/api/v1/channels \
  -H "Content-Type: application/json" \
  -d '{
    "channel_code": "CH_TV_HD_001",
    "channel_name": "Test Channel HD 1",
    "channel_type": "LIVE",
    "tier": 1,
    "codec": "H.264",
    "resolution": "1920x1080",
    "probe_id": 1,
    "template_id": 1,
    "input_url": "http://packager/live/CH_TV_HD_001"
  }'
```

### 2. Configure Grafana Datasources

```bash
# Login to Grafana (http://localhost:3000)
# Add InfluxDB datasource:
Name: InfluxDB-Metrics
Type: InfluxDB
URL: http://influxdb:8086
Organization: inspector
Token: [your INFLUXDB_TOKEN]
Default Bucket: metrics

# Add Prometheus datasource:
Name: Prometheus
Type: Prometheus
URL: http://prometheus:9090
```

### 3. Import Grafana Dashboards

1. Go to Dashboards → Import
2. Upload dashboard JSON from `infrastructure/grafana/dashboards/`
3. Select datasources
4. Import

### 4. Configure Alerts

```bash
# Edit AlertManager config
nano infrastructure/alertmanager.yml

# Add Slack webhook or email SMTP
# Restart AlertManager
docker compose restart alertmanager
```

### 5. Setup Log Rotation

```bash
# Create logrotate config
sudo nano /etc/logrotate.d/inspector

# Add:
/var/log/inspector/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
}
```

### 6. Enable Auto-Start

```bash
# Enable Docker to start on boot
sudo systemctl enable docker

# Create systemd service
sudo nano /etc/systemd/system/inspector.service

# Add:
[Unit]
Description=Inspector MVP Stack
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/inspector/mvp/infrastructure
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down

[Install]
WantedBy=multi-user.target

# Enable service
sudo systemctl enable inspector
sudo systemctl start inspector
```

## Troubleshooting

### Services Won't Start

```bash
# Check Docker daemon
sudo systemctl status docker

# Check compose syntax
docker compose config

# Check logs
docker compose logs [service-name]

# Restart specific service
docker compose restart [service-name]
```

### Database Connection Errors

```bash
# Check PostgreSQL
docker compose exec postgres pg_isready -U inspector_app

# Connect to database
docker compose exec postgres psql -U inspector_app -d inspector_monitoring

# Check InfluxDB
docker compose exec influxdb influx ping
```

### No Metrics in Grafana

```bash
# Check InfluxDB has data
docker compose exec influxdb influx query 'from(bucket:"metrics") |> range(start:-1h)'

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check monitor logs
docker compose logs packager-monitor
docker compose logs cdn-monitor
```

### High Resource Usage

```bash
# Check resource usage
docker stats

# Limit resources in docker-compose.yml
# Add under each service:
deploy:
  resources:
    limits:
      cpus: '0.5'
      memory: 512M
```

## Backup & Recovery

### Backup

```bash
# Backup script
#!/bin/bash
BACKUP_DIR=/opt/inspector/backups/$(date +%Y%m%d)
mkdir -p $BACKUP_DIR

# Backup PostgreSQL
docker compose exec postgres pg_dump -U inspector_app inspector_monitoring > $BACKUP_DIR/postgres.sql

# Backup InfluxDB
docker compose exec influxdb influx backup /tmp/backup
docker cp inspector-influxdb:/tmp/backup $BACKUP_DIR/influxdb/

# Backup configs
cp -r infrastructure/*.yml $BACKUP_DIR/
cp infrastructure/.env $BACKUP_DIR/.env.backup
```

### Recovery

```bash
# Restore PostgreSQL
cat backup.sql | docker compose exec -T postgres psql -U inspector_app inspector_monitoring

# Restore InfluxDB
docker cp influxdb-backup/ inspector-influxdb:/tmp/backup
docker compose exec influxdb influx restore /tmp/backup
```

## Next Steps

1. **Monitoring**: Set up 24/7 monitoring
2. **Alerting**: Configure Slack/Email alerts
3. **Scaling**: Add more monitoring instances if needed
4. **Security**: Enable HTTPS, configure firewalls
5. **Documentation**: Document custom configurations
6. **Training**: Train NOC team on UI and alerts

---

**Deployment Complete!**

The Inspector MVP is now running and monitoring your infrastructure.
