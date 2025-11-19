# Inspector Monitoring Server - Production Deployment

Complete production deployment guide for FPT Play Inspector monitoring stack.

## 📋 Architecture Overview

```
                    ┌─────────────┐
                    │   Internet  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │    Nginx    │ :80, :443
                    │   (Reverse  │
                    │    Proxy)   │
                    └──────┬──────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
      ┌─────▼─────┐  ┌────▼────┐  ┌─────▼──────┐
      │  Grafana  │  │ CMS API │  │ Prometheus │
      │   :3000   │  │  :5000  │  │   :9090    │
      └─────┬─────┘  └────┬────┘  └─────┬──────┘
            │             │              │
            │       ┌─────▼─────┐        │
            │       │ Packager  │        │
            │       │  Monitor  │        │
            │       └─────┬─────┘        │
            │             │              │
      ┌─────▼─────────────▼──────────────▼─────┐
      │                                         │
  ┌───▼────┐  ┌──────────┐  ┌────────────────┐ │
  │InfluxDB│  │PostgreSQL│  │  AlertManager  │ │
  │ :8086  │  │  :5432   │  │     :9093      │ │
  └────────┘  └──────────┘  └────────────────┘ │
                                                │
              Internal Network                  │
              ───────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Ubuntu 20.04+ / CentOS 8+ / RHEL 8+
- Docker 20.10+
- Docker Compose 1.29+
- 16GB+ RAM
- 100GB+ disk space
- Root or sudo access

### 1. Prepare Environment

```bash
# Clone repository
git clone https://github.com/yourdomain/Inspector.git
cd Inspector/deploy

# Copy and edit production environment
cp .env.production .env.production.local
vim .env.production.local

# IMPORTANT: Change all passwords and tokens!
```

### 2. Configure Environment Variables

Edit `.env.production.local` and change:

```bash
# CRITICAL: Change these passwords!
POSTGRES_PASSWORD=YOUR_STRONG_PASSWORD_HERE
INFLUXDB_ADMIN_PASSWORD=YOUR_STRONG_PASSWORD_HERE
INFLUXDB_TOKEN=YOUR_LONG_RANDOM_TOKEN_HERE
GF_ADMIN_PASSWORD=YOUR_STRONG_PASSWORD_HERE

# Update domain
GF_SERVER_ROOT_URL=https://monitoring.yourdomain.com
```

### 3. SSL Certificates

**Production**: Use proper SSL certificates:

```bash
# Copy your SSL certificates
cp /path/to/your/cert.pem ssl/cert.pem
cp /path/to/your/key.pem ssl/key.pem

# Or use Let's Encrypt
certbot certonly --standalone -d monitoring.yourdomain.com
cp /etc/letsencrypt/live/monitoring.yourdomain.com/fullchain.pem ssl/cert.pem
cp /etc/letsencrypt/live/monitoring.yourdomain.com/privkey.pem ssl/key.pem
```

**Testing**: Self-signed certificates (generated automatically)

```bash
# Script will generate self-signed certs if none found
./deploy-prod.sh
```

### 4. Configure Alerting

Edit `alertmanager.yml`:

```yaml
global:
  slack_api_url: 'YOUR_ACTUAL_SLACK_WEBHOOK'

receivers:
  - name: 'critical-alerts'
    slack_configs:
      - channel: '#your-actual-channel'
    email_configs:
      - to: 'your-actual-email@domain.com'
        auth_username: 'your-smtp-username'
        auth_password: 'your-smtp-password'
```

### 5. Deploy

```bash
# Run production deployment
./deploy-prod.sh
```

The script will:
1. ✓ Check prerequisites
2. ✓ Load environment
3. ✓ Create directories
4. ✓ Generate/check SSL certificates
5. ✓ Backup existing data
6. ✓ Pull and build images
7. ✓ Start all services
8. ✓ Run health checks

## 📦 Services & Ports

| Service | Internal Port | External Access | Description |
|---------|--------------|-----------------|-------------|
| Nginx | 80, 443 | https://monitoring.domain.com | Reverse proxy & SSL termination |
| CMS API | 5000 | https://monitoring.domain.com/api/ | REST API management |
| Grafana | 3000 | https://monitoring.domain.com/grafana/ | Dashboards & visualization |
| Prometheus | 9090 | https://monitoring.domain.com/prometheus/ | Metrics & alerting |
| AlertManager | 9093 | https://monitoring.domain.com/alertmanager/ | Alert routing |
| InfluxDB | 8086 | Internal only | Time-series database |
| PostgreSQL | 5432 | Internal only | Configuration database |
| Packager Monitor | - | Internal only | Monitoring service |

## 🔧 Management

### View Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml --env-file .env.production.local logs -f

# Specific service
docker-compose -f docker-compose.prod.yml --env-file .env.production.local logs -f cms-api
docker-compose -f docker-compose.prod.yml --env-file .env.production.local logs -f packager-monitor
docker-compose -f docker-compose.prod.yml --env-file .env.production.local logs -f grafana
```

### Service Status

```bash
docker-compose -f docker-compose.prod.yml --env-file .env.production.local ps
```

### Restart Service

```bash
docker-compose -f docker-compose.prod.yml --env-file .env.production.local restart packager-monitor
```

### Stop All Services

```bash
docker-compose -f docker-compose.prod.yml --env-file .env.production.local down
```

### Update Services

```bash
# Pull latest images
docker-compose -f docker-compose.prod.yml --env-file .env.production.local pull

# Rebuild custom images
docker-compose -f docker-compose.prod.yml --env-file .env.production.local build --no-cache

# Restart with new images
docker-compose -f docker-compose.prod.yml --env-file .env.production.local up -d
```

## 📊 Initial Configuration

### 1. Access Grafana

```bash
# URL: https://monitoring.yourdomain.com/grafana/
# Username: admin
# Password: (from .env.production.local)
```

**First login steps:**
1. Change admin password
2. Verify InfluxDB datasource (auto-provisioned)
3. Import dashboards from grafana/provisioning/dashboards/

### 2. Create First Input

```bash
# Create UDP input for monitoring
curl -X POST https://monitoring.yourdomain.com/api/v1/inputs \
  -H "Content-Type: application/json" \
  -d '{
    "input_name": "VTV1 HD Primary",
    "input_url": "udp://225.3.3.42:30130",
    "input_type": "MPEGTS_UDP",
    "probe_id": 1,
    "enabled": true,
    "bitrate_mbps": 8.0
  }'
```

### 3. Verify Monitoring

```bash
# Check API health
curl https://monitoring.yourdomain.com/api/v1/health

# Check Prometheus targets
curl https://monitoring.yourdomain.com/prometheus/api/v1/targets

# List inputs
curl https://monitoring.yourdomain.com/api/v1/inputs | jq
```

## 🔐 Security

### Firewall Configuration

```bash
# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Block direct access to internal services
sudo ufw deny 5000/tcp  # CMS API
sudo ufw deny 3000/tcp  # Grafana
sudo ufw deny 9090/tcp  # Prometheus
sudo ufw deny 5432/tcp  # PostgreSQL
sudo ufw deny 8086/tcp  # InfluxDB

# Enable firewall
sudo ufw enable
```

### Nginx Basic Auth (Optional)

Add basic auth for Prometheus and AlertManager:

```bash
# Install htpasswd
sudo apt-get install apache2-utils

# Create password file
htpasswd -c /home/thanghl/Inspector/deploy/.htpasswd admin

# Uncomment auth_basic lines in nginx.conf
```

### Database Access

Only allow localhost and container network:

```yaml
# In docker-compose.prod.yml, remove ports section for postgres and influxdb
# ports:
#   - "5432:5432"  # Remove this
```

## 🗄️ Backup & Recovery

### Automated Backup Script

Create `/etc/cron.daily/backup-inspector`:

```bash
#!/bin/bash
BACKUP_DIR="/backup/inspector"
DATE=$(date +%Y%m%d)

mkdir -p $BACKUP_DIR

# Backup PostgreSQL
docker exec inspector-db pg_dump -U monitor_app fpt_play_monitoring | \
  gzip > $BACKUP_DIR/postgres-$DATE.sql.gz

# Backup InfluxDB
docker exec inspector-influxdb influx backup /tmp/influxdb-backup-$DATE
docker cp inspector-influxdb:/tmp/influxdb-backup-$DATE $BACKUP_DIR/

# Keep last 30 days
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

# Upload to S3 (optional)
# aws s3 cp $BACKUP_DIR s3://your-bucket/inspector-backup/ --recursive
```

