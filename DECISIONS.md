# 🏛️ Architectural & Engineering Decision Records (ADR)

<div align="center">

[![ADR Status](https://img.shields.io/badge/ADR%20Records-18%20ACCEPTED-10b981?style=for-the-badge&logo=gitbook&logoColor=10b981&labelColor=070a0f)](https://crystal-heimdall.vercel.app)
[![Verification](https://img.shields.io/badge/Verification-EVIDENCE%20BACKED-06b6d4?style=for-the-badge&logo=checkmarx&logoColor=06b6d4&labelColor=070a0f)](https://github.com/Crystal-Studio-Labs/Crystal-Heimdall/blob/main/test-smoke.mjs)
[![Standard](https://img.shields.io/badge/Standard-GRAVITAS%20RUNTIME-f59e0b?style=for-the-badge&labelColor=070a0f)](./ARCHITECTURE.md)

</div>

> **Standard:** Gravitas Reliability Runtime Decision Protocol  
> **Repository:** Crystal-Heimdall (`v2.0.0`)  
> **Status:** Active Master Record  

This document logs all historical, current, and future architectural, structural, and behavioral decisions made during the lifecycle of the Crystal-Heimdall codebase.

---

## 📋 Decision Record Protocol

Every meaningful architectural choice, scope boundary shift, or operational modification must record a decision frame adhering to this schema:

```yaml
decision:
  id: ADR-XXX
  date: YYYY-MM-DD
  status: accepted | deprecated | superseded
  action: <Target files or architectural component affected>
  context_and_problem: <Underlying problem or constraint prompting change>
  alternatives_considered:
    - <Option 1 with trade-off>
    - <Option 2 with trade-off>
  decision_rationale: <Why this specific path was chosen>
  evidence: <Executed test runs, metric shifts, or verifiable invariants>
  risk_assessment: low | medium | high
  allowed_by_contract: true | false
```

---

## 📜 Historical & Core Decision Log

### ADR-001: Decoupling Express Server from Process Lifecycle for Serverless Compatibility
- **Date:** 2026-10-10
- **Status:** Accepted
- **Action:** Split `server/index.ts` into pure Express app instantiation (`server/app.ts`) and separate standalone process bootstrap (`server/index.ts`).
- **Context:** Deploying to serverless hosts (Vercel Serverless Functions) requires exporting an `(req, res)` handler without calling `app.listen()`, while Docker/VPS deployments require persistent socket binding.
- **Decision Rationale:** Decoupling allows `api/index.js` to import `app` directly for serverless invocation, while `server/index.ts` handles standalone `listen(PORT)` and internal `setInterval` polling daemons.
- **Evidence:** `api/index.js` successfully routes requests on Vercel; standalone runner serves `dist-client` locally.
- **Risk:** Low.

---

### ADR-002: Dual-Mode LibSQL / SQLite Database with Serverless Fallback
- **Date:** 2026-10-10
- **Status:** Accepted
- **Action:** Implement dynamic file path resolution in `server/db.ts` (`data/heimdall.db` with fallback to `/tmp/heimdall.db` when `process.env.VERCEL` is set).
- **Context:** Serverless environments like AWS Lambda and Vercel mount the application filesystem as read-only, causing standard SQLite file writes to crash with `EPERM` / `EROFS`.
- **Decision Rationale:** Using `/tmp` in serverless enables ephemeral read-write capability without requiring remote Turso credentials for development/testing, while allowing persistent local storage on disk for standalone servers.
- **Evidence:** Clean boot across both local Node runtime and Vercel Serverless runtime.
- **Risk:** Medium (ephemeral DB on serverless free tier; mitigated by external Turso DB URL support).

---

### ADR-003: 2FA-Only Zero-Bypass Operator Gate
- **Date:** 2026-10-09
- **Status:** Accepted
- **Action:** Stripped master passwords and OAuth dependencies in `server/routes/auth.ts`; implemented direct RFC 6238 TOTP rolling code authentication with immediate setup lockdown.
- **Context:** Multiple authentication mechanisms (passwords, OAuth, dev bypasses like `000000`) introduce credential-stuffing vulnerabilities and maintenance overhead for single-operator telemetry hubs.
- **Decision Rationale:** RFC 6238 TOTP with QR code generation provides cryptographically robust, offline-capable two-factor authentication. Once paired, `/setup-2fa` permanently locks down (403 Forbidden).
- **Evidence:** Automated tests strictly assert that `000000` returns 401 Unauthorized, and subsequent setup calls return 403 Forbidden.
- **Risk:** Low.

---

### ADR-004: Industrial Brutalism Design System & Zero Border Radius Enforcement
- **Date:** 2026-10-09
- **Status:** Accepted
- **Action:** Enforced global `* { border-radius: 0px !important; }`, hard 3D drop-shadows (`shadow-[4px_4px_0_0_#000]`), monospace telemetry counters, and high-voltage contrast palette (`#070a0f`, `#10b981`, `#06b6d4`, `#f59e0b`, `#ef4444`).
- **Context:** Consumer-grade monitoring tools use generic rounded cards and blurry drop-shadows that look unsuited for high-density defense-grade telemetry infrastructure.
- **Decision Rationale:** Industrial Brutalism offers high data density, unmistakable status communication, instant visual recognition, and zero visual ambiguity.
- **Evidence:** Clean visual hierarchy across desktop, tablet, and mobile displays.
- **Risk:** Low.

---

### ADR-015: Two-Way Sentinel Lifecycle Sync & Drop-In SDK Matrix
- **Date:** 2026-10-16
- **Status:** Accepted
- **Action:** Implemented two-way lifecycle reporting (`POST /api/v1/ping/:key`) handling `boot`, `healthy`, `degraded`, and `shutdown` events. Generated zero-dependency drop-in sentinel snippets across 8 programming runtimes.
- **Context:** External services needed an effortless way to report startup, heartbeat metrics, and graceful shutdowns to prevent false outage alarms during scheduled deployments.
- **Decision Rationale:** Standard library zero-dependency snippets prevent dependency friction while providing sub-millisecond status telemetry.
- **Evidence:** 39/39 automated tests verify inbound heartbeat parsing, memory recording, and graceful shutdown handling.
- **Risk:** Low.

---

### ADR-016: Closed-Browser W3C Web Push Notification Engine (RFC 8292 VAPID)
- **Date:** 2026-11-08
- **Status:** Accepted
- **Action:**
  1. Built `server/webpush.ts`: Implemented automated RFC 8292 VAPID keypair generation and AES-256-GCM encrypted persistence in `operator_auth`.
  2. Implemented `server/routes/push.ts`: Added `GET /api/v1/push/vapid-public-key`, `POST /api/v1/push/subscribe`, and `POST /api/v1/push/test`.
  3. Wired `notifySubscribers()` to dispatch closed-browser Web Push alerts to Google FCM, Apple APNs, and Mozilla Push servers, with self-healing cleanup of `410 Gone` and `404 Not Found` endpoints.
  4. Built dedicated 1-click `[ WEB PUSH ]` arming tab in `SubscribeModal.tsx` and quick action in `CommandPalette.tsx`.
- **Context:** In-app browser alerts stop sounding as soon as an engineer closes their browser tab or navigates away. Outages during off-hours require OS-level background lockscreen delivery.
- **Decision Rationale:** W3C Web Push with VAPID works across modern desktop and mobile browsers without requiring native mobile app store installations or third-party paid notification services.
- **Evidence:** Test #39 in `test-smoke.mjs` verifies VAPID public key retrieval, subscription registration, and test dispatch.
- **Risk:** Low.

---

### ADR-017: Role-Based Navigation & Strict Public Access Separation
- **Date:** 2026-11-08
- **Status:** Accepted
- **Action:**
  1. Updated `Navbar.tsx`: Unauthenticated visitors only see `STATUS`, `INCIDENTS`, `OVERVIEW`, and a high-contrast `[ OPERATOR LOGIN ]` button. Privileged console items (`[01] DASHBOARD`, `[02] ANALYTICS`, `[03] SETTINGS`, `[04] INCIDENTS`, `[05] DOCS`) are strictly hidden unless 2FA session is authenticated.
  2. Updated `MobileBottomNav.tsx`: Public visitors receive 4 public navigation tabs (`[STATUS]`, `[INCIDENTS]`, `[OVERVIEW]`, `[LOGIN]`), while authenticated operators receive 5 console tabs (`[DECK]`, `[STATUS]`, `[INCIDENTS]`, `[METRICS]`, `[SETTINGS]`).
  3. Removed the redundant top hamburger menu on mobile viewports to prevent double-navigation clashes with the sticky bottom navigation bar.
- **Context:** Mobile users experienced clashing navigation menus (both top hamburger and bottom tabs), and unauthenticated visitors had confusing access links to operator-only deck routes.
- **Decision Rationale:** Clear separation between public status board visitors and authenticated operators prevents confusion and minimizes perimeter attack surface.
- **Evidence:** Verified across desktop and mobile screen viewports; builds 100% clean with zero console warnings.
- **Risk:** Low.

---

### ADR-018: Dedicated Static GitHub Pages Showcase Website (`docs/` Folder)
- **Date:** 2026-11-08
- **Status:** Accepted
- **Action:**
  1. Initialized `docs/` folder with `.nojekyll`, `robots.txt`, `sitemap.xml`, and standalone static assets.
  2. Architected `docs/index.html`: A zero-dependency, high-impact Industrial Brutalist showcase site for GitHub Pages.
  3. Included live telemetry polling directly from `https://crystal-heimdall.vercel.app/api/v1/status` with resilient fallback caching.
  4. Built in-browser Web Audio klaxon synthesizer, interactive Command Palette simulator (`Ctrl+K`), and 6-language SDK code switcher.
- **Context:** Crystal Heimdall needed a dedicated public advertising and showcase website (similar to KrishiSetu AI) to present the platform's capabilities to external engineers and organizations.
- **Decision Rationale:** Hosting in `docs/` enables native GitHub Pages serving directly from the `main` branch with zero build configuration, zero hosting fees, and global CDN delivery.
- **Evidence:** Verified standalone static loading, valid XML sitemap, and asset resolution.
- **Risk:** Low.
