#!/bin/bash
# Inspector Central Server Setup Script
# Run this on the central monitoring server

set -e

echo "=========================================="
echo "Inspector Central Server Setup"
echo "=========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}This script must be run as root${NC}"
   exit 1
fi

# Get configuration
read -p "Enter PostgreSQL password for monitor_app user: " -s DB_PASSWORD
echo
read -p "Enter InfluxDB URL (default: http://localhost:8086): " INFLUX_URL
INFLUX_URL=${INFLUX_URL:-http://localhost:8086}
read -p "Enter InfluxDB token: " -s INFLUX_TOKEN
echo
read -p "Enter server hostname/IP for Nginx: " SERVER_NAME

echo -e "\n${YELLOW}Step 1: Installing PostgreSQL...${NC}"
apt update
apt install -y postgresql postgresql-contrib

systemctl start postgresql
systemctl enable postgresql

echo -e "${GREEN}PostgreSQL installed${NC}"

echo -e "\n${YELLOW}Step 2: Creating database and user...${NC}"
sudo -u postgres psql <<EOF
CREATE DATABASE fpt_play_monitoring;
CREATE USER monitor_app WITH PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE fpt_play_monitoring TO monitor_app;
\q
EOF

echo -e "${GREEN}Database created${NC}"

echo -e "\n${YELLOW}Step 3: Initializing database schema...${NC}"
sudo -u postgres psql fpt_play_monitoring < /opt/Inspector/scripts/schema.sql

echo -e "${GREEN}Schema initialized${NC}"

echo -e "\n${YELLOW}Step 4: Installing Python dependencies...${NC}"
apt install -y python3 python3-pip python3-venv

cd /opt/Inspector
python3 -m venv venv
./venv/bin/pip install flask flask-cors flask-sqlalchemy psycopg2-binary influxdb-client

echo -e "${GREEN}Python dependencies installed${NC}"

echo -e "\n${YELLOW}Step 5: Creating inspector user...${NC}"
useradd -r -s /bin/false inspector || true
chown -R inspector:inspector /opt/Inspector

echo -e "${GREEN}User created${NC}"

echo -e "\n${YELLOW}Step 6: Configuring CMS API service...${NC}"

# Create environment file
cat > /opt/Inspector/api_config.env <<ENVEOF
DATABASE_URL=postgresql://monitor_app:$DB_PASSWORD@localhost/fpt_play_monitoring
INFLUXDB_URL=$INFLUX_URL
INFLUXDB_TOKEN=$INFLUX_TOKEN
INFLUXDB_ORG=fpt-play
INFLUXDB_BUCKET=packager_metrics
ENVEOF

# Create systemd service
cat > /etc/systemd/system/inspector-api.service <<SERVICEEOF
[Unit]
Description=Inspector CMS API
After=network.target postgresql.service

[Service]
Type=simple
User=inspector
Group=inspector
WorkingDirectory=/opt/Inspector
EnvironmentFile=/opt/Inspector/api_config.env
ExecStart=/opt/Inspector/venv/bin/python3 /opt/Inspector/2_cms_api_flask.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICEEOF

systemctl daemon-reload
systemctl start inspector-api
systemctl enable inspector-api

echo -e "${GREEN}CMS API service configured and started${NC}"

echo -e "\n${YELLOW}Step 7: Installing and configuring Nginx...${NC}"
apt install -y nginx

cat > /etc/nginx/sites-available/inspector <<NGINXEOF
server {
    listen 80;
    server_name $SERVER_NAME;

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
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # Snapshots
    location /snapshots/ {
        alias /tmp/inspector_snapshots/;
        autoindex off;
    }
}
NGINXEOF

# Create HTML wrapper
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
    <style>
        body { margin: 0; font-family: Arial, sans-serif; }
        .loading { text-align: center; padding: 50px; }
    </style>
</head>
<body>
    <div id="root"><div class="loading">Loading Inspector Dashboard...</div></div>
    <script type="text/babel" src="/3_react_dashboard.jsx"></script>
</body>
</html>
HTMLEOF

ln -sf /etc/nginx/sites-available/inspector /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

echo -e "${GREEN}Nginx configured${NC}"

echo -e "\n${YELLOW}Step 8: Creating snapshot directory...${NC}"
mkdir -p /tmp/inspector_snapshots
chmod 755 /tmp/inspector_snapshots
chown inspector:inspector /tmp/inspector_snapshots

echo -e "${GREEN}Snapshot directory created${NC}"

echo -e "\n${GREEN}=========================================="
echo "Central Server Setup Complete!"
echo "==========================================${NC}"
echo ""
echo "Services Status:"
systemctl status postgresql --no-pager -l
systemctl status inspector-api --no-pager -l
systemctl status nginx --no-pager -l
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Configure InfluxDB at: $INFLUX_URL"
echo "2. Access dashboard at: http://$SERVER_NAME"
echo "3. Deploy monitor services on packager servers"
echo "4. Add inputs via API or Web UI"
echo ""
echo -e "${YELLOW}Test API:${NC}"
echo "curl http://localhost:5000/api/v1/health"
echo ""
