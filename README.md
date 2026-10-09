# ⚡ CRYSTAL HEIMDALL // Autonomous Reliability Sentinel

> **Industrial Brutalism Uptime Tracker, Telemetry Sentinel & Synthetic Monitor for Crystal Studio Labs.**  
> *Zero-cost, standalone PWA with built-in Uptime Kuma features, Sentry crash ingestion, and Web Audio siren alerts.*

---

## 🏛️ System Capabilities & Architecture

* **Industrial Brutalism Design System:** Zero-radius hard geometries (`border-radius: 0px !important`), high-contrast monospace typography, 3D offset drop shadows (`shadow-[4px_4px_0px_#000]`), and tactile mechanical interactions.
* **Public Status Page (`/`):** Clean, real-time public status interface displaying fleet-wide health status, 30-day uptime heartbeat strips, announcement notice banners, and minimal Crystal Studio Labs footer.
* **2FA-Only Operator Authentication (`/login`):** Direct Two-Factor Authentication gate via RFC 6238 6-digit TOTP (Google Authenticator, Ente Auth, 1Password). Zero master passwords and zero third-party OAuth dependencies.
* **Command Deck (`/dashboard`):** High-density operator cockpit with live service registration, instant single-target probe triggering (`[ PING NOW ]`), maintenance mode toggles, and incident triage.
* **Analytics & Uptime Kuma SLA Matrix (`/dashboard/analytics`):**
  * Interactive monitor selector bar (`[ ALL MONITORS ]` + target pills).
  * Multi-Period Availability Matrix Table tracking 24-Hour, 7-Day, and 30-Day SLA uptime percentages, real-time ping latencies, and check volumes.
  * Latency distribution curves (P50, P95, P99) and error histograms.
* **Uptime Kuma Advanced Engine (`/dashboard/settings`):**
  * Poller Heartbeat & Backoff Intervals (Default Interval, Timeout Threshold, Max Retries, Resend Alert Cooldown).
  * TLS / SSL Certificate Validation Matrix (Certificate Expiry Warning Window & Ignore Invalid SSL toggle).
  * HTTP Protocol Specifications & Assertions (Default Method, Custom User-Agent, Accepted Status Codes, Follow Redirects).
  * Telemetry Data Retention Policy & Maintenance Center (Purge Incidents, Prune Telemetry, Vacuum SQLite).
* **Progressive Web App (PWA) & Klaxon Siren Alarms:**
  * Installable standalone PWA (`manifest.webmanifest`, service worker caching).
  * Synthesized Web Audio multi-oscillator klaxon sirens that alert operators instantly when a critical outage occurs.
* **Sentry-Style Crash Sentinel:**
  * Ingests unhandled client/server stack traces via passive telemetry sink (`POST /api/v1/telemetry/errors`).
  * Real-time crash issue inspector with error grouping and resolution triage.
* **Emergency Dispatch Conduits:**
  * Instant rich embed delivery to Discord channels.
  * Instant push alerts to Telegram chats.

---

## 🧭 Routes & Endpoints

| Route | Access | Description |
|---|---|---|
| `/` | Public | Real-time status page, announcement banner, 30-day uptime bars, minimal footer. |
| `/login` | Public | 2FA-Only operator authentication gate (6-digit TOTP). |
| `/dashboard` | Operator | Command deck, monitor cards, instant probe trigger, maintenance mode toggles. |
| `/dashboard/analytics` | Operator | Uptime Kuma multi-period availability table, monitor filter, latency percentiles. |
| `/dashboard/settings` | Operator | Status Page editor, Uptime Kuma engine config, notification conduits, maintenance actions. |
| `/manifest.webmanifest` | Public | PWA web app manifest with standalone display configuration. |
| `/sw.js` | Public | PWA Service Worker caching and background notification handler. |

---

## 🛠️ Quick Start (Local Development)

```bash
# 1. Install dependencies
npm install

# 2. Build client and server bundles
npm run build

# 3. Launch production server on port 3030
node dist-server/index.js
```

Or run dev server with hot reload:
```bash
npm run dev
```

Open:
* **Status Page:** [http://localhost:3030](http://localhost:3030)
* **Operator Console:** [http://localhost:3030/dashboard](http://localhost:3030/dashboard)

---

## 📜 License
MIT License — Crystal Studio Labs &copy; 2026.

