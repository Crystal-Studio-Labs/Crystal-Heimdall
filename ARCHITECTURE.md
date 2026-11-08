# 🏛️ Crystal Heimdall — Architecture & System Design

<div align="center">

[![Vercel Deployment](https://img.shields.io/badge/Vercel-LIVE%20PRODUCTION-000000?style=for-the-badge&logo=vercel&logoColor=white&labelColor=070a0f)](https://crystal-heimdall.vercel.app)
[![Architecture Spec](https://img.shields.io/badge/Architecture-DEFENSE--GRADE%20SENTINEL-10b981?style=for-the-badge&logo=diagramsdotnet&logoColor=10b981&labelColor=070a0f)](https://crystal-heimdall.vercel.app)
[![Database](https://img.shields.io/badge/Database-TURSO%20LIBSQL%20EDGE-000?style=for-the-badge&logo=sqlite&logoColor=34d399&labelColor=070a0f)](https://turso.tech)
[![Push Spec](https://img.shields.io/badge/Push%20Protocol-W3C%20RFC%208292-f59e0b?style=for-the-badge&logo=pwa&logoColor=f59e0b&labelColor=070a0f)](https://datatracker.ietf.org/doc/html/rfc8292)
[![Cryptography](https://img.shields.io/badge/Cipher-AES--256--GCM-06b6d4?style=for-the-badge&labelColor=070a0f)](./SECURITY.md)

</div>

> **🔒 DEFENSE-GRADE OBSERVABILITY APPARATUS // CRYSTAL STUDIO LABS**  
> *Architectural reference and subsystem topology for Crystal Studio Labs internal engineering.*

---

## 1. System Topology Overview

Crystal Heimdall serves as the central reliability sentinel for all internal microservices, workers, databases, APIs, and batch cron tasks across Crystal Studio Labs.

```mermaid
graph TD
    subgraph Target Workloads [Target Microservices & Daemons]
        AuthSvc[Crystal Auth Gateway] -->|Passive Sentry Telemetry| Sink[POST /api/v1/telemetry/errors]
        ApiSvc[Crystal Studio Labs API] -->|Active Synthetic Probing| Poller[Synthetic Poller Loop]
        CronSvc[Nightly Backup Cron] -->|Dead-Man Heartbeat| Heartbeat[POST /api/v1/ping/:key]
        PgPooler[Postgres Pooler 6543] -->|Raw TCP Socket Check| TCPProbe[Direct TCP Socket Prober]
    end

    subgraph Core Engine [Crystal Heimdall Core Sentinel]
        Poller --> Dedup[15m Sliding Deduplication Window]
        Sink --> Dedup
        Heartbeat --> Dedup
        TCPProbe --> Dedup
        Dedup --> DB[(Turso LibSQL Edge Database)]
        DB --> WebPush[RFC 8292 VAPID Web Push Engine]
        DB --> Dispatcher[Discord & Telegram Conduits]
    end

    subgraph Client Surfaces [Client Surfaces & Dashboards]
        DB --> PublicUI[Public Status Page & 30-Day Strips]
        DB --> IncidentLedger[Incident Lifecycle Stepper]
        DB --> OperatorDeck[2FA Operator Command Console]
        DB --> PWAShell[Offline Service Worker PWA]
        DB --> Showcase[GitHub Pages Showcase Site]
    end
```

---

## 2. Core Subsystems

### A. Dual-Engine Observability Matrix
1. **Active Synthetic HTTP/HTTPS Prober:**
   * Periodically checks endpoint availability (configurable 10s–300s).
   * Measures precise DNS, TCP, and TLS round-trip latencies.
   * Compares HTTP status codes against accepted response lists (e.g., `200, 201, 204`).
   * Evaluates custom response body assertion keywords to catch soft errors.
2. **Inverted "Dead-Man's Snitch" Cron Poller:**
   * For background batch tasks and nightly database backups that cannot be directly queried.
   * Expects pings at specified intervals. Triggers an incident if the heartbeat is overdue.

### B. Closed-Browser W3C Web Push Engine (RFC 8292 VAPID)
* Dispatches push notifications to on-call mobile and desktop operating systems even when browser tabs are completely closed.
* Built-in auto-generating RFC 8292 VAPID keypair manager with AES-256-GCM encrypted persistence in `operator_auth`.
* Connects directly to Google FCM, Apple Push Notification service (APNs), and Mozilla Push services without third-party push brokers.
* Self-healing subscriber pool that automatically cleans up `410 Gone` and `404 Not Found` subscriptions upon dispatch.

### C. Passive Crash Sentinel & Telemetry Sink
* Compatible with standard error loggers and Sentry-style clients (`POST /api/v1/telemetry/errors`).
* Automatically extracts stack traces, normalizes error signatures, generates automated fingerprints, and tracks occurrence counts without third-party cloud data leakage.

### D. 15-Minute Sliding Window Deduplication
* Prevents alert storms during cascading service outages.
* Groups recurring failures under an existing incident record within a 15-minute window while silently incrementing event counters.

### E. Native TCP Socket & TLS/SSL Peer Certificate Prober
* Probes raw TCP ports using non-blocking Node.js `net.Socket` connections with strict timeout enforcement.
* Performs deep TLS handshakes via `tls.connect` to inspect remote peer X.509 certificates and calculate actual days remaining to expiry without depending on external SSL APIs.

### F. Dynamic SVG Status Shields & Public RSS Syndicate
* Generates pixel-crisp, Shields.io-compatible Industrial Brutalist SVG status shields directly from server memory (`/api/v1/badge/:id.svg`).
* Syndicates public incident updates via standard RSS 2.0 XML (`/api/v1/rss`) for external feed readers, Slack RSS integrations, and enterprise dashboard feeds.

### G. Mobile Sentinel & Lockscreen Audio Pipeline
* Combines PWA Service Worker push notifications (`ServiceWorkerRegistration.showNotification()`), multi-pulse tactile vibration, and continuous looping Web Audio klaxons.
* Uses the W3C `navigator.mediaSession` standard to preserve audio playback priority across mobile lock screens, alongside Screen Wake Lock API (`navigator.wakeLock`) support.

### H. Role-Based Navigation & Strict Access Control
* **Public Tier:** Unauthenticated visitors only see public status monitors, 30-day uptime bars, incident postmortems, and an `[ OPERATOR LOGIN ]` action.
* **Operator Tier:** Privileged navigation tabs (`[01] DASHBOARD`, `[02] ANALYTICS`, `[03] SETTINGS`, `[04] INCIDENTS`, `[05] DOCS`) are strictly hidden behind HMAC-SHA256 authenticated sessions.

---

## 3. Database Schema (Turso LibSQL Edge / SQLite)

The embedded LibSQL database stores configuration and state in seven optimized tables with composite performance indexing:

1. **`services`**: Monitored endpoints, check types (`http-poll`, `tcp-socket`, `heartbeat`), poll intervals, port numbers, keyword assertions, status (`healthy`, `degraded`, `critical`, `maintenance`), project tags (`group_name`), and isolated API keys.
2. **`incidents`**: Identified outages, severity (`info`, `warning`, `critical`), triage state (`investigating`, `acknowledged`, `resolved`), and resolution timestamps.
3. **`incident_updates`**: Chronological multi-stage operational updates (`investigating`, `identified`, `monitoring`, `resolved`) with composite index `idx_incident_updates_inc_time`.
4. **`telemetry_points`**: Time-series log of all synthetic probes and response times for SLA graphing, backed by composite index `idx_telemetry_svc_time (service_id, recorded_at)`.
5. **`status_settings`**: Configurable branding, announcement banners, SLA toggles, and engine tuning.
6. **`error_issues`**: Passive crash reports with stack traces, environment tags, and triage status.
7. **`subscribers`**: Email, webhook, and W3C Web Push push endpoints with AES-256-GCM encrypted persistence.
8. **`operator_auth`**: RFC 8292 VAPID keypairs and operator authentication records encrypted at rest.

---

## 4. Industrial Brutalism Design Tokens

The user interface follows strict Industrial Brutalism guidelines:
* **Geometry:** `border-radius: 0px !important` across all buttons, cards, dialogs, inputs, and badges.
* **Palette:**
  * Background: Deep Tactical Void (`#070a0f` / `#08090b`).
  * Surface Panels: Hard Jet Black (`#000000`) and Obsidian (`#0b0f17`).
  * Borders: Heavy 2px–4px Slate (`#1e293b` / `#334155`).
  * Accents: High-voltage Emerald (`#10b981`), Cyber Cyan (`#06b6d4`), Warning Amber (`#f59e0b`), and Critical Crimson (`#ef4444`).
* **Shadows:** Hard 3D block shadows (`shadow-[4px_4px_0px_#000]` and `shadow-[8px_8px_0px_#000]`).
* **Typography:** `Space Grotesk` for display headings and `Space Mono` / `JetBrains Mono` for all diagnostic meters, badges, and telemetry logs.
