import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  RefreshCw, 
  Globe, 
  Search, 
  Share2,
  ExternalLink,
  Volume2,
  VolumeX,
  Lock,
  Activity,
  Mail,
  LayoutDashboard,
  LogOut,
  Rss
} from "lucide-react";
import HeartbeatBars, { HistoryBlock } from "../components/HeartbeatBars";
import { useToast } from "../lib/ToastContext";
import { isAudioMuted, setAudioMuted, playCriticalAlarm, playTestSound } from "../lib/audioAlerts";
import { isOperatorAuthenticated, clearAuthToken, getSessionInfo } from "../lib/api";
import SEO from "../components/SEO";

interface PublicService {
  id: string;
  name: string;
  type: string;
  group_name?: string;
  status: "healthy" | "warning" | "critical" | "maintenance";
  latency_ms: number;
  uptime_pct: number;
  is_maintenance?: number;
  historyBlocks: HistoryBlock[];
}

interface IncidentNotice {
  id: string;
  title: string;
  message?: string;
  severity: "info" | "warning" | "critical";
  status: "active" | "acknowledged" | "resolved";
  first_seen_at: number;
  last_seen_at: number;
  occurrences_count?: number;
}

interface StatusPageSettings {
  page_title?: string;
  page_description?: string;
  announcement_banner?: string;
  announcement_type?: "none" | "info" | "warning" | "critical";
  show_sla?: string | boolean;
  show_incidents?: string | boolean;
  footer_text?: string;
  support_url?: string;
}

