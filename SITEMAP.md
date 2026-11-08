# 🗺️ Crystal Heimdall — Route Catalog, Sitemap & SEO Indexation Policy

<div align="center">

[![Sitemap Status](https://img.shields.io/badge/Sitemap-SEARCH%20ENGINE%20OPTIMIZED-10b981?style=for-the-badge&logo=google&logoColor=white&labelColor=070a0f)](https://crystal-heimdall.vercel.app/sitemap.xml)
[![Showcase Sitemap](https://img.shields.io/badge/Showcase-INDEXED%20PAGES-06b6d4?style=for-the-badge&logo=githubpages&logoColor=white&labelColor=070a0f)](https://crystal-studio-labs.github.io/Crystal-Heimdall/sitemap.xml)
[![Robots Policy](https://img.shields.io/badge/Robots.txt-OPERATOR%20GATED-f59e0b?style=for-the-badge&labelColor=070a0f)](https://crystal-heimdall.vercel.app/robots.txt)

</div>

> **🔒 DEFENSE-GRADE OBSERVABILITY APPARATUS // CRYSTAL STUDIO LABS**  
> *Sitemap specifications and search crawler policy for Crystal Heimdall production and showcase environments.*

---

## 1. Route Matrix & Crawler Policy

To protect internal operations while keeping public service uptime completely transparent, Crystal Heimdall strictly partitions its route tree into **Public Indexed** and **Private Excluded** surfaces:

```mermaid
graph TD
    Root[/] --> PublicZone[Public Indexed Zone]
    Root --> PrivateZone[Private Excluded Zone]
    
    PublicZone --> P1["/ (Live Status Page)"]
    PublicZone --> P2["/overview (Architecture Showcase)"]
    PublicZone --> P3["/incidents (Incident Ledger)"]
    PublicZone --> P4["/incidents/:id (Postmortems)"]
    PublicZone --> P5["Showcase (GitHub Pages /docs)"]
    
    PrivateZone --> PR1["/dashboard (Command Deck)"]
    PrivateZone --> PR2["/dashboard/analytics (SLA Matrix)"]
    PrivateZone --> PR3["/dashboard/settings (Engine Config)"]
    PrivateZone --> PR4["/login (2FA Gate)"]
    PrivateZone --> PR5["/api/* (Internal APIs)"]
```

---

## 2. Public Route Catalog (Included in `sitemap.xml`)

### Production Status Hub (`crystal-heimdall.vercel.app`)

| Path | Change Frequency | Priority | Description |
|---|---|---|---|
| `/` | `always` | `1.0` | Live status page with heartbeat ribbons, active announcements, and fleet metrics. |
| `/overview` | `weekly` | `0.8` | Platform capabilities and Industrial Brutalism design architecture. |
| `/incidents` | `hourly` | `0.9` | Public incident ledger with search, severity filters, and MTTR counters. |
| `/incidents/:id` | `weekly` | `0.7` | Incident postmortems, root cause analysis, and resolution timeline. |

The XML sitemap is served directly from:
* Endpoint: `GET /sitemap.xml`
* File Source: [`client/public/sitemap.xml`](file:///d:/Projects/Crystal-Heimdall/client/public/sitemap.xml)

### Public Showcase Website (`crystal-studio-labs.github.io/Crystal-Heimdall/`)

| Section Anchor | Change Frequency | Priority | Description |
|---|---|---|---|
| `/` | `daily` | `1.0` | High-impact product showcase, hero radar, and live telemetry cards. |
| `/#live-telemetry` | `always` | `0.9` | Real-time fleet health prober connected to live Vercel API. |
| `/#features` | `weekly` | `0.9` | 6 Pillars of defense-grade observability breakdown. |
| `/#architecture` | `monthly` | `0.8` | Subsystem topology, data flows, and LibSQL edge persistence. |
| `/#sdk` | `weekly` | `0.8` | Multi-language drop-in sentinel integration matrix (6 runtimes). |
| `/#benchmarks` | `monthly` | `0.7` | Architectural comparison matrix vs commercial SaaS platforms. |

Showcase sitemap file: [`docs/sitemap.xml`](file:///d:/Projects/Crystal-Heimdall/docs/sitemap.xml)

---

## 3. Private Operator Routes (Excluded via `robots.txt` & `noindex`)

The following internal routes are **strictly disallowed** from search indexation:

| Path | Exclusion Mechanism | Reason |
|---|---|---|
| `/dashboard` | `Disallow: /dashboard` + `<meta name="robots" content="noindex, nofollow" />` | Internal fleet monitoring and probe triggers. |
| `/dashboard/analytics` | `Disallow: /dashboard` + `<meta name="robots" content="noindex, nofollow" />` | Internal SLA metrics and per-monitor performance matrices. |
| `/dashboard/settings` | `Disallow: /dashboard` + `<meta name="robots" content="noindex, nofollow" />` | Engine settings, notification conduits, and database maintenance. |
| `/login` | `<meta name="robots" content="noindex, nofollow" />` | Operator gate should not be indexed on search engines. |
| `/api/*` | `Disallow: /api/` | Internal REST endpoints and telemetry sinks. |
