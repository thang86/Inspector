# Inspector MVP - Multi-Layer Monitoring System

Complete MVP for monitoring Packager, CDN, with CMS API and UI Dashboard.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    INSPECTOR MVP SYSTEM                      │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Packager        │     │  CDN Edge        │     │  Client Player   │
│  (Origin)        │────▶│  (Distribution)  │────▶│  (End User)      │
└────────┬─────────┘     └────────┬─────────┘     └──────────────────┘
         │                        │
         ▼                        ▼
┌──────────────────┐     ┌──────────────────┐
│ Packager Monitor │     │  CDN Monitor     │
│ - HLS/DASH       │     │ - Latency        │
│ - Segments       │     │ - Cache Hit      │
│ - ABR Ladder     │     │ - Error Rate     │
└────────┬─────────┘     └────────┬─────────┘
         │                        │
         └────────┬───────────────┘
                  ▼
         ┌──────────────────┐
         │    InfluxDB      │
         │  (Time Series)   │
         └────────┬─────────┘
                  │
         ┌────────┴─────────┬──────────────┐
         ▼                  ▼              ▼
┌──────────────────┐ ┌─────────────┐ ┌──────────────┐
│   Prometheus     │ │   Grafana   │ │   CMS API    │
│   (Metrics)      │ │ (Dashboard) │ │ (PostgreSQL) │
└──────────────────┘ └─────────────┘ └──────┬───────┘
                                             │
                                             ▼
                                    ┌──────────────────┐
                                    │  UI Dashboard    │
                                    │  (React)         │
                                    └──────────────────┘
```

## Components

### 1. Packager Monitor
- **Path**: `packager-monitor/`
- **Purpose**: Monitor HLS/DASH playlists and segments
- **Features**:
  - Real-time segment validation
  - ABR ladder checking
  - Download time measurement
  - Playlist structure validation
  - Metrics push to InfluxDB

### 2. CDN Monitor
- **Path**: `cdn-monitor/`
- **Purpose**: Monitor CDN edge performance
- **Features**:
  - Latency tracking (TTFB)
  - Cache hit/miss rates
  - Error rate monitoring
  - Multi-region support
  - Health check aggregation

### 3. CMS API
- **Path**: `cms-api/`
- **Purpose**: Channel management and configuration
- **Features**:
  - Channel CRUD operations
  - Template management
  - Alert management
  - Probe configuration
  - PostgreSQL backend

### 4. UI Dashboard
- **Path**: `ui-dashboard/`
- **Purpose**: Web-based monitoring interface
- **Features**:
  - Real-time KPIs
  - Channel status overview
  - Alert management
  - Metrics visualization
  - React-based SPA

### 5. Infrastructure
- **Path**: `infrastructure/`
- **Purpose**: Docker orchestration and monitoring
- **Components**:
  - PostgreSQL (database)
  - InfluxDB (time-series metrics)
  - Prometheus (metrics scraping)
  - Grafana (visualization)
  - AlertManager (alerting)

## Quick Start

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- 4GB RAM minimum
- 20GB disk space

### 1. Clone and Setup

```bash
cd mvp/infrastructure
cp .env.example .env
nano .env  # Update with your configuration
```

### 2. Start All Services

```bash
docker-compose up -d
```

### 3. Verify Services

```bash
# Check all services are running
docker-compose ps

# Check logs
docker-compose logs -f
```

### 4. Access Dashboards

- **UI Dashboard**: http://localhost:8080
- **Grafana**: http://localhost:3000 (admin / [your password])
- **Prometheus**: http://localhost:9090
- **CMS API**: http://localhost:5000
- **AlertManager**: http://localhost:9093

## Configuration

### Environment Variables

Edit `infrastructure/.env`:

```bash
# Database
POSTGRES_PASSWORD=your_secure_password

# InfluxDB
INFLUXDB_TOKEN=your_influxdb_token_32_chars_min

# Packager
PACKAGER_URL=http://your-packager.internal

# CDN Endpoints
CDN_ENDPOINTS=http://cdn1.internal,http://cdn2.internal

# Channels
CHANNELS=CH_001,CH_002,CH_003
```

### Custom Configuration

Each component has its own `.env.example`:

- `packager-monitor/.env.example`
- `cdn-monitor/.env.example`
- `cms-api/.env.example`
- `ui-dashboard/.env.example`

## API Documentation

### CMS API Endpoints

```
GET    /api/v1/health          - Health check
GET    /api/v1/channels        - List all channels
POST   /api/v1/channels        - Create channel
GET    /api/v1/channels/:id    - Get channel details
PUT    /api/v1/channels/:id    - Update channel
DELETE /api/v1/channels/:id    - Delete channel

GET    /api/v1/templates       - List templates
POST   /api/v1/templates       - Create template

GET    /api/v1/alerts/active   - Get active alerts
POST   /api/v1/alerts/:id/acknowledge  - Acknowledge alert
POST   /api/v1/alerts/:id/resolve      - Resolve alert

