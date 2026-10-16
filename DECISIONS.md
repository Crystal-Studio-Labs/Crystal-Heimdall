# 🏛️ Architectural & Engineering Decision Records (ADR)

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
- **Action:** Standardized client UI on Industrial Brutalism: hard 3D box shadows (`4px 4px 0px #000`), tactile press translations (`translate(2px, 2px)`), high-contrast borders, monospace telemetry headers, and strict `borderRadius: 0px !important`.
- **Context:** Status and telemetry pages require immediate legibility, high contrast in low-visibility or emergency operations, and zero visual clutter.
- **Decision Rationale:** Brutalism provides unambiguous component boundaries, instant visual distinction between warning/critical states, and high aesthetic appeal without bloated animation libraries.
- **Evidence:** Verified across all routes: `/`, `/dashboard`, `/analytics`, `/incidents`, `/overview`, and `/docs`.
- **Risk:** Low.

---

### ADR-005: Dual-Channel Poller Daemon & External Cron Remediation
- **Date:** 2026-10-10
- **Status:** Accepted
- **Action:** Implemented both internal 60-second polling loop in `server/index.ts` AND an authenticated HTTP endpoint `/api/v1/cron/poll` triggered by GitHub Actions workflow (`.github/workflows/poller.yml`).
- **Context:** Free Vercel Hobby accounts restrict cron jobs to once per day (`0 0 * * *`). 5-minute health monitoring cannot function under a 24-hour cron.
- **Decision Rationale:** Standalone Docker/VPS hosts utilize the built-in interval timer. Serverless deployments utilize free GitHub Actions scheduled jobs every 5 minutes with bearer token authorization (`CRON_SECRET`).
- **Evidence:** GitHub Actions workflow verified; `/api/v1/cron/poll` verified with token authentication.
- **Risk:** Low.

---

### ADR-006: Self-Bootstrapping Smoke Test Lifecycle
- **Date:** 2026-10-16
- **Status:** Accepted
- **Action:** Enhanced `test-smoke.mjs` with an initial liveness probe that auto-bootstraps `dist-server/app.js` on port 3030 if an external server is not already listening, and shuts it down in a `finally` block.
- **Context:** Running `npm test` previously failed with `ECONNREFUSED` if the developer or CI runner had not manually launched `npm run start` in a separate background terminal.
- **Decision Rationale:** Tests must be deterministic, isolated, and self-contained. Gravitas Invariant #3 demands that validation commands execute cleanly and provide empirical evidence without external prerequisites.
- **Evidence:** `npm test` executed and passed all 21 verification suites end-to-end with zero human intervention.
- **Risk:** Low.

---

### ADR-007: 7-Day+ Persistent 2FA Operator Session & Cross-Page State Awareness
- **Date:** 2026-10-16
- **Status:** Accepted
- **Action:** Upgraded client and server authentication architectures to guarantee at least 7 days (up to 30 days) of session retention:
  1. Server (`server/routes/auth.ts`) issues 30-day JWT sessions with detailed expiration metadata (`expiresInDays: 30`, `sessionExpiresAt`) and verified `/me` inspectability.
  2. Client (`client/src/lib/api.ts`) decodes JWT expiration timestamps, validates validity windows, and retains session credentials across browser restarts.
  3. Public status page (`client/src/pages/StatusPage.tsx`) detects active operator sessions in both top header and minimal footer, providing immediate `[ OPERATOR DECK ]` navigation and inline logout controls.
  4. Operator gate (`client/src/pages/LoginPage.tsx`) automatically detects active sessions, avoiding redundant TOTP prompts and routing operators straight to `/dashboard`.
- **Context:** Operators navigating between `/dashboard` and the public main page (`/`) lost navigation to the dashboard and were prompted for 2FA TOTP repeatedly upon clicking login links.
- **Decision Rationale:** Operators should not be re-challenged for 2FA within their valid authorization window (7 to 30 days). Clear navigation between public status pages and operator decks preserves workflow continuity while maintaining strict 2FA boundaries.
- **Evidence:** `npm test` test suite 8e verified session retention (`remaining=30 days`, `expiresAt`); build compiled cleanly.
- **Risk:** Low.

