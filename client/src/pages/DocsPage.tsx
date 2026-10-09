import React, { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import SEO from "../components/SEO";
import { 
  Code2, 
  Terminal, 
  Copy, 
  Check, 
  ExternalLink, 
  Zap, 
  Shield, 
  Radio, 
  Clock, 
  Database,
  Layers,
  ArrowRight
} from "lucide-react";
import { useToast } from "../lib/ToastContext";

export default function DocsPage() {
  const toast = useToast();
  const [activeLang, setActiveLang] = useState<"node" | "python" | "curl" | "bash" | "go">("node");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (key: string, code: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedKey(key);
      toast.success("Code snippet copied to clipboard!");
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const codeSnippets = {
    node: `// Node.js / Express Uncaught Exception & Crash Ingestion Hook
import axios from "axios";

const HEIMDALL_ENDPOINT = "https://status.crystalstudio.labs/api/v1/alerts";
const API_KEY = process.env.HEIMDALL_SERVICE_KEY; // Service Bearer token

process.on("unhandledRejection", async (reason, promise) => {
  try {
    await axios.post(
      HEIMDALL_ENDPOINT,
      {
        title: "Unhandled Promise Rejection in Worker",
        message: String(reason),
        severity: "critical",
        stack_trace: reason instanceof Error ? reason.stack : undefined,
      },
      {
        headers: {
          Authorization: \`Bearer \${API_KEY}\`,
          "Content-Type": "application/json",
        },
        timeout: 5000,
      }
    );
  } catch (err) {
    console.error("Failed to relay exception to Sentinel:", err.message);
  }
});`,
    python: `# Python / FastAPI / Flask Unhandled Exception Sentinel Hook
import requests
import traceback
import sys

HEIMDALL_ENDPOINT = "https://status.crystalstudio.labs/api/v1/alerts"
API_KEY = "your-service-bearer-key"

def dispatch_sentinel_alert(title: str, exc: Exception, severity: str = "critical"):
    payload = {
        "title": title,
        "message": str(exc),
        "severity": severity,
        "stack_trace": "".join(traceback.format_exception(*sys.exc_info()))
    }
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    try:
        requests.post(HEIMDALL_ENDPOINT, json=payload, headers=headers, timeout=5)
    except Exception as e:
        print(f"Sentinel dispatch failed: {e}", file=sys.stderr)`,
    curl: `# cURL Terminal Test Alert
curl -X POST https://status.crystalstudio.labs/api/v1/alerts \\
  -H "Authorization: Bearer YOUR_SERVICE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Database Connection Pool Saturated",
    "message": "Max connections reached (100/100). Latency degraded.",
    "severity": "critical"
  }'`,
    bash: `#!/usr/bin/env bash
# Dead-Man's Switch Heartbeat Runner
# Add to crontab: 0 3 * * * /opt/scripts/backup.sh

set -euo pipefail

# 1. Execute your critical automated workload
/usr/local/bin/run-nightly-database-backup.sh

# 2. Check in with Crystal Heimdall Dead-Man Sentinel
# If this ping is missed for > interval + 5m, an emergency alarm sounds
curl -fsS -m 10 --retry 3 \\
  https://status.crystalstudio.labs/api/v1/ping/YOUR_DEADMAN_API_KEY > /dev/null`,
    go: `// Go (Golang) Exception & Telemetry Reporter
package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"time"
)

type SentinelAlert struct {
	Title    string \`json:"title"\`
	Message  string \`json:"message"\`
	Severity string \`json:"severity"\`
}

func ReportToSentinel(apiKey, title, msg, severity string) error {
	payload, _ := json.Marshal(SentinelAlert{Title: title, Message: msg, Severity: severity})
	req, _ := http.NewRequest("POST", "https://status.crystalstudio.labs/api/v1/alerts", bytes.NewBuffer(payload))
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	_, err := client.Do(req)
	return err
}`
  };

  const endpoints = [
    {
      method: "GET",
      path: "/api/v1/status",
      access: "Public",
      desc: "Returns public fleet operational state, visible monitors, SLA percentages, and announcement banners.",
    },
    {
      method: "GET",
      path: "/api/v1/incidents",
      access: "Public",
      desc: "Fetches past and active incident ledger entries, deduplicated counts, and resolution timestamps.",
    },
    {
      method: "POST",
      path: "/api/v1/alerts",
      access: "Bearer Token",
      desc: "Ingests unhandled exceptions and service crashes. Deduplicates repeated alerts within sliding windows.",
    },
    {
      method: "GET",
      path: "/api/v1/ping/:key",
      access: "API Key",
      desc: "Dead-Man's switch heartbeat. Resets cron countdown for scheduled workers and backup scripts.",
    },
    {
      method: "POST",
      path: "/api/v1/telemetry/errors",
      access: "Public DSN",
      desc: "Sentry-compatible crash telemetry endpoint for browser and server stack trace ingestion.",
    },
    {
      method: "GET",
      path: "/api/v1/cron/poll",
      access: "Public / Cron",
      desc: "Executes automated synthetic HTTP ping cycle across all active service endpoints.",
    },
    {
      method: "POST",
      path: "/api/v1/services/:id/probe",
      access: "Operator 2FA",
      desc: "Triggers on-demand instant probe of an individual target service and records telemetry response.",
    },
    {
      method: "GET",
      path: "/api/v1/analytics",
      access: "Operator 2FA",
      desc: "Calculates Uptime Kuma 24h/7d/30d SLAs, latency percentiles (P50/P95/P99), and MTTR.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#070a0f] text-zinc-100 flex flex-col font-mono relative overflow-hidden pb-24">
      <SEO 
        title="Developer API & Ingestion Guide // Crystal Heimdall"
        description="Comprehensive technical reference for integrating synthetic health checks, exception telemetry webhooks, dead-man cron switches, and Sentry crash sinks."
        canonicalPath="/docs"
        keywords={["API Documentation", "Dead-Man Switch", "Sentry Sink", "Webhooks", "Telemetry Ingestion", "Crystal Heimdall API"]}
      />

      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b-2 border-zinc-800">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs text-cyan-400 font-bold">
              <Code2 className="w-3.5 h-3.5" />
              <span>[DEVELOPER SPECIFICATION & TELEMETRY PROTOCOLS]</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase text-white tracking-tight">
              API & Telemetry Guide
            </h1>
            <p className="text-xs text-zinc-400 font-sans">
              Connect external services, cron jobs, and application exception hooks into the Crystal Heimdall sentinel network.
            </p>
          </div>

          <Link
            to="/overview"
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border-2 border-zinc-700 text-xs font-bold uppercase transition flex items-center gap-1.5 self-start sm:self-auto shadow-[2px_2px_0px_#000]"
          >
            <span>[ SYSTEM OVERVIEW ]</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* CODE INTEGRATION PLAYBOOK */}
        <section className="bg-[#0b0f17] border-2 border-zinc-700 shadow-[4px_4px_0px_#000] p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-zinc-800 pb-4">
            <div className="space-y-1">
              <h2 className="text-base sm:text-lg font-black text-white uppercase">
                Inbound Crash & Exception Ingestion
              </h2>
              <p className="text-xs text-zinc-400 font-sans">
                Relay unhandled promise rejections, database errors, and worker panics directly to Heimdall.
              </p>
            </div>

            {/* Language Selector */}
            <div className="flex border border-zinc-700 bg-black p-0.5 text-xs font-mono">
              {(["node", "python", "curl", "bash", "go"] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setActiveLang(lang)}
                  className={`px-3 py-1 uppercase text-[10px] font-bold transition ${
                    activeLang === lang
                      ? "bg-zinc-800 text-cyan-300 border border-zinc-600"
                      : "text-zinc-500 hover:text-white"
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-zinc-400 flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                <span>Integration Example: {activeLang.toUpperCase()}</span>
              </span>

              <button
                onClick={() => handleCopy(activeLang, codeSnippets[activeLang])}
                className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-mono flex items-center gap-1.5 shadow-[2px_2px_0px_#000]"
              >
                {copiedKey === activeLang ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedKey === activeLang ? "COPIED" : "COPY SNIPPET"}</span>
              </button>
            </div>

            <pre className="p-4 bg-black border-2 border-zinc-800 text-cyan-300 font-mono text-xs overflow-x-auto leading-relaxed shadow-inner">
              {codeSnippets[activeLang]}
            </pre>
          </div>
        </section>

        {/* REST API ENDPOINTS MATRIX */}
        <section className="bg-[#0b0f17] border-2 border-zinc-700 shadow-[4px_4px_0px_#000] p-6 sm:p-8 space-y-6">
          <div className="border-b-2 border-zinc-800 pb-4">
            <h2 className="text-base sm:text-lg font-black text-white uppercase">
              Core REST Endpoints Reference
            </h2>
            <p className="text-xs text-zinc-400 font-sans">
              All REST API routes are mounted under the <code className="text-cyan-400">/api/v1</code> prefix.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b-2 border-zinc-700 text-zinc-400 uppercase text-[11px]">
                  <th className="py-2.5 px-3">METHOD</th>
                  <th className="py-2.5 px-3">ENDPOINT ROUTE</th>
                  <th className="py-2.5 px-3">ACCESS LEVEL</th>
                  <th className="py-2.5 px-3">PURPOSE & CONTRACT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {endpoints.map((ep, idx) => (
                  <tr key={idx} className="hover:bg-zinc-900/50 transition">
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase border ${
                        ep.method === "GET"
                          ? "bg-cyan-950/60 text-cyan-400 border-cyan-600"
                          : ep.method === "POST"
                          ? "bg-emerald-950/60 text-emerald-400 border-emerald-600"
                          : "bg-amber-950/60 text-amber-400 border-amber-600"
                      }`}>
                        {ep.method}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-white font-bold">
                      {ep.path}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase border ${
                        ep.access === "Public" || ep.access === "Public / Cron" || ep.access === "Public DSN"
                          ? "bg-zinc-900 text-zinc-300 border-zinc-700"
                          : "bg-emerald-950 text-emerald-300 border-emerald-600"
                      }`}>
                        {ep.access}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-zinc-400 font-sans text-xs">
                      {ep.desc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* DEAD-MAN'S SWITCH WORKFLOW */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#0b0f17] border-2 border-zinc-700 shadow-[4px_4px_0px_#000] p-6 space-y-4">
            <div className="flex items-center space-x-2 text-xs font-bold text-amber-400 uppercase">
              <Clock className="w-4 h-4" />
              <span>Dead-Man's Switch Protocol</span>
            </div>
            <p className="text-xs text-zinc-300 font-sans leading-relaxed">
              When a cron job or scheduled worker must run periodically (e.g. nightly backups), configure a <code className="text-amber-400">deadman-cron</code> monitor. Append a <code className="text-emerald-400">curl</code> ping at the end of your script. If Sentinel does not receive a heartbeat ping within the configured window, a P0 critical incident is automatically triggered.
            </p>
          </div>

          <div className="bg-[#0b0f17] border-2 border-zinc-700 shadow-[4px_4px_0px_#000] p-6 space-y-4">
            <div className="flex items-center space-x-2 text-xs font-bold text-rose-400 uppercase">
              <Shield className="w-4 h-4" />
              <span>Storm Suppression Filter</span>
            </div>
            <p className="text-xs text-zinc-300 font-sans leading-relaxed">
              To prevent alerting cascades during cascading service failures, Crystal Heimdall enforces a 15-minute sliding deduplication cache. Identical errors within this timeframe are suppressed from repeated Discord/Telegram dispatches, incrementing the incident counter silently.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
