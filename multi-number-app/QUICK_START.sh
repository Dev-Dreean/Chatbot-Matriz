#!/bin/bash

# ============================================
# Quick Start Script - Multi-Number WhatsApp
# ============================================

echo "╔════════════════════════════════════════════╗"
echo "║  WhatsApp Multi-Number - Quick Start 🚀   ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}[!] Installing dependencies...${NC}"
    npm install
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}[✓] Dependencies installed${NC}"
    else
        echo -e "${RED}[✗] Failed to install dependencies${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}[✓] Dependencies already installed${NC}"
fi

echo ""
echo -e "${YELLOW}What would you like to do?${NC}"
echo "[1] Run tests (npm test)"
echo "[2] Start development server (npm run dev)"
echo "[3] Both (install → test → dev)"
echo "[0] Exit"
echo ""
read -p "👉 Select option: " option

case $option in
    1)
        echo -e "${YELLOW}Running tests...${NC}"
        npm test
        ;;
    2)
        echo -e "${YELLOW}Starting development server...${NC}"
        npm run dev
        ;;
    3)
        echo -e "${YELLOW}Running tests...${NC}"
        npm test
        echo ""
        echo -e "${YELLOW}Starting development server...${NC}"
        npm run dev
        ;;
    0)
        echo -e "${GREEN}Goodbye!${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac
