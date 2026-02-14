#!/bin/bash

# Deployment script for avena-be
# This script should be placed on the VPS at /opt/avena-be/deploy.sh

set -e

echo "🚀 Starting deployment..."

# Navigate to deployment directory
cd /opt/avena-be

# Login to registry
echo "🔐 Logging into Docker registry..."
docker login registry.henriquesf.me

# Pull latest images
echo "📥 Pulling latest images..."
docker compose -f docker-compose.prod.yml pull

# Stop old containers and start new ones
echo "🔄 Restarting containers..."
docker compose -f docker-compose.prod.yml up -d --remove-orphans

# Wait for health check
echo "⏳ Waiting for application to be ready..."
sleep 5

# Check if app is running
if docker ps | grep -q avena-app; then
  echo "✅ Application is running!"
  docker compose -f docker-compose.prod.yml ps
else
  echo "❌ Application failed to start!"
  docker compose -f docker-compose.prod.yml logs --tail=50
  exit 1
fi

# Clean up old images
echo "🧹 Cleaning up old images..."
docker image prune -f

echo "✨ Deployment completed successfully!"
