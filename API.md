# 📡 Crystal Heimdall — REST API & Integration Reference

<div align="center">

[![API Version](https://img.shields.io/badge/API%20Version-v1%20STABLE-10b981?style=for-the-badge&logo=openapiinitiative&logoColor=10b981&labelColor=070a0f)](https://crystal-heimdall.vercel.app/api/v1/status)
[![Endpoints](https://img.shields.io/badge/Endpoints-REST%20%2B%20VAPID-06b6d4?style=for-the-badge&logo=fastapi&logoColor=06b6d4&labelColor=070a0f)](https://crystal-heimdall.vercel.app)
[![Format](https://img.shields.io/badge/Format-JSON%20%2F%20SVG%20%2F%20RSS-f59e0b?style=for-the-badge&labelColor=070a0f)](https://crystal-heimdall.vercel.app/api/v1/status)
[![Security](https://img.shields.io/badge/Auth-HMAC--SHA256%20JWT-white?style=for-the-badge&labelColor=070a0f)](./SECURITY.md)

</div>

> **🔒 DEFENSE-GRADE OBSERVABILITY APPARATUS // CRYSTAL STUDIO LABS**  
> *Complete REST API specifications for synthetic health probes, dead-man heartbeats, W3C Web Push alerts, dynamic SVG badges, and privileged operator commands.*

---

## 1. Authentication & Security Model

Crystal Heimdall enforces strict perimeter separation:

1. **Public Read Endpoints:** Open to status dashboards and external monitors (`GET /api/v1/status`, `GET /api/v1/incidents`, `GET /api/v1/badge/:id.svg`, `GET /api/v1/rss`).
2. **Service Reporting Tokens:** Monitored worker nodes authenticate using isolated bearer keys:
   ```http
   Authorization: Bearer svc-key-xxxxxxxxxxxx
   ```
3. **Privileged Operator Endpoints:** Operator commands require signed JWT tokens obtained via the 2FA-Only login gate (`POST /api/v1/auth/login`).

---

## 2. Public Status & Incident Endpoints

### `GET /api/v1/status`
Retrieves public status summary, overall fleet uptime percentage, and active monitored services.
* **Access:** Public
* **Response Body (`200 OK`):**
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
        "latency_ms": 38,
        "uptime": 99.98,
        "is_public": 1,
        "group_name": "Production"
      }
    ]
  }
  ```

### `GET /api/v1/incidents`
Lists historical incidents with search query, severity, and status filtering.
* **Access:** Public
* **Query Parameters:**
  * `search` (string) — Filter by incident title or impact summary
  * `status` (string) — `investigating`, `identified`, `monitoring`, `resolved`
  * `severity` (string) — `critical`, `warning`, `info`

### `GET /api/v1/incidents/:id`
Retrieves single incident details, chronological update steps, and affected monitor tags.
* **Access:** Public

---

## 3. W3C Closed-Browser Web Push Endpoints

### `GET /api/v1/push/vapid-public-key`
Retrieves the active RFC 8292 VAPID public key required by browsers to arm `pushManager.subscribe()`.
* **Access:** Public
* **Response Body (`200 OK`):**
  ```json
  {
    "publicKey": "BNvX8kPz...base64url..."
  }
  ```

### `POST /api/v1/push/subscribe`
Registers a client browser's push subscription endpoint and cryptographic keys.
* **Access:** Public
* **Request Body:**
  ```json
  {
    "subscription": {
      "endpoint": "https://fcm.googleapis.com/fcm/send/...",
      "keys": {
        "p256dh": "BNc...base64...",
        "auth": "A8s...base64..."
      }
    }
  }
  ```
* **Response Body (`200 OK`):**
  ```json
  {
    "status": "subscribed",
    "message": "Web Push alerts active on this device"
  }
  ```

### `POST /api/v1/push/test`
Dispatches an immediate high-priority test notification to all registered push devices.
* **Access:** Operator JWT

---

## 4. Inbound Telemetry & Dead-Man Heartbeats

### `POST /api/v1/ping/:key`
Dead-man cron heartbeat receiver. Call at the start or completion of background jobs, database dumps, and ML training pipelines.
* **Access:** Service API Key in path
* **Request Body (Optional):**
  ```json
  {
    "status": "healthy",
    "job": "nightly-backup",
    "memoryUsageMb": 128
  }
  ```
* **Response Body (`200 OK`):**
  ```json
  {
    "status": "recorded",
    "service": "Nightly Database Backup Cron",
    "pingRecordedAt": "2026-11-08T22:30:00.000Z"
  }
  ```

### `POST /api/v1/telemetry/errors`
Passive Sentry-compatible crash telemetry sink for runtime exceptions.
* **Access:** Service API Key or Local Network
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

## 5. Dynamic SVG Shields & RSS Feeds

### `GET /api/v1/badge/overall.svg`
Generates a dynamic SVG availability shield for the entire fleet.
* **Access:** Public
* **Content-Type:** `image/svg+xml`
* **Query Parameters:** `?style=flat|pill`, `?label=Uptime`

### `GET /api/v1/badge/:serviceId.svg`
Generates an SVG shield for a specific monitored service.
* **Access:** Public
* **Content-Type:** `image/svg+xml`

### `GET /api/v1/rss`
Standard RSS 2.0 XML incident feed for RSS readers, Slack bots, and notification syndication.
* **Access:** Public
* **Content-Type:** `application/rss+xml`

---

## 6. Privileged Operator Commands (Operator JWT Required)

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/auth/login` | `POST` | Authenticates operator using 6-digit RFC 6238 TOTP code. |
| `/api/v1/services` | `POST` | Creates a new synthetic prober or dead-man heartbeat monitor. |
| `/api/v1/services/:id` | `PUT` | Updates monitor intervals, target URLs, port numbers, or tags. |
| `/api/v1/services/:id` | `DELETE` | Removes monitor target from active prober fleet. |
| `/api/v1/services/:id/probe` | `POST` | Triggers immediate on-demand synthetic check (`[ PING NOW ]`). |
| `/api/v1/services/batch` | `POST` | Executes atomic pause, resume, or tagging across multiple services. |
| `/api/v1/incidents` | `POST` | Manually declares a new incident with severity and affected targets. |
| `/api/v1/incidents/:id/updates` | `POST` | Appends chronological incident update note (`investigating` → `resolved`). |
| `/api/v1/status/settings` | `POST` | Updates global engine settings, alert conduits, and announcement banners. |
| `/api/v1/status/purge-data` | `POST` | Prunes telemetry points older than retention SLA or vacuums database. |