---

### ADR-008: Authentic Socket Port Probing (TCP) & Real TLS/SSL Expiry Inspection
- **Date:** 2026-10-16
- **Status:** Accepted
- **Action:** Implemented real TCP socket and TLS certificate inspection engine in `server/probers.ts`, integrated into synthetic poller (`server/poller.ts`), service creation, and instant single probes (`server/routes/services.ts`), with 2-second boot probing in `server/index.ts` and SQLite indexing in `server/db.ts`.
- **Context:** Previously, TCP port-check services (Postgres, Redis, custom socket ports) were skipped or errored out because the poller only executed HTTP `fetch()`. Furthermore, SSL expiry days were simulated using random numbers (`45 + Math.floor(Math.random() * 60)`).
- **Decision Rationale:** Real infrastructure monitoring demands genuine network-level assertions: testing raw socket handshakes with round-trip latency and inspecting actual TLS peer certificates for true expiration dates.
- **Evidence:** `test-smoke.mjs` test suite 22 verified:
  - Genuine TCP port probing against `127.0.0.1:3030` with sub-5ms latency measurement and health reporting.
  - Authentic TLS certificate inspection against `github.com` verifying genuine days remaining and certificate issuer details.
- **Risk:** Low.

---

### ADR-009: Authentic Multi-Window Telemetry Aggregation & Real Historical SLAs
- **Date:** 2026-10-16
- **Status:** Accepted
- **Action:** Replaced fabricated historical blocks and simulated SLA math across `server/routes/status.ts`, `server/routes/analytics.ts`, and `server/routes/services.ts` with real SQL aggregations:
  1. `status.ts` performs calendar-day SQL grouping (`date(recorded_at / 1000, 'unixepoch')`) over the past 30 days to build genuine daily status blocks and real 30-day service uptime.
  2. `analytics.ts` runs a single multi-window aggregation query calculating true 24h, 7d, and 30d uptime availability percentages and 24h average latencies from indexed `telemetry_points`.
  3. `services.ts` builds 24 hourly buckets over the past 24 hours to feed authentic hourly sparklines to `ServiceCard.tsx`.
- **Context:** Previously, days 1–29 on the status page were hardcoded 100% green blocks regardless of past outages, while the analytics breakdown used an artificial formula (`uptime7d = Math.max(99.0, uptime24h - 0.05)`), misrepresenting historical availability.
- **Decision Rationale:** Telemetry data is only valuable if truthful. Computing actual uptime percentages from historical sample points gives operators and visitors complete confidence in system availability metrics.
- **Evidence:** `test-smoke.mjs` Test 2, Test 6, and Test 15 confirmed authentic 24h sparklines, 30-day daily blocks, and genuine multi-window SLA percentages.
- **Risk:** Low.

---

### ADR-010: Target Lifecycle Management, Comprehensive In-Place Editing, and Project Grouping
- **Date:** 2026-10-16
- **Status:** Accepted
- **Action:** Introduced full target lifecycle management and organizational grouping across the backend and frontend:
  1. Added `group_name TEXT DEFAULT 'Production'` migration to SQLite `services` schema in `server/db.ts`.
  2. Implemented `PUT /api/v1/services/:id` in `server/routes/services.ts` enabling comprehensive updates to target names, endpoints, port configurations, polling intervals, retry budgets, keyword matching, HTTP status lists, public flags, and project tags, with automatic TLS re-inspection.
  3. Implemented `POST /api/v1/services/batch` in `server/routes/services.ts` supporting atomic fleet operations (`pause-all`, `resume-all`, `delete-selected`, `set-group`).
  4. Designed and integrated `EditServiceModal.tsx` into `DashboardPage.tsx` alongside project filter chips and project badges in `ServiceCard.tsx` following Industrial Brutalism design rules.
