#!/bin/bash

# VPS Setup Script for avena-be deployment
# Run this script on your VPS as root or with sudo

set -e

echo "🔧 Setting up VPS for avena-be deployment..."

# Update system
echo "📦 Updating system packages..."
apt-get update
apt-get upgrade -y

# Install Docker if not installed
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
else
    echo "✅ Docker already installed"
fi

# Install Docker Compose if not installed
if ! command -v docker compose &> /dev/null; then
    echo "🐳 Installing Docker Compose plugin..."
    apt-get install -y docker-compose-plugin
else
    echo "✅ Docker Compose already installed"
fi

# Create deployment user
echo "👤 Creating deployment user..."
if id "deploy" &>/dev/null; then
    echo "✅ User 'deploy' already exists"
else
    useradd -m -s /bin/bash deploy
    usermod -aG docker deploy
    echo "✅ User 'deploy' created and added to docker group"
fi

# Create deployment directory
echo "📁 Creating deployment directory..."
mkdir -p /opt/avena-be
chown deploy:deploy /opt/avena-be

# Set up SSH for deploy user
echo "🔑 Setting up SSH for deploy user..."
mkdir -p /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh

echo ""
echo "✨ VPS setup completed!"
echo ""
echo "📝 Next steps:"
echo "1. Generate SSH key pair for GitHub Actions:"
echo "   ssh-keygen -t ed25519 -f github_actions_key -C 'github-actions@avena-be'"
echo ""
echo "2. Add the public key to /home/deploy/.ssh/authorized_keys:"
echo "   cat github_actions_key.pub >> /home/deploy/.ssh/authorized_keys"
echo ""
echo "3. Add the PRIVATE key (github_actions_key) to GitHub Secrets as SSH_PRIVATE_KEY"
echo ""
echo "4. Copy deployment files to /opt/avena-be:"
echo "   - docker-compose.prod.yml"
echo "   - .env (from .env.production.example)"
echo "   - deploy.sh"
echo ""
echo "5. Test SSH connection:"
echo "   ssh -i github_actions_key deploy@YOUR_VPS_IP"
