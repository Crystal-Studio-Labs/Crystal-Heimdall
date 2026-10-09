# 🚀 Crystal Heimdall — Production Deployment Guide

> **Production Deployment Strategies for Crystal Heimdall**  
> *Choose between standalone VPS, PM2 daemon, Docker container, or 100% free serverless with Vercel and Turso.*

---

## 1. Quick Production Build

Before deploying to any target environment, generate the optimized client assets and compiled server binaries:

```bash
# 1. Install dependencies
npm ci

# 2. Compile Vite client and TypeScript server
npm run build

# 3. Test launch on port 3030
node dist-server/index.js
```

---

## 2. Option A: PM2 Process Manager (Recommended for VPS)

Using [PM2](https://pm2.keymetrics.io/) ensures automatic process restarts, background clustering, and log rotation:

```bash
# 1. Install PM2 globally
npm install -g pm2

# 2. Launch Crystal Heimdall as background service
pm2 start dist-server/index.js --name "crystal-heimdall"

# 3. Save process list to revive on system reboot
pm2 save
pm2 startup
```

---

## 3. Option B: Docker & Docker Compose

Deploy with container isolation and persistent SQLite volumes.

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
RUN npm ci --omit=dev
COPY --from=builder /app/dist-client ./dist-client
COPY --from=builder /app/dist-server ./dist-server
VOLUME ["/app/data"]
EXPOSE 3030
CMD ["node", "dist-server/index.js"]
```

### `docker-compose.yml`
```yaml
version: "3.8"
services:
  sentinel:
    build: .
    container_name: crystal-heimdall
    restart: unless-stopped
    ports:
      - "3030:3030"
    volumes:
      - ./data:/app/data
    environment:
      - PORT=3030
      - DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
      - TELEGRAM_BOT_TOKEN=...
      - TELEGRAM_CHAT_ID=...
```

Run container:
```bash
docker compose up -d
```

---

## 4. Option C: Systemd Service (Linux VPS / Ubuntu / Debian)

Create `/etc/systemd/system/crystal-heimdall.service`:

```ini
[Unit]
Description=Crystal Heimdall Reliability Sentinel
After=network.target

[Service]
Type=simple
User=node
WorkingDirectory=/var/www/crystal-heimdall
ExecStart=/usr/bin/node dist-server/index.js
Restart=always
RestartSec=5
Environment=PORT=3030
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now crystal-heimdall
sudo systemctl status crystal-heimdall
```

---

## 5. Option D: 100% Free Cloud Serverless (Vercel + Turso)

1. **Provision Free Turso Database:**
   - Sign up at [turso.tech](https://turso.tech) and create a free database.
   - Run `turso db show <name>` and copy `TURSO_DATABASE_URL` (`libsql://...`) and auth token.

2. **Deploy to Vercel:**
   - Link repository to Vercel.
   - Configure Environment Variables:
     - `TURSO_DATABASE_URL=libsql://your-db-name.turso.io`
     - `TURSO_AUTH_TOKEN=your-token`
   - `vercel.json` will automatically schedule `/api/v1/cron/poll` every 1 minute.

---

## 6. Reverse Proxy Configuration

### Nginx Reverse Proxy
```nginx
server {
    listen 80;
    server_name status.crystalstudio.labs;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name status.crystalstudio.labs;

    ssl_certificate /etc/letsencrypt/live/status.crystalstudio.labs/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/status.crystalstudio.labs/privkey.pem;

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
}
```

### Caddy Server
```caddy
status.crystalstudio.labs {
    reverse_proxy 127.0.0.1:3030
}
```
