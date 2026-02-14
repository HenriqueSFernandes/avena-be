# Deployment Documentation

## 🚀 Deployment Setup

This project uses GitHub Actions to automatically deploy to a VPS when pushing to the `main` branch.

### Prerequisites
- VPS running Ubuntu Server with Docker installed
- Private Docker registry at registry.henriquesf.me
- SSH access to the VPS

---

## 📋 VPS Setup (One-time)

### 1. Run the VPS setup script on your server
```bash
# SSH into your VPS as root
ssh root@YOUR_VPS_IP

# Download and run the setup script
curl -fsSL https://raw.githubusercontent.com/HenriqueSFernandes/avena-be/main/scripts/setup-vps.sh | bash
```

Or manually:
```bash
sudo bash scripts/setup-vps.sh
```

This script will:
- Install Docker and Docker Compose
- Create a `deploy` user
- Set up deployment directory at `/opt/avena-be`
- Configure SSH permissions

### 2. Generate SSH key pair for GitHub Actions
```bash
# On your local machine
ssh-keygen -t ed25519 -f github_actions_key -C 'github-actions@avena-be'
```

This creates:
- `github_actions_key` (private key) → Add to GitHub Secrets
- `github_actions_key.pub` (public key) → Add to VPS

### 3. Add public key to VPS
```bash
# Copy public key to VPS
ssh root@YOUR_VPS_IP "cat >> /home/deploy/.ssh/authorized_keys" < github_actions_key.pub

# Or manually:
cat github_actions_key.pub
# Then SSH to VPS and paste into /home/deploy/.ssh/authorized_keys
```

### 4. Copy deployment files to VPS
```bash
# On VPS at /opt/avena-be
scp docker-compose.prod.yml deploy@YOUR_VPS_IP:/opt/avena-be/
scp scripts/deploy.sh deploy@YOUR_VPS_IP:/opt/avena-be/
```

### 5. Create production environment file
```bash
# On VPS
cd /opt/avena-be
cp .env.production.example .env

# Edit .env with real values
nano .env
```

Required environment variables:
```bash
DATABASE_URL=postgres://avena:STRONG_PASSWORD@postgres:5432/avena_db
POSTGRES_USER=avena
POSTGRES_PASSWORD=STRONG_PASSWORD
POSTGRES_DB=avena_db
BETTER_AUTH_SECRET=YOUR_LONG_RANDOM_SECRET_HERE_MIN_32_CHARS
BETTER_AUTH_URL=https://your-domain.com
IMAGE_TAG=latest
```

Generate a strong secret:
```bash
openssl rand -base64 48
```

---

## 🔐 GitHub Secrets Configuration

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `SSH_PRIVATE_KEY` | Contents of `github_actions_key` | Private SSH key for VPS access |
| `SSH_HOST` | Your VPS IP or hostname | VPS server address |
| `SSH_USER` | `deploy` | Deployment user on VPS |
| `REGISTRY_USERNAME` | `ricky` | Docker registry username |
| `REGISTRY_PASSWORD` | Your registry password | Docker registry password |

---

## 🔄 Deployment Process

### Automatic Deployment
Push to `main` branch triggers automatic deployment:
```bash
git add .
git commit -m "Your changes"
git push origin main
```

### Manual Deployment
Trigger manually from GitHub Actions tab → "Deploy to VPS" → Run workflow

### Deployment Flow
1. GitHub Actions builds Docker image
2. Pushes image to registry.henriquesf.me
3. SSHs into VPS as `deploy` user
4. Pulls latest image
5. Restarts containers with docker-compose
6. Cleans up old images

---

## 🛠️ Manual Operations

### View logs
```bash
# On VPS
cd /opt/avena-be
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f postgres
```

### Restart containers
```bash
docker compose -f docker-compose.prod.yml restart
```

### Stop containers
```bash
docker compose -f docker-compose.prod.yml down
```

### Run manual deployment
```bash
cd /opt/avena-be
./deploy.sh
```

### Check container status
```bash
docker compose -f docker-compose.prod.yml ps
```

### Access database
```bash
docker exec -it avena-db psql -U avena -d avena_db
```

---

## 🔌 Reverse Proxy Integration

The app container exposes port 3000. To connect it to your reverse proxy (e.g., Nginx, Traefik, Caddy):

### Option 1: Use host port (current setup)
Your reverse proxy can access the app at `localhost:3000`

### Option 2: Use Docker network
Modify `docker-compose.prod.yml` to use an external network:
```yaml
networks:
  avena-network:
    external: true
    name: your-proxy-network
```

Then configure your reverse proxy to connect to `avena-app:3000`

---

## 🐛 Troubleshooting

### Deployment fails
```bash
# Check GitHub Actions logs
# Check VPS logs
ssh deploy@YOUR_VPS_IP
cd /opt/avena-be
docker compose -f docker-compose.prod.yml logs
```

### Container won't start
```bash
# Check environment variables
cat /opt/avena-be/.env

# Check image exists
docker images | grep avena-be

# Rebuild manually
docker compose -f docker-compose.prod.yml up -d --force-recreate
```

### Database connection issues
```bash
# Check postgres is running
docker ps | grep avena-db

# Check DATABASE_URL matches postgres service name
# Should be: postgres://avena:password@postgres:5432/avena_db
```

### SSH connection fails
```bash
# Test SSH connection
ssh -i github_actions_key deploy@YOUR_VPS_IP

# Check SSH key permissions
chmod 600 github_actions_key
```

---

## 🔄 Rollback Procedure

If a deployment breaks the app:

```bash
# SSH to VPS
ssh deploy@YOUR_VPS_IP
cd /opt/avena-be

# Find previous image
docker images | grep avena-be

# Update .env to use specific tag
echo "IMAGE_TAG=main-abc1234" >> .env

# Redeploy with old image
docker compose -f docker-compose.prod.yml up -d
```

Or revert the git commit and push to trigger automatic rollback.

---

## 📊 Environment Variables

### Local Development (`.env`)
```bash
DATABASE_URL=postgres://avena:avena@localhost:5432/avena_db
BETTER_AUTH_SECRET=dev-secret-not-for-production
BETTER_AUTH_URL=http://localhost:3000
```

### Production (VPS `/opt/avena-be/.env`)
```bash
DATABASE_URL=postgres://avena:STRONG_PASSWORD@postgres:5432/avena_db
POSTGRES_USER=avena
POSTGRES_PASSWORD=STRONG_PASSWORD
POSTGRES_DB=avena_db
BETTER_AUTH_SECRET=GENERATED_SECURE_SECRET_48_CHARS
BETTER_AUTH_URL=https://api.yourdomain.com
IMAGE_TAG=latest
```

---

## 🔒 Security Notes

- Never commit `.env` files to Git
- Use strong passwords for production database
- Keep SSH private key secure (only in GitHub Secrets)
- Regularly update VPS packages: `sudo apt update && sudo apt upgrade`
- Consider setting up automatic backups for database volume
- Use firewall to restrict access to necessary ports only

---

## 📦 Backup & Restore

### Backup database
```bash
docker exec avena-db pg_dump -U avena avena_db > backup_$(date +%Y%m%d).sql
```

### Restore database
```bash
cat backup_20260214.sql | docker exec -i avena-db psql -U avena -d avena_db
```

---

## 🎯 Next Steps

1. ✅ Set up VPS with `setup-vps.sh`
2. ✅ Configure GitHub Secrets
3. ✅ Push to main branch to trigger first deployment
4. Configure reverse proxy (Nginx/Traefik/Caddy)
5. Set up SSL/TLS certificates
6. Configure automated database backups
7. Set up monitoring (optional)
