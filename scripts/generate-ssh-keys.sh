#!/bin/bash

# Generate SSH key pair for GitHub Actions deployment
# Run this locally, NOT on the VPS

set -e

echo "🔑 Generating SSH key pair for GitHub Actions..."
echo ""

# Generate the key pair
ssh-keygen -t ed25519 -f github_actions_key -C "github-actions@avena-be" -N ""

echo ""
echo "✅ SSH keys generated successfully!"
echo ""
echo "📝 Files created:"
echo "  - github_actions_key (PRIVATE - add to GitHub Secrets)"
echo "  - github_actions_key.pub (PUBLIC - add to VPS)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 NEXT STEPS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1️⃣  Add PRIVATE key to GitHub Secrets"
echo "   Go to: GitHub Repo → Settings → Secrets → Actions → New secret"
echo "   Name: SSH_PRIVATE_KEY"
echo "   Value: Copy from below ↓"
echo ""
echo "━━━━━━━ PRIVATE KEY (copy this) ━━━━━━━"
cat github_actions_key
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "2️⃣  Add PUBLIC key to VPS"
echo "   SSH to your VPS and run:"
echo "   echo '$(cat github_actions_key.pub)' >> /home/deploy/.ssh/authorized_keys"
echo ""
echo "3️⃣  Test SSH connection:"
echo "   ssh -i github_actions_key deploy@YOUR_VPS_IP"
echo ""
echo "⚠️  SECURITY WARNING:"
echo "   - Keep github_actions_key PRIVATE (don't commit to git)"
echo "   - Delete these files after adding to GitHub Secrets"
echo "   - These keys are for GitHub Actions only"
echo ""