export default function StatusPage() {
  const toast = useToast();
  const [muted, setMuted] = useState(isAudioMuted());
  const [isAuthenticated, setIsAuthenticated] = useState(() => isOperatorAuthenticated());
  const session = getSessionInfo();
  
  const [data, setData] = useState<{
    overallStatus: "operational" | "degraded" | "outage";
    avgUptime: number;
    lastUpdated: string;
    services: PublicService[];
    recentIncidents: IncidentNotice[];
    settings?: StatusPageSettings;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const prevStatusRef = useRef<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/v1/status");
      if (res.ok) {
        const json = await res.json();
        setData(json);

        // Sound alarm detection
        if (json.overallStatus === "outage" && prevStatusRef.current && prevStatusRef.current !== "outage") {
          playCriticalAlarm();
          toast.error("TELEMETRY ALARM: Service outage detected across monitored targets!");
        }
        prevStatusRef.current = json.overallStatus;
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchStatus().then(() => toast.info("Status ledger refreshed with latest telemetry"));
  };

  const handleShareStatus = () => {
    navigator.clipboard.writeText(window.location.origin);
    toast.success("Public status URL copied to clipboard!");
  };

  const handleToggleSound = () => {
    const next = !muted;
    setAudioMuted(next);
    setMuted(next);
    if (!next) {
      toast.success("Siren alert audio ARMED");
      playTestSound();
    } else {
      toast.info("Siren alert audio MUTED");
    }
  };

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-[#070a0f] text-zinc-100 flex items-center justify-center font-mono text-xs">
        <div className="flex flex-col items-center space-y-4 p-8 bg-[#0b0f17] border-2 border-zinc-700 shadow-[4px_4px_0px_#000]">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
          <span className="text-zinc-300 font-bold uppercase tracking-wider">
            [SYNCING TELEMETRY CONDUITS...]
          </span>
        </div>
      </div>
    );
  }

  const isAllGood = data.overallStatus === "operational";
  const isDegraded = data.overallStatus === "degraded";

  const settings = data.settings || {};
  const showIncidents = settings.show_incidents === true || settings.show_incidents === "true" || settings.show_incidents === undefined;
  const announcementType = settings.announcement_type || "none";
  const announcementBanner = settings.announcement_banner || "";

  // Filter Services by search query
  const filteredServices = data.services.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) ||
           s.type.toLowerCase().includes(q) ||
           (s.group_name && s.group_name.toLowerCase().includes(q));
  });

  // Group services by group_name (e.g. "Production", "Campus Relay", "KrishiSetu")
  const groupedServices = filteredServices.reduce((acc, svc) => {
    const group = svc.group_name || "Production";
    if (!acc[group]) acc[group] = [];
    acc[group].push(svc);
    return acc;
  }, {} as Record<string, PublicService[]>);

  // Active vs Resolved incidents
  const activeIncidents = data.recentIncidents.filter((inc) => inc.status !== "resolved");
  const resolvedIncidents = data.recentIncidents.filter((inc) => inc.status === "resolved");

  return (
    <div className="min-h-screen bg-[#070a0f] text-zinc-100 font-mono pb-24 relative overflow-hidden">
      <SEO 
        title={settings.page_title || "Crystal Heimdall // System Status"}
        description={settings.page_description || "Continuous multi-point health monitoring across all public platforms, APIs, and microservices for Crystal Studio Labs."}
        canonicalPath="/"
        keywords={["Crystal Heimdall", "Status Page", "Uptime Robot", "Uptime Kuma", "Crystal Studio Labs", "Incident History", "System Health"]}
      />

      {/* Top Clean Header */}
      <header className="border-b-2 border-zinc-800 bg-[#070a0f]/95 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-3 font-bold">
            <div className="w-7 h-7 bg-zinc-900 border border-emerald-400 flex items-center justify-center text-emerald-400 shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-white text-xs sm:text-sm tracking-tight uppercase font-black truncate max-w-[200px] sm:max-w-xs">
                {settings.page_title || "Crystal Heimdall"}
              </span>
              <span className="text-[9px] text-emerald-400 -mt-0.5 uppercase tracking-widest font-normal">
                SYSTEM STATUS
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Audio Siren Toggle */}
            <button
              onClick={handleToggleSound}
              className={`p-1.5 sm:px-2.5 sm:py-1 border flex items-center gap-1.5 text-xs font-bold uppercase transition shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] ${
                muted
                  ? "bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white"
                  : "bg-rose-950/80 border-rose-500 text-rose-300"
              }`}
              title={muted ? "Unmute Siren Alerts" : "Siren Alerts Armed (Audio Alert on downtime)"}
            >
              {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-rose-400 animate-pulse" />}
              <span className="hidden sm:inline">{muted ? "MUTED" : "ALARM"}</span>
            </button>

            {/* Manual Refresh */}
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="p-1.5 sm:px-2.5 sm:py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 transition flex items-center gap-1.5 text-xs font-mono shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
              title="Refresh status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`} />
              <span className="hidden sm:inline">REFRESH</span>
            </button>

            {/* Operator Session Pill */}
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-black border border-emerald-400 font-bold transition flex items-center gap-1.5 text-xs shadow-[1px_1px_0px_#000]"
                title={`Active session (~${session.daysRemaining}d left). Return to Command Deck`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">[ DECK ]</span>
              </Link>
            ) : (
              <Link
                to="/login"
                className="p-1.5 sm:px-2 sm:py-1 text-zinc-500 hover:text-zinc-200 border border-transparent hover:border-zinc-800 text-[10px] font-mono tracking-wider transition flex items-center gap-1"
                title="Operator Login"
              >
                <Lock className="w-3 h-3 text-zinc-500" />
                <span className="hidden sm:inline">LOGIN</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6">
        {/* SINGLE HIGH-IMPACT STATUS HERO (UPTIME ROBOT / KUMA STYLE) */}
        <div className={`p-5 sm:p-6 border-2 shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
          isAllGood
            ? "bg-[#0b1712] border-emerald-500 text-emerald-300"
            : isDegraded
            ? "bg-[#1f1707] border-amber-500 text-amber-300"
            : "bg-[#21090c] border-rose-600 text-rose-300"
        }`}>
          <div className="flex items-center space-x-3.5">
            <div className={`w-10 h-10 flex items-center justify-center shrink-0 border-2 ${
              isAllGood
                ? "bg-emerald-950 border-emerald-400 text-emerald-400"
                : isDegraded
                ? "bg-amber-950 border-amber-400 text-amber-400"
                : "bg-rose-950 border-rose-500 text-rose-400"
            }`}>
              {isAllGood ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : isDegraded ? (
                <AlertTriangle className="w-6 h-6" />
              ) : (
                <AlertCircle className="w-6 h-6 animate-pulse" />
              )}
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white uppercase">
                {isAllGood
                  ? "All Systems Operational"
                  : isDegraded
                  ? "Partial Service Disruption"
                  : "Active Service Outage"}
              </h1>
              <p className="text-[11px] text-zinc-300 font-sans mt-0.5">
                {settings.page_description || "Continuous multi-point health monitoring across all public services."}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 self-end sm:self-auto text-xs shrink-0">
            <div className="px-3 py-1 bg-black border border-zinc-700 flex items-center space-x-2">
              <span className="w-2 h-2 bg-emerald-400 inline-block animate-pulse" />
              <span className="text-white font-black">{data.avgUptime}% UPTIME</span>
            </div>
            <span className="text-[10px] text-zinc-400 uppercase hidden md:inline">
              30-DAY WINDOW
            </span>
          </div>
        </div>

        {/* ACTIVE INCIDENTS ALERT CALLOUT (ONLY WHEN PRESENT) */}
        {activeIncidents.length > 0 && (
          <div className="p-4 bg-rose-950/70 border-2 border-rose-600 shadow-[3px_3px_0px_#000] space-y-3">
            <div className="flex items-center space-x-2 text-rose-400 font-black text-xs uppercase tracking-wide">
              <AlertCircle className="w-4 h-4 animate-pulse shrink-0" />
              <span>ACTIVE INCIDENT IN PROGRESS ({activeIncidents.length})</span>
            </div>
            {activeIncidents.map((inc) => (
              <div key={inc.id} className="p-3 bg-black/80 border border-rose-800/80 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white uppercase">{inc.title}</span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {new Date(inc.last_seen_at).toLocaleTimeString()}
                  </span>
                </div>
                {inc.message && (
                  <p className="text-zinc-300 text-xs font-sans leading-relaxed">
                    {inc.message}
                  </p>
                )}
                <div className="pt-1">
                  <Link 
                    to={`/incidents/${inc.id}`}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 uppercase font-bold flex items-center gap-1"
                  >
                    <span>View Timeline &amp; Diagnostics &rarr;</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* BROADCAST ANNOUNCEMENT BANNER (IF ACTIVE) */}
        {announcementType !== "none" && announcementBanner && (
          <div className={`p-3.5 border-2 shadow-[2px_2px_0px_#000] flex items-start gap-3 ${
            announcementType === "critical"
              ? "bg-rose-950/60 border-rose-500 text-rose-200"
              : announcementType === "warning"
              ? "bg-amber-950/60 border-amber-500 text-amber-200"
              : "bg-cyan-950/60 border-cyan-500 text-cyan-200"
          }`}>
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-current" />
            <div className="space-y-0.5 text-xs">
              <span className="font-bold uppercase tracking-wider block text-[10px]">
                NOTICE:
              </span>
              <p className="font-sans leading-relaxed">{announcementBanner}</p>
            </div>
          </div>
        )}

        {/* FILTER BAR */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-2 pl-8 bg-black border border-zinc-700 text-xs text-white placeholder-zinc-500 outline-none focus:border-cyan-400 font-mono"
            />
          </div>

          <div className="flex items-center space-x-2 text-[10px] text-zinc-500 uppercase font-mono">
            <span>{filteredServices.length} Monitored Services</span>
          </div>
        </div>

        {/* GROUPED MONITOR ROWS (UPTIME KUMA / ROBOT STYLE) */}
        <div className="space-y-6">
          {Object.keys(groupedServices).length === 0 ? (
            <div className="p-8 bg-[#0b0f17] border-2 border-zinc-800 text-center space-y-2">
              <Globe className="w-8 h-8 text-zinc-600 mx-auto" />
              <h3 className="font-bold text-white text-xs uppercase">No Public Services Found</h3>
              <p className="text-xs text-zinc-500">
                {searchQuery ? "No services match your search query." : "No services are currently flagged as public."}
              </p>
            </div>
          ) : (
            Object.entries(groupedServices).map(([group, svcs]) => (
              <div key={group} className="space-y-2">
                {/* Group Header */}
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-black text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-3 bg-cyan-400 inline-block" />
                    <span>{group}</span>
                    <span className="text-zinc-500 text-[10px] font-normal">({svcs.length})</span>
                  </span>
                  <span className="text-[10px] text-zinc-500 uppercase font-mono">
                    30-Day Availability
                  </span>
                </div>

                {/* Monitors Table / Container */}
                <div className="bg-[#0b0f17] border-2 border-zinc-800 shadow-[3px_3px_0px_#000] divide-y divide-zinc-800/80">
                  {svcs.map((svc) => {
                    const isUp = svc.status === "healthy";
                    const isWarn = svc.status === "warning";
                    const isMaint = svc.status === "maintenance" || svc.is_maintenance === 1;

                    return (
                      <div 
                        key={svc.id} 
                        className="p-3.5 sm:p-4 hover:bg-zinc-900/40 transition space-y-2.5 sm:space-y-2"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          {/* Monitor Name & Protocol */}
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <span className={`w-2.5 h-2.5 inline-block shrink-0 ${
                              isMaint 
                                ? "bg-sky-400" 
                                : isUp 
                                ? "bg-emerald-400 shadow-[0_0_6px_#10b981]" 
                                : isWarn 
                                ? "bg-amber-400" 
                                : "bg-rose-500 animate-pulse"
                            }`} />
                            <h3 className="font-bold text-white text-xs sm:text-sm uppercase tracking-tight truncate">
                              {svc.name}
                            </h3>
                            <span className="px-1.5 py-0.5 text-[9px] bg-zinc-900 border border-zinc-700 text-zinc-400 uppercase font-mono shrink-0">
                              {svc.type}
                            </span>
                          </div>

                          {/* Status Badge, Latency & Uptime */}
                          <div className="flex items-center justify-between sm:justify-end space-x-3 text-xs shrink-0">
                            <span className="text-zinc-400 font-mono text-[11px]">
                              {svc.latency_ms > 0 ? `${svc.latency_ms}ms` : "Cron Switch"}
                            </span>
                            <span className="text-emerald-400 font-black text-xs font-mono">
                              {svc.uptime_pct || 100}%
                            </span>
                            <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${
                              isMaint
                                ? "bg-sky-950 border-sky-500 text-sky-400"
                                : isUp
                                ? "bg-emerald-950/80 border-emerald-500 text-emerald-400"
                                : isWarn
                                ? "bg-amber-950/80 border-amber-500 text-amber-400"
                                : "bg-rose-950/80 border-rose-500 text-rose-400"
                            }`}>
                              {isMaint ? "[MAINT]" : isUp ? "[OPERATIONAL]" : isWarn ? "[DEGRADED]" : "[OUTAGE]"}
                            </span>
                          </div>
                        </div>

                        {/* Compact 30-Day Segmented Strip */}
                        <HeartbeatBars blocks={svc.historyBlocks} compact={true} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* PAST 30-DAY INCIDENT LOG */}
        {showIncidents && (
          <div className="space-y-3 pt-6 border-t-2 border-zinc-800">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black text-white uppercase tracking-wider">
                Past Incident History (30 Days)
              </h2>
              <Link 
                to="/incidents" 
                className="text-[10px] text-cyan-400 hover:text-cyan-300 uppercase font-bold"
              >
                View Incident Archive &rarr;
              </Link>
            </div>

            {resolvedIncidents.length === 0 && activeIncidents.length === 0 ? (
              <div className="p-4 bg-[#0b0f17] border border-zinc-800 text-center space-y-1">
                <p className="text-xs text-emerald-400 font-bold uppercase flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>No incidents reported in the past 30 days.</span>
                </p>
                <p className="text-[10px] text-zinc-500 font-sans">
                  All systems operated with nominal availability and zero unplanned interruptions.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {resolvedIncidents.slice(0, 5).map((inc) => (
                  <div 
                    key={inc.id} 
                    className="p-3 bg-[#0b0f17] border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="px-1.5 py-0.5 text-[9px] font-black uppercase bg-emerald-950 border border-emerald-500 text-emerald-400">
                          [RESOLVED]
                        </span>
                        <span className="font-bold text-white">{inc.title}</span>
                      </div>
                      {inc.message && (
                        <p className="text-zinc-400 text-[11px] font-sans truncate max-w-lg">
                          {inc.message}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {new Date(inc.last_seen_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CLEAN BRUTALIST FOOTER */}
        <footer className="mt-12 border-t-2 border-zinc-800 pt-8 pb-4 text-xs font-mono text-zinc-500">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <span className="text-white font-bold uppercase">
                {settings.footer_text || "Crystal Studio Labs • Autonomous Sentinel"}
              </span>
              <span className="text-zinc-700">|</span>
              <a
                href="/api/v1/rss"
                target="_blank"
                rel="noreferrer"
                className="text-amber-400 hover:underline flex items-center gap-1 text-[11px] font-bold"
                title="Subscribe to RSS Outage Feed"
              >
                <Rss className="w-3 h-3" />
                <span>RSS FEED</span>
              </a>
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <button
                onClick={handleShareStatus}
                className="text-zinc-400 hover:text-white flex items-center gap-1 transition"
              >
                <Share2 className="w-3 h-3" />
                <span>SHARE</span>
              </button>

              <Link to="/incidents" className="text-zinc-400 hover:text-white transition">
                INCIDENTS
              </Link>

              <a
                href={settings.support_url || "https://github.com/Crystal-Studio-Labs"}
                target="_blank"
                rel="noreferrer"
                className="text-zinc-400 hover:text-white flex items-center gap-1 transition"
              >
                <span>GITHUB</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              {isAuthenticated ? (
                <button
                  onClick={() => {
                    clearAuthToken();
                    setIsAuthenticated(false);
                    toast.info("Signed out of Operator Console");
                  }}
                  className="text-rose-400 hover:text-rose-300 font-bold transition flex items-center gap-1 ml-2"
                >
                  <LogOut className="w-3 h-3" />
                  <span>LOGOUT</span>
                </button>
              ) : (
                <Link
                  to="/login"
                  className="text-zinc-600 hover:text-zinc-400 flex items-center gap-1 transition ml-2"
                >
                  <Lock className="w-2.5 h-2.5" />
                  <span>OPERATOR</span>
                </Link>
              )}
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
