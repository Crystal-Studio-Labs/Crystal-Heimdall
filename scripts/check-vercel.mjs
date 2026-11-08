async function checkVercel() {
  const endpoints = [
    { name: "Root Public Status Page", url: "https://crystal-heimdall.vercel.app/" },
    { name: "Health API", url: "https://crystal-heimdall.vercel.app/api/health" },
    { name: "Status Telemetry API", url: "https://crystal-heimdall.vercel.app/api/v1/status" },
    { name: "RSS Incident Feed", url: "https://crystal-heimdall.vercel.app/api/v1/rss" },
    { name: "Dynamic Fleet SVG Badge", url: "https://crystal-heimdall.vercel.app/api/v1/badges/fleet/status.svg" },
    { name: "Dynamic Service SVG Badge", url: "https://crystal-heimdall.vercel.app/api/v1/badges/service/srv-auth/status.svg" },
  ];

  console.log("=== CHECKING LIVE PRODUCTION DEPLOYMENT ON VERCEL ===");
  console.log("Host: https://crystal-heimdall.vercel.app\n");

  for (const ep of endpoints) {
    const start = Date.now();
    try {
      const res = await fetch(ep.url, { headers: { "User-Agent": "Heimdall-Probe/2.0" } });
      const elapsed = Date.now() - start;
      const contentType = res.headers.get("content-type") || "unknown";
      console.log(`[HTTP ${res.status}] ${ep.name} (${elapsed}ms)`);
      console.log(`   URL: ${ep.url}`);
      console.log(`   Type: ${contentType}`);

      if (ep.url.endsWith("/api/health")) {
        const data = await res.json();
        console.log(`   Runtime: ${data.runtime} | Status: ${data.status} | Sentinel: ${data.sentinel}`);
      } else if (ep.url.endsWith("/api/v1/status")) {
        const data = await res.json();
        console.log(`   Fleet Status: ${data.overallStatus.toUpperCase()} | 30d Uptime: ${data.avgUptime}% | Public Services: ${data.services?.length}`);
      }
      console.log("");
    } catch (err) {
      console.error(`[FAIL] ${ep.name}: ${err.message}\n`);
    }
  }
}

checkVercel();
