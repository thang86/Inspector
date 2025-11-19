# Inspector IPTV Monitoring - Deployment Guide

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Network Requirements](#network-requirements)
5. [Deployment Steps](#deployment-steps)
6. [Multicast Configuration](#multicast-configuration)
7. [Service Configuration](#service-configuration)
8. [Troubleshooting](#troubleshooting)

---

## Overview

Inspector is a comprehensive IPTV monitoring system that provides:
- **TR 101 290 DVB Error Detection** (Priority 1, 2, 3)
- **MDI Network Transport Metrics** (RFC 4445)
- **Quality of Experience (QoE)** Metrics
- **Real-time Stream Analysis**
- **Web Dashboard** with Grafana integration

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Inspector System                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │   Multicast  │─────▶│   Monitor    │─────▶│   InfluxDB   │  │
│  │  UDP Streams │      │   Service    │      │  (Metrics)   │  │
│  │ 225.x.x.x:xx │      │ (Host Net)   │      │              │  │
│  └──────────────┘      └──────────────┘      └──────────────┘  │
│                               │                       │          │
│                               ▼                       ▼          │
│                        ┌──────────────┐      ┌──────────────┐  │
│                        │  PostgreSQL  │      │   Grafana    │  │
│                        │   (Config)   │      │ (Dashboard)  │  │
│                        └──────────────┘      └──────────────┘  │
│                               │                                  │
│                               ▼                                  │
│                        ┌──────────────┐                         │
│                        │   CMS API    │                         │
│                        │   (Flask)    │                         │
│                        └──────────────┘                         │
│                               │                                  │
│                               ▼                                  │
│                        ┌──────────────┐                         │
│                        │  React UI    │                         │
│                        │   (nginx)    │                         │
│                        └──────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### System Requirements

- **OS**: Linux (Ubuntu 20.04+ or similar)
- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **RAM**: 4GB minimum, 8GB recommended
- **CPU**: 2 cores minimum, 4 cores recommended
- **Disk**: 20GB minimum for logs and metrics

### Software Dependencies

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt-get update
sudo apt-get install docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

---

## Network Requirements

### 🔴 **CRITICAL: Multicast Network Access**

The monitor service **MUST** have access to multicast UDP streams for analysis. This requires:

#### 1. **Host Network Configuration**

The monitor service runs with `network_mode: host` to receive multicast traffic directly from the network interface.

**Why Host Mode?**
- Docker bridge networks **DO NOT** support multicast by default
- Host network mode allows the container to join multicast groups (IGMP)
- Container shares the host's network stack and can receive multicast packets

#### 2. **Verify Host Can Receive Multicast**

**Test multicast reception on host:**

```bash
# Install multicast test tools
sudo apt-get install -y socat netcat-openbsd

# Test receiving multicast stream
# Replace 225.3.3.42 and 30130 with your actual multicast address/port
timeout 10 socat UDP4-RECV:30130,ip-add-membership=225.3.3.42:0.0.0.0 -

# Alternative test with netcat
timeout 10 nc -u -l -p 30130 225.3.3.42

# If you see data output, multicast is working!
# If timeout with no data, multicast routing is not configured
```

#### 3. **Enable Multicast Routing (if needed)**

If the host cannot receive multicast:

```bash
# Check current multicast routes
ip mroute show
netstat -g

# Add multicast route to specific interface
# Replace eth0 with your network interface
sudo ip route add 224.0.0.0/4 dev eth0

# Make it persistent (Ubuntu/Debian)
echo "224.0.0.0/4 dev eth0" | sudo tee -a /etc/network/interfaces

# Restart networking
sudo systemctl restart networking
```

#### 4. **Configure IGMP (Internet Group Management Protocol)**

```bash
# Check if IGMP is enabled
cat /proc/sys/net/ipv4/conf/all/mc_forwarding

# Enable IGMP forwarding
sudo sysctl -w net.ipv4.conf.all.mc_forwarding=1
sudo sysctl -w net.ipv4.conf.eth0.mc_forwarding=1

# Make it persistent
echo "net.ipv4.conf.all.mc_forwarding=1" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

#### 5. **Firewall Configuration**

```bash
# Allow multicast traffic (UFW)
sudo ufw allow from 224.0.0.0/4
sudo ufw allow to 224.0.0.0/4

# Allow multicast traffic (iptables)
sudo iptables -A INPUT -s 224.0.0.0/4 -j ACCEPT
sudo iptables -A OUTPUT -d 224.0.0.0/4 -j ACCEPT
```

---

## Deployment Steps

### 1. **Clone Repository**

```bash
cd /home/thanghl/Inspector
git pull origin main
cd deploy
```

### 2. **Environment Configuration**

**Development Environment:**
- Uses `docker-compose.dev.yml`
- Monitor service: `network_mode: host` for multicast
- Database credentials: `monitor_app:dev_password_123`
- InfluxDB token: `dev_influxdb_token_12345`

**Production Environment:**
- Uses `docker-compose.prod.yml`
- Configure SSL certificates
- Update passwords in `.env.production.local`

### 3. **Deploy Services**

**Development Deployment:**

```bash
cd /home/thanghl/Inspector/deploy

# Using the automated deployment script
./deploy-mdi-qoe.sh

# Or manually with docker-compose
docker-compose -f docker-compose.dev.yml up -d

# Check service status
docker-compose -f docker-compose.dev.yml ps
```

**Production Deployment:**

```bash
cd /home/thanghl/Inspector/deploy

# Set environment variables
cp .env.production.example .env.production.local
nano .env.production.local  # Edit with your credentials

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

### 4. **Verify Deployment**

```bash
# Check all containers are running
docker ps --filter "name=inspector"

# Check service health
curl http://localhost:5000/api/v1/health
curl http://localhost:8086/health

# Check monitor logs for multicast reception
docker logs inspector-monitor-dev --tail 50

# Look for:
# ✅ "Successfully analyzed stream" = Multicast working
# ❌ "UDP probe failed: 0 packets received" = Multicast NOT working
```

---

## Multicast Configuration

### Monitor Service Network Configuration

**In `docker-compose.dev.yml`:**

```yaml
packager-monitor:
  container_name: inspector-monitor-dev
  # CRITICAL: Host network mode for multicast access
  network_mode: host
  environment:
    # Use localhost because container is on host network
    DATABASE_URL: postgresql://monitor_app:dev_password_123@localhost:5432/fpt_play_monitoring
    INFLUXDB_URL: http://localhost:8086
    INFLUXDB_TOKEN: dev_influxdb_token_12345
    INFLUXDB_ORG: fpt-play
    INFLUXDB_BUCKET: packager_metrics
```

**Key Points:**
- ✅ `network_mode: host` - Enables multicast reception
- ✅ Use `localhost` for database/InfluxDB connections (not service names)
- ❌ Cannot use Docker networks when using host mode
- ❌ Cannot use `depends_on` with host mode

### Adding Multicast Input Streams

**Via UI:**
1. Navigate to http://localhost:8080
2. Click "Configuration" tab
3. Add new input:
   - Name: `Channel Name`
   - URL: `udp://225.3.3.42:30130` (your multicast address)
   - Type: `MPEGTS_UDP`
   - Protocol: `udp`
   - Port: `30130`
   - Probe ID: `1`

**Via API:**

```bash
curl -X POST http://localhost:5000/api/v1/inputs \
  -H "Content-Type: application/json" \
  -d '{
    "input_name": "VTV1 HD",
    "input_url": "udp://225.3.3.42:30130",
    "input_type": "MPEGTS_UDP",
    "input_protocol": "udp",
    "input_port": 30130,
    "probe_id": 1,
    "is_primary": true,
    "enabled": true
  }'
```

---

## Service Configuration

### Port Mapping

| Service | Port | Description |
|---------|------|-------------|
| CMS API | 5000 | REST API endpoints |
| InfluxDB | 8086 | Time-series metrics database |
| PostgreSQL | 5432 | Configuration database |
| Grafana | 3000 | Dashboards and visualization |
| UI (nginx) | 8080 | React web interface |

### API Endpoints

**Health Check:**
```bash
curl http://localhost:5000/api/v1/health
```

**List Inputs:**
```bash
curl http://localhost:5000/api/v1/inputs
```

**Get TR 101 290 Metrics:**
```bash
curl http://localhost:5000/api/v1/metrics/tr101290/1
```

**Get MDI Metrics:**
```bash
curl http://localhost:5000/api/v1/metrics/mdi/1
```

**Get QoE Metrics:**
```bash
curl http://localhost:5000/api/v1/metrics/qoe/1
```

---

## Troubleshooting

### Issue 1: Monitor Cannot Receive Multicast

**Symptoms:**
```
WARNING - UDP probe failed for Channel: 0 packets received
```

**Diagnosis:**
```bash
# Test multicast on host
timeout 10 socat UDP4-RECV:30130,ip-add-membership=225.3.3.42:0.0.0.0 -

# Check multicast routes
ip mroute show

# Check IGMP membership
netstat -g
```

**Solutions:**
1. Verify multicast stream is actually broadcasting
2. Enable multicast routing: `sudo ip route add 224.0.0.0/4 dev eth0`
3. Enable IGMP: `sudo sysctl -w net.ipv4.conf.all.mc_forwarding=1`
4. Check firewall allows multicast traffic
5. Verify monitor service is using `network_mode: host`

### Issue 2: Monitor Service Can't Connect to Database

**Symptoms:**
```
ERROR - Could not connect to database
```

**Diagnosis:**
```bash
# Check if PostgreSQL is accessible from host
psql -h localhost -p 5432 -U monitor_app -d fpt_play_monitoring

# Check monitor environment
docker exec inspector-monitor-dev env | grep DATABASE
```

**Solutions:**
1. Verify PostgreSQL is listening on `0.0.0.0:5432` not just `127.0.0.1`
2. Check `DATABASE_URL` uses `localhost` not `postgres` (because host network)
3. Restart PostgreSQL container

### Issue 3: InfluxDB Unauthorized

**Symptoms:**
```
ERROR - (401) Reason: Unauthorized
```

**Solution:**
```bash
# Check InfluxDB token
docker exec inspector-monitor-dev env | grep INFLUXDB_TOKEN

# Should match token in docker-compose.dev.yml
# Default: dev_influxdb_token_12345
```

### Issue 4: UI Shows Empty Data

**Symptoms:**
- UI loads but shows no inputs or metrics

**Diagnosis:**
```bash
# Check API is accessible
curl http://localhost:5000/api/v1/inputs

# Check network connectivity
docker network inspect inspector-monitoring-dev
```

**Solutions:**
1. Connect UI container to dev network: `docker network connect inspector-monitoring-dev inspector-ui`
2. Restart UI container: `docker restart inspector-ui`
3. Check nginx logs: `docker logs inspector-ui`

### Issue 5: Delete Button Not Working

**Symptoms:**
- Deleted inputs still appear in UI

**Solution:**
- Delete is a "soft delete" (sets `enabled=false`)
- Inputs are hidden from default list view
- Use `GET /api/v1/inputs?all=true` to see disabled inputs
- This is by design to preserve historical data

---

## Maintenance

### View Logs

```bash
# Monitor service
docker logs -f inspector-monitor-dev

# CMS API
docker logs -f inspector-cms-api-dev

# InfluxDB
docker logs -f inspector-influxdb-dev

# UI
docker logs -f inspector-ui
```

### Backup Database

```bash
# PostgreSQL backup
docker exec inspector-db-dev pg_dump -U monitor_app fpt_play_monitoring > backup.sql

# InfluxDB backup
docker exec inspector-influxdb-dev influx backup /tmp/backup
docker cp inspector-influxdb-dev:/tmp/backup ./influx_backup
```

### Update Services

```bash
cd /home/thanghl/Inspector/deploy

# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.dev.yml build
docker-compose -f docker-compose.dev.yml up -d
```

---

## Performance Tuning

### Monitor Service

- **POLL_INTERVAL**: Set to `30` seconds for frequent checks, `60` for less frequent
- **UDP Buffer Size**: Increase if dropping packets (edit monitor.py)
- **Snapshot Interval**: Adjust based on storage capacity

### InfluxDB

- **Retention Policy**: Default 7 days, adjust in docker-compose
- **Bucket Size**: Monitor disk usage with `docker exec inspector-influxdb-dev du -sh /var/lib/influxdb2`

### PostgreSQL

- **Connection Pool**: Tune based on concurrent API requests
- **Vacuum**: Run `VACUUM ANALYZE` weekly for performance

---

## Security Considerations

### Production Deployment

1. **Change Default Passwords**:
   - PostgreSQL: `monitor_app:dev_password_123` → strong password
   - InfluxDB token: Generate new token
   - Grafana admin: Change from `admin:admin`

2. **Enable SSL/TLS**:
   - Configure nginx with SSL certificates
   - Use HTTPS for all external access

3. **Firewall Rules**:
   - Restrict access to internal network only
   - Only expose nginx (port 8080/443) externally
   - Block direct access to database ports

4. **Network Isolation**:
   - Use separate Docker networks for services
   - Only monitor service needs host network mode

---

## Support

For issues or questions:
- **GitHub**: https://github.com/thang86/Inspector/issues
- **Documentation**: `/home/thanghl/Inspector/deploy/MDI_QOE_DOCUMENTATION.md`
- **Logs**: Check service logs with `docker logs <container-name>`

---

**Document Version**: 1.0
**Last Updated**: 2025-11-19
**Deployment Type**: Development & Production
