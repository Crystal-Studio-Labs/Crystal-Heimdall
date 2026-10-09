import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck, 
  Globe, 
  Search, 
  Share2,
  ChevronLeft,
  ChevronRight,
  Flame,
  ExternalLink,
  Volume2,
  VolumeX,
  Lock,
  Activity,
  Mail,
  Shield
} from "lucide-react";
import HeartbeatBars, { HistoryBlock } from "../components/HeartbeatBars";
import { useToast } from "../lib/ToastContext";
import { isAudioMuted, setAudioMuted, playCriticalAlarm, playTestSound } from "../lib/audioAlerts";

interface PublicService {
  id: string;
  name: string;
  type: string;
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
  const [activeTypeTab, setActiveTypeTab] = useState<"all" | "http" | "cron" | "sink">("all");
  const [incidentFilter, setIncidentFilter] = useState<"all" | "active" | "resolved">("all");

  // Pagination states
  const [servicesPage, setServicesPage] = useState(1);
  const servicesPerPage = 5;

  const [incidentsPage, setIncidentsPage] = useState(1);
  const incidentsPerPage = 4;

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
    fetchStatus().then(() => toast.info("Status ledger updated with latest probes"));
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
  const showSla = settings.show_sla === true || settings.show_sla === "true" || settings.show_sla === undefined;
  const showIncidents = settings.show_incidents === true || settings.show_incidents === "true" || settings.show_incidents === undefined;
  const announcementType = settings.announcement_type || "none";
  const announcementBanner = settings.announcement_banner || "";

