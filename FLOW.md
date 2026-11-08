# 🔄 Crystal-Heimdall: Code Execution Flow & Architecture Map

<div align="center">

[![Execution Flow](https://img.shields.io/badge/Execution%20Flow-END--TO--END%20VERIFIED-10b981?style=for-the-badge&logo=git&logoColor=10b981&labelColor=070a0f)](https://crystal-heimdall.vercel.app)
[![Smoke Tests](https://img.shields.io/badge/Smoke%20Suite-39%20%2F%2039%20PASSING-10b981?style=for-the-badge&logo=vitest&logoColor=10b981&labelColor=070a0f)](https://github.com/Crystal-Studio-Labs/Crystal-Heimdall/blob/main/test-smoke.mjs)
[![Pentest Hardened](https://img.shields.io/badge/Pentest-43%20%2F%2043%20HARDENED-06b6d4?style=for-the-badge&logo=shieldsdotio&logoColor=06b6d4&labelColor=070a0f)](https://github.com/Crystal-Studio-Labs/Crystal-Heimdall/blob/main/test-pentest.mjs)
[![Web Push](https://img.shields.io/badge/Web%20Push-RFC%208292%20VAPID-f59e0b?style=for-the-badge&logo=pwa&logoColor=f59e0b&labelColor=070a0f)](./ARCHITECTURE.md)

</div>

> **Repository:** Crystal-Heimdall (`v2.0.0`)  
> **Status:** Active Architectural Reference  
> **Document Purpose:** Maps how control, data, and execution move across files, runtime boundaries, network interfaces, and mobile devices.

---

## 🗺️ High-Level System Architecture

```mermaid
flowchart TD
    subgraph Client_Layer [Frontend: React 19 + Vite SPA & Showcase]
        IndexHTML["client/index.html"] --> MainTSX["client/src/main.tsx"]
        MainTSX --> AppTSX["client/src/App.tsx"]
        AppTSX --> Router["React Router v6"]
        Router --> StatusPage["StatusPage (/)"]
        Router --> LoginPage["LoginPage (/login)"]
        Router --> Dashboard["DashboardPage (/dashboard)"]
        Router --> Analytics["AnalyticsPage (/dashboard/analytics)"]
        Router --> Incidents["IncidentsPage (/incidents)"]
        Router --> IncidentDetail["IncidentDetailPage (/incidents/:id)"]
        Router --> Overview["LandingPage (/overview)"]
        Router --> Settings["SettingsPage (/dashboard/settings)"]
        ShowcaseHTML["docs/index.html (GitHub Pages)"] --> LiveAPI["Live Fetch (/api/v1/status)"]
    end

    subgraph Push_Engine [Closed-Browser W3C Web Push Engine]
        WebPushCore["server/webpush.ts (VAPID Manager)"]
        PushRoute["server/routes/push.ts"]
        SubscribersRoute["server/routes/subscribers.ts"]
        SW["client/public/sw.js (Service Worker)"]
        PushRoute --> WebPushCore
        SubscribersRoute --> WebPushCore
        WebPushCore -->|RFC 8292 Push| FCM["Google FCM / Apple APNs / Mozilla Push"]
        FCM --> SW
        SW --> Lockscreen["OS Lockscreen & Notification Center"]
    end

    subgraph Entrypoints [Backend Runtimes]
        VercelReq["api/index.js (Vercel Serverless)"]
        NodeReq["server/index.ts (Standalone Node / Docker)"]
    end

    subgraph Core_Server [Express Core: server/app.ts]
        App["server/app.ts (Express Instance)"]
        ColdStart["initDb() Middleware"]
        AuthRoutes["server/routes/auth.ts"]
        ServicesRoutes["server/routes/services.ts"]
        StatusRoutes["server/routes/status.ts"]
        AlertsRoutes["server/routes/alerts.ts"]
        IncidentsRoutes["server/routes/incidents.ts"]
        AnalyticsRoutes["server/routes/analytics.ts"]
        ChannelsRoutes["server/routes/channels.ts"]
        BadgesRoutes["server/routes/badges.ts"]
        TelemetryRoutes["server/routes/telemetry.ts"]
        PushRoutes["server/routes/push.ts"]
        StaticServe["dist-client SPA Serving"]
    end

    subgraph Background_Workers [Daemons & Probers]
        Poller["server/poller.ts (runPollCycle)"]
        Probers["server/probers.ts (TCP Socket & TLS Handshake)"]
        CronTrigger["/api/v1/cron/poll (Serverless Trigger)"]
    end

    subgraph Storage [Persistence Layer]
        LibSQL["Turso LibSQL Edge / SQLite (data/heimdall.db)"]
    end

    VercelReq --> App
    NodeReq --> App
    App --> AuthRoutes
    App --> ServicesRoutes
    App --> StatusRoutes
    App --> AlertsRoutes
    App --> IncidentsRoutes
    App --> AnalyticsRoutes
    App --> PushRoutes
    ServicesRoutes --> LibSQL
    StatusRoutes --> LibSQL
    Poller --> Probers
    Probers --> LibSQL
    CronTrigger --> Poller
```

---

## 🧭 Subsystem Execution Flow

### 1. Inbound Synthetic Health Probing Loop
1. **Trigger:** `server/poller.ts` executes every 30s–60s (or via `/api/v1/cron/poll` on Vercel).
2. **Dispatch:** Inspects `services` table for targets requiring evaluation.
3. **Execution:**
   * HTTP/HTTPS: Dispatches non-blocking `fetch()` with timeout and keyword assertion check.
   * Raw TCP: Opens `net.Socket` to port (e.g. `6543`), calculates connection latency, and cleanly destroys socket.
   * TLS Inspection: Reads `getPeerCertificate()` to compute days remaining until SSL expiry.
4. **State Transition:** If consecutive failures exceed threshold, opens incident and invokes `notifySubscribers()`.

### 2. Closed-Browser W3C Web Push Notification Flow
1. **Subscription Arming:** Client opens `SubscribeModal.tsx` ➔ requests browser push permission ➔ retrieves VAPID public key via `GET /api/v1/push/vapid-public-key`.
2. **Registration:** Browser generates cryptographic device token (`p256dh` and `auth`) ➔ registers via `POST /api/v1/push/subscribe`.
3. **Dispatch:** Incident occurs ➔ `server/subscribers.ts` invokes `server/webpush.ts` `sendPushNotification()`.
4. **Wakeup:** Google FCM / Apple APNs pushes payload to device ➔ `client/public/sw.js` `push` event fires in background ➔ renders system lockscreen notification with multi-pulse vibration.

### 3. Operator 2FA Verification Flow
1. **Challenge:** Operator visits `/login`, enters 6-digit rolling code from authenticator app.
2. **Verification:** `server/routes/auth.ts` verifies TOTP using `speakeasy.totp.verify()` with window ±1.
3. **Session Issuance:** If valid, generates signed HMAC-SHA256 JWT token with 24-hour expiration.
4. **Client Storage:** Client persists token in `localStorage`, unlocks privileged console routes (`Navbar.tsx` & `MobileBottomNav.tsx`).

### 4. GitHub Pages Showcase Streaming Flow
1. **Visitor:** Opens `https://crystal-studio-labs.github.io/Crystal-Heimdall/`.
2. **Live Telemetry Stream:** In-browser script polls `https://crystal-heimdall.vercel.app/api/v1/status`.
3. **Fallback Resiliency:** If connection is delayed or restricted, immediately falls back to high-density cached demonstration monitors.
4. **Interactive Controls:** Visitor can test Web Audio Klaxon siren, open simulated Command Palette (`Ctrl+K`), or copy SDK integration code in 6 runtimes.