- **Context:** Previously, operators were forced to delete and recreate targets whenever endpoints, intervals, or ports changed. Furthermore, all services appeared in a flat list without project attribution (`Campus Relay`, `KrishiSetu`, `OSCC`, `Production`).
- **Decision Rationale:** Infrastructure monitoring requires agile operational control. Operators need to adjust polling rates, fix URLs, pause batches of services during deployments, and organize services by team or project.
- **Evidence:** `test-smoke.mjs` Test 23 verified end-to-end target creation with project tags, full in-place modification via `PUT`, batch pause, batch tagging, and batch deletion.
- **Risk:** Low.

---

### ADR-011: Multi-Stage Incident Timeline Management & Authentic Postmortem Audit Ledgers
- **Date:** 2026-10-16
- **Status:** Accepted
- **Action:** Engineered a chronological operational incident timeline engine and postmortem audit trail:
  1. Created `incident_updates` table (`id, incident_id, status, message, created_at`) and index `idx_incident_updates_inc_time` in SQLite schema (`server/db.ts`) with backfill logic for existing incidents.
  2. Implemented `POST /api/v1/incidents/:id/updates` and enhanced `GET /api/v1/incidents/:id` in `server/routes/incidents.ts` to return the complete ordered ledger of operational notes and status transitions (`investigating`, `identified`, `monitoring`, `resolved`).
  3. Integrated automatic initial timeline record creation upon inbound exception ingestion (`server/routes/alerts.ts`), synthetic poller failures, and dead-man switch timeouts (`server/poller.ts`).
  4. Redesigned `IncidentDrawer.tsx` on the dashboard to render the live timeline and provide an operator note composer with status selectors.
  5. Overhauled `IncidentDetailPage.tsx` to replace hardcoded dummy steps with the authentic database ledger, complete with an authenticated operator composer for appending postmortem entries directly from the public audit report.
- **Context:** Previously, incidents had only a binary state (`active` vs `resolved`) without intermediate progress notes. Incident detail pages rendered a static mock 3-step timeline that did not reflect actual operator investigation, mitigation steps, or resolution actions.
- **Decision Rationale:** Enterprise reliability sentinels require transparent, time-stamped audit trails of every mitigation step to maintain stakeholder trust, comply with incident response runbooks, and build authentic postmortems.
- **Evidence:** `test-smoke.mjs` Test 24 verified alert creation with automatic initial update, appending `identified`, `monitoring`, and `resolved` updates, master incident status synchronization, and complete chronological retrieval.
---

### ADR-012: Dynamic SVG Status Shields, Incident RSS 2.0 Syndication & Generic Webhook Dispatch
- **Date:** 2026-10-16
- **Status:** Accepted
- **Action:** Engineered dynamic SVG status shields, public RSS 2.0 incident feeds, and generic webhook dispatch conduits:
  1. Implemented `sendGenericWebhookAlert` in `server/dispatcher.ts` supporting dual-format JSON dispatch compatible with Slack, n8n, Zapier, PagerDuty, and custom ingest endpoints.
  2. Enhanced `server/routes/channels.ts` to support testing generic webhook relays via `POST /api/v1/channels/test` (`type: "generic"` or `"webhook"`).
  3. Engineered `server/routes/badges.ts` producing pixel-crisp, Shields.io-compatible flat Industrial Brutalist SVG status shields (`/api/v1/badges/:id/status.svg` with metrics `status`, `uptime`, `latency`, and `:id === 'fleet'`).
  4. Implemented `getRssFeedHandler` in `server/routes/status.ts` and mounted `/status/feed.xml`, `/feed.xml`, and `/api/v1/status/feed.xml` in `server/app.ts` before SPA client fallback routes.
  5. Updated `SettingsPage.tsx` with a 3-channel alert grid (Discord, Telegram, Generic Webhook) and a Dynamic Badges & RSS Feed Hub card offering one-click copy of Markdown shields and RSS URLs.
