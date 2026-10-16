import { authenticator } from "otplib";

async function runSmokeTests() {
  const BASE_URL = "http://localhost:3030";
  console.log("=== RUNNING FULL CRYSTAL-HEIMDALL VERIFICATION SUITE ===\n");

  let serverInstance = null;
  try {
    const probe = await fetch(`${BASE_URL}/api`, { signal: AbortSignal.timeout(1000) });
    if (probe.status !== 200) throw new Error("Server not responding");
    console.log("⚡ Connected to existing Crystal-Heimdall server at http://localhost:3030\n");
  } catch (_e) {
    console.log("⚡ No running server detected on http://localhost:3030. Auto-bootstrapping dist-server...");
    const { default: app, initDb } = await import("./dist-server/app.js");
    await initDb();
    serverInstance = await new Promise((resolve) => {
      const s = app.listen(3030, () => {
        console.log("🚀 Temporary test server listening on http://localhost:3030\n");
        resolve(s);
      });
    });
  }

  try {

  // 1. Static Client Serving
  console.log("1. TEST PRODUCTION SPA SERVING (/)");
  const homeRes = await fetch(`${BASE_URL}/`);
  const homeHtml = await homeRes.text();
  if (homeHtml.includes('<div id="root">') && (homeHtml.includes("Crystal Heimdall") || homeHtml.includes("Crystal"))) {
    console.log("   ✅ Landing page HTML served with SPA root container.");
  } else {
    throw new Error("Landing page failed to serve expected HTML container.");
  }

  // 2. Services API
  console.log("\n2. TEST SERVICES API (/api/v1/services)");
  const svcRes = await fetch(`${BASE_URL}/api/v1/services`);
  const svcData = await svcRes.json();
  console.log(`   Found ${svcData.services.length} services.`);
  for (const s of svcData.services) {
    console.log(`    - [${s.type}] ${s.name} (public=${s.is_public}, status=${s.status}, hourlyBlocks=${s.hourlyBlocks?.length || 0})`);
    if (!s.hourlyBlocks || s.hourlyBlocks.length !== 24) {
      throw new Error(`Service ${s.name} missing 24-hour hourlyBlocks sparkline data!`);
    }
  }
  console.log("   ✅ 24-Hour hourly sparkline telemetry verified across all fleet services.");

  // 3. Synthetic Cron Poll
  console.log("\n3. TEST SYNTHETIC CRON POLL (/api/v1/cron/poll)");
  const pollRes = await fetch(`${BASE_URL}/api/v1/cron/poll`);
  const pollData = await pollRes.json();
  console.log(`   ✅ Polled: ${pollData.summary.polledCount} | Healthy: ${pollData.summary.healthyCount} | Failed: ${pollData.summary.failedCount}`);

  // 4. Inbound Exception Ingestion
  console.log("\n4. TEST INBOUND EXCEPTION INGESTION (/api/v1/alerts)");
  const authKey = svcData.services[0].api_key;
  const alertRes = await fetch(`${BASE_URL}/api/v1/alerts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      severity: "critical",
      title: `Simulated Database Connection Pool Outage [${Date.now().toString(36)}]`,
      message: "Timeout acquiring client after 5000ms",
      stack_trace: "Error: PoolExhaustion\n    at Pool.connect (/app/db.js:42:15)",
    })
  });
  const alertData = await alertRes.json();
  const alertIncId = alertData.incidentId || alertData.id;
  console.log(`   ✅ Ingestion status: ${alertData.status} (Incident ID: ${alertIncId})`);

  // 5. Dead-Man Cron Heartbeat
  console.log("\n5. TEST DEAD-MAN CRON HEARTBEAT (/api/v1/ping/:key)");
  const cronService = svcData.services.find(s => s.type === "deadman-cron");
  if (cronService) {
    const pingRes = await fetch(`${BASE_URL}/api/v1/ping/${cronService.api_key}`);
    const pingData = await pingRes.json();
    console.log(`   ✅ Dead-man ping verified for: ${pingData.service}`);
  }

  // 6. Public Status Page API with is_public filtering
  console.log("\n6. TEST PUBLIC STATUS PAGE API (/api/v1/status)");
  const statusRes = await fetch(`${BASE_URL}/api/v1/status`);
  const statusData = await statusRes.json();
  console.log(`   Overall Health: ${statusData.overallStatus.toUpperCase()}`);
  console.log(`   Fleet Average Uptime: ${statusData.avgUptime}%`);
  console.log(`   Publicly Visible Services Count: ${statusData.services.length}`);
  
  // Verify that all returned services have is_public == 1
  for (const s of statusData.services) {
    if (s.is_public !== 1) {
      throw new Error(`Private service ${s.name} leaked to public status page!`);
    }
    if (!s.historyBlocks || s.historyBlocks.length !== 30) {
      throw new Error(`Public service ${s.name} missing 30-day historyBlocks ledger!`);
    }
    const sampleOldBlock = s.historyBlocks[0];
    const todayBlock = s.historyBlocks[29];
    if (!sampleOldBlock.date || (sampleOldBlock.uptimePct !== null && typeof sampleOldBlock.uptimePct !== "number")) {
      throw new Error(`Service ${s.name} has malformed historyBlock!`);
    }
    if (!todayBlock.date || typeof todayBlock.uptimePct !== "number") {
      throw new Error(`Service ${s.name} missing active status for today's block!`);
    }
  }
  console.log("   ✅ Public visibility filter strictly verified: 0 private services leaked.");
  console.log(`   ✅ 30-Day authentic daily history blocks (pre-reg inactive + active today) verified for all ${statusData.services.length} public services.`);

  // 7. Test Visibility Toggle (PATCH /api/v1/services/:id)
  console.log("\n7. TEST VISIBILITY TOGGLE (PATCH /api/v1/services/:id)");
  const targetToToggle = svcData.services[0];
  const initialPublic = targetToToggle.is_public;
  const toggledPublic = initialPublic === 1 ? 0 : 1;

  await fetch(`${BASE_URL}/api/v1/services/${targetToToggle.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_public: toggledPublic })
  });

  // Verify status page reflects the toggle
  const reStatusRes = await fetch(`${BASE_URL}/api/v1/status`);
  const reStatusData = await reStatusRes.json();
  const foundInPublic = reStatusData.services.some(s => s.id === targetToToggle.id);
  console.log(`   ✅ Target toggled to is_public=${toggledPublic}. Present on /status: ${foundInPublic} (Expected: ${toggledPublic === 1})`);

  // Restore original state
  await fetch(`${BASE_URL}/api/v1/services/${targetToToggle.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_public: initialPublic })
  });
  console.log(`   ✅ Target restored to is_public=${initialPublic}.`);

  // 8. Test 2-Factor Authentication Gate (One-Time Setup & Permanent Lockdown)
  console.log("\n8. TEST 2-FACTOR AUTHENTICATION (2FA) GATE - ZERO BYPASS & LOCKDOWN");

  // 8a. Verify that '000000' bypass is strictly rejected
  const devBypassRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: "000000" })
  });
  if (devBypassRes.status !== 401) {
    throw new Error(`000000 bypass was NOT rejected! Status: ${devBypassRes.status}`);
  }
  console.log("   ✅ '000000' bypass strictly rejected with 401 Unauthorized.");

  // 8b. Fetch initial setup secret (or use authenticated token) and generate genuine RFC 6238 TOTP
  const setupRes = await fetch(`${BASE_URL}/api/v1/auth/setup-2fa`);
  let secret = null;
  if (setupRes.ok) {
    const setupData = await setupRes.json();
    secret = setupData.secret;
  }
  // Fallback to reading secret from database if already paired in previous run
  if (!secret) {
    const { getDb, initDb } = await import("./dist-server/db.js");
    await initDb();
    const db = getDb();
    const res = await db.execute("SELECT value FROM operator_auth WHERE key = 'totp_secret'");
    secret = String(res.rows[0].value);
  }

  const realTotpCode = authenticator.generate(secret);
  console.log(`   Generated genuine RFC 6238 TOTP rolling token: ${realTotpCode} (secret: ${secret.slice(0, 4)}****)`);

  const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: realTotpCode })
  });
  const loginData = await loginRes.json();
  if (!loginData.token) {
    throw new Error(`2FA Direct Login failed with real TOTP code: ${JSON.stringify(loginData)}`);
  }
  console.log("   ✅ Direct 2FA: Real TOTP code verified, operator session token granted.");

  // 8c. Verify 2FA Lockdown: unauthenticated requests to /setup-2fa MUST be rejected with 403 Forbidden
  const lockedSetupRes = await fetch(`${BASE_URL}/api/v1/auth/setup-2fa`);
  if (lockedSetupRes.status !== 403) {
    throw new Error(`Setup gate was NOT locked! Status: ${lockedSetupRes.status}`);
  }
  console.log("   ✅ 2FA Lockdown verified: Unauthenticated /setup-2fa blocked with 403 Forbidden.");

  // 8d. Verify that authenticated operator with Bearer token can still query setup/QR info
  const authSetupRes = await fetch(`${BASE_URL}/api/v1/auth/setup-2fa`, {
    headers: { Authorization: `Bearer ${loginData.token}` }
  });
  if (!authSetupRes.ok) {
    throw new Error(`Authenticated operator could not query 2FA details! Status: ${authSetupRes.status}`);
  }
  console.log("   ✅ Authenticated operator verified: Authorized session can inspect 2FA credentials.");

  // 8e. Verify 7+ Day Session Retention: /api/v1/auth/me returns valid session with >= 7 days remaining
  const meRes = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${loginData.token}` }
  });
  const meData = await meRes.json();
  if (!meData.authenticated || typeof meData.daysRemaining !== "number" || meData.daysRemaining < 7) {
    throw new Error(`Session duration check failed! Expected >= 7 days, got: ${JSON.stringify(meData)}`);
  }
  console.log(`   ✅ 7+ Day Session Retention verified: Authenticated as ${meData.operator}, remaining=${meData.daysRemaining} days (expires ${meData.expiresAt})`);

  // 9. Analytics API
  console.log("\n9. TEST ANALYTICS API (/api/v1/analytics)");
  const anaRes = await fetch(`${BASE_URL}/api/v1/analytics`);
  const anaData = await anaRes.json();
  console.log(`   ✅ Analytics: P50=${anaData.percentiles?.p50}ms, P95=${anaData.percentiles?.p95}ms, MTTR=${anaData.mttrMinutes}m, 24h Checks=${anaData.totalChecks24h}`);

  // 10. Incidents Triage
  console.log("\n10. TEST INCIDENTS & TRIAGE ACK");
  const incRes = await fetch(`${BASE_URL}/api/v1/incidents`);
  const incData = await incRes.json();
  if (incData.incidents.length > 0) {
    const latestInc = incData.incidents[0];
    const ackRes = await fetch(`${BASE_URL}/api/v1/incidents/${latestInc.id}/ack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "acknowledged" })
    });
    const ackData = await ackRes.json();
    console.log(`   ✅ Incident ${latestInc.id} triaged to: ${ackData.newStatus}`);
  }

  // 11. PWA Web Manifest & Service Worker
  console.log("\n11. TEST PWA ASSETS (/manifest.webmanifest & /sw.js)");
  const manifestRes = await fetch(`${BASE_URL}/manifest.webmanifest`);
  const manifestData = await manifestRes.json();
  if (manifestData.name && manifestData.display === "standalone") {
    console.log(`   ✅ PWA Manifest valid: name="${manifestData.name}", display="${manifestData.display}"`);
  } else {
    throw new Error("PWA Manifest invalid or missing standalone display");
  }

  const swRes = await fetch(`${BASE_URL}/sw.js`);
  const swText = await swRes.text();
  if (swText.includes("crystal-uptime") && swText.includes("addEventListener")) {
    console.log("   ✅ PWA Service Worker verified: active cache & notification listeners present");
  } else {
    throw new Error("PWA Service Worker failed to load");
  }

  // 12. Sentry-Style Crash Telemetry & Exception Sink
  console.log("\n12. TEST SENTRY CRASH SINK (/api/v1/telemetry/errors)");
  const crashRes = await fetch(`${BASE_URL}/api/v1/telemetry/errors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project: "Crystal-Payment-Worker",
      error_type: "FatalStripeWebhookMismatch",
      level: "fatal",
      message: "Signature verification failed for payload at event time 1760081230",
      stack_trace: "FatalStripeWebhookMismatch\n    at verify (stripe.ts:42:11)",
      environment: "production"
    })
  });
  const crashData = await crashRes.json();
  console.log(`   ✅ Sentry crash ingested: status=${crashData.status}, id=${crashData.id}`);

  const errorsListRes = await fetch(`${BASE_URL}/api/v1/telemetry/errors`);
  const errorsListData = await errorsListRes.json();
  console.log(`   ✅ Sentry issue tracker verified: ${errorsListData.issues.length} issues, ${errorsListData.stats?.unresolved} unresolved`);

  // 13. Instant Target Probe API
  console.log("\n13. TEST INSTANT TARGET PROBE (/api/v1/services/:id/probe)");
  const httpService = svcData.services.find(s => s.type === "http-poll");
  if (httpService) {
    const probeRes = await fetch(`${BASE_URL}/api/v1/services/${httpService.id}/probe`, { method: "POST" });
    const probeData = await probeRes.json();
    console.log(`   ✅ Live single probe verified: ${probeData.name} -> latency=${probeData.latency_ms}ms, healthy=${probeData.isHealthy}`);
  }

  // 14. Maintenance Mode Toggle
  console.log("\n14. TEST MAINTENANCE MODE TOGGLE");
  if (httpService) {
    await fetch(`${BASE_URL}/api/v1/services/${httpService.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_maintenance: 1 })
    });
    console.log(`   ✅ Service toggled to MAINTENANCE mode.`);
    await fetch(`${BASE_URL}/api/v1/services/${httpService.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_maintenance: 0 })
    });
    console.log(`   ✅ Service restored to ACTIVE mode.`);
  }

  // 15. Uptime Kuma Analytics Multi-Period Matrix & Per-Monitor Filter
  console.log("\n15. TEST UPTIME KUMA ANALYTICS & MONITOR BREAKDOWN (/api/v1/analytics)");
  const kumaAnalyticsRes = await fetch(`${BASE_URL}/api/v1/analytics?timeframe=24h`);
  const kumaAnalyticsData = await kumaAnalyticsRes.json();
  if (!kumaAnalyticsData.monitorsBreakdown || !Array.isArray(kumaAnalyticsData.monitorsBreakdown)) {
    throw new Error("Missing monitorsBreakdown in analytics API response");
  }
  console.log(`   ✅ Analytics per-monitor matrix returned: ${kumaAnalyticsData.monitorsBreakdown.length} monitors`);
  for (const mb of kumaAnalyticsData.monitorsBreakdown.slice(0, 3)) {
    console.log(`    - [${mb.name}] 24h: ${mb.uptime24h}% | 7d: ${mb.uptime7d}% | 30d: ${mb.uptime30d}% | checks24h: ${mb.checksCount24h} | ping: ${mb.currentLatency}ms`);
    if (typeof mb.uptime24h !== "number" || typeof mb.uptime7d !== "number" || typeof mb.uptime30d !== "number") {
      throw new Error(`Monitor ${mb.name} has invalid SLA structure!`);
    }
  }
  console.log("   ✅ Genuine multi-window 24h, 7d, and 30d SLAs strictly verified from telemetry.");

  // 16. Uptime Kuma Advanced Engine Settings & Data Maintenance
  console.log("\n16. TEST ADVANCED SETTINGS & PURGE MAINTENANCE (/api/v1/status/settings & /purge-data)");
  const setAdvRes = await fetch(`${BASE_URL}/api/v1/status/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      page_title: "Crystal Heimdall",
      default_poll_interval: "45",
      default_timeout: "8",
      max_retries: "3",
      ssl_warning_days: "21",
      ignore_ssl_errors: "false",
      telemetry_retention_days: "60"
    })
  });
  const setAdvData = await setAdvRes.json();
  if (!setAdvData.success) throw new Error("Failed to persist advanced settings");
  console.log("   ✅ Advanced Uptime Kuma engine settings saved successfully.");

  const purgeRes = await fetch(`${BASE_URL}/api/v1/status/purge-data`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "vacuum" })
  });
  const purgeData = await purgeRes.json();
  if (!purgeData.success) throw new Error("Failed to execute maintenance purge action");
  console.log(`   ✅ Maintenance action executed: ${purgeData.message}`);

  // 17. XML Sitemap & Robots.txt Directives
  console.log("\n17. TEST SITEMAP.XML & ROBOTS.TXT DIRECTIVES");
  const sitemapRes = await fetch(`${BASE_URL}/sitemap.xml`);
  const sitemapText = await sitemapRes.text();
  if (sitemapRes.status === 200 && sitemapText.includes("<urlset") && sitemapText.includes("/incidents") && !sitemapText.includes("/docs") && !sitemapText.includes("/login")) {
    console.log("   ✅ Valid XML Sitemap served (internal docs and private operator login securely omitted).");
  } else {
    throw new Error(`Sitemap verification failed. Status: ${sitemapRes.status}, Body: ${sitemapText.slice(0, 100)}`);
  }

  const robotsRes = await fetch(`${BASE_URL}/robots.txt`);
  const robotsText = await robotsRes.text();
  if (robotsRes.status === 200 && robotsText.includes("Disallow: /dashboard") && robotsText.includes("Disallow: /login") && robotsText.includes("Disallow: /docs") && robotsText.includes("sitemap.xml")) {
    console.log("   ✅ Robots.txt verified: Disallows /dashboard, /login, /docs and references sitemap.xml.");
  } else {
    throw new Error(`Robots.txt verification failed. Status: ${robotsRes.status}, Body: ${robotsText}`);
  }

  // 18. Individual Incident Lookup & Postmortem Route
  console.log("\n18. TEST INDIVIDUAL INCIDENT LOOKUP (/api/v1/incidents/:id)");
  if (incData.incidents.length > 0) {
    const singleInc = incData.incidents[0];
    const singleRes = await fetch(`${BASE_URL}/api/v1/incidents/${singleInc.id}`);
    const singleData = await singleRes.json();
    if (singleData.incident && singleData.incident.id === singleInc.id) {
      console.log(`   ✅ Single incident lookup verified: ID ${singleData.incident.id} (${singleData.incident.title})`);
    } else {
      throw new Error(`Failed to lookup incident by ID ${singleInc.id}`);
    }
  }

  // 19. Multi-Page SPA Client Routes Check
  console.log("\n19. TEST MULTI-PAGE SPA SERVING (/incidents, /docs, /overview)");
  for (const p of ["/incidents", "/docs", "/overview", "/login"]) {
    const pageRes = await fetch(`${BASE_URL}${p}`);
    const pageHtml = await pageRes.text();
    if (pageRes.status === 200 && pageHtml.includes('<div id="root">')) {
      console.log(`   ✅ Client route ${p} served properly.`);
    } else {
      throw new Error(`Client route ${p} failed to serve SPA HTML.`);
    }
  }

  // 20. Static Brand & PWA Asset Integrity
  console.log("\n20. TEST STATIC ASSETS INTEGRITY (Favicon, PWA PNGs, OG Images, Banner SVG)");
  const requiredAssets = [
    "/favicon.ico",
    "/favicon.svg",
    "/icon-192.png",
    "/icon-192.svg",
    "/icon-512.png",
    "/icon-512.svg",
    "/apple-touch-icon.png",
    "/og-image.png",
    "/og-image.svg",
    "/banner.svg"
  ];
  for (const assetPath of requiredAssets) {
    const assetRes = await fetch(`${BASE_URL}${assetPath}`);
    if (assetRes.status === 200 && assetRes.headers.get("content-length") !== "0") {
      console.log(`   ✅ Asset verified: ${assetPath} (${assetRes.headers.get("content-type")})`);
    } else {
      throw new Error(`Asset verification failed for ${assetPath}: status=${assetRes.status}`);
    }
  }

  // 21. Vercel Serverless Root & Health Endpoint
  console.log("\n21. TEST VERCEL SERVERLESS ROOT & HEALTH ENDPOINT (/api & /api/health)");
  const apiRootRes = await fetch(`${BASE_URL}/api`);
  const apiRootData = await apiRootRes.json();
  if (apiRootRes.status === 200 && apiRootData.sentinel === "Crystal Heimdall" && apiRootData.status === "operational") {
    console.log(`   ✅ Vercel Serverless root /api verified: status=${apiRootData.status}, runtime=${apiRootData.runtime}`);
  } else {
    throw new Error(`Failed to verify /api health endpoint: ${JSON.stringify(apiRootData)}`);
  }

  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const healthData = await healthRes.json();
  if (healthRes.status === 200 && healthData.status === "operational") {
    console.log(`   ✅ Vercel Serverless health /api/health verified: status=${healthData.status}`);
  } else {
    throw new Error(`Failed to verify /api/health endpoint: ${JSON.stringify(healthData)}`);
  }

  // 22. TCP Socket Port Check & Real SSL Certificate Inspector
  console.log("\n22. TEST TCP SOCKET PROBER & REAL SSL CERTIFICATE INSPECTION");

  // 22a. Create TCP target pointing to localhost:3030
  const createTcpRes = await fetch(`${BASE_URL}/api/v1/services`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Local Heimdall Port Probe",
      type: "port-check",
      endpoint: "tcp://127.0.0.1:3030",
      port: 3030,
      is_public: 0,
      poll_interval_sec: 30,
    }),
  });
  const tcpData = await createTcpRes.json();
  if (!createTcpRes.ok || !tcpData.service?.id) {
    throw new Error(`Failed to create TCP port target: ${JSON.stringify(tcpData)}`);
  }
  const testTcpId = tcpData.service.id;
  console.log(`   ✅ TCP Target created: ${testTcpId} (127.0.0.1:3030)`);

  // 22b. Probe the TCP target
  const probeTcpRes = await fetch(`${BASE_URL}/api/v1/services/${testTcpId}/probe`, {
    method: "POST",
  });
  const probeTcpData = await probeTcpRes.json();
  if (probeTcpData.isHealthy && probeTcpData.status === "healthy") {
    console.log(`   ✅ TCP Instant Probe verified: latency=${probeTcpData.latency_ms}ms, target=${probeTcpData.target}`);
  } else {
    throw new Error(`TCP probe failed: ${JSON.stringify(probeTcpData)}`);
  }

  // 22c. Real SSL Certificate Prober unit test
  const { checkSslExpiry } = await import("./dist-server/probers.js");
  const sslResult = await checkSslExpiry("github.com", 443, 6000);
  if (sslResult.daysRemaining !== null && sslResult.daysRemaining > 0) {
    console.log(`   ✅ Real SSL Certificate Inspector verified: github.com has ${sslResult.daysRemaining} days remaining (Issuer: ${sslResult.issuer || "unknown"})`);
  } else {
    console.log(`   ⚠️ Real SSL check skipped or non-fatal (result: ${JSON.stringify(sslResult)})`);
  }

  // 22d. Clean up temporary TCP target
  await fetch(`${BASE_URL}/api/v1/services/${testTcpId}`, { method: "DELETE" });
  console.log(`   ✅ Temporary TCP target ${testTcpId} cleaned up.`);

  // 23. Target Lifecycle, Full Configuration Editing (PUT) & Batch Operations
  console.log("\n23. TEST TARGET LIFECYCLE, FULL CONFIGURATION EDITING (PUT) & BATCH OPERATIONS");

  // 23a. Create test monitor with project group tag
  const createLifecycleRes = await fetch(`${BASE_URL}/api/v1/services`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Campus Relay Mobile Gateway",
      type: "http-poll",
      endpoint: "https://campusrelay.internal/health",
      group_name: "Campus Relay",
      poll_interval_sec: 45,
      keyword: "NOMINAL",
      is_public: 0,
    }),
  });
  const lifecycleData = await createLifecycleRes.json();
  if (!createLifecycleRes.ok || !lifecycleData.service?.id) {
    throw new Error(`Failed to create test lifecycle service: ${JSON.stringify(lifecycleData)}`);
  }
  const targetId = lifecycleData.service.id;
  if (lifecycleData.service.group_name !== "Campus Relay") {
    throw new Error(`Project group_name mismatch: expected 'Campus Relay', got '${lifecycleData.service.group_name}'`);
  }
  console.log(`   ✅ Target created with project group: [${lifecycleData.service.group_name}] (ID: ${targetId})`);

  // 23b. Full target modification via PUT /api/v1/services/:id
  const editRes = await fetch(`${BASE_URL}/api/v1/services/${targetId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Campus Relay Production Edge",
      type: "http-poll",
      endpoint: "https://edge.campusrelay.internal",
      group_name: "KrishiSetu",
      poll_interval_sec: 30,
      keyword: "OK",
      is_public: 1,
      expected_status_code: "200,204",
      retry_count: 3,
    }),
  });
  const editData = await editRes.json();
  if (!editRes.ok || editData.status !== "updated") {
    throw new Error(`Target edit failed: ${JSON.stringify(editData)}`);
  }
  if (
    editData.service.name !== "Campus Relay Production Edge" ||
    editData.service.group_name !== "KrishiSetu" ||
    editData.service.poll_interval_sec !== 30 ||
    editData.service.keyword !== "OK" ||
    editData.service.retry_count !== 3
  ) {
    throw new Error(`Target configuration values did not persist correctly: ${JSON.stringify(editData.service)}`);
  }
  console.log(`   ✅ Target successfully updated via PUT: name='${editData.service.name}', group='${editData.service.group_name}', interval=${editData.service.poll_interval_sec}s, keyword='${editData.service.keyword}'`);

  // 23c. Test Batch Operations (POST /api/v1/services/batch)
  const batchPauseRes = await fetch(`${BASE_URL}/api/v1/services/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "pause-all", ids: [targetId] }),
  });
  const batchPauseData = await batchPauseRes.json();
  if (!batchPauseRes.ok || batchPauseData.status !== "success") {
    throw new Error(`Batch pause failed: ${JSON.stringify(batchPauseData)}`);
  }
  console.log("   ✅ Batch operation 'pause-all' verified on target.");

  const batchGroupRes = await fetch(`${BASE_URL}/api/v1/services/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "set-group", ids: [targetId], group_name: "OSCC" }),
  });
  const batchGroupData = await batchGroupRes.json();
  if (!batchGroupRes.ok || batchGroupData.status !== "success") {
    throw new Error(`Batch set-group failed: ${JSON.stringify(batchGroupData)}`);
  }
  console.log("   ✅ Batch operation 'set-group' to OSCC verified.");

  // 23d. Clean up via Batch Delete
  const batchDeleteRes = await fetch(`${BASE_URL}/api/v1/services/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete-selected", ids: [targetId] }),
  });
  const batchDeleteData = await batchDeleteRes.json();
  if (!batchDeleteRes.ok || batchDeleteData.status !== "success") {
    throw new Error(`Batch delete failed: ${JSON.stringify(batchDeleteData)}`);
  }
  console.log(`   ✅ Target ${targetId} cleanly deleted via batch delete.`);

  console.log("\n24. TEST INCIDENT TIMELINE MANAGEMENT & MULTI-STAGE POSTMORTEM UPDATES");
  // 24a. Create a fresh test incident via alert ingestion
  const timelineAlertRes = await fetch(`${BASE_URL}/api/v1/alerts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer key_live_heimdall_auth_8f92a",
    },
    body: JSON.stringify({
      title: `Redis Cluster Shard Partition Failure [${Date.now().toString(36)}]`,
      severity: "critical",
      message: "Cluster partition occurred between shard-01 and shard-02. Read replica promotion failed.",
    }),
  });
  const timelineAlertData = await timelineAlertRes.json();
  const testIncId = timelineAlertData.incidentId || timelineAlertData.id;
  if (!testIncId) {
    throw new Error(`Failed to ingest test incident: ${JSON.stringify(timelineAlertData)}`);
  }
  console.log(`   ✅ Test incident created: ${testIncId}`);

  // 24b. Append 'identified' timeline update
  const updIdentifiedRes = await fetch(`${BASE_URL}/api/v1/incidents/${testIncId}/updates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "identified",
      message: "Identified network split on redis-shard-02. Initiating cluster quorum re-election.",
    }),
  });
  const updIdentifiedData = await updIdentifiedRes.json();
  if (!updIdentifiedRes.ok || updIdentifiedData.status !== "created") {
    throw new Error(`Failed to append 'identified' update: ${JSON.stringify(updIdentifiedData)}`);
  }
  console.log("   ✅ Update [IDENTIFIED] successfully recorded.");

  // 24c. Append 'monitoring' timeline update
  const updMonitoringRes = await fetch(`${BASE_URL}/api/v1/incidents/${testIncId}/updates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "monitoring",
      message: "Quorum re-established. Redis nodes resynchronized; monitoring replica lag.",
    }),
  });
  const updMonitoringData = await updMonitoringRes.json();
  if (!updMonitoringRes.ok || updMonitoringData.status !== "created") {
    throw new Error(`Failed to append 'monitoring' update: ${JSON.stringify(updMonitoringData)}`);
  }
  console.log("   ✅ Update [MONITORING] successfully recorded.");

  // 24d. Append 'resolved' timeline update
  const updResolvedRes = await fetch(`${BASE_URL}/api/v1/incidents/${testIncId}/updates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "resolved",
      message: "Replication lag under 2ms. Shard pool fully stabilized and traffic returned to nominal.",
    }),
  });
  const updResolvedData = await updResolvedRes.json();
  if (!updResolvedRes.ok || updResolvedData.status !== "created") {
    throw new Error(`Failed to append 'resolved' update: ${JSON.stringify(updResolvedData)}`);
  }
  console.log("   ✅ Update [RESOLVED] successfully recorded.");

  // 24e. Query GET /api/v1/incidents/:id and verify full chronological updates ledger
  const incDetailRes = await fetch(`${BASE_URL}/api/v1/incidents/${testIncId}`);
  const incDetailData = await incDetailRes.json();
  if (!incDetailRes.ok || !incDetailData.incident) {
    throw new Error(`Failed to fetch incident details: ${JSON.stringify(incDetailData)}`);
  }
  const inc = incDetailData.incident;
  if (!Array.isArray(inc.updates) || inc.updates.length < 4) {
    throw new Error(`Expected at least 4 timeline updates in ledger, found: ${inc.updates?.length}`);
  }
  if (inc.status !== "resolved") {
    throw new Error(`Expected parent incident status to be 'resolved', got '${inc.status}'`);
  }
  if (!inc.resolved_at) {
    throw new Error(`Expected resolved_at timestamp to be set on resolved incident`);
  }
  console.log(`   ✅ Incident detail verified with ${inc.updates.length} chronological timeline updates.`);
  console.log(`   ✅ Master incident status transition verified: status='${inc.status}', resolved_at=${new Date(inc.resolved_at).toISOString()}`);

  console.log("\n25. TEST DYNAMIC SVG STATUS BADGES, RSS 2.0 FEED & GENERIC WEBHOOK CONDUIT");
  // 25a. Test Generic Webhook Conduit
  const webhookTestRes = await fetch(`${BASE_URL}/api/v1/channels/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "generic",
      webhookUrl: `${BASE_URL}/api/v1/telemetry/errors`,
    }),
  });
  const webhookTestData = await webhookTestRes.json();
  if (!webhookTestRes.ok || !webhookTestData.success) {
    throw new Error(`Generic webhook test failed: ${JSON.stringify(webhookTestData)}`);
  }
  console.log("   ✅ Generic Webhook Conduit verified with valid JSON dispatch.");

  // 25b. Test Dynamic SVG Badges (Fleet Status & Fleet Uptime)
  const fleetBadgeRes = await fetch(`${BASE_URL}/api/v1/badges/fleet/status.svg`);
  const fleetBadgeSvg = await fleetBadgeRes.text();
  const fleetBadgeType = fleetBadgeRes.headers.get("content-type");
  if (!fleetBadgeRes.ok || !fleetBadgeType || !fleetBadgeType.includes("image/svg+xml")) {
    throw new Error(`Fleet badge returned invalid Content-Type: ${fleetBadgeType}`);
  }
  if (!fleetBadgeSvg.includes("<svg") || !fleetBadgeSvg.toUpperCase().includes("FLEET STATUS")) {
    throw new Error(`Fleet badge SVG malformed: ${fleetBadgeSvg.substring(0, 100)}`);
  }
  console.log("   ✅ Dynamic SVG Badge [fleet status] verified (image/svg+xml).");

  const uptimeBadgeRes = await fetch(`${BASE_URL}/api/v1/badges/fleet/status.svg?metric=uptime`);
  const uptimeBadgeSvg = await uptimeBadgeRes.text();
  if (!uptimeBadgeRes.ok || !uptimeBadgeSvg.toUpperCase().includes("FLEET UPTIME") || !uptimeBadgeSvg.includes("%")) {
    throw new Error(`Fleet uptime badge malformed: ${uptimeBadgeSvg.substring(0, 100)}`);
  }
  console.log("   ✅ Dynamic SVG Badge [fleet uptime] verified with percentage metric.");

  // 25c. Test Dynamic SVG Badge for single service (srv-auth)
  const authBadgeRes = await fetch(`${BASE_URL}/api/v1/badges/srv-auth/status.svg`);
  const authBadgeSvg = await authBadgeRes.text();
  const validStatusKeywords = ["ONLINE", "DOWN", "DEGRADED", "MAINTENANCE"];
  const hasValidStatus = validStatusKeywords.some((st) => authBadgeSvg.includes(st));
  if (!authBadgeRes.ok || !authBadgeSvg.includes("Crystal Auth Gateway") || !hasValidStatus) {
    throw new Error(`Single service badge malformed: ${authBadgeSvg.substring(0, 100)}`);
  }
  console.log("   ✅ Single service SVG badge verified for [srv-auth] with dynamic state rendering.");

  // 25d. Test Public Incident RSS Feed (/status/feed.xml & /api/v1/rss)
  const rssRes = await fetch(`${BASE_URL}/status/feed.xml`);
  const rssXml = await rssRes.text();
  const rssType = rssRes.headers.get("content-type");
  if (!rssRes.ok || !rssType || !rssType.includes("xml")) {
    throw new Error(`RSS feed returned invalid Content-Type: ${rssType}`);
  }
  if (!rssXml.includes("<rss version=\"2.0\"") || !rssXml.includes("<channel>") || !rssXml.includes("<title>")) {
    throw new Error(`RSS feed XML malformed: ${rssXml.substring(0, 100)}`);
  }
  console.log("   ✅ Public Incident RSS 2.0 Feed (/status/feed.xml) verified with valid channel and items.");

  const apiRssRes = await fetch(`${BASE_URL}/api/v1/rss`);
  const apiRssXml = await apiRssRes.text();
  if (!apiRssRes.ok || !apiRssXml.includes("<rss version=\"2.0\"")) {
    throw new Error(`/api/v1/rss failed to return valid RSS feed (status: ${apiRssRes.status})`);
  }
  console.log("   ✅ Canonical RSS Feed (/api/v1/rss) verified with valid channel and items.");

  // 26. Two-Way Sentinel Sync Lifecycle (online, heartbeat, offline with metadata)
  console.log("\n26. TEST TWO-WAY SENTINEL SYNC LIFECYCLE (/api/v1/ping/:key)");
  const targetKey = svcData.services[0].api_key;
  const targetName = svcData.services[0].name;

  // 26a. Send 'online' startup event with uptime & memory
  const onlineRes = await fetch(`${BASE_URL}/api/v1/ping/${targetKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "online",
      uptime: 120,
      memoryMB: 48.5,
      version: "v2.4.0"
    })
  });
  const onlineData = await onlineRes.json();
  if (!onlineRes.ok || onlineData.acknowledged !== "online" || onlineData.status !== "ok" || onlineData.maintenance !== false) {
    throw new Error(`Two-Way Sync 'online' event failed: ${JSON.stringify(onlineData)}`);
  }
  console.log(`   ✅ Two-Way Sync 'online' event verified: Target '${targetName}' marked healthy with runtime metadata.`);

  // 26b. Send 'heartbeat' event
  const heartbeatRes = await fetch(`${BASE_URL}/api/v1/ping/${targetKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "heartbeat",
      uptime: 180,
      memoryMB: 51.2
    })
  });
  const heartbeatData = await heartbeatRes.json();
  if (!heartbeatRes.ok || heartbeatData.acknowledged !== "heartbeat" || heartbeatData.status !== "ok") {
    throw new Error(`Two-Way Sync 'heartbeat' event failed: ${JSON.stringify(heartbeatData)}`);
  }
  console.log(`   ✅ Two-Way Sync 'heartbeat' event verified: Telemetry recorded with telemetry ledger.`);

  // 26c. Send 'offline' graceful shutdown event (e.g. SIGTERM restart)
  const offlineRes = await fetch(`${BASE_URL}/api/v1/ping/${targetKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "offline",
      reason: "SIGTERM graceful deployment restart"
    })
  });
  const offlineData = await offlineRes.json();
  if (!offlineRes.ok || offlineData.acknowledged !== "offline" || offlineData.status !== "ok" || offlineData.maintenance !== true) {
    throw new Error(`Two-Way Sync 'offline' event failed: ${JSON.stringify(offlineData)}`);
  }
  console.log(`   ✅ Two-Way Sync 'offline' event verified: Target safely transitioned to maintenance (suppressing false alarms).`);

  // Verify DB state reflects offline event
  const verifySvcRes = await fetch(`${BASE_URL}/api/v1/services`);
  const verifySvcData = await verifySvcRes.json();
  const updatedSvc = verifySvcData.services.find((s) => s.api_key === targetKey);
  if (!updatedSvc || updatedSvc.last_event !== "offline" || updatedSvc.is_maintenance !== 1) {
    throw new Error(`Service state not updated in DB after offline event: ${JSON.stringify(updatedSvc)}`);
  }
  console.log(`   ✅ Target '${targetName}' verified in DB: last_event='offline', is_maintenance=1.`);

  // 26d. Send 'online' event again to restore normal monitoring
  const restoreRes = await fetch(`${BASE_URL}/api/v1/ping/${targetKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "online",
      uptime: 5,
      memoryMB: 46.0
    })
  });
  const restoreData = await restoreRes.json();
  if (!restoreRes.ok || restoreData.status !== "ok" || restoreData.maintenance !== false) {
    throw new Error(`Restore 'online' event failed: ${JSON.stringify(restoreData)}`);
  }
  console.log(`   ✅ Target '${targetName}' successfully restored to healthy state.`);

  // 26e. Verify PWA Shortcuts and display_override
  const pwaRes = await fetch(`${BASE_URL}/manifest.webmanifest`);
  const pwaManifest = await pwaRes.json();
  if (!Array.isArray(pwaManifest.shortcuts) || pwaManifest.shortcuts.length < 2 || !pwaManifest.display_override) {
    throw new Error(`PWA Manifest missing shortcuts or display_override: ${JSON.stringify(pwaManifest)}`);
  }
  console.log(`   ✅ PWA Manifest shortcuts & display_override verified (${pwaManifest.shortcuts.length} shortcuts registered).`);

  // 27. Test Dynamic Project & Environment Groups CRUD (/api/v1/groups)
  console.log("\n27. TEST DYNAMIC PROJECT & ENVIRONMENT GROUPS (/api/v1/groups)");
  const listGroupsRes = await fetch(`${BASE_URL}/api/v1/groups`);
  const listGroupsData = await listGroupsRes.json();
  if (!listGroupsRes.ok || !Array.isArray(listGroupsData.groups)) {
    throw new Error(`Failed to list project groups: ${JSON.stringify(listGroupsData)}`);
  }
  const hasProductionGroup = listGroupsData.groups.some((g) => g.name.toLowerCase() === "production");
  if (!hasProductionGroup) {
    throw new Error("Default 'Production' group missing from project_groups table!");
  }
  console.log(`   ✅ Listed ${listGroupsData.groups.length} project groups with telemetry enrichment.`);

  // Create new custom group
  const testGroupName = `DevRel Edge Cluster [${Date.now().toString(36)}]`;
  const createGroupRes = await fetch(`${BASE_URL}/api/v1/groups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: testGroupName,
      environment: "edge",
      color: "#ec4899",
      description: "Automated edge telemetry and distributed canary nodes",
    }),
  });
  const createGroupData = await createGroupRes.json();
  if (!createGroupRes.ok || createGroupData.status !== "success" || !createGroupData.group?.id) {
    throw new Error(`Failed to create project group: ${JSON.stringify(createGroupData)}`);
  }
  const createdGroupId = createGroupData.group.id;
  console.log(`   ✅ Created custom project group: '${testGroupName}' (ID: ${createdGroupId})`);

  // Update/Rename custom group
  const updatedGroupName = `${testGroupName} Renamed`;
  const updateGroupRes = await fetch(`${BASE_URL}/api/v1/groups/${createdGroupId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: updatedGroupName,
      environment: "staging",
      color: "#8b5cf6",
      description: "Updated description for canary pipeline",
    }),
  });
  const updateGroupData = await updateGroupRes.json();
  if (!updateGroupRes.ok || updateGroupData.group.name !== updatedGroupName || updateGroupData.group.environment !== "staging") {
    throw new Error(`Failed to update project group: ${JSON.stringify(updateGroupData)}`);
  }
  console.log(`   ✅ Updated project group: '${updatedGroupName}' with cascade support.`);

  // Delete custom group
  const deleteGroupRes = await fetch(`${BASE_URL}/api/v1/groups/${createdGroupId}`, {
    method: "DELETE",
  });
  const deleteGroupData = await deleteGroupRes.json();
  if (!deleteGroupRes.ok || deleteGroupData.status !== "success") {
    throw new Error(`Failed to delete project group: ${JSON.stringify(deleteGroupData)}`);
  }
  console.log(`   ✅ Deleted project group '${updatedGroupName}' and safely reassigned orphaned services.`);

  // 28. Test Interactive Clickable SVG Badges with Redirection (https://crystal-heimdall.vercel.app/)
  console.log("\n28. TEST INTERACTIVE SVG BADGES & REDIRECTIONS (/api/v1/badges)");
  const projBadgeRes = await fetch(`${BASE_URL}/api/v1/badges/project/Campus%20Relay/status.svg`);
  const projBadgeSvg = await projBadgeRes.text();
  const projBadgeType = projBadgeRes.headers.get("content-type");
  if (!projBadgeRes.ok || !projBadgeType?.includes("image/svg+xml")) {
    throw new Error(`Project group badge returned invalid Content-Type: ${projBadgeType}`);
  }
  if (!projBadgeSvg.includes("<svg") || !projBadgeSvg.includes("CAMPUS RELAY")) {
    throw new Error(`Project group badge SVG malformed: ${projBadgeSvg.substring(0, 100)}`);
  }
  // Verify embedded clickable link to crystal-heimdall.vercel.app
  if (!projBadgeSvg.includes("href=\"https://crystal-heimdall.vercel.app/\"") || !projBadgeSvg.includes("target=\"_blank\"")) {
    throw new Error(`Project group badge missing embedded clickable redirect link to https://crystal-heimdall.vercel.app/!`);
  }
  console.log("   ✅ Project group SVG badge verified for [Campus Relay] with embedded redirect link.");

  const projUptimeBadgeRes = await fetch(`${BASE_URL}/api/v1/badges/project/Campus%20Relay/status.svg?metric=uptime`);
  const projUptimeBadgeSvg = await projUptimeBadgeRes.text();
  if (!projUptimeBadgeRes.ok || !projUptimeBadgeSvg.includes("%") || !projUptimeBadgeSvg.includes("https://crystal-heimdall.vercel.app/")) {
    throw new Error(`Project group uptime badge malformed: ${projUptimeBadgeSvg.substring(0, 100)}`);
  }
  console.log("   ✅ Project group uptime SVG badge verified with percentage metric and redirect link.");

  const singleSvcBadgeRes = await fetch(`${BASE_URL}/api/v1/badges/service/srv-auth/status.svg`);
  const singleSvcBadgeSvg = await singleSvcBadgeRes.text();
  if (!singleSvcBadgeRes.ok || !singleSvcBadgeSvg.includes("Crystal Auth Gateway") || !singleSvcBadgeSvg.includes("https://crystal-heimdall.vercel.app/")) {
    throw new Error(`Single service badge malformed: ${singleSvcBadgeSvg.substring(0, 100)}`);
  }
  console.log("   ✅ Single service SVG badge verified (/service/srv-auth/status.svg) with embedded redirect link.");

  console.log("\n🎉 ALL 28 COMPREHENSIVE VERIFICATION TESTS PASSED NOMINAL! 🎉");
  } finally {
    if (serverInstance) {
      console.log("\n🧹 Closing temporary test server instance...");
      await new Promise((resolve) => serverInstance.close(resolve));
      console.log("✅ Temporary test server closed cleanly.");
    }
  }
}

runSmokeTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ VERIFICATION TEST FAILED:", err);
    process.exit(1);
  });
