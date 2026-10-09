import React, { useEffect, useState, useCallback, useRef } from "react";
import Navbar from "../components/Navbar";
import ServiceCard, { ServiceItem } from "../components/ServiceCard";
import AddServiceModal from "../components/AddServiceModal";
import IncidentDrawer, { IncidentItem } from "../components/IncidentDrawer";
import SEO from "../components/SEO";
import { 
  ShieldCheck, 
  Plus, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Search,
  BellRing,
  Play,
  ChevronLeft,
  ChevronRight,
  Zap,
  Radio,
  Bug,
  Volume2,
  VolumeX,
  Code2,
  Copy,
  Check,
  Flame,
  Wrench,
  Server,
  Activity,
  Layers,
  FileCode
} from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "../lib/ToastContext";
import { 
  isAudioMuted, 
  setAudioMuted, 
  playCriticalAlarm, 
  playResolvedChime, 
  playCrashSound, 
  playTestSound 
} from "../lib/audioAlerts";

interface ErrorIssue {
  id: string;
  project: string;
  title: string;
  error_type: string;
  level: "fatal" | "error" | "warning";
  message: string;
  stack_trace?: string;
  environment: string;
  status: "unresolved" | "resolved" | "ignored";
  events_count: number;
  first_seen_at: number;
  last_seen_at: number;
  metadata_json?: string;
}

