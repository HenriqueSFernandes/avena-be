#!/bin/bash
# Quick script to copy deployment files to VPS

set -e

VPS_HOST="156.67.25.151"
VPS_USER="deploy"
VPS_DIR="/opt/avena-be"
SSH_KEY="scripts/github_actions_key"

echo "📦 Copying deployment files to VPS..."
echo ""

# Copy docker-compose.prod.yml
echo "1️⃣  Copying docker-compose.prod.yml..."
scp -i "$SSH_KEY" docker-compose.prod.yml "${VPS_USER}@${VPS_HOST}:${VPS_DIR}/"

# Copy .env template
echo "2️⃣  Copying .env template..."
scp -i "$SSH_KEY" .env.production.example "${VPS_USER}@${VPS_HOST}:${VPS_DIR}/.env"

echo ""
echo "✅ Files copied successfully!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  IMPORTANT: Edit .env file on VPS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "SSH to VPS:"
echo "  ssh -i $SSH_KEY ${VPS_USER}@${VPS_HOST}"
echo ""
echo "Edit .env file:"
echo "  cd $VPS_DIR"
echo "  nano .env"
echo ""
echo "Required changes:"
echo "  1. Set POSTGRES_PASSWORD to a strong password"
echo "  2. Update DATABASE_URL with same password"
echo "  3. Set BETTER_AUTH_SECRET (generate with: openssl rand -base64 48)"
echo "  4. Set BETTER_AUTH_URL to your domain or http://156.67.25.151:3000"
echo ""
echo "After editing .env, run deployment:"
echo "  docker compose -f docker-compose.prod.yml up -d"
echo ""