### Manual Backup

```bash
# PostgreSQL
docker exec inspector-db pg_dump -U monitor_app fpt_play_monitoring > backup.sql

# InfluxDB
docker exec inspector-influxdb influx backup /tmp/influx-backup
docker cp inspector-influxdb:/tmp/influx-backup ./influx-backup
```

### Restore from Backup

```bash
# PostgreSQL
docker exec -i inspector-db psql -U monitor_app fpt_play_monitoring < backup.sql

# InfluxDB
docker cp ./influx-backup inspector-influxdb:/tmp/influx-backup
docker exec inspector-influxdb influx restore /tmp/influx-backup
```

## 📈 Monitoring & Alerting

### View Active Alerts

```bash
# Via API
curl https://monitoring.yourdomain.com/prometheus/api/v1/alerts | jq

# Via AlertManager
curl https://monitoring.yourdomain.com/alertmanager/api/v2/alerts | jq
```

### Test Alert

```bash
# Trigger test alert
curl -X POST https://monitoring.yourdomain.com/alertmanager/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '[{
    "labels": {"alertname": "TestAlert", "severity": "warning"},
    "annotations": {"description": "This is a test alert"}
  }]'
```

### Alert Channels

Configure in `alertmanager.yml`:
- Slack: Set `slack_api_url` and channels
- Email: Configure SMTP settings
- PagerDuty: Add service key
- Webhook: Add custom webhook URL

## 🔍 Troubleshooting

### Service Won't Start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml --env-file .env.production.local logs <service>

# Check service status
docker-compose -f docker-compose.prod.yml --env-file .env.production.local ps

# Restart service
docker-compose -f docker-compose.prod.yml --env-file .env.production.local restart <service>
```

### Database Connection Issues

```bash
# Check PostgreSQL
docker exec inspector-db pg_isready -U monitor_app -d fpt_play_monitoring

# Connect to database
docker exec -it inspector-db psql -U monitor_app -d fpt_play_monitoring

# Check tables
\dt
```

### High CPU/Memory Usage

```bash
# Check container stats
docker stats

# Adjust resources in docker-compose.prod.yml
services:
  packager-monitor:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
```

### SSL Certificate Issues

```bash
# Check certificate
openssl x509 -in ssl/cert.pem -text -noout

# Verify certificate matches key
openssl x509 -noout -modulus -in ssl/cert.pem | openssl md5
openssl rsa -noout -modulus -in ssl/key.pem | openssl md5
```

## 🔄 Upgrade Procedure

```bash
# 1. Backup current data
./backup.sh

# 2. Pull latest code
git pull origin main

# 3. Review changes
git log -p

# 4. Stop services
docker-compose -f docker-compose.prod.yml --env-file .env.production.local down

# 5. Build new images
docker-compose -f docker-compose.prod.yml --env-file .env.production.local build --no-cache

# 6. Start with new version
./deploy-prod.sh

# 7. Verify health
curl https://monitoring.yourdomain.com/api/v1/health
```

## 📞 Support & Escalation

### Issue Categories

1. **Service Down** → Contact SRE team immediately
2. **Database Issues** → Contact Database Admin
3. **Network/Firewall** → Contact Network team
4. **Application Errors** → Check logs, contact Dev team

### Emergency Contacts

- SRE Team: sre@yourdomain.com
- On-call: +84-xxx-xxx-xxxx
- Slack: #inspector-alerts

## 📚 Additional Documentation

- [API Documentation](./API.md)
- [Metrics Guide](./METRICS.md)
- [Alert Playbook](./ALERTS.md)
- [Architecture Diagram](../ARCHITECTURE_DIAGRAM.md)

## ✅ Production Checklist

Before going to production:

- [ ] Change all default passwords
- [ ] Configure proper SSL certificates
- [ ] Set up firewall rules
- [ ] Configure AlertManager notifications
- [ ] Set up automated backups
- [ ] Test failover procedures
- [ ] Document runbooks
- [ ] Train operations team
- [ ] Set up monitoring for monitoring (meta-monitoring)
- [ ] Configure log rotation
- [ ] Set up access control (RBAC)
- [ ] Performance testing
- [ ] Security audit
- [ ] Disaster recovery plan

---

**Production Deployment Complete** 🎉
