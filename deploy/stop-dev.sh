#!/bin/bash
# ============================================================================
# Stop Inspector Dev Environment
# ============================================================================

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Stopping Inspector Dev Environment...${NC}"

cd "$(dirname "$0")"

# Stop containers
docker-compose -f docker-compose.dev.yml down

echo -e "${GREEN}✓ All services stopped${NC}"
echo ""
echo -e "To remove volumes (delete all data):"
echo -e "  ${YELLOW}docker-compose -f docker-compose.dev.yml down -v${NC}"
