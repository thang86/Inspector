# Inspector System - Phase 1 Deployment Guide

## 📋 Overview
Phase 1: Deploy Inspector monitoring system on packager servers to monitor MPEGTS_UDP inputs and HLS/DASH outputs.

**Timeline**: 3-5 days
**Target**: Packager servers (packager-01, packager-02, etc.)
**Scope**: Input monitoring, snapshot capture, basic alerting

---

## 🎯 Phase 1 Objectives

### Core Features
- ✅ Monitor MPEGTS_UDP inputs (multicast streams)
- ✅ Monitor HLS/DASH outputs from packagers
- ✅ Capture thumbnails every 60 seconds
- ✅ Basic health checks and alerting
- ✅ Web UI for monitoring and debugging

### Out of Scope (Future Phases)
- ❌ Advanced video quality analysis (MOS, macroblocking)
- ❌ Multi-datacenter deployment
- ❌ Grafana dashboards (will use built-in UI)
- ❌ Integration with existing monitoring systems

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Packager Server                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐         ┌──────────────┐             │
│  │ UDP Inputs   │────────▶│  Packager    │             │
│  │ (Multicast)  │         │  (FFmpeg)    │             │
│  └──────────────┘         └──────┬───────┘             │
│         │                        │                      │
│         │                        ▼                      │
│         │              ┌──────────────┐                 │
│         │              │ HLS/DASH     │                 │
│         │              │ Output       │                 │
│         │              └──────────────┘                 │
│         │                        │                      │
│         ▼                        ▼                      │
│  ┌────────────────────────────────────┐                │
│  │   Inspector Monitor Service        │                │
│  │   - Probe UDP inputs               │                │
│  │   - Monitor HLS outputs            │                │
│  │   - Capture thumbnails             │                │
│  │   - Push metrics to InfluxDB       │                │
│  └────────────┬───────────────────────┘                │
│               │                                         │
└───────────────┼─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│              Central Monitoring Server                   │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ PostgreSQL   │  │ InfluxDB     │  │ Redis        │  │
│  │ (Metadata)   │  │ (Metrics)    │  │ (Cache)      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │            CMS API (Flask)                      │    │
│  │  - /api/v1/inputs (CRUD)                       │    │
│  │  - /api/v1/channels                            │    │
│  │  - /api/v1/debug/*                             │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │         React Dashboard                         │    │
│  │  - Inputs monitoring                           │    │
│  │  - Thumbnails view                             │    │
│  │  - Debug panel                                 │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## 📦 Prerequisites

### 1. Server Requirements

**Packager Servers** (where monitor service runs):
- OS: Ubuntu 20.04+ / CentOS 8+
- CPU: 2+ cores
- RAM: 4GB minimum
- Disk: 20GB for snapshots
- Network: Access to multicast groups

**Central Monitoring Server**:
- OS: Ubuntu 20.04+
- CPU: 4+ cores
- RAM: 8GB minimum
- Disk: 100GB+ (for database and snapshots)
- Network: Accessible from packager servers

### 2. Software Dependencies

**On Packager Servers**:
```bash
- Python 3.8+
- ffmpeg (for snapshot capture)
- systemd
```

**On Central Server**:
```bash
- Python 3.8+
- PostgreSQL 13+
- InfluxDB 2.0+
- Node.js 16+ (for React dashboard)
- Nginx (for reverse proxy)
```

### 3. Network Configuration

- **Multicast routing**: Packager servers must receive multicast streams
- **Firewall rules**:
  - PostgreSQL: 5432 (packager → central)
  - InfluxDB: 8086 (packager → central)
  - CMS API: 5000 (internal)
  - Dashboard: 80/443 (operators)

---

## 🚀 Deployment Steps

### Step 1: Setup Central Monitoring Server

#### 1.1 Install PostgreSQL
```bash
# Install PostgreSQL
sudo apt update
sudo apt install -y postgresql postgresql-contrib

# Start and enable
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql <<EOF
CREATE DATABASE fpt_play_monitoring;
CREATE USER monitor_app WITH PASSWORD 'YOUR_SECURE_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE fpt_play_monitoring TO monitor_app;
\q
EOF
```

#### 1.2 Install InfluxDB
```bash
# Add InfluxDB repository
wget -q https://repos.influxdata.com/influxdata-archive_compat.key
echo '393e8779c89ac8d958f81f942f9ad7fb82a25e133faddaf92e15b16e6ac9ce4c influxdata-archive_compat.key' | sha256sum -c && cat influxdata-archive_compat.key | gpg --dearmor | sudo tee /etc/apt/trusted.gpg.d/influxdata-archive_compat.gpg > /dev/null
echo 'deb [signed-by=/etc/apt/trusted.gpg.d/influxdata-archive_compat.gpg] https://repos.influxdata.com/debian stable main' | sudo tee /etc/apt/sources.list.d/influxdata.list

# Install
sudo apt update
sudo apt install -y influxdb2

# Start and enable
sudo systemctl start influxdb
sudo systemctl enable influxdb

# Setup InfluxDB (via web UI at http://SERVER_IP:8086)
# - Organization: fpt-play
# - Bucket: packager_metrics
# - Save the API token
```

#### 1.3 Initialize Database Schema
```bash
# Connect to PostgreSQL
sudo -u postgres psql fpt_play_monitoring <<EOF

-- Create tables
CREATE TABLE IF NOT EXISTS probes (
    probe_id SERIAL PRIMARY KEY,
    probe_name VARCHAR(50) UNIQUE NOT NULL,
    layer INTEGER NOT NULL,
    location VARCHAR(100),
    ip_address VARCHAR(50) NOT NULL,
    port INTEGER DEFAULT 8443,
    api_token VARCHAR(255),
    snmp_enabled BOOLEAN DEFAULT TRUE,
    snmp_version VARCHAR(10),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS templates (
    template_id SERIAL PRIMARY KEY,
    template_name VARCHAR(50) NOT NULL,
    description TEXT,
    codec VARCHAR(20),
    min_mos FLOAT DEFAULT 2.0,
    max_mos FLOAT DEFAULT 5.0,
    loudness_target FLOAT DEFAULT -23.0,
    loudness_tolerance FLOAT DEFAULT 2.0,
    macroblocking_threshold FLOAT DEFAULT 0.15,
    freeze_threshold_ms INTEGER DEFAULT 1000,
    black_threshold_ms INTEGER DEFAULT 500,
    pcr_jitter_threshold_ns INTEGER DEFAULT 500,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS channels (
    channel_id SERIAL PRIMARY KEY,
    channel_code VARCHAR(50) UNIQUE NOT NULL,
    channel_name VARCHAR(200) NOT NULL,
    channel_type VARCHAR(20) NOT NULL,
    tier INTEGER NOT NULL,
    codec VARCHAR(20),
    resolution VARCHAR(20),
    fps FLOAT,
    is_4k BOOLEAN DEFAULT FALSE,
    is_hdr BOOLEAN DEFAULT FALSE,
    has_atmos BOOLEAN DEFAULT FALSE,
    probe_id INTEGER REFERENCES probes(probe_id) NOT NULL,
    input_url TEXT,
    template_id INTEGER REFERENCES templates(template_id) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inputs (
    input_id SERIAL PRIMARY KEY,
    input_name VARCHAR(200) NOT NULL,
    input_url TEXT NOT NULL,
    input_type VARCHAR(50) NOT NULL,
    input_protocol VARCHAR(50),
    input_port INTEGER,
    channel_id INTEGER REFERENCES channels(channel_id),
    probe_id INTEGER NOT NULL REFERENCES probes(probe_id),
    is_primary BOOLEAN DEFAULT TRUE,
    enabled BOOLEAN DEFAULT TRUE,
    bitrate_mbps FLOAT,
    input_metadata JSONB,
    snapshot_url TEXT,
    last_snapshot_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
    alert_id SERIAL PRIMARY KEY,
    channel_id INTEGER REFERENCES channels(channel_id) NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    message TEXT,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_inputs_enabled ON inputs(enabled);
CREATE INDEX idx_inputs_probe ON inputs(probe_id);
CREATE INDEX idx_channels_enabled ON channels(enabled);
CREATE INDEX idx_alerts_resolved ON alerts(resolved);

-- Insert default probe and template
INSERT INTO probes (probe_name, layer, location, ip_address, port)
VALUES ('packager-01-probe', 2, 'Datacenter-HN', '10.0.1.10', 8443);

INSERT INTO templates (template_name, description, codec)
VALUES ('default-hd', 'Default HD template', 'H.264');

\q
EOF
```

#### 1.4 Deploy CMS API
```bash
# Clone repository
cd /opt
git clone https://github.com/thang86/Inspector.git
cd Inspector

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install flask flask-cors flask-sqlalchemy psycopg2-binary influxdb-client

# Configure
export DATABASE_URL="postgresql://monitor_app:YOUR_SECURE_PASSWORD@localhost/fpt_play_monitoring"

# Create systemd service
sudo tee /etc/systemd/system/inspector-api.service > /dev/null <<EOF
[Unit]
Description=Inspector CMS API
After=network.target postgresql.service

[Service]
Type=simple
User=inspector
Group=inspector
WorkingDirectory=/opt/Inspector
Environment="DATABASE_URL=postgresql://monitor_app:YOUR_SECURE_PASSWORD@localhost/fpt_play_monitoring"
ExecStart=/opt/Inspector/venv/bin/python3 /opt/Inspector/2_cms_api_flask.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Create user
sudo useradd -r -s /bin/false inspector
sudo chown -R inspector:inspector /opt/Inspector

# Start service
sudo systemctl daemon-reload
sudo systemctl start inspector-api
sudo systemctl enable inspector-api
sudo systemctl status inspector-api
```

#### 1.5 Deploy React Dashboard
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt install -y nodejs

# Build dashboard (simplified - single HTML file approach)
# For Phase 1, we'll serve the JSX via CDN (React, Recharts)
# Production build will be done in Phase 2

# Setup Nginx
sudo apt install -y nginx

sudo tee /etc/nginx/sites-available/inspector > /dev/null <<'EOF'
server {
    listen 80;
    server_name inspector.monitor.local;

    # Dashboard
    location / {
        root /opt/Inspector;
        try_files \$uri /3_react_dashboard.html =404;
    }

    # API proxy
    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    # Snapshots
    location /snapshots/ {
        alias /tmp/inspector_snapshots/;
        autoindex off;
    }
}
EOF

# Create HTML wrapper for React dashboard
cat > /opt/Inspector/3_react_dashboard.html <<'HTMLEOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Inspector - Video Monitoring Control Center</title>
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script src="https://unpkg.com/recharts@2/dist/Recharts.js"></script>
    <link rel="stylesheet" href="/Dashboard.css">
</head>
<body>
    <div id="root"></div>
    <script type="text/babel" src="/3_react_dashboard.jsx"></script>
</body>
</html>
HTMLEOF

# Enable site
sudo ln -s /etc/nginx/sites-available/inspector /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

### Step 2: Deploy Monitor Service on Packager Servers

#### 2.1 Install Dependencies
```bash
# On each packager server
sudo apt update
sudo apt install -y python3 python3-pip python3-venv ffmpeg

# Clone repository
cd /opt
sudo git clone https://github.com/thang86/Inspector.git
cd Inspector

# Create virtual environment
sudo python3 -m venv venv
sudo /opt/Inspector/venv/bin/pip install \
    requests \
    influxdb-client \
    psycopg2-binary \
    m3u8

# Create snapshot directory
sudo mkdir -p /tmp/inspector_snapshots
sudo chmod 755 /tmp/inspector_snapshots
```

#### 2.2 Configure Monitor Service
```bash
# Create config file
sudo tee /opt/Inspector/monitor_config.env > /dev/null <<EOF
DATABASE_URL=postgresql://monitor_app:YOUR_SECURE_PASSWORD@CENTRAL_SERVER_IP/fpt_play_monitoring
INFLUXDB_URL=http://CENTRAL_SERVER_IP:8086
INFLUXDB_TOKEN=YOUR_INFLUXDB_TOKEN
INFLUXDB_ORG=fpt-play
INFLUXDB_BUCKET=packager_metrics
PACKAGER_URL=http://localhost:8080
SNAPSHOT_DIR=/tmp/inspector_snapshots
POLL_INTERVAL=30
EOF
```

#### 2.3 Create Systemd Service
```bash
sudo tee /etc/systemd/system/inspector-monitor.service > /dev/null <<EOF
[Unit]
Description=Inspector Packager Monitor Service
After=network.target

[Service]
Type=simple
User=inspector
Group=inspector
WorkingDirectory=/opt/Inspector
EnvironmentFile=/opt/Inspector/monitor_config.env
ExecStart=/opt/Inspector/venv/bin/python3 /opt/Inspector/1_packager_monitor_service.py
Restart=always
RestartSec=10
StandardOutput=append:/var/log/inspector-monitor.log
StandardError=append:/var/log/inspector-monitor.log

[Install]
WantedBy=multi-user.target
EOF

# Create user if not exists
sudo useradd -r -s /bin/false inspector || true
sudo chown -R inspector:inspector /opt/Inspector
sudo touch /var/log/inspector-monitor.log
sudo chown inspector:inspector /var/log/inspector-monitor.log

# Start service
sudo systemctl daemon-reload
sudo systemctl start inspector-monitor
sudo systemctl enable inspector-monitor
sudo systemctl status inspector-monitor
```

---

## 🧪 Testing & Validation

### Test 1: Database Connection
```bash
# On central server
sudo -u postgres psql fpt_play_monitoring -c "SELECT * FROM probes;"
```

### Test 2: API Health Check
```bash
curl http://CENTRAL_SERVER_IP:5000/api/v1/health
# Expected: {"status":"healthy","database":"connected"}
```

### Test 3: Add Test Input
```bash
curl -X POST http://CENTRAL_SERVER_IP:5000/api/v1/inputs \
  -H "Content-Type: application/json" \
  -d '{
    "input_name": "HBO_TEST",
    "input_url": "udp://225.3.3.42:30130",
    "input_type": "MPEGTS_UDP",
    "input_protocol": "udp",
    "input_port": 30130,
    "probe_id": 1,
    "enabled": true
  }'
```

### Test 4: Monitor Service Logs
```bash
# On packager server
sudo tail -f /var/log/inspector-monitor.log

# Should see:
# - "Starting Packager Monitor Service"
# - "Connected to database successfully"
# - "Fetched N inputs from database"
# - "Probing UDP stream..."
```

### Test 5: Check Snapshots
```bash
# After 60 seconds
ls -lh /tmp/inspector_snapshots/
# Should see .jpg files
```

### Test 6: Web UI Access
```bash
# Open browser
http://inspector.monitor.local

# Check:
# - Overview tab loads
# - Inputs tab shows HBO_TEST
# - Debug tab shows system status
```

---

## 📊 Monitoring & Health Checks

### Service Health Checks
```bash
# CMS API
systemctl status inspector-api
curl http://localhost:5000/api/v1/health

# Monitor Service
systemctl status inspector-monitor
tail -20 /var/log/inspector-monitor.log

# PostgreSQL
sudo systemctl status postgresql
sudo -u postgres psql -c "SELECT count(*) FROM inputs;"

# InfluxDB
sudo systemctl status influxdb
curl http://localhost:8086/health
```

### Log Locations
- CMS API: `journalctl -u inspector-api -f`
- Monitor Service: `/var/log/inspector-monitor.log`
- Nginx: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`
- PostgreSQL: `/var/log/postgresql/postgresql-*.log`

---

## 🐛 Troubleshooting

### Issue 1: Monitor can't connect to database
```bash
# Check network
ping CENTRAL_SERVER_IP

# Check PostgreSQL allows remote connections
sudo nano /etc/postgresql/*/main/postgresql.conf
# listen_addresses = '*'

