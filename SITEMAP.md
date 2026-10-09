# 🗺️ Crystal Heimdall — Route Catalog & SEO Metadata Registry

> **Complete inventory of all mapped frontend routes, SEO graph metadata, crawl policies, and structured data schemas.**

---

## 1. Route Inventory & Navigation Matrix

| Path | Component | Access Level | Change Frequency | Search Indexing | Priority |
|---|---|---|---|---|---|
| `/` | `StatusPage.tsx` | **Public** | Always (Live) | `index, follow` | **1.0** |
| `/overview` | `LandingPage.tsx` | **Public** | Weekly | `index, follow` | **0.9** |
| `/incidents` | `IncidentsPage.tsx` | **Public** | Hourly | `index, follow` | **0.9** |
| `/incidents/:id` | `IncidentDetailPage.tsx` | **Public** | Static/Hourly | `index, follow` | **0.8** |
| `/docs` | `DocsPage.tsx` | **Public** | Weekly | `index, follow` | **0.8** |
| `/login` | `LoginPage.tsx` | **Public** | Monthly | `noindex, nofollow` | **0.3** |
| `/dashboard` | `DashboardPage.tsx` | **Protected (2FA)** | N/A | `noindex, nofollow` | — |
| `/dashboard/analytics` | `AnalyticsPage.tsx` | **Protected (2FA)** | N/A | `noindex, nofollow` | — |
| `/dashboard/settings` | `SettingsPage.tsx` | **Protected (2FA)** | N/A | `noindex, nofollow` | — |
| `*` | `NotFoundPage.tsx` | **Public** | N/A | `noindex, nofollow` | — |

---

## 2. Per-Page SEO & Open Graph Metadata

### 2.1 `/` — Public Live Status Page
- **Page Title:** `Crystal Heimdall // Autonomous Reliability Sentinel`
- **Meta Description:** `Continuous multi-point health monitoring across all public platforms, APIs, and microservices for Crystal Studio Labs.`
- **Canonical URL:** `https://status.crystalstudio.labs/`
- **Open Graph Image:** `https://status.crystalstudio.labs/og-image.svg` (1200×630px)
- **Twitter Card:** `summary_large_image`
- **JSON-LD Type:** `SoftwareApplication` / `Organization`

### 2.2 `/overview` — Architecture & Platform Overview
- **Page Title:** `Architecture & Overview // Crystal Heimdall`
- **Meta Description:** `Autonomous reliability sentinel, Uptime Kuma monitoring engine, and Sentry crash tracker designed for Crystal Studio Labs infrastructure.`
- **Canonical URL:** `https://status.crystalstudio.labs/overview`
- **Open Graph Image:** `https://status.crystalstudio.labs/og-image.svg`
- **Twitter Card:** `summary_large_image`
- **JSON-LD Type:** `WebPage`

### 2.3 `/incidents` — Incident Ledger & Postmortems
- **Page Title:** `Incident Ledger & Postmortems // Crystal Heimdall`
- **Meta Description:** `Public historical record of service incidents, system anomalies, resolution timelines, and postmortem telemetry for Crystal Studio Labs infrastructure.`
- **Canonical URL:** `https://status.crystalstudio.labs/incidents`
- **Open Graph Image:** `https://status.crystalstudio.labs/og-image.svg`
- **Twitter Card:** `summary_large_image`
- **JSON-LD Type:** `CollectionPage`

### 2.4 `/incidents/:id` — Incident Deep-Dive & Timeline
- **Page Title:** `<Incident Title> // Incident Postmortem`
- **Meta Description:** `<Incident Diagnostic Message & MTTR summary>`
- **Canonical URL:** `https://status.crystalstudio.labs/incidents/:id`
- **Open Graph Image:** `https://status.crystalstudio.labs/og-image.svg`
- **Twitter Card:** `summary_large_image`
- **JSON-LD Type:** `Article` / `Report`

### 2.5 `/docs` — Developer API & Telemetry Guide
- **Page Title:** `Developer API & Ingestion Guide // Crystal Heimdall`
- **Meta Description:** `Comprehensive technical reference for integrating synthetic health checks, exception telemetry webhooks, dead-man cron switches, and Sentry crash sinks.`
- **Canonical URL:** `https://status.crystalstudio.labs/docs`
- **Open Graph Image:** `https://status.crystalstudio.labs/og-image.svg`
- **Twitter Card:** `summary_large_image`
- **JSON-LD Type:** `TechArticle`

### 2.6 `/login` — Operator 2FA Gateway
- **Page Title:** `Operator Authentication Gate // Crystal Heimdall`
- **Meta Description:** `Direct Two-Factor Authentication (RFC 6238 TOTP) access gate for Crystal Studio Labs infrastructure operators.`
- **Robots Directive:** `noindex, nofollow`

### 2.7 Protected Operator Deck (`/dashboard`, `/dashboard/analytics`, `/dashboard/settings`)
- **Robots Directive:** `noindex, nofollow` (Blocked in `robots.txt` and meta tags)

---

## 3. Search Engine Discovery Files

- **XML Sitemap:** Accessible at [`/sitemap.xml`](https://status.crystalstudio.labs/sitemap.xml)
- **Robots Directives:** Accessible at [`/robots.txt`](https://status.crystalstudio.labs/robots.txt)
- **Web App Manifest:** Accessible at [`/manifest.webmanifest`](https://status.crystalstudio.labs/manifest.webmanifest)
