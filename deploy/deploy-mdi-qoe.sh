#!/bin/bash

###############################################################################
# MDI/QoE Enhancement Deployment Script
#
# This script deploys the enhanced IPTV monitoring system with:
# - Media Delivery Index (MDI) - RFC 4445 Network Transport Metrics
# - Quality of Experience (QoE) Metrics
# - Bitrate display changed to Mbps
#
# Usage: ./deploy-mdi-qoe.sh
###############################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOY_DIR="/home/thanghl/Inspector/deploy"
MONITOR_SERVICE_DIR="/home/thanghl/Inspector"
UI_APP_DIR="${DEPLOY_DIR}/ui-app"
LOG_FILE="${DEPLOY_DIR}/deployment.log"

# Function to print colored messages
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

# Function to check if service is running
check_service() {
    local service_name=$1
    local port=$2

    if curl -s "http://localhost:${port}/health" > /dev/null 2>&1; then
        log_success "${service_name} is running on port ${port}"
        return 0
    else
        log_error "${service_name} is NOT running on port ${port}"
        return 1
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local service_name=$1
    local port=$2
    local max_attempts=30
    local attempt=1

    log_info "Waiting for ${service_name} to be ready..."

    while [ $attempt -le $max_attempts ]; do
        if curl -s "http://localhost:${port}/health" > /dev/null 2>&1; then
            log_success "${service_name} is ready!"
            return 0
        fi

        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done

    log_error "${service_name} failed to start within 60 seconds"
    return 1
}

# Function to verify MDI metrics collection
verify_mdi_metrics() {
    local input_id=$1

    log_info "Verifying MDI metrics collection for input ${input_id}..."

    # Wait a bit for metrics to be collected
    sleep 5

    response=$(curl -s "http://localhost:5000/api/v1/metrics/mdi/${input_id}")

    if echo "$response" | grep -q '"status": "ok"'; then
        log_success "MDI metrics are being collected"
        echo "$response" | python3 -m json.tool | head -20
        return 0
    else
        log_warning "MDI metrics not yet available (this is normal on first run)"
        return 1
    fi
}

# Function to verify QoE metrics collection
verify_qoe_metrics() {
    local input_id=$1

    log_info "Verifying QoE metrics collection for input ${input_id}..."

    response=$(curl -s "http://localhost:5000/api/v1/metrics/qoe/${input_id}")

    if echo "$response" | grep -q '"status": "ok"'; then
        log_success "QoE metrics are being collected"
        echo "$response" | python3 -m json.tool | head -20
        return 0
    else
        log_warning "QoE metrics not yet available (this is normal on first run)"
        return 1
    fi
}

###############################################################################
# MAIN DEPLOYMENT WORKFLOW
###############################################################################

echo "========================================================================="
echo "  MDI/QoE Enhancement Deployment"
echo "  $(date)"
echo "========================================================================="
echo "" | tee "$LOG_FILE"

###############################################################################
# STEP 1: Pre-deployment checks
###############################################################################

log_info "Step 1: Pre-deployment checks"

# Check if running from correct directory
if [ ! -f "${DEPLOY_DIR}/docker-compose.dev.yml" ]; then
    log_error "docker-compose.dev.yml not found. Please run from ${DEPLOY_DIR}"
    exit 1
fi

# Use dev compose file
COMPOSE_FILE="docker-compose.dev.yml"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    log_error "Docker is not running. Please start Docker first."
    exit 1
fi

log_success "Pre-deployment checks passed"
echo ""

###############################################################################
# STEP 2: Stop existing services
###############################################################################

log_info "Step 2: Stopping existing services"

cd "$DEPLOY_DIR"

if docker-compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
    log_info "Stopping Docker containers..."
    docker-compose -f "$COMPOSE_FILE" down
    log_success "Docker containers stopped"
else
    log_info "No running containers found"
fi

# Stop monitor service if running
if pgrep -f "1_packager_monitor_service.py" > /dev/null; then
    log_info "Stopping monitor service..."
    pkill -f "1_packager_monitor_service.py"
    sleep 2
    log_success "Monitor service stopped"
fi

echo ""

###############################################################################
# STEP 3: Build Docker images
###############################################################################

log_info "Step 3: Building Docker images with new features"

cd "$DEPLOY_DIR"

log_info "Building CMS API image with MDI/QoE endpoints..."
docker-compose -f "$COMPOSE_FILE" build cms-api
log_success "CMS API image built"

# Check if UI service exists in compose file
if docker-compose -f "$COMPOSE_FILE" config --services | grep -q "ui"; then
    log_info "Building UI application with MDI/QoE panels..."
    docker-compose -f "$COMPOSE_FILE" build ui-app
    log_success "UI application image built"
else
    log_warning "UI service not found in $COMPOSE_FILE (will run UI separately if needed)"
fi

echo ""

###############################################################################
# STEP 4: Start services
###############################################################################

log_info "Step 4: Starting services"

# Start Docker services
log_info "Starting InfluxDB, CMS API, and backend services..."
docker-compose -f "$COMPOSE_FILE" up -d
log_success "Docker services started"

# Wait for CMS API to be ready
wait_for_service "CMS API" 5000

# Note: Grafana runs on port 3000 (not React UI)
log_info "Grafana will be available on port 3000"

echo ""

###############################################################################
# STEP 5: Start Monitor Service
###############################################################################

log_info "Step 5: Starting Monitor Service with MDI/QoE collection"

cd "$MONITOR_SERVICE_DIR"

