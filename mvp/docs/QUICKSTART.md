# Inspector MVP - Quick Start Guide

Get the Inspector MVP up and running in 10 minutes.

## 1-Minute Overview

Inspector MVP monitors your video infrastructure across multiple layers:
- **Packager**: HLS/DASH playlists and segments
- **CDN**: Edge latency and cache performance
- **UI**: Web dashboard for visualization
- **CMS**: API for channel management
- **Metrics**: InfluxDB + Prometheus + Grafana

## Prerequisites

- Linux server (Ubuntu 20.04+ recommended)
- Docker & Docker Compose installed
- 4GB RAM, 20GB disk
- Network access to your packager and CDN

## Quick Start (10 Minutes)

### Step 1: Setup (2 minutes)

```bash
# Navigate to infrastructure directory
cd mvp/infrastructure

# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

**Minimum required changes**:
```bash
POSTGRES_PASSWORD=your_secure_password
INFLUXDB_TOKEN=your_token_min_32_characters
PACKAGER_URL=http://your-packager-host
```

### Step 2: Deploy (5 minutes)

```bash
# Start all services
docker compose up -d

# Wait for services to start (about 30 seconds)
sleep 30

# Check status
docker compose ps
```

All services should show "Up" or "Up (healthy)".

### Step 3: Verify (2 minutes)

```bash
# Check CMS API
curl http://localhost:5000/api/v1/health

# Check UI Dashboard
curl http://localhost:8080

# View logs
docker compose logs --tail=20
```

### Step 4: Access Dashboards (1 minute)

Open in your browser:

1. **UI Dashboard**: http://localhost:8080
2. **Grafana**: http://localhost:3000 (admin / your GRAFANA_PASSWORD)
3. **Prometheus**: http://localhost:9090
4. **CMS API**: http://localhost:5000/api/v1/channels

## Common Tasks

### Add a Channel

```bash
curl -X POST http://localhost:5000/api/v1/channels \
  -H "Content-Type: application/json" \
  -d '{
    "channel_code": "CH_001",
    "channel_name": "My Channel",
    "channel_type": "LIVE",
    "tier": 1,
    "probe_id": 1,
    "template_id": 1,
    "input_url": "http://packager/live/CH_001"
  }'
```

### View Metrics

```bash
# In InfluxDB
docker compose exec influxdb influx query \
  'from(bucket:"metrics") |> range(start:-5m)'

# In Prometheus
curl http://localhost:9090/api/v1/query?query=up
```

### Check Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f packager-monitor
```

### Restart Services

```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart packager-monitor
```

### Stop Everything

```bash
docker compose down
```

## Troubleshooting

### Services not starting?

```bash
# Check Docker is running
sudo systemctl status docker

# Check logs for errors
docker compose logs | grep -i error

# Rebuild
docker compose down
docker compose up -d --build
```

### No metrics appearing?

```bash
# Check monitor is running
docker compose ps packager-monitor

# Check monitor logs
docker compose logs packager-monitor

# Verify packager URL is reachable
curl http://YOUR_PACKAGER_URL/live/CH_001/master.m3u8
```

### Can't access dashboards?

```bash
# Check firewall
sudo ufw status
sudo ufw allow 3000,5000,8080,9090/tcp

# Check services are listening
sudo netstat -tulpn | grep -E '3000|5000|8080|9090'
```

## Next Steps

1. **Configure Channels**: Add your channels via API or UI
2. **Set Up Alerts**: Configure AlertManager for notifications
3. **Create Dashboards**: Build custom Grafana dashboards
4. **Scale**: Add more monitoring instances if needed

## Full Documentation

- **Complete README**: `mvp/README.md`
- **Deployment Guide**: `mvp/docs/DEPLOYMENT.md`
- **API Documentation**: `mvp/README.md#api-documentation`

## Support

Check logs first:
```bash
docker compose logs -f
```

Still stuck? Review the full deployment guide in `docs/DEPLOYMENT.md`.

---

**That's it! You're monitoring!** 🚀
