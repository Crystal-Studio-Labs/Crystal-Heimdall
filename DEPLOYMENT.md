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

---

## 8. Option E: Render (Recommended for Continuous 24/7 Monitoring)

[Render](https://render.com) runs persistent Node.js servers, allowing the internal 60-second synthetic poller daemon to run **continuously 24/7** without requiring external cron triggers or serverless workarounds.

### 1-Click Blueprint Deploy:
1. Push this repository to GitHub (already synced!).
2. In the Render Dashboard, click **"New"** ➔ **"Blueprint"**.
3. Connect your repository `SahooShuvranshu/Crystal-Heimdall`.
4. Render will automatically read [`render.yaml`](file:///d:/Projects/Crystal-Heimdall/render.yaml):
   * **Runtime:** Node.js
   * **Build Command:** `npm run build`
   * **Start Command:** `npm start`
   * **Persistent Disk:** Mounts `/app/data` to preserve your SQLite database across restarts!
5. Add `JWT_SECRET` and `TOTP_SECRET` in the dashboard.

---

## 9. Option F: Railway (Best Developer Experience & 1-Click Volumes)

[Railway](https://railway.app) provides native container hosting with 1-click persistent volume attachments:

1. In Railway, click **"New Project"** ➔ **"Deploy from GitHub repo"**.
2. Select `SahooShuvranshu/Crystal-Heimdall`.
3. Railway will automatically detect the multi-stage [`Dockerfile`](file:///d:/Projects/Crystal-Heimdall/Dockerfile).
4. Go to the service **"Volumes"** tab ➔ **"Add Volume"**:
   * **Mount Path:** `/app/data`
5. In **"Variables"**, add your `JWT_SECRET`, `TOTP_SECRET`, and notification webhooks.
6. Click **"Deploy"**. The background poller runs 24/7 continuously!

---

## 10. Option G: Fly.io (Free Edge Containers & NVMe Volume)

[Fly.io](https://fly.io) includes a free tier with up to 3 shared-CPU VMs and 3GB of persistent NVMe volume storage:

1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh` (or `iwr https://fly.io/install.ps1 -useb | iex` on Windows).
2. Authenticate: `fly auth login`.
3. Create persistent storage volume:
   ```bash
   fly volumes create heimdall_data --size 1 --region iad
   ```
4. Deploy using the included [`fly.toml`](file:///d:/Projects/Crystal-Heimdall/fly.toml):
   ```bash
   fly launch --no-deploy
   fly deploy
   ```

---

## 11. Option H: Koyeb (Free Always-On Micro-Instance)

[Koyeb](https://koyeb.com) offers a free "Eco" instance that does not sleep:
1. Connect your GitHub repository `SahooShuvranshu/Crystal-Heimdall`.
2. Choose **Buildpack** (or Dockerfile).
3. Set Port to `3030`.
4. Provide environment variables (`TURSO_DATABASE_URL` or use Turso for persistence).
5. Deploy.

---

## 12. Option I: Oracle Cloud "Always Free" Tier (100% Free Dedicated VPS Forever)

Oracle Cloud Infrastructure (OCI) provides the most generous free tier in cloud computing:
* **Resources:** Up to 4 ARM Ampere OCPUs, 24 GB RAM, and 200 GB Block Volume **free forever**.
* **Setup:**
  1. Create a free Ubuntu VM instance on Oracle Cloud.
  2. Clone the repository via SSH.
  3. Run with Docker Compose:
     ```bash
     git clone git@github.com:SahooShuvranshu/Crystal-Heimdall.git
     cd Crystal-Heimdall
     docker compose up -d --build
     ```
  4. Full control, persistent disk, zero third-party limits, and 100% privacy!

---

## 📊 Platform Comparison Matrix

| Hosting Platform | Type | Free Tier? | Background Poller (60s) | SQLite Persistence | Best Suited For |
|---|---|---|---|---|---|
| **Vercel** | Serverless | Yes (Hobby) | External cron / GitHub Actions | Ephemeral `/tmp` (Requires Turso) | Fast edge CDN, status page showcase |
| **Render** | Persistent Web Service | Yes (Free/Starter) | ✅ Native 24/7 Poller | ✅ Persistent Disk ($1/mo) or Turso | Zero-maintenance container hosting |
| **Railway** | Persistent Container | $5 Trial Credit | ✅ Native 24/7 Poller | ✅ 1-Click Volume Mount | Rapid staging and production scaling |
| **Fly.io** | Micro VM | Yes (Free Allowance) | ✅ Native 24/7 Poller | ✅ Free 3GB NVMe Volume | Lowest latency global edge deployment |
| **Oracle Cloud** | Dedicated Cloud VPS | ✅ Free Forever | ✅ Native 24/7 Poller | ✅ 200GB Free SSD Storage | Enterprise reliability, full data ownership |
| **Private VPS** | Dedicated Linux VM | Paid ($3–$5/mo) | ✅ Native 24/7 Poller | ✅ Local SSD | Total control, Docker Compose, internal VPN |


