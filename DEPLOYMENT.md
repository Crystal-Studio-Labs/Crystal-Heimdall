# 🚀 Crystal Heimdall — Production Deployment Guide

> **🔒 CLASSIFICATION: PROPRIETARY & CONFIDENTIAL // FOR INTERNAL USE ONLY**  
> **PROPERTY OF CRYSTAL STUDIO LABS — ALL RIGHTS RESERVED.**  
> *Internal runbook for deploying and operating Crystal Heimdall across Crystal Studio Labs infrastructure.*

---

## 1. Private Infrastructure Prerequisites

Before deploying Crystal Heimdall to internal servers or clouds:
1. **Repository Access:** Ensure the deployment server has deploy key or SSH access to `git@github.com:Crystal-Studio-Labs/Crystal-Heimdall.git`.
2. **Secrets Provisioning:** Populate `.env` from the official **Crystal Studio Labs 1Password / Vault** vault. Do not commit `.env`.
3. **Network Boundary:** 
   * Expose public status endpoints (`/`, `/overview`, `/incidents`, `/docs`) via reverse proxy (Caddy / Nginx).
   * Restrict access to `/dashboard*` via **Cloudflare Zero Trust Access**, **Tailscale**, or HTTP Basic Auth reverse-proxy layers.

---

## 2. Production Build Execution

Compile the optimized client bundle and TypeScript server:

```bash
# 1. Install dependencies strictly from lockfile
npm ci

# 2. Compile Vite client and TypeScript server
npm run build

# 3. Verify with smoke test suite
node test-smoke.mjs
```

Build outputs:
* `dist-client/`: Static Single-Page Application assets.
* `dist-server/`: Compiled Node.js ESM server binaries.
* `data/heimdall.db`: LibSQL / SQLite persistent database.

---

## 3. Option A: PM2 Process Manager (Recommended for Private VPS)

Using PM2 provides process supervision, automatic revival on system reboots, and log rotation:

```bash
# 1. Install PM2 globally
npm install -g pm2

# 2. Launch Crystal Heimdall as background service
pm2 start dist-server/index.js --name "crystal-heimdall"

# 3. Configure startup script
pm2 save
pm2 startup
```

Monitoring the PM2 daemon:
```bash
pm2 status
pm2 logs crystal-heimdall
pm2 restart crystal-heimdall
```

---

## 4. Option B: Docker Container Deployment

Run in an isolated container with volume persistence for SQLite:

### `Dockerfile`
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3030
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist-client ./dist-client
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/data ./data

EXPOSE 3030
CMD ["node", "dist-server/index.js"]
```

### `docker-compose.yml`
```yaml
version: '3.8'

services:
  crystal-heimdall:
    build: .
    container_name: crystal-heimdall
    restart: always
    ports:
      - "3030:3030"
    environment:
      - PORT=3030
      - NODE_ENV=production
      - DATABASE_URL=file:/app/data/heimdall.db
      - JWT_SECRET=${JWT_SECRET}
      - TOTP_SECRET=${TOTP_SECRET}
      - DISCORD_WEBHOOK_URL=${DISCORD_WEBHOOK_URL}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID}
    volumes:
      - ./data:/app/data
```

Launch with:
```bash
docker compose up -d --build
```

---

## 5. Option C: Nginx Reverse Proxy & Cloudflare Zero Trust Perimeter

Configure Nginx to route public status traffic while protecting internal operator routes:

```nginx
server {
    listen 80;
    server_name status.crystalstudiolabs.internal;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name status.crystalstudiolabs.internal;

    ssl_certificate /etc/letsencrypt/live/status.crystalstudiolabs.internal/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/status.crystalstudiolabs.internal/privkey.pem;

    # Public Routes & Assets
    location / {
        proxy_pass http://127.0.0.1:3030;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Internal Operator Deck (Optionally restrict by internal IP or Cloudflare Access)
    location /dashboard {
        # Allow internal corporate VPN / Tailscale subnet
        # allow 10.0.0.0/8;
        # allow 100.64.0.0/10; # Tailscale CGNAT
        # deny all;

        proxy_pass http://127.0.0.1:3030;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 6. Database Backup & Disaster Recovery Procedures

The persistent LibSQL database resides in `data/heimdall.db`. Execute scheduled snapshots:

```bash
# Automated SQLite snapshot via cron
0 3 * * * sqlite3 /app/data/heimdall.db ".backup '/backups/heimdall-$(date +\%Y\%m\%d).db'"
```

To restore from backup:
```bash
cp /backups/heimdall-YYYYMMDD.db /app/data/heimdall.db
pm2 restart crystal-heimdall
```
