#!/bin/bash
# Inspector MVP - Quick Deploy Script
# Run this on a system with Docker installed

set -e

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║           Inspector MVP - Quick Deployment                    ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Check if running in correct directory
if [ ! -f "infrastructure/docker-compose.yml" ]; then
    echo "❌ Error: Please run this script from the mvp/ directory"
    echo ""
    echo "Usage:"
    echo "  cd /path/to/Inspector/mvp"
    echo "  ./DEPLOY_NOW.sh"
    exit 1
fi

# Check Docker
echo "🔍 Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed!"
    echo ""
    echo "Please install Docker first:"
    echo "  Ubuntu/Debian: sudo apt install docker.io docker-compose-plugin"
    echo "  Mac: Install Docker Desktop from https://docker.com"
    echo "  Windows: Install Docker Desktop from https://docker.com"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "❌ Docker daemon is not running!"
    echo ""
    echo "Please start Docker:"
    echo "  sudo systemctl start docker"
    exit 1
fi

echo "✓ Docker is installed and running"
echo ""

# Check .env file
if [ ! -f "infrastructure/.env" ]; then
    echo "❌ Configuration file not found!"
    echo ""
    echo "Creating .env from template..."
    cp infrastructure/.env.example infrastructure/.env
    echo ""
    echo "⚠️  Please edit infrastructure/.env with your configuration:"
    echo "  - Update passwords"
    echo "  - Set PACKAGER_URL to your packager"
    echo "  - Set CDN_ENDPOINTS to your CDN servers"
    echo ""
    echo "Then run this script again."
    exit 1
fi

echo "✓ Configuration file found"
echo ""

# Confirm deployment
echo "📦 Ready to deploy the following services:"
echo ""
echo "  • PostgreSQL       (Database)"
echo "  • InfluxDB         (Metrics)"
echo "  • Prometheus       (Monitoring)"
echo "  • Grafana          (Dashboards)"
echo "  • CMS API          (REST API)"
echo "  • Packager Monitor (HLS/DASH)"
echo "  • CDN Monitor      (Edge)"
echo "  • UI Dashboard     (Web UI)"
echo "  • AlertManager     (Alerts)"
echo ""
echo "This will:"
echo "  ✓ Pull Docker images"
echo "  ✓ Build custom images"
echo "  ✓ Start all services"
echo "  ✓ Initialize databases"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

echo ""
echo "🚀 Starting deployment..."
echo ""

# Navigate to infrastructure
cd infrastructure

# Run deployment script
if [ -f "deploy.sh" ]; then
    chmod +x deploy.sh
    ./deploy.sh
else
    echo "Running manual deployment..."

    echo "📥 Pulling images..."
    docker compose pull

    echo "🔨 Building images..."
    docker compose build

    echo "🚀 Starting services..."
    docker compose up -d

    echo ""
    echo "⏳ Waiting for services to start (30 seconds)..."
    sleep 30

    echo ""
    echo "📊 Service Status:"
    docker compose ps
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║                  ✅ DEPLOYMENT COMPLETE! ✅                   ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Access Your Dashboards:"
echo ""
echo "  🌐 UI Dashboard:   http://localhost:8080"
echo "  📈 Grafana:        http://localhost:3000"
echo "  🔍 Prometheus:     http://localhost:9090"
echo "  🔌 CMS API:        http://localhost:5000"
echo "  🚨 AlertManager:   http://localhost:9093"
echo ""
echo "🔐 Grafana Login:"
echo "  Username: admin"
echo "  Password: (check infrastructure/.env for GRAFANA_PASSWORD)"
echo ""
echo "📚 Documentation:"
echo "  Quick Start: docs/QUICKSTART.md"
echo "  Full Guide:  docs/DEPLOYMENT.md"
echo "  README:      README.md"
echo ""
echo "🔧 Useful Commands:"
echo "  View logs:      cd infrastructure && docker compose logs -f"
echo "  Check status:   cd infrastructure && docker compose ps"
echo "  Restart:        cd infrastructure && docker compose restart"
echo "  Stop:           cd infrastructure && docker compose down"
echo ""
echo "🎉 Happy Monitoring!"
echo ""
