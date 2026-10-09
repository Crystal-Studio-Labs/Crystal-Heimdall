# 🏛️ Crystal Heimdall — Architecture & System Design

> **🔒 CLASSIFICATION: PROPRIETARY & CONFIDENTIAL // FOR INTERNAL USE ONLY**  
> **PROPERTY OF CRYSTAL STUDIO LABS — ALL RIGHTS RESERVED.**  
> *Architectural reference and subsystem topology for Crystal Studio Labs internal engineering.*

---

## 1. System Topology Overview

Crystal Heimdall serves as the central reliability sentinel for all internal microservices, workers, APIs, and batch cron tasks across Crystal Studio Labs.

```mermaid
graph TD
    subgraph Private Network [Internal Microservices & Daemons]
        AuthSvc[Crystal Auth Gateway] -->|Passive Sentry Telemetry| Sink[POST /api/v1/telemetry/errors]
        ApiSvc[Crystal Studio Labs API] -->|Active Synthetic Probing| Poller[Synthetic Poller Loop]
        CronSvc[Nightly Backup Cron] -->|Dead-Man Heartbeat| Heartbeat[GET /api/v1/ping/:key]
    end

    subgraph Core Engine [Crystal Heimdall Core]
        Poller --> Dedup[15m Sliding Deduplication Window]
        Sink --> Dedup
        Heartbeat --> Dedup
        Dedup --> DB[(LibSQL / SQLite Database)]
        DB --> Dispatcher[Discord & Telegram Conduits]
    end

    subgraph Client Surfaces [Frontend Interfaces]
        DB --> PublicUI[Public Status Page & Incidents]
        DB --> PrivUI[Protected Operator Console / Dashboard]
    end
```

---

## 2. Core Subsystems

### A. Dual-Engine Observability Matrix
1. **Active Synthetic HTTP/HTTPS Prober:**
   * Periodically checks endpoint availability (configurable 10s–300s).
   * Measures precise DNS, TCP, and TLS round-trip latencies.
   * Compares HTTP status codes against accepted response lists (e.g., `200, 201, 204`).
2. **Inverted "Dead-Man's Snitch" Cron Poller:**
   * For background batch tasks and nightly database backups that cannot be directly queried.
   * Expects pings at specified intervals. Triggers an incident if the heartbeat is overdue.

### B. Passive Crash Sentinel & Telemetry Sink
* Compatible with standard error loggers and Sentry-style clients (`POST /api/v1/telemetry/errors`).
* Automatically extracts stack traces, normalizes error signatures, generates automated fingerprints, and tracks occurrence counts without third-party cloud data leakage.

### C. 15-Minute Sliding Window Deduplication
* Prevents alert storms during cascading service outages.
* Groups recurring failures under an existing incident record within a 15-minute window while silently incrementing event counters.

### D. Multi-Period SLA Availability Matrix
* Maintains rolling availability percentages for 24-Hour, 7-Day, and 30-Day windows.
* Computes latency percentiles (P50, P95, P99) and Mean Time to Recovery (MTTR).

---

## 3. Database Schema (LibSQL / SQLite)

The embedded LibSQL database (`data/heimdall.db`) stores configuration and state in four optimized tables:

1. **`services`**: Monitored endpoints, check types, poll intervals, status (`healthy`, `degraded`, `down`, `maintenance`), and isolated API keys.
2. **`incidents`**: Identified outages, severity (`info`, `warning`, `critical`), triage state (`investigating`, `acknowledged`, `resolved`), and resolution timestamps.
3. **`telemetry_pings`**: Time-series log of all synthetic probes and response times for SLA graphing.
4. **`status_settings`**: Configurable branding, announcement banners, SLA toggles, and engine tuning.
5. **`error_issues`**: Passive crash reports with stack traces, environment tags, and triage status.

---

## 4. Industrial Brutalism Design Tokens

The user interface follows strict Industrial Brutalism guidelines:
* **Geometry:** `border-radius: 0px !important` across all buttons, cards, dialogs, inputs, and badges.
* **Palette:**
  * Background: Deep Tactical Void (`#070a0f` / `#08090b`).
  * Surface Panels: Hard Jet Black (`#000000`) and Obsidian (`#0b0f17`).
  * Borders: Heavy 2px–3px Zinc (`#27272a`).
  * Accents: High-voltage Emerald (`#10b981`), Cyber Cyan (`#38bdf8`), and Critical Crimson (`#ef4444`).
* **Shadows:** Hard 3D block shadows (`shadow-[4px_4px_0px_#000]`).
* **Typography:** `JetBrains Mono` and browser monospace for all diagnostic meters, headers, and telemetry logs.