  // Filter Services
  const filteredServices = data.services.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.type.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (activeTypeTab === "http") return s.type.includes("http");
    if (activeTypeTab === "cron") return s.type.includes("cron");
    if (activeTypeTab === "sink") return s.type.includes("sink") || s.type.includes("webhook");
    return true;
  });

  // Services Pagination
  const totalServicesPages = Math.ceil(filteredServices.length / servicesPerPage) || 1;
  const currentServices = filteredServices.slice(
    (servicesPage - 1) * servicesPerPage,
    servicesPage * servicesPerPage
  );

  // Filter Incidents
  const filteredIncidents = data.recentIncidents.filter((inc) => {
    if (incidentFilter === "active") return inc.status !== "resolved";
    if (incidentFilter === "resolved") return inc.status === "resolved";
    return true;
  });

  // Incidents Pagination
  const totalIncidentsPages = Math.ceil(filteredIncidents.length / incidentsPerPage) || 1;
  const currentIncidents = filteredIncidents.slice(
    (incidentsPage - 1) * incidentsPerPage,
    incidentsPage * incidentsPerPage
  );

  return (
    <div className="min-h-screen bg-[#070a0f] text-zinc-100 font-mono pb-24 relative overflow-hidden">
      {/* Top Header */}
      <header className="border-b-2 border-zinc-800 bg-[#070a0f] sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-3 font-bold">
            <div className="w-7 h-7 bg-zinc-900 border border-emerald-400 flex items-center justify-center text-emerald-400">
              <Activity className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-white text-xs tracking-tight uppercase">
                {settings.page_title || "Uptime Tracker For Crystal Studio Labs"}
              </span>
              <span className="text-[9px] text-emerald-400 -mt-0.5 uppercase tracking-widest font-normal">
                [AUTONOMOUS SENTINEL LIVE]
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Sound Alarm Toggle */}
            <button
              onClick={handleToggleSound}
              className={`px-2.5 py-1.5 border flex items-center gap-1.5 text-xs font-bold uppercase transition shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] ${
                muted
                  ? "bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white"
                  : "bg-rose-950/80 border-rose-500 text-rose-300"
              }`}
              title={muted ? "Unmute Siren Alerts" : "Siren Alerts Armed (Audio Alert will play on downtime)"}
            >
              {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-rose-400 animate-pulse" />}
              <span className="hidden sm:inline">{muted ? "MUTED" : "ALARM ON"}</span>
            </button>

            <button
              onClick={handleShareStatus}
              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 transition flex items-center gap-1.5 text-xs font-mono shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
              title="Copy shareable status link"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">SHARE</span>
            </button>

            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 transition flex items-center gap-1.5 text-xs font-mono shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
              title="Refresh telemetry status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`} />
              <span className="hidden sm:inline">REFRESH</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 space-y-8">
        {/* GRAND INDUSTRIAL STATUS HERO */}
        <section
          className={`p-6 sm:p-8 border-2 shadow-[6px_6px_0px_#000] space-y-6 transition-all ${
            isAllGood
              ? "bg-[#0b1712] border-emerald-500 text-emerald-300"
              : isDegraded
              ? "bg-[#1f1707] border-amber-500 text-amber-300"
              : "bg-[#21090c] border-rose-600 text-rose-300"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-start space-x-4">
              <div
                className={`w-14 h-14 flex items-center justify-center shrink-0 border-2 ${
                  isAllGood
                    ? "bg-emerald-950 border-emerald-400 text-emerald-400"
                    : isDegraded
                    ? "bg-amber-950 border-amber-400 text-amber-400"
                    : "bg-rose-950 border-rose-500 text-rose-400"
                }`}
              >
                {isAllGood ? (
                  <CheckCircle2 className="w-8 h-8" />
                ) : isDegraded ? (
                  <AlertTriangle className="w-8 h-8" />
                ) : (
                  <AlertCircle className="w-8 h-8" />
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 text-[10px] font-black uppercase bg-black border border-current">
                    {isAllGood ? "[SYS.OK]" : isDegraded ? "[SYS.DEGRADED]" : "[SYS.OUTAGE]"}
                  </span>
                  <span className="text-xs uppercase text-zinc-400 font-bold">
                    {settings.page_title || "Uptime Tracker For Crystal Studio Labs"}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white uppercase">
                  {isAllGood
                    ? "All Systems Operational"
                    : isDegraded
                    ? "Partial Disruption Detected"
                    : "Active Service Outage"}
                </h1>
                <p className="text-xs text-zinc-300 font-sans max-w-xl">
                  {settings.page_description ||
                    "Continuous multi-point health monitoring across all public platforms, APIs, and microservices."}
                </p>
              </div>
            </div>

            <div className="sm:text-right shrink-0">
              <div className="inline-flex items-center space-x-2 px-3 py-1.5 bg-black border-2 border-zinc-700 text-xs">
                <span className="w-2 h-2 bg-emerald-400 animate-pulse" />
                <span className="text-white font-black">{data.avgUptime}% UPTIME</span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1 uppercase">
                POLLED AT {new Date(data.lastUpdated).toLocaleTimeString()}
              </p>
            </div>
          </div>

          {/* Aggregate Metrics Strip (Conditional SLA Display) */}
          {showSla && (
            <div className="pt-4 border-t-2 border-zinc-800 grid grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-black/60 border border-zinc-800">
                <span className="text-zinc-500 text-[10px] uppercase font-bold block">// MONITORED NODES //</span>
                <span className="text-white font-black text-sm sm:text-base">{data.services.length} Public Services</span>
              </div>
              <div className="p-3 bg-black/60 border border-zinc-800">
                <span className="text-zinc-500 text-[10px] uppercase font-bold block">// 30-DAY FLEET SLA //</span>
                <span className="text-emerald-400 font-black text-sm sm:text-base">{data.avgUptime}% Nominal</span>
              </div>
              <div className="p-3 bg-black/60 border border-zinc-800">
                <span className="text-zinc-500 text-[10px] uppercase font-bold block">// HEARBEAT INTERVAL //</span>
                <span className="text-zinc-200 font-black text-sm sm:text-base">60s Probes</span>
              </div>
            </div>
          )}
        </section>

        {/* UPTIME KUMA LIVE ANNOUNCEMENT BANNER */}
        {announcementType !== "none" && announcementBanner && (
          <section
            className={`p-4 border-2 shadow-[4px_4px_0px_#000] flex items-start gap-3.5 ${
              announcementType === "critical"
                ? "bg-rose-950/60 border-rose-500 text-rose-200"
                : announcementType === "warning"
                ? "bg-amber-950/60 border-amber-500 text-amber-200"
                : "bg-cyan-950/60 border-cyan-500 text-cyan-200"
            }`}
          >
            {announcementType === "critical" ? (
              <Flame className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            ) : announcementType === "warning" ? (
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-cyan-400 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <span className="font-black text-xs uppercase tracking-wider block">
                [{announcementType.toUpperCase()} ANNOUNCEMENT & NOTIFICATION]:
              </span>
              <p className="text-xs font-sans leading-relaxed">{announcementBanner}</p>
            </div>
          </section>
        )}

        {/* 30-DAY SERVICES LEDGER WITH PAGINATION */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b-2 border-zinc-800">
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-tight">
                Active Monitored Targets ({filteredServices.length})
              </h2>
              <p className="text-xs text-zinc-400 font-sans">
                30-day continuous availability blocks and real-time response latency.
              </p>
            </div>

            {/* Filter Search & Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Filter targets..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setServicesPage(1);
                  }}
                  className="p-2 pl-8 bg-black border-2 border-zinc-700 text-xs text-white placeholder-zinc-500 outline-none focus:border-cyan-400 font-mono w-44 sm:w-52"
                />
              </div>

              {/* Category Filter */}
              <div className="flex border border-zinc-700 bg-zinc-900 p-0.5 text-xs">
                {(["all", "http", "cron", "sink"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveTypeTab(tab);
                      setServicesPage(1);
                    }}
                    className={`px-2.5 py-1 uppercase text-[10px] font-bold transition ${
                      activeTypeTab === tab
                        ? "bg-zinc-700 text-white"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Services List */}
          <div className="space-y-4">
            {filteredServices.length === 0 ? (
              <div className="p-8 bg-[#0b0f17] border-2 border-zinc-800 text-center space-y-2">
                <Globe className="w-8 h-8 text-zinc-600 mx-auto" />
                <h3 className="font-bold text-white text-xs uppercase">No Matching Targets Found</h3>
                <p className="text-xs text-zinc-500">No public targets match the current filter query.</p>
              </div>
            ) : (
              currentServices.map((svc) => {
                const isUp = svc.status === "healthy";
                const isWarn = svc.status === "warning";
                const isMaint = svc.status === "maintenance" || svc.is_maintenance === 1;

                return (
                  <div
                    key={svc.id}
                    className="p-5 sm:p-6 bg-[#0b0f17] border-2 border-zinc-700 shadow-[3px_3px_0px_#000] hover:border-zinc-500 transition-all space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span
                          className={`w-3 h-3 inline-block shrink-0 ${
                            isMaint
                              ? "bg-sky-400"
                              : isUp
                              ? "bg-emerald-400 shadow-[0_0_6px_#10b981]"
                              : isWarn
                              ? "bg-amber-400"
                              : "bg-rose-500"
                          }`}
                        />
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="font-black text-white text-sm sm:text-base tracking-tight uppercase">
                              {svc.name}
                            </h3>
                            {isMaint && (
                              <span className="px-1.5 py-0.5 text-[9px] bg-sky-950 border border-sky-500 text-sky-400 font-bold uppercase">
                                [MAINTENANCE]
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-zinc-500 uppercase">{svc.type}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-sm sm:text-base font-black text-emerald-400">
                          {svc.uptime_pct || 99.9}%
                        </span>
                        <p className="text-[11px] text-zinc-400">
                          {svc.latency_ms > 0 ? `${svc.latency_ms}ms latency` : "Cron Switch"}
                        </p>
                      </div>
                    </div>

                    {/* 30-Day Segmented Block Strip */}
                    <HeartbeatBars blocks={svc.historyBlocks} />
                  </div>
                );
              })
            )}
          </div>

          {/* Services Pagination Controls */}
          {filteredServices.length > servicesPerPage && (
            <div className="p-4 bg-[#0b0f17] border-2 border-zinc-800 flex items-center justify-between text-xs">
              <button
                onClick={() => setServicesPage((p) => Math.max(p - 1, 1))}
                disabled={servicesPage === 1}
                className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-800 flex items-center gap-1 font-bold"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>PREV</span>
              </button>

              <span className="text-zinc-400 font-bold uppercase">
                PAGE {servicesPage} OF {totalServicesPages} • SHOWING {Math.min((servicesPage - 1) * servicesPerPage + 1, filteredServices.length)}-{Math.min(servicesPage * servicesPerPage, filteredServices.length)} OF {filteredServices.length}
              </span>

              <button
                onClick={() => setServicesPage((p) => Math.min(p + 1, totalServicesPages))}
                disabled={servicesPage === totalServicesPages}
                className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-800 flex items-center gap-1 font-bold"
              >
                <span>NEXT</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </section>

        {/* INCIDENT HISTORY & AUDIT LOG (CONDITIONAL DISPLAY) */}
        {showIncidents && (
          <section className="space-y-4 pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b-2 border-zinc-800">
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-tight">
                  Recent Incidents & Outage Ledger
                </h2>
                <p className="text-xs text-zinc-400 font-sans">
                  30-day incident window • Verified transparency logs
                </p>
              </div>

              {/* Incident filter */}
              <div className="flex border border-zinc-700 bg-zinc-900 p-0.5 text-xs self-start sm:self-auto">
                {(["all", "active", "resolved"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => {
                      setIncidentFilter(filter);
                      setIncidentsPage(1);
                    }}
                    className={`px-3 py-1 capitalize text-xs font-bold transition ${
                      incidentFilter === filter
                        ? "bg-zinc-700 text-white"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {filteredIncidents.length === 0 ? (
              <div className="p-8 bg-[#0b0f17] border-2 border-zinc-800 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <h3 className="font-bold text-white text-xs uppercase">No Recent Incidents Reported</h3>
                <p className="text-xs text-zinc-400 font-sans">
                  All systems operated nominally with zero unplanned outages in the preceding 30 days.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentIncidents.map((inc) => {
                  const isResolved = inc.status === "resolved";
                  return (
                    <div
                      key={inc.id}
                      className="p-5 bg-[#0b0f17] border-2 border-zinc-700 shadow-[3px_3px_0px_#000] space-y-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-black uppercase ${
                              isResolved
                                ? "bg-emerald-950 border border-emerald-500 text-emerald-400"
                                : inc.severity === "critical"
                                ? "bg-rose-950 border border-rose-500 text-rose-400"
                                : "bg-amber-950 border border-amber-500 text-amber-400"
                            }`}
                          >
                            [{isResolved ? "RESOLVED" : inc.severity.toUpperCase()}]
                          </span>
                          <span className="font-bold text-white text-xs sm:text-sm">{inc.title}</span>
                        </div>
                        <span className="text-[11px] text-zinc-400">
                          {new Date(inc.last_seen_at).toLocaleDateString()}
                        </span>
                      </div>

                      {inc.message && (
                        <p className="text-zinc-300 text-xs bg-black p-3 border border-zinc-800">
                          {inc.message}
                        </p>
                      )}
                    </div>
                  );
                })}

                {/* Incidents Pagination */}
                {filteredIncidents.length > incidentsPerPage && (
                  <div className="p-3 bg-[#0b0f17] border border-zinc-800 flex items-center justify-between text-xs">
                    <button
                      onClick={() => setIncidentsPage((p) => Math.max(p - 1, 1))}
                      disabled={incidentsPage === 1}
                      className="px-2.5 py-1 bg-zinc-900 border border-zinc-700 disabled:opacity-30 hover:bg-zinc-800"
                    >
                      PREV
                    </button>
                    <span className="text-zinc-400 font-bold">
                      PAGE {incidentsPage} OF {totalIncidentsPages}
                    </span>
                    <button
                      onClick={() => setIncidentsPage((p) => Math.min(p + 1, totalIncidentsPages))}
                      disabled={incidentsPage === totalIncidentsPages}
                      className="px-2.5 py-1 bg-zinc-900 border border-zinc-700 disabled:opacity-30 hover:bg-zinc-800"
                    >
                      NEXT
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* PROPER INDUSTRIAL BRUTALIST FOOTER WITH CRYSTAL STUDIO LABS DATA */}
        <footer className="mt-16 border-t-2 border-zinc-800 bg-[#070a0f] pt-10 pb-8 text-xs font-mono">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b-2 border-zinc-800/80">
            {/* Col 1: Crystal Studio Labs Identity */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-zinc-900 border border-emerald-400 flex items-center justify-center text-emerald-400">
                  <Activity className="w-3.5 h-3.5" />
                </div>
                <span className="font-black text-white uppercase tracking-tight text-sm">
                  Crystal Studio Labs
                </span>
              </div>
              <p className="text-zinc-400 text-xs font-sans leading-relaxed">
                Autonomous reliability engineering, distributed infrastructure sentinels, and edge intelligence systems.
              </p>
              <div className="space-y-1.5 pt-1 text-[11px]">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Mail className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <a href="mailto:connect.crystalstudio@gmail.com" className="text-cyan-400 hover:underline">
                    connect.crystalstudio@gmail.com
                  </a>
                </div>
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <span className="w-1.5 h-1.5 bg-emerald-400 inline-block animate-pulse" />
                  <span>AUTONOMOUS SENTINEL: LIVE (30s POLL)</span>
                </div>
              </div>
            </div>

            {/* Col 2: Monitored Fleet & Ecosystem */}
            <div className="space-y-3">
              <span className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase block border-b border-zinc-800 pb-1">
                // ECOSYSTEM FLEET //
              </span>
              <ul className="space-y-2 text-xs">
                <li>
                  <a
                    href="https://github.com/Crystal-Studio-Labs/Argus"
                    target="_blank"
                    rel="noreferrer"
                    className="text-zinc-300 hover:text-emerald-400 transition flex items-center justify-between group"
                  >
                    <span>Argus — Security & PR Sentinel</span>
                    <ExternalLink className="w-3 h-3 text-zinc-600 group-hover:text-emerald-400" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/Crystal-Studio-Labs/Campus-Relay"
                    target="_blank"
                    rel="noreferrer"
                    className="text-zinc-300 hover:text-emerald-400 transition flex items-center justify-between group"
                  >
                    <span>Campus Relay — Decentralized Network</span>
                    <ExternalLink className="w-3 h-3 text-zinc-600 group-hover:text-emerald-400" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/Crystal-Studio-Labs/KrishiSetu-ML-Model"
                    target="_blank"
                    rel="noreferrer"
                    className="text-zinc-300 hover:text-emerald-400 transition flex items-center justify-between group"
                  >
                    <span>KrishiSetu AI — Edge ML Diagnostics</span>
                    <ExternalLink className="w-3 h-3 text-zinc-600 group-hover:text-emerald-400" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/Crystal-Studio-Labs"
                    target="_blank"
                    rel="noreferrer"
                    className="text-zinc-300 hover:text-cyan-400 transition flex items-center justify-between group"
                  >
                    <span>Crystal Studio Labs Org Repositories</span>
                    <ExternalLink className="w-3 h-3 text-zinc-600 group-hover:text-cyan-400" />
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 3: Reliability & Protocol Specs */}
            <div className="space-y-3">
              <span className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase block border-b border-zinc-800 pb-1">
                // PROTOCOL STANDARDS //
              </span>
              <div className="space-y-2 text-[11px] text-zinc-400">
                <div className="flex items-center justify-between p-2 bg-[#0b0f17] border border-zinc-800">
                  <span className="text-zinc-500">OPERATIONAL SLA</span>
                  <span className="text-emerald-400 font-bold">99.9% CONTINUOUS</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-[#0b0f17] border border-zinc-800">
                  <span className="text-zinc-500">AUTH ISOLATION</span>
                  <span className="text-emerald-400 font-bold">RFC 6238 2FA ONLY</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-[#0b0f17] border border-zinc-800">
                  <span className="text-zinc-500">INCIDENT DISPATCH</span>
                  <span className="text-cyan-400 font-bold">KLAXON ALARM & DSN SINK</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar: Copyright & Minimal Operator Access */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
            <div>
              <span>{settings.footer_text || "Crystal Studio Labs • Autonomous Reliability Sentinel"}</span>
              <span className="mx-2 text-zinc-700">|</span>
              <span>&copy; {new Date().getFullYear()}</span>
            </div>

            <div className="flex items-center space-x-3">
              <a
                href={settings.support_url || "https://github.com/Crystal-Studio-Labs"}
                target="_blank"
                rel="noreferrer"
                className="text-zinc-400 hover:text-white flex items-center gap-1 font-bold transition text-xs"
              >
                <span>SUPPORT / GITHUB</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              {/* Minimal Operator Login */}
              <Link
                to="/login"
                className="px-2.5 py-1 bg-black hover:bg-zinc-900 border border-zinc-700 hover:border-emerald-500 text-zinc-400 hover:text-emerald-400 text-[10px] font-mono font-bold tracking-wider transition flex items-center gap-1.5 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                title="Direct 2FA Operator Console Access"
              >
                <Lock className="w-3 h-3 text-emerald-400" />
                <span>[ OPERATOR 2FA ]</span>
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