export default function DashboardPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"fleet" | "sentry" | "incidents">("fleet");

  // Telemetry Services state
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [errorIssues, setErrorIssues] = useState<ErrorIssue[]>([]);
  const [errorStats, setErrorStats] = useState({ total: 0, unresolved: 0, fatal: 0 });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTriggeringPoll, setIsTriggeringPoll] = useState(false);
  const [isSimulatingCrash, setIsSimulatingCrash] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<IncidentItem | null>(null);
  const [inspectingError, setInspectingError] = useState<ErrorIssue | null>(null);
  const [copiedDsn, setCopiedDsn] = useState(false);
  const [muted, setMuted] = useState(isAudioMuted());

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "public" | "private" | "issues" | "maint">("all");
  const [errorFilter, setErrorFilter] = useState<"unresolved" | "all" | "fatal" | "error">("unresolved");

  // Pagination for services
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Sound detection state tracking
  const prevStatusesRef = useRef<Record<string, string>>({});
  const prevFatalCountRef = useRef<number>(0);

  const loadData = useCallback(async () => {
    try {
      const [srvRes, incRes, errRes] = await Promise.all([
        fetch("/api/v1/services"),
        fetch("/api/v1/incidents"),
        fetch("/api/v1/telemetry/errors"),
      ]);

      if (srvRes.ok) {
        const data = await srvRes.json();
        const loadedServices: ServiceItem[] = data.services || [];
        setServices(loadedServices);

        // Sound alert detection: check if any service transitioned to critical
        let newOutageDetected = false;
        loadedServices.forEach((svc) => {
          const prev = prevStatusesRef.current[svc.id];
          if (prev && prev !== "critical" && svc.status === "critical") {
            newOutageDetected = true;
          }
          prevStatusesRef.current[svc.id] = svc.status;
        });

        if (newOutageDetected) {
          playCriticalAlarm();
          toast.error("TELEMETRY ALARM: Target transitioned to CRITICAL OUTAGE!");
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification("CRITICAL OUTAGE DETECTED", {
              body: "A monitored target dropped offline. Tap to triage.",
              icon: "/icon-192.svg"
            });
          }
        }
      }

      if (incRes.ok) {
        const data = await incRes.json();
        setIncidents(data.incidents || []);
      }

      if (errRes.ok) {
        const data = await errRes.json();
        setErrorIssues(data.issues || []);
        setErrorStats(data.stats || { total: 0, unresolved: 0, fatal: 0 });

        // Alert on new fatal crash
        if (data.stats?.fatal > prevFatalCountRef.current && prevFatalCountRef.current > 0) {
          playCrashSound();
          toast.error("SENTRY ALERT: Inbound Fatal Exception Received!");
        }
        prevFatalCountRef.current = data.stats?.fatal || 0;
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000); // 15s background poll
    return () => clearInterval(interval);
  }, [loadData]);

  // Request browser notification permission once
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    loadData().then(() => toast.info("Dashboard synced with active telemetry & crash sink"));
  };

  const handleToggleSound = () => {
    const next = !muted;
    setAudioMuted(next);
    setMuted(next);
    if (!next) {
      toast.success("Industrial siren audio ARMED");
      playTestSound();
    } else {
      toast.info("Industrial siren audio MUTED");
    }
  };

  const handleTriggerGlobalPoll = async () => {
    setIsTriggeringPoll(true);
    try {
      const res = await fetch("/api/v1/cron/poll");
      if (res.ok) {
        const json = await res.json();
        toast.success(`Synthetic cycle executed: ${json.summary?.polledCount || 0} probed, ${json.summary?.healthyCount || 0} healthy`);
        loadData();
      }
    } catch {
      toast.error("Failed to execute synthetic poll cycle");
    } finally {
      setIsTriggeringPoll(false);
    }
  };

  const handleSimulateCrash = async () => {
    setIsSimulatingCrash(true);
    try {
      const res = await fetch("/api/v1/telemetry/errors/simulate", { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        playCrashSound();
        toast.error(`Simulated Crash: ${json.issue?.title}`);
        loadData();
        setActiveTab("sentry");
      }
    } catch {
      toast.error("Failed to simulate crash");
    } finally {
      setIsSimulatingCrash(false);
    }
  };

  const handleTriageIncident = async (id: string, newStatus: "acknowledged" | "resolved") => {
    try {
      const res = await fetch(`/api/v1/incidents/${id}/ack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        if (newStatus === "resolved") {
          playResolvedChime();
        }
        toast.success(`Incident triaged to ${newStatus}`);
        loadData();
        if (selectedIncident && selectedIncident.id === id) {
          setSelectedIncident((prev) => (prev ? { ...prev, status: newStatus } : null));
        }
      }
    } catch (err) {
      toast.error("Incident triage failed");
    }
  };

  const handleTriageError = async (id: string, newStatus: "resolved" | "unresolved" | "ignored") => {
    try {
      const res = await fetch(`/api/v1/telemetry/errors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        if (newStatus === "resolved") {
          playResolvedChime();
        }
        toast.success(`Exception marked as ${newStatus}`);
        loadData();
        if (inspectingError && inspectingError.id === id) {
          setInspectingError((prev) => (prev ? { ...prev, status: newStatus } : null));
        }
      }
    } catch {
      toast.error("Failed to update error status");
    }
  };

  const handleDeleteError = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/telemetry/errors/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.info("Error record deleted");
        setInspectingError(null);
        loadData();
      }
    } catch {
      toast.error("Failed to delete error record");
    }
  };

  const handleCopyDsn = () => {
    const dsnUrl = `${window.location.origin}/api/v1/telemetry/errors`;
    navigator.clipboard.writeText(dsnUrl);
    setCopiedDsn(true);
    toast.success("Telemetry error ingestion endpoint copied!");
    setTimeout(() => setCopiedDsn(false), 2000);
  };

  // Metrics computation
  const totalServices = services.length;
  const healthyCount = services.filter((s) => s.status === "healthy").length;
  const criticalCount = services.filter((s) => s.status === "critical").length;
  const warningCount = services.filter((s) => s.status === "warning").length;
  const maintCount = services.filter((s) => s.status === "maintenance" || s.is_maintenance === 1).length;
  const publicCount = services.filter((s) => s.is_public === 1).length;

  const avgUptime = totalServices > 0 
    ? (services.reduce((acc, s) => acc + (s.uptime_pct || 99.9), 0) / totalServices).toFixed(2)
    : "100.00";

  const validLatencies = services.filter((s) => s.latency_ms > 0);
  const avgLatency = validLatencies.length > 0
    ? Math.round(validLatencies.reduce((acc, s) => acc + s.latency_ms, 0) / validLatencies.length)
    : 32;

  const activeIncidents = incidents.filter((i) => i.status !== "resolved");

  // Filtered services
  const filteredServices = services.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.endpoint && s.endpoint.toLowerCase().includes(searchQuery.toLowerCase())) ||
      s.type.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === "public") return s.is_public === 1;
    if (filterType === "private") return s.is_public === 0;
    if (filterType === "issues") return s.status === "critical" || s.status === "warning";
    if (filterType === "maint") return s.status === "maintenance" || s.is_maintenance === 1;
    return true;
  });

  // Filtered errors
  const filteredErrors = errorIssues.filter((err) => {
    if (errorFilter === "unresolved") return err.status === "unresolved";
    if (errorFilter === "fatal") return err.level === "fatal";
    if (errorFilter === "error") return err.level === "error";
    return true;
  });

  // Pagination calculation
  const totalPages = Math.ceil(filteredServices.length / itemsPerPage) || 1;
  const paginatedServices = filteredServices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="min-h-screen bg-[#070a0f] text-zinc-100 flex flex-col font-mono relative overflow-hidden pb-24">
      <SEO 
        title="Operator Command Deck // Crystal Heimdall"
        description="Operator control console for managing synthetic fleet monitors, triggering instant probes, toggling maintenance modes, and triaging Sentry crashes."
        canonicalPath="/dashboard"
        noIndex={true}
      />
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b-2 border-zinc-800">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs font-mono text-emerald-400">
              <span className="w-2 h-2 bg-emerald-400 inline-block animate-pulse" />
              <span className="font-extrabold tracking-wider">[OPERATOR COMMAND DECK // REAL-TIME]</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
              Sentinel Telemetry Operations
            </h1>
            <p className="text-xs text-zinc-400 font-sans">
              Uptime Kuma/Robot synthetic engine, Dead-Man cron watchers, and Sentry crash exception sinks.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Sound Mute Toggle */}
            <button
              onClick={handleToggleSound}
              className={`px-3 py-2 border-2 text-xs font-bold uppercase flex items-center gap-1.5 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] ${
                muted
                  ? "bg-zinc-900 border-zinc-700 text-zinc-400"
                  : "bg-rose-950 border-rose-500 text-rose-300"
              }`}
              title={muted ? "Unmute Alarm" : "Mute Alarm"}
            >
              {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-rose-400 animate-pulse" />}
              <span>{muted ? "ALARM MUTED" : "ALARM ARMED"}</span>
            </button>

            {/* Test Alarm Sound */}
            <button
              onClick={() => {
                if (muted) setAudioMuted(false);
                setMuted(false);
                playTestSound();
                toast.warning("Testing industrial siren alarm sound...");
              }}
              className="p-2 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-700 text-zinc-300 text-xs shadow-[2px_2px_0px_#000]"
              title="Test Siren Sound"
            >
              <BellRing className="w-4 h-4 text-rose-400" />
            </button>

            {/* Run Poll Cycle */}
            <button
              onClick={handleTriggerGlobalPoll}
              disabled={isTriggeringPoll}
              className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-700 text-zinc-200 text-xs font-bold uppercase flex items-center gap-2 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
              title="Run synthetic polling cycle on all registered targets"
            >
              <Play className={`w-3.5 h-3.5 ${isTriggeringPoll ? "animate-spin text-emerald-400" : "text-emerald-400"}`} />
              <span>{isTriggeringPoll ? "Probing..." : "[ RUN POLL ]"}</span>
            </button>

            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="p-2 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-700 text-zinc-300 text-xs shadow-[2px_2px_0px_#000]"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`} />
            </button>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 btn-primary text-xs flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>[ REGISTER TARGET ]</span>
            </button>
          </div>
        </div>

        {/* BRUTALIST FLEET TELEMETRY STATS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Card 1: Fleet Availability Hero (Span 2) */}
          <div className="md:col-span-2 bg-[#0b0f17] border-2 border-zinc-700 p-6 flex flex-col justify-between shadow-[4px_4px_0px_#000]">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 font-bold">
                  // FLEET SYNTHETIC AVAILABILITY //
                </span>
                <div className="flex items-baseline space-x-3 mt-2">
                  <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                    {avgUptime}%
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-black border uppercase ${
                    criticalCount > 0 
                      ? "bg-rose-950 border-rose-500 text-rose-400" 
                      : warningCount > 0 
                      ? "bg-amber-950 border-amber-500 text-amber-400" 
                      : "bg-emerald-950 border-emerald-500 text-emerald-400"
                  }`}>
                    {criticalCount > 0 ? "[CRITICAL OUTAGE]" : warningCount > 0 ? "[PARTIAL DISRUPTION]" : "[NOMINAL SLA]"}
                  </span>
                </div>
              </div>

              <div className="w-10 h-10 bg-zinc-900 border border-emerald-500 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="pt-4 grid grid-cols-4 gap-2 border-t-2 border-zinc-800 mt-6 text-xs">
              <div>
                <span className="text-zinc-500 text-[10px] uppercase font-bold block">HEALTHY</span>
                <span className="text-emerald-400 font-black text-sm">{healthyCount} / {totalServices}</span>
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] uppercase font-bold block">OUTAGES</span>
                <span className={`font-black text-sm ${criticalCount > 0 ? "text-rose-400 font-black" : "text-zinc-400"}`}>
                  {criticalCount}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] uppercase font-bold block">MAINTENANCE</span>
                <span className="text-sky-400 font-black text-sm">{maintCount}</span>
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] uppercase font-bold block">SENTRY CRASHES</span>
                <span className="text-purple-400 font-black text-sm">{errorStats.unresolved}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Round-Trip Latency */}
          <div className="bg-[#0b0f17] border-2 border-zinc-700 p-6 flex flex-col justify-between shadow-[4px_4px_0px_#000]">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 font-bold block">
                  // ROUND-TRIP LATENCY //
                </span>
                <div className="text-3xl sm:text-4xl font-black text-white mt-2">
                  {avgLatency}<span className="text-xs text-zinc-400 font-normal ml-1">ms</span>
                </div>
                <span className="inline-block px-2 py-0.5 text-[9px] font-mono font-bold bg-emerald-950 border border-emerald-500 text-emerald-300 mt-2">
                  [MEDIAN: &lt;50ms]
                </span>
              </div>
              <div className="w-8 h-8 bg-zinc-900 border border-sky-500 flex items-center justify-center text-sky-400">
                <Zap className="w-4 h-4" />
              </div>
            </div>

            <div className="pt-4 border-t-2 border-zinc-800 flex items-center justify-between text-xs">
              <span className="text-zinc-500 text-[10px]">p95: ~{Math.round(avgLatency * 1.45)}ms</span>
              <Link to="/dashboard/analytics" className="text-cyan-400 hover:text-cyan-300 font-bold uppercase text-[11px]">
                [ANALYTICS ▶]
              </Link>
            </div>
          </div>

          {/* Card 3: Crash Sentinel Quick Pill */}
          <div className="bg-[#0b0f17] border-2 border-zinc-700 p-6 flex flex-col justify-between shadow-[4px_4px_0px_#000]">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 font-bold block">
                  // SENTRY SINK SINK //
                </span>
                <div className="text-sm font-black text-white mt-2 uppercase">
                  {errorStats.unresolved} Active Issues
                </div>
                <span className={`inline-block px-2 py-0.5 text-[9px] font-mono font-bold border mt-2 ${
                  errorStats.fatal > 0 
                    ? "bg-rose-950 border-rose-500 text-rose-300"
                    : "bg-purple-950 border-purple-500 text-purple-300"
                }`}>
                  [{errorStats.fatal} FATAL UNHANDLED]
                </span>
              </div>
              <div className="w-8 h-8 bg-zinc-900 border border-purple-500 flex items-center justify-center text-purple-400">
                <Bug className="w-4 h-4" />
              </div>
            </div>

            <div className="pt-4 border-t-2 border-zinc-800 flex items-center justify-between text-xs">
              <span className="text-zinc-500 text-[10px]">Crash Ingest Active</span>
              <button 
                onClick={() => setActiveTab("sentry")}
                className="text-purple-400 hover:text-purple-300 font-bold uppercase text-[11px]"
              >
                [INSPECT SINK ▶]
              </button>
            </div>
          </div>
        </div>

        {/* DASHBOARD ROCKER CHANNEL TABS */}
        <div className="border-b-2 border-zinc-800 flex items-center gap-2 pt-2">
          {[
            { id: "fleet", label: `[01] MONITORS FLEET (${services.length})`, icon: Layers },
            { id: "sentry", label: `[02] SENTRY CRASH SENTINEL (${errorStats.unresolved})`, icon: Bug },
            { id: "incidents", label: `[03] ACTIVE INCIDENTS (${activeIncidents.length})`, icon: AlertTriangle },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2.5 text-xs font-bold font-mono uppercase flex items-center gap-2 border-t-2 border-x-2 -mb-0.5 transition ${
                  isActive
                    ? "bg-[#0b0f17] text-white border-zinc-700 border-b-transparent shadow-[2px_2px_0px_#000]"
                    : "bg-transparent text-zinc-500 border-transparent hover:text-zinc-300"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-emerald-400" : "text-zinc-500"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: FLEET MONITORS (UPTIME KUMA / ROBOT STYLE) */}
        {activeTab === "fleet" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b-2 border-zinc-800">
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-tight">
                  Monitored Services & Endpoints ({filteredServices.length})
                </h2>
                <p className="text-xs text-zinc-400 font-sans">
                  Click 'TEST' for instant single probe or 'MAINT' to toggle maintenance mode.
                </p>
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Filter targets..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="p-2 pl-8 bg-black border-2 border-zinc-700 text-xs text-white placeholder-zinc-500 outline-none focus:border-cyan-400 font-mono w-44 sm:w-52"
                  />
                </div>

                {/* Filter Tabs */}
                <div className="flex border border-zinc-700 bg-zinc-900 p-0.5 text-xs">
                  {(["all", "public", "private", "issues", "maint"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => {
                        setFilterType(tab);
                        setCurrentPage(1);
                      }}
                      className={`px-3 py-1 text-xs uppercase font-bold transition ${
                        filterType === tab
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

            {/* Target Cards Grid */}
            {isLoading ? (
              <div className="py-20 text-center text-zinc-500 font-mono text-xs flex flex-col items-center justify-center space-y-3">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                <span>[FETCHING TELEMETRY CONDUITS...]</span>
              </div>
            ) : filteredServices.length === 0 ? (
              <div className="py-16 text-center bg-[#0b0f17] border-2 border-dashed border-zinc-800 p-8 space-y-4">
                <Radio className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-xs text-zinc-400">No monitored targets match the current filter criteria.</p>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-4 py-2 btn-primary text-xs"
                >
                  [ REGISTER FIRST TARGET ]
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedServices.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    onRefresh={loadData}
                  />
                ))}
              </div>
            )}

            {/* DASHBOARD PAGINATION CONTROLS */}
            {filteredServices.length > itemsPerPage && (
              <div className="p-4 bg-[#0b0f17] border-2 border-zinc-800 flex items-center justify-between text-xs mt-4">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-800 flex items-center gap-1 font-bold"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>PREV</span>
                </button>

                <span className="text-zinc-400 font-bold uppercase">
                  PAGE {currentPage} OF {totalPages} • SHOWING {Math.min((currentPage - 1) * itemsPerPage + 1, filteredServices.length)}-{Math.min(currentPage * itemsPerPage, filteredServices.length)} OF {filteredServices.length} TARGETS
                </span>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-800 flex items-center gap-1 font-bold"
                >
                  <span>NEXT</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SENTRY CRASH SENTINEL (EXCEPTION TRACKER & SINK) */}
        {activeTab === "sentry" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b-2 border-zinc-800">
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Bug className="w-5 h-5 text-purple-400" />
                  <span>Sentry Crash Sentinel & Exception Ingest</span>
                </h2>
                <p className="text-xs text-zinc-400 font-sans">
                  Real-time crash tracking, unhandled exceptions, and stack trace forensics.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleCopyDsn}
                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-700 text-zinc-200 text-xs font-bold uppercase flex items-center gap-1.5 shadow-[2px_2px_0px_#000]"
                  title="Copy Ingest Webhook URL"
                >
                  {copiedDsn ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedDsn ? "DSN COPIED" : "COPY SINK URL"}</span>
                </button>

                <button
                  onClick={handleSimulateCrash}
                  disabled={isSimulatingCrash}
                  className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 border-2 border-rose-600 text-rose-200 text-xs font-bold uppercase flex items-center gap-1.5 shadow-[2px_2px_0px_#000]"
                  title="Generate a test crash report to test the ingestion pipeline"
                >
                  <Flame className="w-3.5 h-3.5 text-rose-400" />
                  <span>{isSimulatingCrash ? "Simulating..." : "SIMULATE CRASH"}</span>
                </button>

                {/* Filter */}
                <div className="flex border border-zinc-700 bg-zinc-900 p-0.5 text-xs">
                  {(["unresolved", "all", "fatal", "error"] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setErrorFilter(filter)}
                      className={`px-3 py-1 uppercase text-[10px] font-bold transition ${
                        errorFilter === filter
                          ? "bg-zinc-700 text-white"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Error Issues Ledger */}
            {filteredErrors.length === 0 ? (
              <div className="p-12 bg-[#0b0f17] border-2 border-zinc-800 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h3 className="font-bold text-white text-sm uppercase">Zero Unhandled Exceptions</h3>
                <p className="text-xs text-zinc-500 font-sans max-w-md mx-auto">
                  No crash reports matching current filters. Dispatch crashes via POST to <code className="text-zinc-300 font-mono">/api/v1/telemetry/errors</code>.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredErrors.map((issue) => {
                  const isFatal = issue.level === "fatal";
                  const isResolved = issue.status === "resolved";

                  return (
                    <div
                      key={issue.id}
                      className={`p-5 bg-[#0b0f17] border-2 shadow-[3px_3px_0px_#000] space-y-3 transition-all ${
                        isResolved
                          ? "border-zinc-800 opacity-60"
                          : isFatal
                          ? "border-rose-700/80"
                          : "border-zinc-700"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center space-x-2.5">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-black uppercase border ${
                              isResolved
                                ? "bg-emerald-950 border-emerald-500 text-emerald-400"
                                : isFatal
                                ? "bg-rose-950 border-rose-500 text-rose-400"
                                : "bg-purple-950 border-purple-500 text-purple-400"
                            }`}
                          >
                            [{isResolved ? "RESOLVED" : issue.level.toUpperCase()}]
                          </span>

                          <span className="px-2 py-0.5 text-[10px] bg-zinc-900 border border-zinc-700 text-cyan-300 font-bold uppercase">
                            {issue.project}
                          </span>

                          <span className="text-xs font-black text-white">{issue.title}</span>
                        </div>

                        <div className="flex items-center space-x-3 text-xs">
                          <span className="text-purple-400 font-bold text-[11px]">
                            x{issue.events_count} events
                          </span>
                          <span className="text-zinc-500 text-[10px]">
                            {new Date(issue.last_seen_at).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-zinc-300 bg-black/80 p-3 border border-zinc-800/80 font-mono">
                        {issue.message}
                      </p>

                      <div className="flex items-center justify-between pt-1 text-xs">
                        <div className="flex items-center space-x-2 text-[10px] text-zinc-500">
                          <span>ENV: {issue.environment}</span>
                          <span>•</span>
                          <span>FIRST SEEN: {new Date(issue.first_seen_at).toLocaleDateString()}</span>
                        </div>

                        <div className="flex items-center space-x-2">
                          {issue.stack_trace && (
                            <button
                              onClick={() => setInspectingError(issue)}
                              className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-[11px] font-bold"
                            >
                              View Stack Trace
                            </button>
                          )}

                          <button
                            onClick={() => handleTriageError(issue.id, isResolved ? "unresolved" : "resolved")}
                            className={`px-3 py-1 text-[11px] font-bold border transition ${
                              isResolved
                                ? "bg-zinc-900 border-zinc-700 text-zinc-300 hover:text-white"
                                : "bg-emerald-950 border-emerald-500 text-emerald-300 hover:bg-emerald-900"
                            }`}
                          >
                            {isResolved ? "Reopen" : "Mark Resolved"}
                          </button>

                          <button
                            onClick={() => handleDeleteError(issue.id)}
                            className="p-1 text-zinc-500 hover:text-rose-400"
                            title="Delete exception record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quick Ingestion SDK Conduit Card */}
            <div className="p-6 bg-[#0b0f17] border-2 border-zinc-700 shadow-[4px_4px_0px_#000] space-y-4">
              <div className="flex items-center space-x-3">
                <Code2 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-black text-white uppercase">
                  Sentry Telemetry Ingestion Conduit
                </h3>
              </div>
              <p className="text-xs text-zinc-400 font-sans">
                Plug your frontend apps, Node.js workers, or Python services directly into Crystal-Heimdall using standard HTTP POST:
              </p>

              <div className="bg-black p-4 border border-zinc-800 text-xs font-mono text-zinc-300 space-y-2 overflow-x-auto">
                <span className="text-zinc-500">// BROWSER / NODE.JS INGESTION SNIPPET //</span>
                <pre className="text-emerald-300">
{`window.onerror = (message, source, lineno, colno, error) => {
  fetch("${window.location.origin}/api/v1/telemetry/errors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project: "My-Web-App",
      error_type: error?.name || "Error",
      message: String(message),
      level: "fatal",
      stack_trace: error?.stack,
      environment: "production"
    })
  });
};`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ACTIVE INCIDENTS ACCORDION */}
        {activeTab === "incidents" && (
          <div className="space-y-4">
            {activeIncidents.length > 0 ? (
              <div className="bg-[#1c080b] border-2 border-rose-600 p-6 shadow-[4px_4px_0px_#000] space-y-4">
                <div className="flex items-center justify-between border-b-2 border-rose-800 pb-3">
                  <div className="flex items-center space-x-3">
                    <AlertTriangle className="w-5 h-5 text-rose-400 animate-bounce" />
                    <div>
                      <h2 className="text-sm font-black text-white uppercase">
                        ACTIVE INCIDENTS & DISRUPTIONS ({activeIncidents.length})
                      </h2>
                      <p className="text-[10px] text-zinc-400">Immediate operator triage required</p>
                    </div>
                  </div>
                  <span className="text-xs text-rose-400 font-bold">[ATTENTION REQUIRED]</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeIncidents.map((incident) => (
                    <div 
                      key={incident.id}
                      className="bg-black border-2 border-rose-900 p-4 flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-rose-400 font-black uppercase">[{incident.severity}]</span>
                          <span className="text-zinc-500">{new Date(incident.last_seen_at).toLocaleTimeString()}</span>
                        </div>
                        <h3 className="font-bold text-white text-xs">{incident.title}</h3>
                        {incident.message && (
                          <p className="text-zinc-400 text-xs truncate">{incident.message}</p>
                        )}
                      </div>

                      <div className="pt-3 border-t border-zinc-800 flex items-center justify-between text-xs">
                        <span className="text-sky-400 text-[10px]">×{incident.occurrences_count} alerts</span>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setSelectedIncident(incident)}
                            className="px-2 py-1 bg-zinc-900 border border-zinc-700 text-zinc-300 text-[11px] font-bold"
                          >
                            Inspect
                          </button>
                          <button
                            onClick={() => handleTriageIncident(incident.id, "resolved")}
                            className="px-2.5 py-1 bg-emerald-950 border border-emerald-500 text-emerald-300 text-[11px] font-bold"
                          >
                            Resolve
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-8 bg-[#07130e] border-2 border-emerald-500 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  <div>
                    <h3 className="font-bold text-white uppercase">[ZERO ACTIVE OUTAGES]</h3>
                    <p className="text-[11px] text-zinc-400 font-sans">All synthetic probes, workers, and cron health checks operating nominally.</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 text-[10px] bg-emerald-950 border border-emerald-500 text-emerald-400 font-bold uppercase">
                  [ALL SYSTEMS ONLINE]
                </span>
              </div>
            )}
          </div>
        )}
      </main>

      {/* SENTRY ERROR INSPECTOR DRAWER */}
      {inspectingError && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-end bg-black/80 font-mono text-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInspectingError(null);
          }}
        >
          <div className="w-full max-w-2xl h-full bg-[#0b0f17] border-l-2 border-zinc-700 p-6 sm:p-8 overflow-y-auto space-y-6 shadow-[-6px_0px_0px_#000]">
            <div className="flex items-center justify-between border-b-2 border-zinc-800 pb-4">
              <div>
                <span className="text-[10px] text-purple-400 font-bold uppercase">// SENTRY CRASH FORENSICS //</span>
                <h2 className="text-base font-black text-white uppercase">{inspectingError.title}</h2>
              </div>
              <button
                onClick={() => setInspectingError(null)}
                className="p-1.5 bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-black border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">PROJECT</span>
                  <span className="text-white font-bold">{inspectingError.project}</span>
                </div>
                <div className="p-3 bg-black border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">SEVERITY</span>
                  <span className="text-rose-400 font-bold uppercase">{inspectingError.level}</span>
                </div>
                <div className="p-3 bg-black border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">TOTAL EVENTS</span>
                  <span className="text-purple-400 font-bold">{inspectingError.events_count} occurrences</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-zinc-400 font-bold block mb-1">EXCEPTION MESSAGE</span>
                <div className="p-3 bg-black border border-zinc-800 text-zinc-200">
                  {inspectingError.message}
                </div>
              </div>

              {inspectingError.stack_trace && (
                <div>
                  <span className="text-[10px] text-zinc-400 font-bold block mb-1">CALL STACK TRACE</span>
                  <pre className="p-4 bg-black border border-zinc-800 text-rose-300 text-xs overflow-x-auto whitespace-pre font-mono leading-relaxed">
                    {inspectingError.stack_trace}
                  </pre>
                </div>
              )}

              {inspectingError.metadata_json && (
                <div>
                  <span className="text-[10px] text-zinc-400 font-bold block mb-1">METADATA CONTEXT</span>
                  <pre className="p-3 bg-black border border-zinc-800 text-cyan-300 text-xs overflow-x-auto font-mono">
                    {JSON.stringify(JSON.parse(inspectingError.metadata_json), null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-4 border-t-2 border-zinc-800 flex justify-between">
              <button
                onClick={() => handleDeleteError(inspectingError.id)}
                className="px-4 py-2 bg-rose-950/60 border border-rose-600 text-rose-300 font-bold text-xs"
              >
                Delete Record
              </button>

              <button
                onClick={() => handleTriageError(inspectingError.id, inspectingError.status === "resolved" ? "unresolved" : "resolved")}
                className="px-5 py-2 btn-primary text-xs font-bold uppercase"
              >
                {inspectingError.status === "resolved" ? "Reopen Issue" : "Resolve Issue"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal & Drawer */}
      <AddServiceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onCreated={loadData}
      />

      <IncidentDrawer
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
        onResolve={async (id) => {
          await handleTriageIncident(id, "resolved");
        }}
      />
    </div>
  );
}