- **Context:** Previously, Heimdall only supported Discord and Telegram notifications, had no way to embed live availability badges in GitHub repositories or documentation, and lacked an open RSS feed for external feed readers and syndication.
- **Decision Rationale:** Status systems must integrate seamlessly into modern developer ecosystems. Static SVG badges allow engineering teams to showcase uptime in repository READMEs without third-party dependencies, RSS enables standard feed reader alerts, and generic webhooks enable universal workflow integration.
- **Evidence:** `test-smoke.mjs` Test 25 confirmed generic webhook dispatch, SVG status shield generation (fleet status, fleet uptime, and single target status), and XML validation of the RSS 2.0 incident feed.
- **Risk:** Low.

---

### ADR-013: Mobile Sentinel Architecture, Lockscreen Push Notifications & Emergency Alarm Deck
- **Date:** 2026-10-16
- **Status:** Accepted
- **Action:** Engineered a native-grade Mobile Sentinel audio alarm and lockscreen push notification pipeline:
  1. Upgraded PWA Service Worker (`client/public/sw.js`) with an in-app `message` event listener to reliably call `self.registration.showNotification()` with raster PNG icons (`/icon-192.png`), multi-pulse vibration patterns (`[600, 200, 600, 200, 1000, 300, 800]`), and `requireInteraction: true` + `renotify: true`, ensuring alerts stay pinned in the Android/iOS status bar and lockscreen.
  2. Implemented `client/src/lib/audioAlerts.ts` continuous industrial klaxon looping engine with `navigator.mediaSession` integration so background audio priorities are preserved when the phone is locked.
  3. Integrated the W3C Screen Wake Lock API (`navigator.wakeLock.request('screen')`) allowing operators to keep monitoring devices awake on desk/wall mounts.
  4. Redesigned `client/src/pages/DashboardPage.tsx` by moving sound controls out of cramped header buttons into an unmistakable, prominent **Mobile Sentinel & Audio Alarm Command Deck** featuring:
     - Master ALARM: [ON / ARMED] vs [OFF / MUTED] toggle.
     - [ TEST ALARM & PUSH ] button running full siren, vibration, and system tray notification validation.
     - [ KEEP SCREEN AWAKE ] WakeLock toggle.
     - [ ENABLE MOBILE PUSH ] quick permission grant button.
     - Flashing emergency outage banner with one-click `[ SILENCE ALARM ]` action.
- **Context:** Mobile browsers (especially Android Chrome) reject `new Notification(...)` in page context and aggressively throttle background timers when the device screen locks. Outage alerts were previously inaudible or missed when phones were locked.
- **Decision Rationale:** Operational sentinels must wake up on-call engineers. Relying on ServiceWorker push notifications with persistent interaction flags and MediaSession audio ensures notifications punch through lockscreens and sound alarms reliably.
- **Evidence:** `client/public/sw.js` and `client/src/lib/audioAlerts.ts` verified; `npm run build:client` compiled cleanly; test suite passed 25/25 tests.
- **Risk:** Low.

---

### ADR-014: Private Infrastructure Lockdown, Covert Operator Access & API Documentation Shielding
- **Date:** 2026-10-16
- **Status:** Accepted
- **Action:** Shielded operator portals, restricted public API docs, and established covert footer-only access:
  1. **Top Header Sanitization:** Removed all prominent "OPERATOR LOGIN" buttons and login triggers from public-facing navigation headers (`Navbar.tsx`) and the status hero header (`StatusPage.tsx`).
  2. **Covert Footer Access:** Established a discreet, minimalist monospace `[ OPERATOR ACCESS ]` link exclusively located in the status page footer (`StatusPage.tsx`), routing to the 2FA login gate for the admin only.
  3. **Documentation Shielding:** Removed all public references to `/docs` and `API DOCS` from `Navbar.tsx`, `LandingPage.tsx`, and `StatusPage.tsx`. In `client/src/App.tsx`, configured unauthenticated visits to `/docs` and `/api-docs` to quietly redirect to the public status page (`/`).
  4. **Search Engine & Sitemap Sanitization:** Updated `robots.txt` to disallow crawling on `/dashboard`, `/login`, `/docs`, `/api-docs`, and `/api/`. Stripped `/login` and `/docs` out of `sitemap.xml`, preserving only public operational pages (`/`, `/overview`, `/incidents`).
