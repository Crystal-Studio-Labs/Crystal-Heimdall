# ⚡ CRYSTAL HEIMDALL // Autonomous Reliability Sentinel

![Crystal Heimdall Banner](./client/public/banner.svg)

> **🔒 CLASSIFICATION: PROPRIETARY & CONFIDENTIAL // FOR INTERNAL USE ONLY**  
> **PROPERTY OF CRYSTAL STUDIO LABS — ALL RIGHTS RESERVED.**  
> *Unauthorized copying, distribution, cloning, public deployment, or reverse engineering of this software is strictly prohibited.*

---

## 🏛️ System Overview

**Crystal Heimdall** is the dedicated, private reliability sentinel and infrastructure monitoring platform engineered exclusively for **Crystal Studio Labs**. Built with an **Industrial Brutalism** design system (`border-radius: 0px !important`), high-density monospace telemetry meters, and zero third-party telemetry bloat, Heimdall delivers continuous uptime monitoring, synthetic poll loops, passive Sentry crash collection, and Web Audio siren alerts for internal operators.

---

## 🔒 Private Repository & Team Onboarding Guidelines

### 1. Repository Access & Cloning
This repository is private. Team members must authenticate via SSH or GitHub CLI with active Crystal Studio Labs organization membership:
```bash
# Clone via SSH (Recommended)
git clone git@github.com:SahooShuvranshu/Crystal-Heimdall.git

# Or Clone via HTTPS
git clone https://github.com/SahooShuvranshu/Crystal-Heimdall.git
cd Crystal-Heimdall
```

### 2. Environment Secrets & Security Policy
* **Never commit `.env` or sensitive credentials** to git.
* Obtain the internal team secrets (e.g., `JWT_SECRET`, `TOTP_SECRET`, `DISCORD_WEBHOOK_URL`, `TELEGRAM_BOT_TOKEN`) from the official **Crystal Studio Labs 1Password / Vault** under `Engineering > Crystal-Heimdall`.
* Create your local configuration file from template:
  ```bash
  cp .env.example .env
  ```

### 3. Operator 2FA Enrollment (Zero Master Passwords)
Crystal Heimdall does not use master passwords or third-party OAuth. Operators log in via **RFC 6238 TOTP**:
* In production, each authorized engineer scans their provisioned TOTP QR code into an authenticator app (Google Authenticator, Ente Auth, 1Password).
* In local development or isolated staging environments, emergency code `000000` is accepted for rapid testing.

### 4. Network Isolation & Perimeter Security
* The **Public Status Page (`/`)** and **Incident Ledger (`/incidents`)** are designed for public consumer and stakeholder visibility.
* The **Operator Deck (`/dashboard*`)** must be protected behind an internal network perimeter (such as **Cloudflare Zero Trust Access**, **Tailscale**, or private reverse proxy).
* All dashboard routes are hard-shielded against web crawlers with `<meta name="robots" content="noindex, nofollow" />` and `robots.txt` disallow rules.

---

## 🏛️ Core Capabilities

* **Industrial Brutalism Design Language:** Strict 0px radius geometries, high-contrast monochrome & emerald aesthetics, 3D block shadows (`shadow-[4px_4px_0px_#000]`), and tactile mechanical button states.
* **Dual-Engine Synthetic Monitoring:**
  * Active HTTP/HTTPS probing with configurable method, custom headers, timeout thresholds, and retry exponential backoffs.
  * Inverted "Dead-Man's Snitch" cron heartbeats (`GET /api/v1/ping/:key`) for batch scripts and internal backup daemons.
* **Passive Crash Sentinel & Exception Sink:**
  * Sentry-compatible lightweight ingestion sink (`POST /api/v1/telemetry/errors`) for internal services and microservices.
  * Real-time stack trace inspection, automated fingerprint grouping, and error triage.
* **Uptime Kuma SLA Matrix (`/dashboard/analytics`):**
  * Multi-period availability table calculating 24-Hour, 7-Day, and 30-Day SLA uptime percentages.
  * Real-time ping latency distributions (P50, P95, P99).
* **Advanced Engine Settings (`/dashboard/settings`):**
  * Heartbeat poller intervals, SSL certificate expiry warnings, HTTP status assertions.
  * Database maintenance center (Incident purge, telemetry pruning, and SQLite vacuuming).
