import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  Clock,
  Shield,
  Radio,
  Volume2,
  VolumeX,
  LayoutDashboard,
  Lock,
  Server
} from "lucide-react";
import HeartbeatBars, { HistoryBlock } from "../components/HeartbeatBars";
import { useToast } from "../lib/ToastContext";
import { isOperatorAuthenticated, getSessionInfo } from "../lib/api";
import { isAudioMuted, setAudioMuted, playTestSound } from "../lib/audioAlerts";
import SEO from "../components/SEO";

interface TelemetryPoint {
  timestamp: number;
  latency_ms: number;
  status_code: number;
}

interface IncidentUpdate {
  id: string;
  incident_id: string;
  status: string;
  message: string;
  created_at: number;
}

interface IncidentItem {
  id: string;
  service_id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message?: string;
  status: "active" | "acknowledged" | "resolved";
  first_seen_at: number;
  last_seen_at: number;
  resolved_at?: number;
  updates?: IncidentUpdate[];
}

interface ServiceData {
  service: {
    id: string;
    name: string;
    type: string;
    endpoint?: string;
    group_name: string;
    status: "healthy" | "warning" | "critical" | "maintenance";
    latency_ms: number;
    uptime_pct: number;
    created_at: number;
    last_ping_at?: number;
    is_maintenance?: number;
    port?: number;
    keyword?: string;
    historyBlocks: HistoryBlock[];
    stats: {
      uptime_24h: number;
      uptime_7d: number;
      uptime_30d: number;
      avg_latency: number;
      min_latency: number;
      max_latency: number;
      p95_latency: number;
      total_checks_30d: number;
    };
  };
  latencyHistory: TelemetryPoint[];
  incidents: IncidentItem[];
}

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [data, setData] = useState<ServiceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<TelemetryPoint | null>(null);
  const [muted, setMuted] = useState(isAudioMuted());
  const [nextSync, setNextSync] = useState(30);

  const isAuthenticated = isOperatorAuthenticated();
  const session = getSessionInfo();

  const fetchServiceData = async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/v1/services/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("Target service or monitor not found.");
        } else {
          setError(`Failed to retrieve telemetry conduit (HTTP ${res.status})`);
        }
        return;
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Network error loading service telemetry");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchServiceData();
  }, [id]);

  // 1-second cadence timer for 30s auto-sync countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setNextSync((prev) => {
        if (prev <= 1) {
          fetchServiceData();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [id]);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Markdown embed snippet copied!");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleToggleSound = () => {
    const newMuted = !muted;
    setMuted(newMuted);
    setAudioMuted(newMuted);
    if (!newMuted) {
      playTestSound();
      toast.info("Audio siren alarms enabled");
    } else {
      toast.info("Audio siren alarms muted");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070a0f] text-zinc-100 font-mono flex items-center justify-center p-6">
        <div className="flex flex-col items-center space-y-3">
          <Activity className="w-8 h-8 animate-spin text-emerald-400" />
          <span className="text-xs uppercase tracking-widest text-zinc-400">
            [CONNECTING TO TARGET TELEMETRY CONDUIT...]
          </span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#070a0f] text-zinc-100 font-mono p-6 sm:p-12">
        <div className="max-w-2xl mx-auto p-8 bg-[#0b0f17] border-2 border-rose-500/80 shadow-[6px_6px_0px_#000] space-y-4">
          <div className="flex items-center space-x-3 text-rose-400">
            <AlertCircle className="w-6 h-6" />
            <h1 className="text-base font-black uppercase">Telemetry Target Error</h1>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed font-sans">
            {error || "The requested service does not exist or has been marked private by the operator."}
          </p>
          <div className="pt-2">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-700 hover:border-emerald-400 text-white text-xs font-bold uppercase transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Public Status Page</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { service, latencyHistory, incidents } = data;
  const isUp = service.status === "healthy";
  const isWarn = service.status === "warning";
  const isMaint = service.status === "maintenance" || service.is_maintenance === 1;

  // Render SVG Response Time Graph
  const svgWidth = 800;
  const svgHeight = 220;
  const padLeft = 55;
  const padRight = 20;
  const padTop = 25;
  const padBottom = 35;
  const graphW = svgWidth - padLeft - padRight;
  const graphH = svgHeight - padTop - padBottom;

  const maxLatencyVal = Math.max(
    ...latencyHistory.map((p) => p.latency_ms),
    service.stats.max_latency || 200,
    100
  );
  // Round up to clean ceiling (e.g. 100, 250, 500, 1000)
  const yCeil = Math.ceil(maxLatencyVal / 50) * 50;

  const pointsCount = latencyHistory.length;
  const coordinates = latencyHistory.map((p, i) => {
    const x = pointsCount <= 1
      ? padLeft + graphW / 2
      : padLeft + (i / (pointsCount - 1)) * graphW;
    const yRatio = Math.min(1, Math.max(0, p.latency_ms / yCeil));
    const y = padTop + graphH - yRatio * graphH;
    return { ...p, x, y };
  });

  // SVG Line path
  const linePathD = coordinates.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, "");

  // SVG Closed area path for gradient
  const areaPathD = coordinates.length > 0
    ? `${linePathD} L ${coordinates[coordinates.length - 1].x} ${padTop + graphH} L ${coordinates[0].x} ${padTop + graphH} Z`
    : "";

  const activeIncidents = incidents.filter((inc) => inc.status !== "resolved");
  const resolvedIncidents = incidents.filter((inc) => inc.status === "resolved");

  const canonicalOrigin = typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1"
    ? window.location.origin
    : "https://crystal-heimdall.vercel.app";
  const badgeUrl = `${canonicalOrigin}/api/v1/badges/service/${service.id}/status.svg`;
  const markdownEmbed = `[![${service.name} Status](${badgeUrl})](${canonicalOrigin}/service/${service.id})`;

  return (
    <div className="min-h-screen bg-[#070a0f] text-zinc-100 font-mono pb-24 relative overflow-hidden">
      <SEO
        title={`${service.name} // Status & Telemetry Diagnostics`}
        description={`Real-time health telemetry, response time graph, SLAs, and incident history for ${service.name}.`}
        canonicalPath={`/service/${service.id}`}
        keywords={[service.name, "Telemetry", "API Response Time", "Status Page", "Uptime SLA", service.group_name]}
      />

      {/* Top Breadcrumb & Controls Header */}
      <header className="border-b-2 border-zinc-800 bg-[#070a0f]/95 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-3 font-bold truncate">
            <Link
              to="/"
              className="p-1.5 bg-zinc-900 border border-zinc-700 hover:border-emerald-400 text-zinc-300 hover:text-white transition flex items-center gap-1 shrink-0"
              title="Return to Master Status Page"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">[ STATUS ]</span>
            </Link>

            <div className="flex items-center space-x-1.5 text-xs truncate">
              <span className="text-zinc-500 uppercase hidden md:inline">SYSTEM STATUS /</span>
              <span className="text-emerald-400 font-bold uppercase truncate">
                {service.group_name}
              </span>
              <span className="text-zinc-600">/</span>
              <span className="text-white font-black uppercase truncate max-w-[140px] sm:max-w-xs">
                {service.name}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Audio Siren Toggle */}
            <button
              onClick={handleToggleSound}
              className={`p-1.5 sm:px-2.5 sm:py-1 border flex items-center gap-1.5 text-xs font-bold uppercase transition shadow-[1px_1px_0px_#000] ${
                muted
                  ? "bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white"
                  : "bg-rose-950/80 border-rose-500 text-rose-300"
              }`}
              title={muted ? "Unmute Siren Alerts" : "Siren Armed"}
            >
              {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-rose-400 animate-pulse" />}
              <span className="hidden sm:inline">{muted ? "MUTED" : "ALARM"}</span>
            </button>

            {/* Live Auto-Sync Ticker */}
            <div
              className="flex items-center space-x-1.5 px-2 py-1 bg-black border border-zinc-800 text-[10px] text-zinc-400 font-mono"
              title="Automatic 30-second background telemetry refresh"
            >
              <span className="w-1.5 h-1.5 bg-emerald-400 inline-block animate-pulse" />
              <span>LIVE ({nextSync}s)</span>
            </div>

            {/* Operator Link */}
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-black border border-emerald-400 font-bold transition flex items-center gap-1 text-xs shadow-[1px_1px_0px_#000]"
                title={`Operator Session (~${session.daysRemaining}d left)`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">[ DECK ]</span>
              </Link>
            ) : (
              <Link
                to="/login"
                className="p-1.5 sm:px-2 sm:py-1 text-zinc-500 hover:text-zinc-200 border border-transparent hover:border-zinc-800 text-[10px] font-mono tracking-wider transition flex items-center gap-1"
                title="Operator Access"
              >
                <Lock className="w-3 h-3 text-zinc-500" />
                <span className="hidden sm:inline">LOGIN</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6">
        {/* SERVICE HERO DIAGNOSTICS BANNER */}
        <div className={`p-5 sm:p-6 border-2 shadow-[4px_4px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-6 transition ${
          isMaint
            ? "bg-[#0b141d] border-sky-500 text-sky-300"
            : isUp
            ? "bg-[#0b1712] border-emerald-500 text-emerald-300"
            : isWarn
            ? "bg-[#1c1409] border-amber-500 text-amber-300"
            : "bg-[#1f0b0e] border-rose-600 text-rose-300"
        }`}>
          <div className="flex items-start sm:items-center space-x-4 min-w-0">
            <div className={`w-12 h-12 flex items-center justify-center shrink-0 border-2 ${
              isMaint
                ? "bg-sky-950 border-sky-400 text-sky-400"
                : isUp
                ? "bg-emerald-950 border-emerald-400 text-emerald-400"
                : isWarn
                ? "bg-amber-950 border-amber-400 text-amber-400"
                : "bg-rose-950 border-rose-500 text-rose-400"
            }`}>
              {isMaint ? (
                <Radio className="w-6 h-6 animate-pulse" />
              ) : isUp ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : isWarn ? (
                <AlertTriangle className="w-6 h-6" />
              ) : (
                <AlertCircle className="w-6 h-6 animate-pulse" />
              )}
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white uppercase truncate">
                  {service.name}
                </h1>
                <span className="px-2 py-0.5 text-[10px] bg-black/60 border border-zinc-700 text-zinc-300 uppercase font-mono font-bold">
                  {service.group_name}
                </span>
                <span className="px-2 py-0.5 text-[10px] bg-zinc-900 border border-zinc-700 text-emerald-400 uppercase font-mono font-bold">
                  {service.type}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400 font-mono">
                {service.endpoint && (
                  <span className="truncate max-w-sm sm:max-w-md text-zinc-300">
                    TARGET: {service.endpoint}
                  </span>
                )}
                {service.port && <span>PORT: {service.port}</span>}
                {service.created_at > 0 && (
                  <span className="text-zinc-500">
                    ENROLLED: {new Date(Number(service.created_at)).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3 shrink-0 self-start md:self-auto">
            <span className={`px-3 py-1.5 text-xs font-black uppercase border-2 shadow-[2px_2px_0px_#000] tracking-wider ${
              isMaint
                ? "bg-sky-950 border-sky-500 text-sky-400"
                : isUp
                ? "bg-emerald-950 border-emerald-500 text-emerald-400"
                : isWarn
                ? "bg-amber-950 border-amber-500 text-amber-400"
                : "bg-rose-950 border-rose-500 text-rose-400"
            }`}>
              {isMaint ? "[ MAINTENANCE ]" : isUp ? "[ OPERATIONAL ]" : isWarn ? "[ DEGRADED ]" : "[ OUTAGE ]"}
            </span>
          </div>
        </div>

        {/* 4-COLUMN MULTI-WINDOW SLA & METRICS GRID */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 bg-[#0b0f17] border-2 border-zinc-800 shadow-[3px_3px_0px_#000] space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase font-mono block">24-Hour SLA</span>
            <div className="text-lg sm:text-2xl font-black text-white font-mono">
              {service.stats.uptime_24h}%
            </div>
            <span className="text-[10px] text-emerald-400 font-mono block">Past 24h checks</span>
          </div>

          <div className="p-4 bg-[#0b0f17] border-2 border-zinc-800 shadow-[3px_3px_0px_#000] space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase font-mono block">7-Day SLA</span>
            <div className="text-lg sm:text-2xl font-black text-white font-mono">
              {service.stats.uptime_7d}%
            </div>
            <span className="text-[10px] text-emerald-400 font-mono block">Rolling weekly window</span>
          </div>

          <div className="p-4 bg-[#0b0f17] border-2 border-zinc-800 shadow-[3px_3px_0px_#000] space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase font-mono block">30-Day Availability</span>
            <div className="text-lg sm:text-2xl font-black text-emerald-400 font-mono">
              {service.stats.uptime_30d}%
            </div>
            <span className="text-[10px] text-zinc-500 font-mono block">30-day telemetry ledger</span>
          </div>

          <div className="p-4 bg-[#0b0f17] border-2 border-zinc-800 shadow-[3px_3px_0px_#000] space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase font-mono block">Response Time (Avg)</span>
            <div className="text-lg sm:text-2xl font-black text-cyan-400 font-mono">
              {service.latency_ms > 0 ? `${service.latency_ms}ms` : "0ms"}
            </div>
            <span className="text-[10px] text-zinc-500 font-mono block">
              P95: {service.stats.p95_latency}ms
            </span>
          </div>
        </div>

        {/* 30-DAY HEARTBEAT STRIP CARD */}
        <div className="p-5 bg-[#0b0f17] border-2 border-zinc-800 shadow-[4px_4px_0px_#000] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-white uppercase flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>30-Day Heartbeat Availability History</span>
            </span>
            <span className="text-[10px] text-zinc-500 uppercase font-mono">
              {service.stats.total_checks_30d} Total Probes
            </span>
          </div>

          <HeartbeatBars blocks={service.historyBlocks} compact={false} />

          <div className="flex items-center justify-between pt-1 text-[10px] text-zinc-500 font-mono">
            <span>30 DAYS AGO</span>
            <span className="text-zinc-400 font-bold">100% OPERATIONAL OBJECTIVE</span>
            <span>TODAY</span>
          </div>
        </div>

        {/* API RESPONSE TIME GRAPH CARD */}
        <div className="p-5 bg-[#0b0f17] border-2 border-zinc-800 shadow-[4px_4px_0px_#000] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs font-black text-white uppercase tracking-wider">
                API Response Time Telemetry (Past 24 Hours)
              </h2>
            </div>

            {/* Latency Stats Badges */}
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
              <span className="px-2 py-0.5 bg-black border border-zinc-800 text-zinc-400">
                MIN: <strong className="text-white">{service.stats.min_latency}ms</strong>
              </span>
              <span className="px-2 py-0.5 bg-black border border-zinc-800 text-zinc-400">
                AVG: <strong className="text-cyan-300">{service.stats.avg_latency}ms</strong>
              </span>
              <span className="px-2 py-0.5 bg-black border border-zinc-800 text-zinc-400">
                P95: <strong className="text-amber-300">{service.stats.p95_latency}ms</strong>
              </span>
              <span className="px-2 py-0.5 bg-black border border-zinc-800 text-zinc-400">
                PEAK: <strong className="text-rose-400">{service.stats.max_latency}ms</strong>
              </span>
            </div>
          </div>

          {/* Interactive Responsive SVG Graph */}
          <div className="relative bg-black border border-zinc-800/80 p-2 overflow-hidden">
            {hoveredPoint && (
              <div className="absolute top-3 right-3 px-3 py-1.5 bg-zinc-900 border border-cyan-500 text-xs text-white font-mono shadow-lg flex items-center space-x-3 pointer-events-none z-10">
                <span className="text-zinc-400">
                  {new Date(hoveredPoint.timestamp).toLocaleTimeString()}
                </span>
                <span className="text-cyan-300 font-bold">
                  {hoveredPoint.latency_ms}ms
                </span>
                <span className={`px-1.5 py-0.2 text-[9px] font-bold ${
                  hoveredPoint.status_code >= 400 ? "bg-rose-950 text-rose-300" : "bg-emerald-950 text-emerald-300"
                }`}>
                  HTTP {hoveredPoint.status_code}
                </span>
              </div>
            )}

            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-48 sm:h-64 overflow-visible"
            >
              <defs>
                <linearGradient id="latencyAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid lines and labels */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const y = padTop + graphH - ratio * graphH;
                const val = Math.round(ratio * yCeil);
                return (
                  <g key={idx}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={svgWidth - padRight}
                      y2={y}
                      stroke="#27272a"
                      strokeDasharray="2 3"
                    />
                    <text
                      x={padLeft - 8}
                      y={y + 3}
                      fill="#71717a"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="end"
                    >
                      {val}ms
                    </text>
                  </g>
                );
              })}

              {/* Area fill */}
              {areaPathD && (
                <path d={areaPathD} fill="url(#latencyAreaGrad)" />
              )}

              {/* Main Line */}
              {linePathD && (
                <path
                  d={linePathD}
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}

              {/* Data points */}
              {coordinates.map((pt, idx) => {
                const isFail = pt.status_code >= 400 || pt.status_code === 0;
                return (
                  <circle
                    key={idx}
                    cx={pt.x}
                    cy={pt.y}
                    r={hoveredPoint?.timestamp === pt.timestamp ? 5 : 3}
                    fill={isFail ? "#f43f5e" : "#06b6d4"}
                    stroke="#000"
                    strokeWidth="1.5"
                    className="cursor-pointer transition-all duration-150"
                    onMouseEnter={() => setHoveredPoint(pt)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                );
              })}
            </svg>

            {/* Time Scale Footer */}
            <div className="flex items-center justify-between px-2 pt-2 text-[10px] text-zinc-500 font-mono border-t border-zinc-900">
              <span>24 HOURS AGO</span>
              <span className="text-zinc-600">LIVE LATENCY PROBES</span>
              <span>NOW</span>
            </div>
          </div>
        </div>

        {/* PROJECT INCIDENT HISTORY CARD */}
        <div className="p-5 bg-[#0b0f17] border-2 border-zinc-800 shadow-[4px_4px_0px_#000] space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <span className="text-xs font-black text-white uppercase flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Project Incident History &amp; Postmortems</span>
            </span>
            <span className="text-[10px] text-zinc-500 uppercase font-mono">
              {incidents.length} Recorded
            </span>
          </div>

          {/* Active Incidents Alert */}
          {activeIncidents.length > 0 && (
            <div className="p-4 bg-rose-950/70 border-2 border-rose-600 space-y-3">
              <div className="flex items-center space-x-2 text-rose-400 font-black text-xs uppercase">
                <AlertCircle className="w-4 h-4 animate-pulse shrink-0" />
                <span>ACTIVE OUTAGE IN PROGRESS FOR THIS TARGET</span>
              </div>
              {activeIncidents.map((inc) => (
                <div key={inc.id} className="p-3 bg-black border border-rose-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white uppercase">{inc.title}</span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      Started: {new Date(inc.first_seen_at).toLocaleTimeString()}
                    </span>
                  </div>
                  {inc.message && <p className="text-zinc-300 font-sans text-xs">{inc.message}</p>}
                  <Link
                    to={`/incidents/${inc.id}`}
                    className="inline-block text-[10px] text-cyan-400 hover:text-cyan-300 uppercase font-bold"
                  >
                    View Live Incident Timeline &rarr;
                  </Link>
                </div>
              ))}
            </div>
          )}

          {/* Past Incidents List */}
          {resolvedIncidents.length === 0 && activeIncidents.length === 0 ? (
            <div className="p-6 bg-black border border-zinc-800 text-center space-y-1.5">
              <p className="text-xs text-emerald-400 font-bold uppercase flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>No incidents reported for this target in the past 30 days.</span>
              </p>
              <p className="text-[11px] text-zinc-500 font-sans">
                Continuous synthetic health checks operated with 100% nominal availability.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {resolvedIncidents.map((inc) => (
                <div
                  key={inc.id}
                  className="p-4 bg-black border border-zinc-800 hover:border-zinc-700 transition space-y-2 text-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center space-x-2">
                      <span className="px-1.5 py-0.5 text-[9px] font-black uppercase bg-emerald-950 border border-emerald-500 text-emerald-400 shrink-0">
                        [RESOLVED]
                      </span>
                      <h3 className="font-bold text-white uppercase">{inc.title}</h3>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {new Date(inc.last_seen_at).toLocaleDateString()} at {new Date(inc.last_seen_at).toLocaleTimeString()}
                    </span>
                  </div>

                  {inc.message && (
                    <p className="text-zinc-400 text-xs font-sans leading-relaxed">
                      {inc.message}
                    </p>
                  )}

                  {inc.updates && inc.updates.length > 0 && (
                    <div className="pt-2 pl-3 border-l-2 border-zinc-800 space-y-1.5 mt-2">
                      <span className="text-[9px] text-zinc-500 font-bold uppercase block">
                        Chronological Updates:
                      </span>
                      {inc.updates.map((u) => (
                        <div key={u.id} className="text-[11px] space-y-0.5">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-[9px] text-cyan-400 font-mono uppercase font-bold">
                              [{u.status}]
                            </span>
                            <span className="text-[9px] text-zinc-500 font-mono">
                              {new Date(u.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-zinc-300 font-sans">{u.message}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-1">
                    <Link
                      to={`/incidents/${inc.id}`}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 uppercase font-bold"
                    >
                      Inspect Postmortem Incident Report &rarr;
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PROJECT DYNAMIC SVG BADGE & MARKDOWN EMBED */}
        <div className="p-5 bg-[#0b0f17] border-2 border-zinc-800 shadow-[4px_4px_0px_#000] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-white uppercase flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Project Dynamic Status Badge</span>
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">Shields.io Compatible</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 py-1">
            <img 
              src={badgeUrl} 
              alt={`${service.name} Status`} 
              className="h-5 w-auto block max-w-full"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                const fallbackUrl = `https://crystal-heimdall.vercel.app/api/v1/badges/service/${service.id}/status.svg`;
                if (target.src !== fallbackUrl) {
                  target.src = fallbackUrl;
                }
              }}
            />
            <span className="text-[10px] text-zinc-500 font-mono">
              Dynamic SVG renders live operational state and links to this page.
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-zinc-400 uppercase font-bold">
              README Markdown Embed:
            </span>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={markdownEmbed}
                className="w-full p-2 bg-black border border-zinc-700 text-[11px] text-cyan-300 font-mono outline-none"
              />
              <button
                onClick={() => handleCopy("badge", markdownEmbed)}
                className="px-3 py-2 bg-zinc-900 border border-zinc-700 hover:border-emerald-400 text-zinc-300 hover:text-white text-xs font-bold uppercase shrink-0 transition"
              >
                {copiedKey === "badge" ? "COPIED" : "COPY"}
              </button>
            </div>
          </div>
        </div>

        {/* BRUTALIST FOOTER */}
        <footer className="mt-12 border-t-2 border-zinc-800 pt-8 pb-4 text-xs font-mono text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <span className="text-white font-bold uppercase">
              Crystal Studio Labs • Autonomous Sentinel
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/" className="text-zinc-400 hover:text-white transition">
              STATUS PAGE
            </Link>
            <Link to="/incidents" className="text-zinc-400 hover:text-white transition">
              INCIDENTS
            </Link>
            <Link to="/overview" className="text-zinc-400 hover:text-white transition">
              OVERVIEW
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
