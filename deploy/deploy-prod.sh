#!/bin/bash
# ============================================================================
# FPT Play Inspector - Production Deployment Script
# Deploys full monitoring stack to production environment
# ============================================================================

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}FPT Play Inspector - Production Deployment${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker and Docker Compose are installed${NC}"
echo ""

# Navigate to deploy directory
cd "$(dirname "$0")"

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo -e "${RED}Error: .env.production file not found${NC}"
    echo -e "${YELLOW}Please copy .env.production and configure it:${NC}"
    echo -e "  cp .env.example .env.production"
    echo -e "  vim .env.production"
    exit 1
fi

# Load environment variables
echo -e "${YELLOW}Loading production environment...${NC}"
set -a
source .env.production
set +a
echo -e "${GREEN}✓ Environment loaded${NC}"
echo ""

# Create necessary directories
echo -e "${YELLOW}Creating directories...${NC}"
mkdir -p ${SNAPSHOT_DIR:-/tmp/inspector_snapshots}
chmod 755 ${SNAPSHOT_DIR:-/tmp/inspector_snapshots}
mkdir -p ssl
echo -e "${GREEN}✓ Directories created${NC}"
echo ""

# Check SSL certificates
echo -e "${YELLOW}Checking SSL certificates...${NC}"
if [ ! -f ssl/cert.pem ] || [ ! -f ssl/key.pem ]; then
    echo -e "${YELLOW}⚠ SSL certificates not found${NC}"
    echo -e "${YELLOW}Generating self-signed certificates for testing...${NC}"
    openssl req -x509 -newkey rsa:2048 -keyout ssl/key.pem \
      -out ssl/cert.pem -days 365 -nodes \
      -subj "/C=VN/ST=HCM/L=HCMC/O=FPT/CN=monitoring.yourdomain.com" 2>/dev/null
    echo -e "${GREEN}✓ Self-signed certificates generated${NC}"
    echo -e "${RED}WARNING: Use proper SSL certificates in production!${NC}"
else
    echo -e "${GREEN}✓ SSL certificates found${NC}"
fi
echo ""

# Backup existing data (if deployment exists)
if docker ps -a | grep -q inspector-db; then
    echo -e "${YELLOW}Backing up existing database...${NC}"
    docker exec inspector-db pg_dump -U ${POSTGRES_USER} ${POSTGRES_DB} > backup-$(date +%Y%m%d-%H%M%S).sql 2>/dev/null || true
    echo -e "${GREEN}✓ Backup completed${NC}"
    echo ""
fi

# Pull latest images
echo -e "${YELLOW}Pulling latest Docker images...${NC}"
docker-compose -f docker-compose.prod.yml --env-file .env.production pull
echo -e "${GREEN}✓ Images pulled${NC}"
echo ""

# Build custom images
echo -e "${YELLOW}Building custom images...${NC}"
docker-compose -f docker-compose.prod.yml --env-file .env.production build --no-cache
echo -e "${GREEN}✓ Images built${NC}"
echo ""

# Start services
echo -e "${YELLOW}Starting services...${NC}"
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d

# Wait for services to be ready
echo ""
echo -e "${YELLOW}Waiting for services to be ready...${NC}"
sleep 15

# Check service health
echo ""
echo -e "${YELLOW}Checking service health...${NC}"

# Check PostgreSQL
echo -n "PostgreSQL... "
if docker exec inspector-db pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB} &>/dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

# Check InfluxDB
echo -n "InfluxDB... "
if docker exec inspector-influxdb influx ping &>/dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

# Wait for API to be ready
sleep 5

# Check CMS API
echo -n "CMS API... "
if curl -sf http://localhost:${CMS_API_PORT}/api/v1/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠ (may still be starting)${NC}"
fi

# Check Prometheus
echo -n "Prometheus... "
if curl -sf http://localhost:${PROMETHEUS_PORT}/-/healthy > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠ (may still be starting)${NC}"
fi

# Check Grafana
echo -n "Grafana... "
if curl -sf http://localhost:${GRAFANA_PORT}/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠ (may still be starting)${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Access the services:${NC}"
echo -e "  ${GREEN}Main Dashboard:${NC}  https://localhost/grafana/"
echo -e "  ${GREEN}CMS API:${NC}         https://localhost/api/v1/health"
echo -e "  ${GREEN}Prometheus:${NC}      https://localhost/prometheus/"
echo -e "  ${GREEN}AlertManager:${NC}    https://localhost/alertmanager/"
echo -e "  ${GREEN}Grafana Direct:${NC}  http://localhost:${GRAFANA_PORT}"
echo ""
echo -e "${BLUE}Credentials:${NC}"
echo -e "  ${GREEN}Grafana:${NC}     ${GF_ADMIN_USER} / (check .env.production)"
echo -e "  ${GREEN}InfluxDB:${NC}    ${INFLUXDB_ADMIN_USER} / (check .env.production)"
echo -e "  ${GREEN}PostgreSQL:${NC}  ${POSTGRES_USER} / (check .env.production)"
echo ""
echo -e "${BLUE}Management commands:${NC}"
echo -e "  ${YELLOW}View logs:${NC}"
echo -e "    docker-compose -f docker-compose.prod.yml --env-file .env.production logs -f"
echo -e "  ${YELLOW}Stop services:${NC}"
echo -e "    docker-compose -f docker-compose.prod.yml --env-file .env.production down"
echo -e "  ${YELLOW}Restart service:${NC}"
echo -e "    docker-compose -f docker-compose.prod.yml --env-file .env.production restart <service>"
echo -e "  ${YELLOW}View status:${NC}"
echo -e "    docker-compose -f docker-compose.prod.yml --env-file .env.production ps"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "  1. Configure AlertManager notifications (edit alertmanager.yml)"
echo -e "  2. Add inputs via API: curl -X POST http://localhost:${CMS_API_PORT}/api/v1/inputs ..."
echo -e "  3. Import Grafana dashboards"
echo -e "  4. Configure proper SSL certificates (replace self-signed certs)"
echo -e "  5. Set up backup procedures for databases"
echo ""
echo -e "${YELLOW}⚠ IMPORTANT SECURITY NOTES:${NC}"
echo -e "  - Change default passwords in .env.production"
echo -e "  - Use proper SSL certificates (not self-signed)"
echo -e "  - Configure firewall rules"
echo -e "  - Set up regular database backups"
echo -e "  - Review and restrict network access"
echo ""
