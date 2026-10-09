# 🗺️ Crystal Heimdall — Route Catalog, Sitemap & SEO Indexation Policy

> **🔒 CLASSIFICATION: PROPRIETARY & CONFIDENTIAL // FOR INTERNAL USE ONLY**  
> **PROPERTY OF CRYSTAL STUDIO LABS — ALL RIGHTS RESERVED.**  
> *Sitemap specifications and search crawler policy for Crystal Heimdall.*

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
    PublicZone --> P5["/docs (Developer Guide)"]
    
    PrivateZone --> PR1["/dashboard (Command Deck)"]
    PrivateZone --> PR2["/dashboard/analytics (SLA Matrix)"]
    PrivateZone --> PR3["/dashboard/settings (Engine Config)"]
    PrivateZone --> PR4["/login (2FA Gate)"]
    PrivateZone --> PR5["/api/* (Internal APIs)"]
```

---

## 2. Public Route Catalog (Included in `sitemap.xml`)

| Path | Change Frequency | Priority | Description |
|---|---|---|---|
| `/` | `always` | `1.0` | Live status page with heartbeat ribbons, active announcements, and fleet metrics. |
| `/overview` | `weekly` | `0.8` | Platform capabilities and Industrial Brutalism design architecture. |
| `/incidents` | `hourly` | `0.9` | Public incident ledger with search, severity filters, and MTTR counters. |
| `/docs` | `monthly` | `0.7` | Developer API reference and client integration code snippets. |
| `/login` | `yearly` | `0.3` | 2FA-Only operator login gate (present for navigational completeness). |

The XML sitemap is served directly from:
* Endpoint: `GET /sitemap.xml`
* File Source: [`client/public/sitemap.xml`](file:///d:/Projects/Crystal-Heimdall/client/public/sitemap.xml)

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

Web crawler directives are defined in [`client/public/robots.txt`](file:///d:/Projects/Crystal-Heimdall/client/public/robots.txt):
```txt
User-agent: *
Allow: /
Allow: /overview
Allow: /incidents
Allow: /docs
Disallow: /dashboard
Disallow: /dashboard/
Disallow: /api/
Disallow: /api/*

Sitemap: http://localhost:3030/sitemap.xml
```

---

## 4. Open Graph & Social Card Assets

Every public page dynamically injects rich preview metadata:
* **Image Asset:** High-resolution preview at [`/og-image.png`](file:///d:/Projects/Crystal-Heimdall/client/public/og-image.png) (1200×630) and scalable vector graphic at [`/og-image.svg`](file:///d:/Projects/Crystal-Heimdall/client/public/og-image.svg).
* **Twitter Card:** Set to `summary_large_image`.
* **Schema.org JSON-LD:** Structured data for `SoftwareApplication` and `WebSite` included automatically via [`client/src/components/SEO.tsx`](file:///d:/Projects/Crystal-Heimdall/client/src/components/SEO.tsx).