- **Context:** Crystal-Heimdall is private infrastructure for Crystal Studio Labs. Public visitors should only see fleet status and incidents without visible login buttons, administrative prompts, or exposed API documentation.
- **Decision Rationale:** Enforces defense-in-depth and attack surface minimization. Unauthenticated visitors see a pure status page, while the operator can access the command deck discreetly via the footer.
- **Evidence:** Verified via `npm run build:client` and automated test suite (`test-smoke.mjs`), with all 25 test suites passing nominal.
- **Risk:** Low.

---

### ADR-015: Two-Way Sentinel Lifecycle Sync, Database Monitoring Presets, Mobile Responsive Deck & PWA Optimization
- **Date:** 2026-10-16
- **Status:** Accepted
- **Action:**
  1. **Two-Way Sentinel Lifecycle Sync:** Extended `/api/v1/ping/:key` to ingest structured JSON payloads with lifecycle events (`online`, `heartbeat`, `offline`), `uptime`, `memoryMB`, and `reason`.
     - `offline`: Automatically marks target `status = 'maintenance'` and `is_maintenance = 1`, gracefully suppressing alarm sirens and notifications during deliberate deployments and graceful process terminations (SIGTERM/SIGINT).
     - `online`: Restores target `status = 'healthy'`, resets maintenance mode, auto-resolves active incidents, and records fresh uptime/memory metadata.
     - `heartbeat`: Records sparkline availability telemetry points and updates live process memory and uptime stats.
     - Simultaneously, Heimdall probes outbound targets to detect hard crashes and unhandled host dropouts.
  2. **Drop-in Zero-Dependency SDK Generator & Radar Beacon (`ConnectProjectModal.tsx`):** Built interactive modal with copy-pasteable snippets for Node.js/Express, Python/FastAPI, Next.js, and Supabase (REST API vs TCP connection pooler on port 6543/5432). Features live radar beacon polling every 2.5s until handshake is established.
  3. **Mobile Screen Ratio & Responsive UI Overhaul:**
     - Overhauled `ServiceCard.tsx` footer from rigid horizontal layout to `flex flex-col sm:flex-row` with wrapping buttons to prevent card blowouts on 360px-430px smartphone viewports.
     - Upgraded Mobile Sentinel Command Deck buttons to conform to minimum 44px touch targets.
     - Enabled horizontal swipe-strip scrolling for project category chips (`overflow-x-auto whitespace-nowrap scrollbar-none`).
  4. **PWA Enhancements:**
     - Added `viewport-fit=cover` in `client/index.html` for notch and dynamic island safe-area rendering.
     - Added `display_override: ["window-controls-overlay", "standalone", "minimal-ui"]`, `scope: "/"`, and home-screen app shortcuts (`Live Status`, `Command Deck`, `Analytics`) in `manifest.webmanifest`.
     - Implemented Cache-First static asset caching in `client/public/sw.js` (`crystal-uptime-v3`) while guaranteeing `/api/` network-only execution.
- **Context:** The operator requested two-way synchronization between external applications and Heimdall, database monitoring recipes (Supabase REST/TCP), mobile-friendly dashboard controls for small screens, and optimized PWA capabilities.
- **Decision Rationale:** Two-way sync eliminates false outage alarms during scheduled deployments while outbound polling catches hard crashes. Zero external dependency SDK code prevents bloat in monitored client apps.
- **Evidence:** Tested with all 26 automated smoke test suites passing nominal; frontend and backend compiled with zero errors.
- **Risk:** Low.