GET    /api/v1/probes          - List probes
POST   /api/v1/probes          - Create probe
```

## Monitoring Metrics

### Packager Monitor Metrics

**InfluxDB Bucket**: `metrics`

**Measurements**:
- `segment_metric` - Individual segment metrics
- `playlist_validation` - Playlist validation results
- `abr_ladder` - ABR ladder information
- `channel_error` - Channel errors

**Tags**:
- `channel` - Channel ID
- `rung` - Quality level

**Fields**:
- `segment_number`
- `duration_sec`
- `size_bytes`
- `download_time_ms`
- `http_status`
- `is_valid`
- `error_count`

### CDN Monitor Metrics

**Measurements**:
- `cdn_request` - Individual request metrics
- `cdn_health` - Endpoint health checks

**Tags**:
- `endpoint` - CDN endpoint URL
- `cache_status` - HIT, MISS, BYPASS

**Fields**:
- `latency_ms`
- `ttfb_ms`
- `response_size_bytes`
- `cache_hit_rate`
- `error_rate`

## Deployment

### Development

```bash
cd mvp/infrastructure
docker-compose up
```

### Production

```bash
# 1. Update .env with production values
cd mvp/infrastructure
cp .env.example .env
nano .env

# 2. Build images
docker-compose build

# 3. Start services
docker-compose up -d

# 4. Check health
docker-compose ps
curl http://localhost:5000/api/v1/health
```

### Scaling

Scale monitoring services:

```bash
# Scale packager monitors
docker-compose up -d --scale packager-monitor=3

# Scale CDN monitors
docker-compose up -d --scale cdn-monitor=2
```

## Troubleshooting

### Services Not Starting

```bash
# Check logs
docker-compose logs [service-name]

# Restart service
docker-compose restart [service-name]

# Rebuild service
docker-compose up -d --build [service-name]
```

### Database Connection Issues

```bash
# Check PostgreSQL is ready
docker-compose exec postgres pg_isready -U inspector_app

# Check InfluxDB
docker-compose exec influxdb influx ping
```

### No Metrics Appearing

```bash
# Check monitor logs
docker-compose logs packager-monitor
docker-compose logs cdn-monitor

# Verify InfluxDB connection
docker-compose exec influxdb influx bucket list

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets
```

## Maintenance

### Backup Database

```bash
# Backup PostgreSQL
docker-compose exec postgres pg_dump -U inspector_app inspector_monitoring > backup.sql

# Backup InfluxDB
docker-compose exec influxdb influx backup /tmp/backup
docker cp inspector-influxdb:/tmp/backup ./influx-backup/
```

### Update Services

```bash
# Pull latest images
docker-compose pull

# Rebuild custom images
docker-compose build

# Restart with new images
docker-compose up -d
```

### Cleanup

```bash
# Stop all services
docker-compose down

# Remove volumes (WARNING: deletes all data)
docker-compose down -v

# Clean up unused images
docker system prune -a
```

## Development

### Local Development

Each component can be run independently:

```bash
# Packager Monitor
cd packager-monitor
pip install -r requirements.txt
python monitor.py

# CMS API
cd cms-api
pip install -r requirements.txt
python app.py

# UI Dashboard
cd ui-dashboard
npm install
npm start
```

### Adding New Channels

```bash
# Via API
curl -X POST http://localhost:5000/api/v1/channels \
  -H "Content-Type: application/json" \
  -d '{
    "channel_code": "CH_NEW_001",
    "channel_name": "New Channel",
    "channel_type": "LIVE",
    "tier": 1,
    "probe_id": 1,
    "template_id": 1,
    "input_url": "http://packager/live/CH_NEW_001"
  }'

# Via Database
docker-compose exec postgres psql -U inspector_app -d inspector_monitoring
```

## Performance

### Resource Usage

**Typical per-service usage**:

| Service | CPU | Memory | Disk |
|---------|-----|--------|------|
| postgres | 5% | 100MB | 1GB |
| influxdb | 10% | 200MB | 5GB |
| prometheus | 5% | 150MB | 2GB |
| grafana | 3% | 100MB | 500MB |
| cms-api | 2% | 50MB | - |
| packager-monitor | 5% | 100MB | 100MB |
| cdn-monitor | 3% | 50MB | 50MB |
| ui-dashboard | 1% | 20MB | - |

**Total**: ~25% CPU, ~800MB RAM, ~10GB disk

### Scaling Guidelines

- **< 50 channels**: Single instance of each service
- **50-200 channels**: Scale monitors (2-3 instances)
- **200-500 channels**: Scale monitors + add read replicas
- **> 500 channels**: Distributed deployment

## Security

### Production Checklist

- [ ] Change all default passwords in `.env`
- [ ] Use strong passwords (16+ characters)
- [ ] Enable HTTPS with SSL certificates
- [ ] Configure firewall rules
- [ ] Enable authentication on all services
- [ ] Use secrets management (Vault, AWS Secrets Manager)
- [ ] Regular backups
- [ ] Log rotation
- [ ] Network isolation
- [ ] Resource limits

### Hardening

```bash
# Set proper file permissions
chmod 600 .env
chmod 600 infrastructure/.env

# Use Docker secrets (production)
docker secret create influxdb_token influxdb_token.txt
```

## License

Proprietary - Internal Use Only

## Support

For issues and questions:
- Check logs: `docker-compose logs -f`
- Review documentation in `docs/`
- Contact: DevOps Team

---

**Version**: 1.0.0
**Last Updated**: 2025-01-14
**Status**: Production Ready
