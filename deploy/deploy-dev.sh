#!/bin/bash
# ============================================================================
# FPT Play Inspector - Dev Deployment Script
# Deploys monitoring server to development environment
# ============================================================================

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}FPT Play Inspector - Dev Deployment${NC}"
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

# Create snapshot directory
echo -e "${YELLOW}Creating snapshot directory...${NC}"
mkdir -p /tmp/inspector_snapshots
chmod 777 /tmp/inspector_snapshots
echo -e "${GREEN}✓ Snapshot directory created${NC}"
echo ""

# Stop existing containers
echo -e "${YELLOW}Stopping existing containers...${NC}"
docker-compose -f docker-compose.dev.yml down 2>/dev/null || true
echo -e "${GREEN}✓ Containers stopped${NC}"
echo ""

# Build and start services
echo -e "${YELLOW}Building and starting services...${NC}"
docker-compose -f docker-compose.dev.yml up -d --build

# Wait for services to be healthy
echo ""
echo -e "${YELLOW}Waiting for services to be ready...${NC}"
sleep 10

# Check service health
echo ""
echo -e "${YELLOW}Checking service health...${NC}"

# Check PostgreSQL
if docker-compose -f docker-compose.dev.yml exec -T postgres pg_isready -U monitor_app -d fpt_play_monitoring &>/dev/null; then
    echo -e "${GREEN}✓ PostgreSQL is healthy${NC}"
else
    echo -e "${RED}✗ PostgreSQL is not healthy${NC}"
    exit 1
fi

# Check InfluxDB
if docker-compose -f docker-compose.dev.yml exec -T influxdb influx ping &>/dev/null; then
    echo -e "${GREEN}✓ InfluxDB is healthy${NC}"
else
    echo -e "${RED}✗ InfluxDB is not healthy${NC}"
    exit 1
fi

# Wait a bit more for API to be ready
sleep 5

# Check CMS API
if curl -sf http://localhost:5000/api/v1/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ CMS API is healthy${NC}"
else
    echo -e "${YELLOW}⚠ CMS API is starting up (may take a few more seconds)${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Access the services:"
echo -e "  ${GREEN}CMS API:${NC}      http://localhost:5000/api/v1/health"
echo -e "  ${GREEN}Grafana:${NC}      http://localhost:3000 (admin/admin)"
echo -e "  ${GREEN}InfluxDB:${NC}     http://localhost:8086"
echo -e "  ${GREEN}PostgreSQL:${NC}   localhost:5432 (monitor_app/dev_password_123)"
echo ""
echo -e "View logs:"
echo -e "  ${YELLOW}docker-compose -f docker-compose.dev.yml logs -f${NC}"
echo ""
echo -e "Stop services:"
echo -e "  ${YELLOW}docker-compose -f docker-compose.dev.yml down${NC}"
echo ""
echo -e "${GREEN}To test the API:${NC}"
echo -e "  ${YELLOW}curl http://localhost:5000/api/v1/probes${NC}"
echo -e "  ${YELLOW}curl http://localhost:5000/api/v1/channels${NC}"
echo -e "  ${YELLOW}curl http://localhost:5000/api/v1/inputs${NC}"
echo ""
