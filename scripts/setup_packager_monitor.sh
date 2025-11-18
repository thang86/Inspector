#!/bin/bash
# Inspector Packager Monitor Setup Script
# Run this on each packager server

set -e

echo "=========================================="
echo "Inspector Packager Monitor Setup"
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
read -p "Enter central server IP/hostname: " CENTRAL_SERVER
read -p "Enter PostgreSQL password: " -s DB_PASSWORD
echo
read -p "Enter InfluxDB token: " -s INFLUX_TOKEN
echo
read -p "Enter packager URL (default: http://localhost:8080): " PACKAGER_URL
PACKAGER_URL=${PACKAGER_URL:-http://localhost:8080}

echo -e "\n${YELLOW}Step 1: Installing dependencies...${NC}"
apt update
apt install -y python3 python3-pip python3-venv ffmpeg git

echo -e "${GREEN}Dependencies installed${NC}"

echo -e "\n${YELLOW}Step 2: Cloning Inspector repository...${NC}"
if [ ! -d "/opt/Inspector" ]; then
    cd /opt
    git clone https://github.com/thang86/Inspector.git
else
    echo "Repository already exists, pulling latest..."
    cd /opt/Inspector
    git pull
fi

echo -e "${GREEN}Repository ready${NC}"

echo -e "\n${YELLOW}Step 3: Setting up Python environment...${NC}"
cd /opt/Inspector
python3 -m venv venv
./venv/bin/pip install requests influxdb-client psycopg2-binary m3u8

echo -e "${GREEN}Python environment ready${NC}"

echo -e "\n${YELLOW}Step 4: Creating configuration...${NC}"
cat > /opt/Inspector/monitor_config.env <<ENVEOF
DATABASE_URL=postgresql://monitor_app:$DB_PASSWORD@$CENTRAL_SERVER/fpt_play_monitoring
INFLUXDB_URL=http://$CENTRAL_SERVER:8086
INFLUXDB_TOKEN=$INFLUX_TOKEN
INFLUXDB_ORG=fpt-play
INFLUXDB_BUCKET=packager_metrics
PACKAGER_URL=$PACKAGER_URL
SNAPSHOT_DIR=/tmp/inspector_snapshots
POLL_INTERVAL=30
ENVEOF

chmod 600 /opt/Inspector/monitor_config.env

echo -e "${GREEN}Configuration created${NC}"

echo -e "\n${YELLOW}Step 5: Creating inspector user...${NC}"
useradd -r -s /bin/false inspector || true
chown -R inspector:inspector /opt/Inspector

echo -e "${GREEN}User created${NC}"

echo -e "\n${YELLOW}Step 6: Creating snapshot directory...${NC}"
mkdir -p /tmp/inspector_snapshots
chmod 755 /tmp/inspector_snapshots
chown inspector:inspector /tmp/inspector_snapshots

echo -e "${GREEN}Snapshot directory created${NC}"

echo -e "\n${YELLOW}Step 7: Configuring systemd service...${NC}"
cat > /etc/systemd/system/inspector-monitor.service <<SERVICEEOF
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
SERVICEEOF

# Create log file
touch /var/log/inspector-monitor.log
chown inspector:inspector /var/log/inspector-monitor.log

systemctl daemon-reload
systemctl start inspector-monitor
systemctl enable inspector-monitor

echo -e "${GREEN}Service configured and started${NC}"

echo -e "\n${YELLOW}Step 8: Testing connectivity...${NC}"

echo "Testing database connection..."
if /opt/Inspector/venv/bin/python3 -c "import psycopg2; psycopg2.connect('$DATABASE_URL'); print('OK')" 2>/dev/null; then
    echo -e "${GREEN}✓ Database connection: OK${NC}"
else
    echo -e "${RED}✗ Database connection: FAILED${NC}"
    echo "Check firewall rules and credentials"
fi

echo "Testing InfluxDB connection..."
if curl -s -o /dev/null -w "%{http_code}" "http://$CENTRAL_SERVER:8086/health" | grep -q "200"; then
    echo -e "${GREEN}✓ InfluxDB connection: OK${NC}"
else
    echo -e "${RED}✗ InfluxDB connection: FAILED${NC}"
    echo "Check InfluxDB service and firewall"
fi

echo -e "\n${GREEN}=========================================="
echo "Packager Monitor Setup Complete!"
echo "==========================================${NC}"
echo ""
echo "Service Status:"
systemctl status inspector-monitor --no-pager -l
echo ""
echo -e "${YELLOW}Monitor logs:${NC}"
echo "tail -f /var/log/inspector-monitor.log"
echo ""
echo -e "${YELLOW}Check UDP multicast:${NC}"
echo "tcpdump -i eth0 host 225.3.3.42 and port 30130"
echo ""
echo -e "${YELLOW}Test snapshot capture:${NC}"
echo "ffmpeg -i udp://225.3.3.42:30130 -frames:v 1 -q:v 2 /tmp/test.jpg"
echo ""
