#!/bin/bash
# Inspector MVP - Deployment Script
# Quick deployment of the Inspector MVP stack

set -e

echo "=========================================="
echo "Inspector MVP - Deployment Script"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running in infrastructure directory
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}Error: docker-compose.yml not found!${NC}"
    echo "Please run this script from the infrastructure/ directory"
    exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Warning: .env file not found!${NC}"
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo -e "${YELLOW}Please edit .env file with your configuration before continuing!${NC}"
    echo ""
    echo "Required changes:"
    echo "  - POSTGRES_PASSWORD"
    echo "  - INFLUXDB_TOKEN"
    echo "  - PACKAGER_URL"
    echo ""
    read -p "Press Enter after editing .env to continue, or Ctrl+C to exit..."
fi

echo "Step 1: Pulling Docker images..."
docker compose pull

echo ""
echo "Step 2: Building custom images..."
docker compose build

echo ""
echo "Step 3: Starting database services..."
docker compose up -d postgres influxdb

echo "Waiting for databases to be ready (30 seconds)..."
sleep 30

echo ""
echo "Step 4: Verifying database health..."
docker compose exec postgres pg_isready -U inspector_app || {
    echo -e "${RED}PostgreSQL is not ready!${NC}"
    echo "Check logs: docker compose logs postgres"
    exit 1
}

docker compose exec influxdb influx ping || {
    echo -e "${RED}InfluxDB is not ready!${NC}"
    echo "Check logs: docker compose logs influxdb"
    exit 1
}

echo -e "${GREEN}Databases are healthy!${NC}"

echo ""
echo "Step 5: Starting monitoring infrastructure..."
docker compose up -d prometheus grafana alertmanager

echo "Waiting 10 seconds..."
sleep 10

echo ""
echo "Step 6: Starting application services..."
docker compose up -d cms-api packager-monitor cdn-monitor ui-dashboard

echo "Waiting for services to start (20 seconds)..."
sleep 20

echo ""
echo "Step 7: Verifying all services..."
docker compose ps

echo ""
echo "Step 8: Health checks..."

# Check CMS API
echo -n "Checking CMS API... "
if curl -sf http://localhost:5000/api/v1/health > /dev/null; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${YELLOW}Not responding (may still be starting)${NC}"
fi

# Check Prometheus
echo -n "Checking Prometheus... "
if curl -sf http://localhost:9090/-/healthy > /dev/null; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${YELLOW}Not responding${NC}"
fi

# Check InfluxDB
echo -n "Checking InfluxDB... "
if curl -sf http://localhost:8086/health > /dev/null; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${YELLOW}Not responding${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}Deployment Complete!${NC}"
echo "=========================================="
echo ""
echo "Access your dashboards:"
echo "  - UI Dashboard:  http://localhost:8080"
echo "  - Grafana:       http://localhost:3000"
echo "  - Prometheus:    http://localhost:9090"
echo "  - CMS API:       http://localhost:5000"
echo "  - AlertManager:  http://localhost:9093"
echo ""
echo "Grafana credentials:"
echo "  Username: admin"
echo "  Password: (check your .env file for GRAFANA_PASSWORD)"
echo ""
echo "To view logs:"
echo "  docker compose logs -f"
echo ""
echo "To stop services:"
echo "  docker compose down"
echo ""
echo "Happy monitoring! 🚀"