* **Progressive Web App (PWA) & Emergency Sirens:**
  * Standalone installable app (`manifest.webmanifest`, service worker cache).
  * Synthesized Web Audio multi-oscillator klaxon sirens that alert on-call operators immediately during downtime.
* **Instant Dispatch Conduits:**
  * Webhook alert delivery to Discord channels and Telegram bot chats.

---

## 🧭 Routes & Access Directory

| Route | Classification | Description |
|---|---|---|
| [`/`](file:///d:/Projects/Crystal-Heimdall/client/src/pages/StatusPage.tsx) | **Public** | Real-time status page, announcement banner, 30-day uptime bars, minimal footer. |
| [`/overview`](file:///d:/Projects/Crystal-Heimdall/client/src/pages/LandingPage.tsx) | **Public** | Architectural overview and platform showcase for Crystal Studio Labs. |
| [`/incidents`](file:///d:/Projects/Crystal-Heimdall/client/src/pages/IncidentsPage.tsx) | **Public** | Historical incident ledger with severity/status filters and MTTR metrics. |
| [`/incidents/:id`](file:///d:/Projects/Crystal-Heimdall/client/src/pages/IncidentDetailPage.tsx) | **Public** | Deep-dive postmortem and incident timeline breakdown. |
| [`/docs`](file:///d:/Projects/Crystal-Heimdall/client/src/pages/DocsPage.tsx) | **Public** | Developer API reference and client code snippets (Node, Python, Go, cURL). |
| [`/login`](file:///d:/Projects/Crystal-Heimdall/client/src/pages/LoginPage.tsx) | **Public** | 2FA-Only operator authentication gate (6-digit TOTP). |
| [`/dashboard`](file:///d:/Projects/Crystal-Heimdall/client/src/pages/DashboardPage.tsx) | **Internal Operator** | Command deck, monitor cards, instant probe trigger, maintenance mode toggles. |
| [`/dashboard/analytics`](file:///d:/Projects/Crystal-Heimdall/client/src/pages/AnalyticsPage.tsx) | **Internal Operator** | Uptime Kuma multi-period availability table, monitor filter, latency percentiles. |
| [`/dashboard/settings`](file:///d:/Projects/Crystal-Heimdall/client/src/pages/SettingsPage.tsx) | **Internal Operator** | Status Page editor, Uptime Kuma engine config, notification conduits, maintenance actions. |
| [`/sitemap.xml`](file:///d:/Projects/Crystal-Heimdall/client/public/sitemap.xml) | **Public** | Search engine discovery sitemap with priorities and change frequencies. |
| [`/robots.txt`](file:///d:/Projects/Crystal-Heimdall/client/public/robots.txt) | **Public** | Web crawler indexation policies (allows public, disallows /dashboard). |

---

## 📚 Technical Documentation Suite

* [Architecture & System Design](file:///d:/Projects/Crystal-Heimdall/ARCHITECTURE.md) — Subsystems, dual-engine synthetic pollers, database schemas, and brutalist design tokens.
* [REST API Reference](file:///d:/Projects/Crystal-Heimdall/API.md) — Public, private, telemetry, and operator endpoints.
* [Deployment Guide](file:///d:/Projects/Crystal-Heimdall/DEPLOYMENT.md) — Bare-metal, PM2, Docker, systemd, and reverse-proxy instructions.
* [Security Specification](file:///d:/Projects/Crystal-Heimdall/SECURITY.md) — 2FA-only zero-trust architecture, TOTP specs, and secret management.
* [Sitemap & SEO Catalog](file:///d:/Projects/Crystal-Heimdall/SITEMAP.md) — Complete routing map, SEO metadata audit, Open Graph tags, and Schema.org JSON-LD.

---

## 🛠️ Quick Start (Local Development)

```bash
# 1. Install dependencies
npm ci

# 2. Compile client and server bundles
npm run build

# 3. Launch production server on port 3030
node dist-server/index.js
```

Or run dev server with hot reload:
```bash
npm run dev
```

Endpoints:
* **Status Page:** [http://localhost:3030](http://localhost:3030)
* **Operator Console:** [http://localhost:3030/dashboard](http://localhost:3030/dashboard)

---

## 📜 Intellectual Property & Confidentiality

**PROPRIETARY AND CONFIDENTIAL — CRYSTAL STUDIO LABS &copy; 2026. ALL RIGHTS RESERVED.**  
This software and associated documentation contain proprietary information belonging to Crystal Studio Labs. Reproduction, distribution, or public display without prior written permission is strictly prohibited.
