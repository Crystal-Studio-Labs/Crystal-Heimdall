import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import SEO from "../components/SEO";
import { 
  Flame, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  Search, 
  Filter, 
  ChevronRight, 
  ArrowLeft, 
  Calendar,
  Layers,
  Activity,
  ExternalLink
} from "lucide-react";

interface Incident {
  id: string;
  service_id: string;
  service_name?: string;
  title: string;
  message: string;
  severity: "critical" | "warning" | "info";
  status: "active" | "acknowledged" | "resolved";
  count: number;
  created_at: number;
  last_seen_at: number;
  resolved_at?: number | null;
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "resolved">("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | "critical" | "warning" | "info">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  useEffect(() => {
    fetch("/api/v1/incidents")
      .then((r) => r.json())
      .then((data) => {
        if (data && data.incidents) {
          setIncidents(data.incidents);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  // Filter calculations
  const filteredIncidents = incidents.filter((inc) => {
    const matchesSearch = 
      inc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inc.service_name && inc.service_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (inc.message && inc.message.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = 
      statusFilter === "all" ||
      (statusFilter === "active" && inc.status !== "resolved") ||
      (statusFilter === "resolved" && inc.status === "resolved");

    const matchesSeverity = 
      severityFilter === "all" || inc.severity === severityFilter;

    return matchesSearch && matchesStatus && matchesSeverity;
  });

  const totalPages = Math.ceil(filteredIncidents.length / itemsPerPage) || 1;
  const paginatedIncidents = filteredIncidents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const activeCount = incidents.filter((i) => i.status !== "resolved").length;
  const resolvedCount = incidents.filter((i) => i.status === "resolved").length;
  const criticalCount = incidents.filter((i) => i.severity === "critical").length;

  return (
    <div className="min-h-screen bg-[#070a0f] text-zinc-100 flex flex-col font-mono relative overflow-hidden pb-24">
      <SEO 
        title="Incident Ledger & Postmortems // Crystal Heimdall"
        description="Public historical record of service incidents, system anomalies, resolution timelines, and postmortem telemetry for Crystal Studio Labs infrastructure."
        canonicalPath="/incidents"
        keywords={["Incidents", "Postmortems", "Outage Ledger", "Crystal Heimdall", "SLA Incident History"]}
      />

      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b-2 border-zinc-800">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs text-rose-400 font-bold">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>[INCIDENT REPOSITORY & POSTMORTEM LEDGER]</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase text-white tracking-tight">
              System Incident Ledger
            </h1>
            <p className="text-xs text-zinc-400 font-sans">
              Historical documentation of infrastructure outages, triaged anomalies, and mean-time-to-resolution (MTTR) audits.
            </p>
          </div>

          <Link
            to="/"
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border-2 border-zinc-700 text-xs font-bold uppercase transition flex items-center gap-1.5 self-start sm:self-auto shadow-[2px_2px_0px_#000]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>[ RETURN TO LIVE STATUS ]</span>
          </Link>
        </div>

        {/* METRICS SUMMARY BENTO */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-[#0b0f17] border-2 border-zinc-700 shadow-[3px_3px_0px_#000] space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase block">TOTAL INCIDENTS</span>
            <span className="text-2xl font-black text-white">{incidents.length}</span>
            <span className="text-[10px] text-zinc-500 block font-sans">Historical log count</span>
          </div>

          <div className={`p-4 bg-[#0b0f17] border-2 shadow-[3px_3px_0px_#000] space-y-1 ${
            activeCount > 0 ? "border-rose-500/80 text-rose-300" : "border-zinc-700 text-zinc-300"
          }`}>
            <span className="text-[10px] font-bold uppercase block flex items-center gap-1.5">
              <span className={`w-2 h-2 ${activeCount > 0 ? "bg-rose-400 animate-pulse" : "bg-emerald-400"}`} />
              CURRENTLY ACTIVE
            </span>
            <span className="text-2xl font-black text-white">{activeCount}</span>
            <span className="text-[10px] text-zinc-500 block font-sans">Unresolved disruptions</span>
          </div>

          <div className="p-4 bg-[#0b0f17] border-2 border-zinc-700 shadow-[3px_3px_0px_#000] space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase block">RESOLVED & AUDITED</span>
            <span className="text-2xl font-black text-emerald-400">{resolvedCount}</span>
            <span className="text-[10px] text-zinc-500 block font-sans">Closed with nominal state</span>
          </div>

          <div className="p-4 bg-[#0b0f17] border-2 border-zinc-700 shadow-[3px_3px_0px_#000] space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase block">CRITICAL EVENTS</span>
            <span className="text-2xl font-black text-amber-400">{criticalCount}</span>
            <span className="text-[10px] text-zinc-500 block font-sans">Priority P0 disruptions</span>
          </div>
        </div>

        {/* CONTROLS & FILTER ROW */}
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-zinc-950 p-4 border-2 border-zinc-800 shadow-[3px_3px_0px_#000]">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="SEARCH BY TITLE, MESSAGE, OR MONITORED TARGET..."
              className="w-full pl-9 pr-4 py-2 bg-black border-2 border-zinc-800 text-white font-mono text-xs focus:border-rose-400 outline-none uppercase placeholder:text-zinc-600"
            />
          </div>

          {/* Status Rockers */}
          <div className="flex items-center gap-1 bg-black p-1 border-2 border-zinc-800">
            {(["all", "active", "resolved"] as const).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setStatusFilter(s);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 text-[11px] font-bold uppercase transition ${
                  statusFilter === s
                    ? "bg-zinc-800 text-white border border-zinc-600"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Severity Dropdown */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-zinc-500" />
            <select
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-black border-2 border-zinc-800 text-xs font-mono font-bold text-zinc-300 focus:border-rose-400 outline-none uppercase"
            >
              <option value="all">ALL SEVERITIES</option>
              <option value="critical">CRITICAL ONLY</option>
              <option value="warning">WARNING ONLY</option>
              <option value="info">INFO ONLY</option>
            </select>
          </div>
        </div>

        {/* INCIDENT LISTING */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-zinc-500 bg-[#0b0f17] border-2 border-zinc-800">
              [ ACCESSING SENTINEL INCIDENT ARCHIVE... ]
            </div>
          ) : paginatedIncidents.length === 0 ? (
            <div className="p-12 text-center text-xs text-zinc-500 bg-[#0b0f17] border-2 border-zinc-800 space-y-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
              <div className="font-bold text-white uppercase">[ NO INCIDENTS MATCHING FILTER CRITERIA ]</div>
              <p className="text-zinc-500 font-sans text-xs">All monitored services operating within nominal parameters.</p>
            </div>
          ) : (
            paginatedIncidents.map((inc) => {
              const isResolved = inc.status === "resolved";
              const dateStr = new Date(inc.created_at).toLocaleString();
              const durationMs = (inc.resolved_at || inc.last_seen_at) - inc.created_at;
              const durationMin = Math.max(1, Math.round(durationMs / 60000));

              return (
                <div
                  key={inc.id}
                  className={`bg-[#0b0f17] border-2 transition-all shadow-[4px_4px_0px_#000] p-5 sm:p-6 space-y-4 ${
                    isResolved 
                      ? "border-zinc-800 hover:border-zinc-700" 
                      : "border-rose-500/80 bg-rose-950/10 hover:border-rose-400"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                      {/* Severity Pill */}
                      <span className={`px-2 py-0.5 font-bold uppercase text-[10px] border ${
                        inc.severity === "critical"
                          ? "bg-rose-950 text-rose-300 border-rose-600"
                          : inc.severity === "warning"
                          ? "bg-amber-950 text-amber-300 border-amber-600"
                          : "bg-cyan-950 text-cyan-300 border-cyan-600"
                      }`}>
                        [{inc.severity.toUpperCase()}]
                      </span>

                      {/* Status Badge */}
                      <span className={`px-2 py-0.5 font-bold uppercase text-[10px] border ${
                        isResolved
                          ? "bg-emerald-950/80 text-emerald-300 border-emerald-500"
                          : "bg-rose-950/80 text-rose-300 border-rose-500 animate-pulse"
                      }`}>
                        {isResolved ? "RESOLVED" : inc.status.toUpperCase()}
                      </span>

                      {/* Service Target */}
                      {inc.service_name && (
                        <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-700 text-zinc-300 text-[10px] font-bold">
                          TARGET: {inc.service_name}
                        </span>
                      )}

                      {/* Anti-Storm Deduplication Count */}
                      {inc.count > 1 && (
                        <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-700 text-cyan-400 text-[10px] font-bold">
                          × {inc.count} REPEATED DISPATCHES
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-zinc-400 font-mono flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-zinc-500" />
                        {dateStr}
                      </span>
                      <span className="text-zinc-600">|</span>
                      <span className="flex items-center gap-1 text-zinc-300">
                        <Clock className="w-3 h-3 text-zinc-500" />
                        {isResolved ? `RESOLVED IN ${durationMin}M` : `OUTAGE: ${durationMin}M`}
                      </span>
                    </div>
                  </div>

                  {/* Incident Title & Message */}
                  <div className="space-y-2">
                    <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-tight">
                      {inc.title}
                    </h2>
                    <p className="text-xs text-zinc-300 font-sans leading-relaxed bg-black/60 p-3 border border-zinc-800/80">
                      {inc.message || "Automated probe reported consecutive threshold failure."}
                    </p>
                  </div>

                  {/* Action Link to Detail / Postmortem */}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">
                      INCIDENT ID: {inc.id}
                    </span>

                    <Link
                      to={`/incidents/${inc.id}`}
                      className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-cyan-300 hover:text-white border border-zinc-700 text-xs font-mono font-bold uppercase transition flex items-center gap-1 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                    >
                      <span>VIEW POSTMORTEM & TIMELINE</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t-2 border-zinc-800 pt-6">
            <span className="text-xs text-zinc-400 font-mono">
              SHOWING PAGE {currentPage} OF {totalPages} ({filteredIncidents.length} TOTAL INCIDENTS)
            </span>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-zinc-900 border-2 border-zinc-700 text-xs font-mono font-bold text-zinc-300 hover:text-white disabled:opacity-40 disabled:hover:text-zinc-300 shadow-[2px_2px_0px_#000]"
              >
                [ PREV ]
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 bg-zinc-900 border-2 border-zinc-700 text-xs font-mono font-bold text-zinc-300 hover:text-white disabled:opacity-40 disabled:hover:text-zinc-300 shadow-[2px_2px_0px_#000]"
              >
                [ NEXT ]
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