sudo nano /etc/postgresql/*/main/pg_hba.conf
# Add: host all all PACKAGER_IP/32 md5

sudo systemctl restart postgresql
```

### Issue 2: UDP multicast not working
```bash
# Check multicast route
ip route show | grep 225

# Add multicast route if needed
sudo ip route add 224.0.0.0/4 dev eth0

# Check if receiving multicast
sudo tcpdump -i eth0 host 225.3.3.42 and port 30130
```

### Issue 3: Snapshots not captured
```bash
# Check ffmpeg
ffmpeg -version

# Test manual capture
ffmpeg -i udp://225.3.3.42:30130 -frames:v 1 -q:v 2 test.jpg

# Check permissions
ls -la /tmp/inspector_snapshots/
```

### Issue 4: API returns 500 errors
```bash
# Check logs
journalctl -u inspector-api -n 50

# Check database connection
sudo -u inspector psql $DATABASE_URL -c "SELECT 1;"
```

---

## 📈 Success Metrics (Phase 1)

### Week 1:
- ✅ Central server deployed and accessible
- ✅ Database schema created and tested
- ✅ CMS API running and responsive
- ✅ Web UI accessible

### Week 2:
- ✅ Monitor service deployed on 1 packager server
- ✅ At least 3 inputs configured and monitored
- ✅ Snapshots being captured successfully
- ✅ Metrics flowing to InfluxDB

### Week 3:
- ✅ Monitor deployed on all packager servers
- ✅ All production inputs configured
- ✅ Operators trained on Web UI
- ✅ Basic alerting tested

---

## 🚦 Go/No-Go Checklist

Before declaring Phase 1 complete:

- [ ] Central server running for 48h without crashes
- [ ] All packager monitors reporting metrics
- [ ] Database contains >50 inputs
- [ ] Snapshots captured for >80% of inputs
- [ ] Web UI loads in <3 seconds
- [ ] No critical errors in logs for 24h
- [ ] Team trained on basic operations
- [ ] Backup/restore tested
- [ ] Documentation complete

---

## 📚 Next Steps (Phase 2)

After Phase 1 success:
- Advanced video quality metrics (MOS, freezes, black frames)
- Grafana dashboards integration
- Alerting via Telegram/Email
- Multi-datacenter deployment
- Automated failover
- Performance optimization

---

## 👥 Team & Responsibilities

- **DevOps**: Server setup, deployment, monitoring
- **Backend Dev**: Bug fixes, API enhancements
- **Frontend Dev**: UI improvements, dashboard customization
- **QA**: Testing, validation, documentation
- **Operations**: Daily monitoring, incident response

---

## 📞 Support Contacts

- **Technical Issues**: [Your team channel]
- **Emergency**: [On-call rotation]
- **Documentation**: This file + `/docs` folder

---

**Document Version**: 1.0
**Last Updated**: 2025-01-18
**Author**: Inspector Development Team