# Start monitor service in background
log_info "Starting packager monitor service..."
nohup python3 1_packager_monitor_service.py > "${DEPLOY_DIR}/monitor.log" 2>&1 &
MONITOR_PID=$!

log_success "Monitor service started (PID: $MONITOR_PID)"

# Wait for monitor service to initialize
log_info "Waiting for monitor service to initialize..."
sleep 10

echo ""

###############################################################################
# STEP 6: Verify deployment
###############################################################################

log_info "Step 6: Verifying deployment"

# Check all services
echo ""
log_info "Service Health Status:"
check_service "CMS API" 5000

# Check if monitor service is still running
if ps -p $MONITOR_PID > /dev/null; then
    log_success "Monitor service is running (PID: $MONITOR_PID)"
else
    log_error "Monitor service failed to start. Check ${DEPLOY_DIR}/monitor.log"
fi

echo ""

###############################################################################
# STEP 7: Verify new features
###############################################################################

log_info "Step 7: Verifying new MDI/QoE features"

# Test API endpoints
log_info "Testing new API endpoints..."

# Get inputs to test with
inputs_response=$(curl -s "http://localhost:5000/api/v1/inputs")

if echo "$inputs_response" | grep -q "input_id"; then
    # Extract first input ID
    input_id=$(echo "$inputs_response" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['data'][0]['input_id'])" 2>/dev/null || echo "1")

    log_info "Testing with input ID: ${input_id}"

    # Wait for first metrics collection cycle
    log_info "Waiting for first metrics collection cycle (30 seconds)..."
    sleep 30

    # Verify MDI metrics
    verify_mdi_metrics "$input_id"

    # Verify QoE metrics
    verify_qoe_metrics "$input_id"

else
    log_warning "Could not retrieve inputs. Skipping metrics verification."
fi

echo ""

###############################################################################
# STEP 8: Display access information
###############################################################################

log_info "Step 8: Deployment Summary"

echo ""
echo "========================================================================="
echo "  DEPLOYMENT COMPLETE!"
echo "========================================================================="
echo ""
echo "Services Status:"
echo "  • InfluxDB:           http://localhost:8086"
echo "  • CMS API:            http://localhost:5000"
echo "  • Grafana:            http://localhost:3000"
echo "  • Monitor Service:    Running (PID: $MONITOR_PID)"
echo ""
echo "New Features Deployed:"
echo "  ✓ MDI (RFC 4445) Network Transport Metrics"
echo "    - Delay Factor (DF) - IP packet jitter measurement"
echo "    - Media Loss Rate (MLR) - Packet loss detection"
echo "    - Buffer Depth/Fill - Buffer utilization tracking"
echo "    - Traffic Rate - Input/Output bitrate monitoring"
echo "    - Jitter Analysis - Network stability assessment"
echo ""
echo "  ✓ Quality of Experience (QoE) Metrics"
echo "    - Video: Black frame detection, freeze detection, PID status"
echo "    - Audio: Silence detection, loudness (LUFS)"
echo "    - Overall MOS (Mean Opinion Score)"
echo ""
echo "  ✓ UI Enhancements"
echo "    - Bitrate changed from kbps to Mbps"
echo "    - MDI panel with intelligent network analysis"
echo "    - QoE panel with video/audio quality display"
echo "    - Color-coded severity indicators"
echo ""
echo "API Endpoints (New):"
echo "  • GET /api/v1/metrics/mdi/<input_id>"
echo "  • GET /api/v1/metrics/qoe/<input_id>"
echo "  • GET /api/v1/metrics/comprehensive/<input_id>"
echo ""
echo "Log Files:"
echo "  • Deployment:         ${DEPLOY_DIR}/deployment.log"
echo "  • Monitor Service:    ${DEPLOY_DIR}/monitor.log"
echo "  • CMS API:            docker logs inspector-cms-api"
echo "  • UI Application:     docker logs inspector-ui"
echo ""
echo "Next Steps:"
echo "  1. Access Grafana at http://localhost:3000 (admin/admin)"
echo "  2. Access CMS API at http://localhost:5000/api/v1/health"
echo "  3. Test MDI metrics: curl http://localhost:5000/api/v1/metrics/mdi/1"
echo "  4. Test QoE metrics: curl http://localhost:5000/api/v1/metrics/qoe/1"
echo "  5. Review deployment.log for any warnings"
echo ""
echo "To run React UI separately (if needed):"
echo "  cd ${UI_APP_DIR} && npm install && npm start"
echo ""
echo "========================================================================="

# Save deployment info
cat > "${DEPLOY_DIR}/DEPLOYMENT_INFO.txt" <<EOF
Deployment Date: $(date)
Monitor Service PID: $MONITOR_PID

Services:
- InfluxDB: http://localhost:8086
- CMS API: http://localhost:5000
- Grafana: http://localhost:3000

New Features:
- MDI (RFC 4445) Network Metrics
- QoE (Quality of Experience) Metrics
- Bitrate display in Mbps

API Endpoints:
- GET /api/v1/metrics/mdi/<input_id>
- GET /api/v1/metrics/qoe/<input_id>
- GET /api/v1/metrics/comprehensive/<input_id>

Logs:
- Deployment: ${DEPLOY_DIR}/deployment.log
- Monitor: ${DEPLOY_DIR}/monitor.log
EOF

log_success "Deployment information saved to ${DEPLOY_DIR}/DEPLOYMENT_INFO.txt"

exit 0
