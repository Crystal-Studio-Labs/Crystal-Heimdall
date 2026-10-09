# 📡 Crystal Heimdall — REST API & Integration Reference

> **🔒 CLASSIFICATION: PROPRIETARY & CONFIDENTIAL // FOR INTERNAL USE ONLY**  
> **PROPERTY OF CRYSTAL STUDIO LABS — ALL RIGHTS RESERVED.**  
> *Internal API reference for microservice integrations and administrative telemetry within Crystal Studio Labs.*

---

## 1. Authentication & Security Model

Crystal Heimdall separates public status reads from privileged operator writes:

1. **Public Read Endpoints:** Open to all clients (`/api/v1/status`, `/api/v1/incidents`).
2. **Service Reporting Tokens:** Monitored microservices authenticate using their target API key:
   ```http
   Authorization: Bearer svc-key-xxxxxxxxxxxx
   ```
3. **Operator Deck Endpoints:** Operator commands require signed JWT tokens obtained via the 2FA-Only login gate (`POST /api/v1/auth/login`).

---

## 2. Public Status & Incident Endpoints

### `GET /api/v1/status`
Retrieves public status summary, overall fleet health, and active public services.
* **Access:** Public
* **Response:**
  ```json
  {
    "overallStatus": "operational",
    "avgUptime": 99.98,
    "services": [
      {
        "id": "svc-1",
        "name": "Crystal Auth Gateway",
        "type": "http-poll",
        "status": "healthy",
        "latency_ms": 142,
        "uptime": 99.95,
        "is_public": 1
      }
    ]
  }
  ```

### `GET /api/v1/incidents`
Lists historical incidents with support for query, severity, and status filtering.
* **Access:** Public
* **Query Parameters:** `search`, `status` (`investigating`, `acknowledged`, `resolved`), `severity` (`critical`, `warning`, `info`).

### `GET /api/v1/incidents/:id`
Retrieves individual incident detail, chronological timeline, and raw stack telemetry.
* **Access:** Public

---

## 3. Inbound Telemetry & Service Reporting (Private)

### `POST /api/v1/alerts`
Inbound exception ingestion for monitored targets. Automatically groups matching alerts within a 15-minute sliding window.
* **Access:** Service API Key (`Authorization: Bearer svc-key-...`)
* **Request Body:**
  ```json
  {
    "severity": "critical",
    "title": "Database Connection Pool Exhaustion",
    "message": "Timed out after 5000ms acquiring client from pool",
    "stack_trace": "Error: PoolTimeout\n    at Pool.connect (/app/db.js:42:15)",
    "fingerprint": "db_pool_timeout_worker_01"
  }
  ```
* **Response:** `200 OK` with status `dispatched` or `suppressed_duplicate`.

### `GET /api/v1/ping/:key`
Dead-man cron heartbeat ping for internal backup and batch daemons.
* **Access:** Service API Key in URL path
* **Response:**
  ```json
  {
    "status": "recorded",
    "service": "Internal Nightly Backup Cron",
    "pingRecordedAt": "2026-10-10T01:45:00.000Z"
  }
  ```

### `POST /api/v1/telemetry/errors`
Passive Sentry-compatible crash telemetry sink for unhandled exceptions across internal services.
* **Access:** Internal Service API Key or Local Network
* **Request Body:**
  ```json
  {
    "project": "Crystal-Payment-Worker",
    "error_type": "FatalStripeWebhookMismatch",
    "level": "fatal",
    "message": "Signature verification failed",
    "stack_trace": "FatalStripeWebhookMismatch\n    at verify (stripe.ts:42:11)",
    "environment": "production"
  }
  ```

---

## 4. Operator Deck & Engine Endpoints (Restricted)

### `POST /api/v1/auth/login`
2FA-Only operator authentication gate (RFC 6238 TOTP).
* **Request Body:** `{ "code": "123456" }`
* **Response:** `{ "token": "jwt-token-string", "expiresIn": 86400 }`

### `POST /api/v1/services`
Registers a new monitored target in the sentinel fleet.
* **Access:** Operator JWT

### `POST /api/v1/services/:id/probe`
Triggers an immediate synthetic probe for a specific target (`[ PING NOW ]`).
* **Access:** Operator JWT

### `POST /api/v1/status/settings`
Updates Uptime Kuma advanced engine parameters, poll intervals, SSL validation flags, and announcement banners.
* **Access:** Operator JWT

### `POST /api/v1/status/purge-data`
Executes database maintenance operations:
* **Actions:** `purge_incidents`, `prune_telemetry`, or `vacuum`.
* **Access:** Operator JWT
