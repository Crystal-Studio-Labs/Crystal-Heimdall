# 🚀 Crystal Heimdall — Production Deployment Guide

> **🔒 CLASSIFICATION: PROPRIETARY & CONFIDENTIAL // FOR INTERNAL USE ONLY**  
> **PROPERTY OF CRYSTAL STUDIO LABS — ALL RIGHTS RESERVED.**  
> *Internal runbook for deploying and operating Crystal Heimdall across Crystal Studio Labs infrastructure.*

---

## 1. Private Infrastructure Prerequisites

Before deploying Crystal Heimdall to internal servers or clouds:
1. **Repository Access:** Ensure the deployment server has deploy key, SSH, or token access to `https://github.com/SahooShuvranshu/Crystal-Heimdall.git`.
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

---

## 7. Option D: Vercel Serverless Hosting (Zero-Cost Cloud Deployment)

Crystal Heimdall is pre-configured for single-click deployment on [Vercel](https://vercel.com):

### Step 1: Import Repository
1. In the Vercel dashboard, click **"Add New..."** ➔ **"Project"**.
2. Select your private GitHub repository: `SahooShuvranshu/Crystal-Heimdall`.

### Step 2: Build & Framework Configuration
The configuration is automatically applied from [`vercel.json`](file:///d:/Projects/Crystal-Heimdall/vercel.json):
* **Framework Preset:** `Other` (or auto-detected Vite)
* **Build Command:** `npm run build` (builds both `dist-client` and `dist-server`)
* **Output Directory:** `dist-client`
* **Serverless Functions:** Routed via `api/index.js`

### Step 3: Configure Environment Variables
In Vercel Project Settings ➔ **Environment Variables**, provide:

| Variable | Required | Description |
|---|---|---|
| `TURSO_DATABASE_URL` | **Yes (for Vercel)** | Remote LibSQL database URL (e.g., `libsql://heimdall-crystal.turso.io`). Provides persistent storage across serverless cold starts. |
| `TURSO_AUTH_TOKEN` | **Yes (for Vercel)** | Turso database authentication token. |
| `JWT_SECRET` | **Yes** | High-entropy secret for operator session signing. |
| `TOTP_SECRET` | **Yes** | Base32 seed for operator 2FA verification. |
| `DISCORD_WEBHOOK_URL` | Optional | Webhook URL for real-time Discord channel alerts. |
| `TELEGRAM_BOT_TOKEN` | Optional | Telegram bot token for instant push notifications. |
| `TELEGRAM_CHAT_ID` | Optional | Telegram chat or group identifier. |

> [!NOTE]
> If `TURSO_DATABASE_URL` is omitted, Crystal Heimdall defaults to `/tmp/heimdall-data/heimdall.db`. However, `/tmp` is ephemeral in serverless environments, so connecting a free Turso LibSQL database is strongly recommended for production persistence.

### Step 4: Synthetic Polling on Vercel (Hobby vs. Pro Plan)

* **Vercel Hobby Tier:** Vercel limits free Hobby accounts to daily cron executions (`0 0 * * *`). To avoid build rejection errors on Vercel Hobby, `vercel.json` is configured with `"schedule": "0 0 * * *"`.
* **High-Frequency Free Polling (Every 1–5 Minutes):**
  To maintain continuous 60-second or 5-minute synthetic probes without paying for Vercel Pro, choose either zero-cost approach:
  1. **GitHub Actions Workflow (Included):**
     * Located in `.github/workflows/poller.yml`.
     * Runs every 5 minutes completely free on GitHub runners.
     * Add `HEIMDALL_APP_URL` in your GitHub repository's **Settings > Secrets and variables > Actions** with your Vercel deployment URL (e.g. `https://your-domain.vercel.app`).
  2. **External Free Cron Services:**
     * Use free tools such as [cron-job.org](https://cron-job.org), [updown.io](https://updown.io), or [EasyCron](https://www.easycron.com) to ping `https://your-domain.vercel.app/api/v1/cron/poll` every 1 minute.
* **Vercel Pro Tier:** If you upgrade to Vercel Pro, you can change `schedule` in `vercel.json` to `* * * * *` for native minute-by-minute execution.

