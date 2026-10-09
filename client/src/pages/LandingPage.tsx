import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  ArrowRight, 
  Activity, 
  ShieldCheck, 
  Zap, 
  Radio, 
  Clock, 
  BellRing,
  ChevronRight,
  ShieldAlert,
  Code2
} from "lucide-react";
import Navbar from "../components/Navbar";
import SEO from "../components/SEO";

interface PublicServicePreview {
  id: string;
  name: string;
  type: string;
  status: "healthy" | "warning" | "critical";
  latency_ms: number;
  uptime_pct: number;
}

export default function LandingPage() {
  const [statusInfo, setStatusInfo] = useState<{
    overallStatus: string;
    avgUptime: number;
    services: PublicServicePreview[];
  }>({
    overallStatus: "operational",
    avgUptime: 99.94,
    services: [],
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/status")
      .then((r) => r.json())
      .then((d) => {
        if (d && d.overallStatus) {
          setStatusInfo({
            overallStatus: d.overallStatus,
            avgUptime: d.avgUptime || 99.9,
            services: d.services || [],
          });
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const isOperational = statusInfo.overallStatus === "operational";

  const displayServices = statusInfo.services.length > 0
    ? statusInfo.services
    : [
        { id: "demo-1", name: "Crystal Auth Gateway", type: "Synthetic HTTP", status: "healthy" as const, latency_ms: 28, uptime_pct: 100.0 },
        { id: "demo-2", name: "Crystal Studio Labs API", type: "Synthetic HTTP", status: "healthy" as const, latency_ms: 38, uptime_pct: 99.98 },
        { id: "demo-3", name: "Internal Nightly Backup Cron", type: "Dead-Man Cron", status: "healthy" as const, latency_ms: 0, uptime_pct: 100.0 },
      ];

  return (
    <div className="min-h-screen bg-[#070a0f] text-zinc-100 flex flex-col justify-between font-mono relative overflow-hidden">
      <SEO 
        title="Architecture & Overview // Crystal Heimdall"
        description="Autonomous reliability sentinel, Uptime Kuma monitoring engine, and Sentry crash tracker designed for Crystal Studio Labs infrastructure."
        canonicalPath="/overview"
        keywords={["Architecture", "Overview", "Crystal Heimdall", "Uptime Sentinel", "Crystal Studio Labs"]}
      />

      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-20 flex-1 flex flex-col items-center space-y-16">
        {/* DRAFTING BOARD HERO */}
        <section className="w-full flex flex-col items-center text-center space-y-8 max-w-4xl pt-4">
          {/* Top Status Stamp */}
          <div className="inline-flex items-center space-x-3 px-4 py-2 bg-zinc-900 border-2 border-zinc-700 shadow-[3px_3px_0px_#000] text-xs">
            <span className="w-2 h-2 bg-emerald-400 inline-block animate-pulse" />
            <span className="font-extrabold tracking-wider text-emerald-400">
              {isOperational ? "[STATUS: ALL FLEET TARGETS OPERATIONAL]" : "[STATUS: DISRUPTION DETECTED]"}
            </span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-300 font-bold">{statusInfo.avgUptime}% 30-DAY FLEET SLA</span>
          </div>

          {/* Headline - Explicit Brand Claim */}
          <div className="space-y-4">
            <div className="text-xs font-mono tracking-widest text-cyan-400 uppercase font-black">
              // AUTONOMOUS INFRASTRUCTURE OBSERVABILITY //
            </div>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white uppercase leading-none">
              Crystal Heimdall <br />
              <span className="text-emerald-400 bg-zinc-900 px-3 py-1 border-2 border-emerald-400 inline-block mt-2 shadow-[4px_4px_0px_#000]">
                Crystal Studio Labs
              </span>
            </h1>

            <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-2xl mx-auto font-sans pt-2">
              Continuous multi-point health monitoring, live probe telemetry, dead-man cron switches, Sentry crash ingestion, and public transparency reports.
            </p>
          </div>

          {/* Action Rocker Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2 w-full">
            <Link
              to="/"
              className="px-6 py-3.5 btn-primary text-xs sm:text-sm flex items-center justify-center space-x-2"
            >
              <span>[01] LIVE STATUS PAGE</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              to="/incidents"
              className="px-6 py-3.5 bg-zinc-900 hover:bg-zinc-800 text-rose-300 hover:text-white border-2 border-zinc-700 hover:border-rose-500 text-xs sm:text-sm font-bold uppercase transition flex items-center justify-center space-x-2 shadow-[3px_3px_0px_#000]"
            >
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>[02] INCIDENT LEDGER</span>
            </Link>

            <Link
              to="/docs"
              className="px-6 py-3.5 bg-zinc-900 hover:bg-zinc-800 text-cyan-300 hover:text-white border-2 border-zinc-700 hover:border-cyan-500 text-xs sm:text-sm font-bold uppercase transition flex items-center justify-center space-x-2 shadow-[3px_3px_0px_#000]"
            >
              <Code2 className="w-4 h-4 text-cyan-400" />
              <span>[03] DEVELOPER API</span>
            </Link>

            <Link
              to="/login"
              className="px-6 py-3.5 btn-secondary text-xs sm:text-sm flex items-center justify-center space-x-2"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>[04] OPERATOR CONSOLE</span>
            </Link>
          </div>
        </section>

        {/* TECHNICAL PARAMETERS MATRIX */}
        <section className="w-full max-w-4xl p-5 bg-[#0b0f17] border-2 border-zinc-800 shadow-[4px_4px_0px_#000] grid grid-cols-2 sm:grid-cols-4 gap-4 text-center font-mono">
          <div className="p-3 bg-zinc-950 border border-zinc-800">
            <span className="text-zinc-500 text-[10px] uppercase font-bold block">// MEDIAN LATENCY //</span>
            <span className="text-lg font-black text-white">~28ms</span>
          </div>
          <div className="p-3 bg-zinc-950 border border-zinc-800">
            <span className="text-zinc-500 text-[10px] uppercase font-bold block">// DEBOUNCE WINDOW //</span>
            <span className="text-lg font-black text-cyan-400">15 Minutes</span>
          </div>
          <div className="p-3 bg-zinc-950 border border-zinc-800">
            <span className="text-zinc-500 text-[10px] uppercase font-bold block">// AUTH PROTOCOL //</span>
            <span className="text-lg font-black text-emerald-400">RFC 6238 2FA ONLY</span>
          </div>
          <div className="p-3 bg-zinc-950 border border-zinc-800">
            <span className="text-zinc-500 text-[10px] uppercase font-bold block">// PROBE CADENCE //</span>
            <span className="text-lg font-black text-amber-400">60 Seconds</span>
          </div>
        </section>

        {/* LIVE MONITORED PROBES LEDGER */}
        <section className="w-full max-w-4xl">
          <div className="bg-[#0b0f17] border-2 border-zinc-700 shadow-[4px_4px_0px_#000] p-6 space-y-5">
            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b-2 border-zinc-800 gap-3">
              <div className="flex items-center space-x-3">
                <span className="w-2.5 h-2.5 bg-emerald-400 inline-block" />
                <span className="font-black text-white text-sm uppercase">Active Telemetry Conduits</span>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-950 border border-emerald-500 text-emerald-300">
                  [NOMINAL]
                </span>
              </div>
              <div className="flex items-center space-x-4 text-xs font-mono text-zinc-400">
                <span>Fleet SLA: <strong className="text-emerald-400 font-bold">{statusInfo.avgUptime}%</strong></span>
                <span className="text-zinc-700">|</span>
                <span>Probed: <strong className="text-zinc-200">Continuous Synthetics</strong></span>
              </div>
            </div>

            {/* Live Rows */}
            <div className="space-y-3 py-2">
              {displayServices.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-zinc-950 border-2 border-zinc-800 hover:border-zinc-600 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-2 h-2 bg-emerald-400 inline-block shrink-0" />
                    <div>
                      <h4 className="font-bold text-white text-xs sm:text-sm uppercase font-mono group-hover:text-emerald-400 transition">
                        {item.name}
                      </h4>
                      <span className="text-[10px] font-mono text-zinc-500 uppercase">{item.type}</span>
                    </div>
                  </div>

                  {/* Mini-bars */}
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: 24 }).map((_, barIdx) => (
                      <div
                        key={barIdx}
                        className="w-1.5 h-4 bg-emerald-500 hover:bg-emerald-300 transition"
                        title="Nominal state"
                      />
                    ))}
                  </div>

                  <div className="flex items-center space-x-4 text-xs font-mono">
                    <span className="text-emerald-400 font-bold">{item.uptime_pct}%</span>
                    <span className="text-zinc-400">{item.latency_ms > 0 ? `${item.latency_ms}ms` : "Nominal"}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom link */}
            <div className="pt-4 border-t-2 border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-zinc-400 font-mono">
              <span className="flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                Continuously probing endpoints every 60 seconds
              </span>
              <Link to="/" className="text-emerald-400 hover:text-emerald-300 font-bold transition flex items-center gap-1 uppercase">
                <span>[ OPEN LIVE STATUS PAGE ]</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* 4 FEATURE PILLARS */}
        <section className="w-full max-w-4xl space-y-4">
          <div className="text-xs text-zinc-400 font-mono uppercase tracking-wider font-bold">
            // ARCHITECTURAL CAPABILITIES //
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#0b0f17] border-2 border-zinc-800 p-5 space-y-3 shadow-[3px_3px_0px_#000]">
              <div className="w-8 h-8 bg-zinc-900 border border-emerald-500 text-emerald-400 flex items-center justify-center font-bold">
                01
              </div>
              <h3 className="font-bold text-white text-sm uppercase">Active Synthetic Probing</h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                Scheduled round-robin HTTP and TLS pinging validates endpoint availability, latency thresholds, and SSL certificate validity windows.
              </p>
            </div>

            <div className="bg-[#0b0f17] border-2 border-zinc-800 p-5 space-y-3 shadow-[3px_3px_0px_#000]">
              <div className="w-8 h-8 bg-zinc-900 border border-cyan-500 text-cyan-400 flex items-center justify-center font-bold">
                02
              </div>
              <h3 className="font-bold text-white text-sm uppercase">Sentry Crash Sink</h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                Passive telemetry ingestion captures uncaught promise rejections, frontend stack traces, and worker panics in real-time.
              </p>
            </div>

            <div className="bg-[#0b0f17] border-2 border-zinc-800 p-5 space-y-3 shadow-[3px_3px_0px_#000]">
              <div className="w-8 h-8 bg-zinc-900 border border-purple-500 text-purple-400 flex items-center justify-center font-bold">
                03
              </div>
              <h3 className="font-bold text-white text-sm uppercase">Alert Dispatches</h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                Instant emergency webhook relays dispatched to Discord and Telegram with 15-minute storm suppression filters.
              </p>
            </div>

            <div className="bg-[#0b0f17] border-2 border-zinc-800 p-5 space-y-3 shadow-[3px_3px_0px_#000]">
              <div className="w-8 h-8 bg-zinc-900 border border-amber-500 text-amber-400 flex items-center justify-center font-bold">
                04
              </div>
              <h3 className="font-bold text-white text-sm uppercase">Dead-Man's Switch</h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                Background scripts and scheduled jobs ping /api/v1/ping/:key. If a silent worker fails, an alarm triggers.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t-2 border-zinc-800 bg-black py-6 text-xs text-zinc-500 font-mono">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-emerald-400 inline-block" />
            <span className="text-zinc-200 font-bold uppercase">Crystal Heimdall</span>
            <span className="text-zinc-600">|</span>
            <span>Crystal Studio Labs</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-zinc-400">
            <Link to="/" className="hover:text-white transition uppercase">[ STATUS ]</Link>
            <Link to="/incidents" className="hover:text-white transition uppercase">[ INCIDENTS ]</Link>
            <Link to="/docs" className="hover:text-white transition uppercase">[ API DOCS ]</Link>
            <Link to="/login" className="hover:text-white transition uppercase">[ OPERATOR GATE ]</Link>
            <span>&copy; {new Date().getFullYear()} Crystal Studio Labs</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
