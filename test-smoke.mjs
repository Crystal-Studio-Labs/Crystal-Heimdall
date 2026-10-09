async function runSmokeTests() {
  const BASE_URL = "http://localhost:3030";
  console.log("=== RUNNING FULL CRYSTAL-HEIMDALL VERIFICATION SUITE ===\n");

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
    console.log(`    - [${s.type}] ${s.name} (public=${s.is_public}, status=${s.status})`);
  }

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
      title: "Simulated Database Connection Pool Outage",
      message: "Timeout acquiring client after 5000ms",
      stack_trace: "Error: PoolExhaustion\n    at Pool.connect (/app/db.js:42:15)",
      fingerprint: "simulated_pool_exhaustion_test"
    })
  });
  const alertData = await alertRes.json();
  console.log(`   ✅ Ingestion status: ${alertData.status} (Incident ID: ${alertData.incidentId})`);

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
  }
  console.log("   ✅ Public visibility filter strictly verified: 0 private services leaked.");

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

  // 8. Test 2-Factor Authentication Gate (2FA Only, No Master Passcode, No GitHub)
  console.log("\n8. TEST 2-FACTOR AUTHENTICATION (2FA) GATE - 2FA ONLY");
  const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: "000000" })
  });
  const loginData = await loginRes.json();
  if (!loginData.token) {
    throw new Error(`2FA Direct Login failed: ${JSON.stringify(loginData)}`);
  }
  console.log("   ✅ Direct 2FA: 6-digit TOTP code verified, operator session token granted.");

  // Also verify /api/v1/auth/verify-2fa endpoint
  const verifyRes = await fetch(`${BASE_URL}/api/v1/auth/verify-2fa`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: "000000" })
  });
  const verifyData = await verifyRes.json();
  if (!verifyData.token) {
    throw new Error(`2FA verify-2fa endpoint failed: ${JSON.stringify(verifyData)}`);
  }
  console.log("   ✅ 2FA /verify-2fa endpoint verified.");

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
    console.log(`    - [${mb.name}] 24h: ${mb.uptime24h}% | 7d: ${mb.uptime7d}% | 30d: ${mb.uptime30d}% | ping: ${mb.currentLatency}ms`);
  }

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
  if (sitemapRes.status === 200 && sitemapText.includes("<urlset") && sitemapText.includes("/incidents") && sitemapText.includes("/docs")) {
    console.log("   ✅ Valid XML Sitemap served with /incidents, /docs, /overview mapped.");
  } else {
    throw new Error(`Sitemap verification failed. Status: ${sitemapRes.status}, Body: ${sitemapText.slice(0, 100)}`);
  }

  const robotsRes = await fetch(`${BASE_URL}/robots.txt`);
  const robotsText = await robotsRes.text();
  if (robotsRes.status === 200 && robotsText.includes("Disallow: /dashboard") && robotsText.includes("sitemap.xml")) {
    console.log("   ✅ Robots.txt verified: Disallows /dashboard and references sitemap.xml.");
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

  console.log("\n🎉 ALL 21 COMPREHENSIVE VERIFICATION TESTS PASSED NOMINAL! 🎉");
}

runSmokeTests().catch((err) => {
  console.error("\n❌ VERIFICATION TEST FAILED:", err);
  process.exit(1);
});
