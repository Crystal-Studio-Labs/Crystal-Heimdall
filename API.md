# ⚡ Crystal Heimdall — REST API & Integration Reference

> **API Version:** `v1`  
> **Base URL:** `http://localhost:3030/api/v1` (or your deployed custom domain)  
> **Format:** JSON (`application/json; charset=utf-8`)

---

## 1. Authentication & Security

1. **Public Endpoints:** No authentication required (`GET /status`, `GET /incidents`, `GET /incidents/:id`).
2. **Service Scoped Endpoints:** Authenticated via Bearer token (`Authorization: Bearer <service_api_key>`) or path key (`/ping/:key`).
3. **Operator Command Endpoints:** Protected by operator session token issued upon 6-digit TOTP verification (`/api/v1/auth/verify-2fa`).

---

## 2. Status & Public Endpoints

### 2.1 Get Fleet Status
```http
GET /api/v1/status
```
Returns overall operational state, publicly visible targets, 30-day uptime bars, and active maintenance announcements.

**Response (200 OK):**
```json
{
  "overallStatus": "operational",
  "avgUptime": 99.88,
  "services": [
    {
      "id": "svc-781",
      "name": "Crystal Auth Gateway",
      "type": "http-poll",
      "status": "healthy",
      "latency_ms": 248,
      "uptime_pct": 100.0,
      "is_maintenance": 0,
      "historyBlocks": [
        { "day": "2026-10-09", "status": "healthy", "uptime": 100 }
      ]
    }
  ],
  "recentIncidents": [],
  "settings": {
    "page_title": "Crystal Heimdall",
    "page_description": "Continuous Multi-Point Health Monitoring",
    "announcement_banner": "All systems nominal across all regions.",
    "announcement_type": "info",
    "show_sla": true,
    "show_incidents": true,
    "footer_text": "Crystal Studio Labs • Autonomous Reliability Sentinel"
  },
  "lastUpdated": 1791574000000
}
```

---

### 2.2 Get Incident History
```http
GET /api/v1/incidents
```
Returns the list of historical incidents ordered by most recent activity.

**Response (200 OK):**
```json
{
  "incidents": [
    {
      "id": "inc-mv1df5ap",
      "service_id": "svc-781",
      "service_name": "Crystal Auth Gateway",
      "title": "Synthetic Probe Threshold Violation",
      "message": "Endpoint returned HTTP 503 Service Unavailable",
      "severity": "critical",
      "status": "resolved",
      "count": 1,
      "created_at": 1791573900000,
      "last_seen_at": 1791574200000,
      "resolved_at": 1791574300000
    }
  ]
}
```

---

### 2.3 Get Single Incident
```http
GET /api/v1/incidents/:id
```
Returns a single incident record with associated service metadata and timestamps.

**Response (200 OK):**
```json
{
  "incident": {
    "id": "inc-mv1df5ap",
    "service_id": "svc-781",
    "service_name": "Crystal Auth Gateway",
    "service_type": "http-poll",
    "service_endpoint": "https://auth.crystalstudio.labs/health",
    "title": "Synthetic Probe Threshold Violation",
    "message": "Endpoint returned HTTP 503 Service Unavailable",
    "severity": "critical",
    "status": "resolved",
    "count": 1,
    "created_at": 1791573900000,
    "last_seen_at": 1791574200000,
    "resolved_at": 1791574300000
  }
}
```

---

## 3. Ingestion & Heartbeat Sinks

### 3.1 Ingest Unhandled Exception
```http
POST /api/v1/alerts
Authorization: Bearer <service_api_key>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Unhandled Database Connection Error",
  "message": "Pool timeout after 5000ms acquiring client connection.",
  "severity": "critical",
  "stack_trace": "Error: Pool timeout\n    at Pool.connect (/app/db.js:42:15)"
}
```

**Response (200 OK):**
```json
{
  "status": "dispatched",
  "incidentId": "inc-mv1df5ap",
  "duplicateSuppressed": false
}
```

---

### 3.2 Dead-Man's Switch Cron Heartbeat
```http
GET /api/v1/ping/:api_key
```

Signals nominal completion of a background cron job. Resets failure countdown and auto-resolves any open missed-heartbeat incident for the service.

**Response (200 OK):**
```json
{
  "status": "ok",
  "service": "Internal Nightly Backup Cron",
  "type": "deadman-cron",
  "pingRecordedAt": "2026-10-10T00:45:00.000Z"
}
```

---

### 3.3 Sentry-Style Crash Sink
```http
POST /api/v1/telemetry/errors
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "ReferenceError: window is not defined",
  "message": "Attempted to access window during server-side execution",
  "stack_trace": "ReferenceError: window is not defined\n    at render (/app/src/entry.js:12:3)",
  "severity": "error"
}
```

**Response (200 OK):**
```json
{
  "status": "created",
  "id": "err-dp9mfu6",
  "count": 1
}
```

---

## 4. Operator Endpoints (Command & Control)

### 4.1 Trigger Instant Probe
```http
POST /api/v1/services/:id/probe
```
Immediately dispatches a synthetic probe to a single target service and records response telemetry.

**Response (200 OK):**
```json
{
  "id": "svc-781",
  "name": "Crystal Auth Gateway",
  "isHealthy": true,
  "statusCode": 200,
  "latency_ms": 248,
  "probedAt": "2026-10-10T00:45:10.000Z"
}
```

---

### 4.2 Query Multi-Period SLA Analytics
```http
GET /api/v1/analytics?timeframe=24h&service_id=<optional_id>
```

**Response (200 OK):**
```json
{
  "selectedServiceId": null,
  "allServices": [
    { "id": "svc-781", "name": "Crystal Auth Gateway", "type": "http-poll" }
  ],
  "monitorsBreakdown": [
    {
      "id": "svc-781",
      "name": "Crystal Auth Gateway",
      "type": "http-poll",
      "status": "healthy",
      "uptime24h": 100.0,
      "uptime7d": 99.95,
      "uptime30d": 99.98,
      "currentLatency": 248,
      "avgLatency": 252,
      "checksCount24h": 380
    }
  ],
  "percentiles": {
    "p50": 248,
    "p95": 412,
    "p99": 850
  },
  "mttrMinutes": 1,
  "totalChecks24h": 380
}
```

---

### 4.3 Database Maintenance & Pruning
```http
POST /api/v1/status/purge-data
Content-Type: application/json

{
  "action": "vacuum" // "purge_resolved_incidents" | "prune_telemetry" | "vacuum"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Telemetry database optimized & synchronized."
}
```
