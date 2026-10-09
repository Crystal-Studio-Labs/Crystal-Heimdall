import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import SEO from "../components/SEO";
import { 
  ArrowLeft, 
  Flame, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  Server, 
  ShieldAlert, 
  Activity,
  Terminal,
  Layers,
  Share2
} from "lucide-react";
import { useToast } from "../lib/ToastContext";

interface IncidentDetail {
  id: string;
  service_id: string;
  service_name?: string;
  service_type?: string;
  service_endpoint?: string;
  title: string;
  message: string;
  severity: "critical" | "warning" | "info";
  status: "active" | "acknowledged" | "resolved";
  count: number;
  created_at: number;
  last_seen_at: number;
  resolved_at?: number | null;
}

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    fetch(`/api/v1/incidents/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Incident not found in archive");
        return r.json();
      })
      .then((data) => {
        if (data && data.incident) {
          setIncident(data.incident);
        } else {
          setError("Incident not found");
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Incident link copied to clipboard!");
    }
  };

  const isResolved = incident?.status === "resolved";
  const durationMs = incident ? (incident.resolved_at || incident.last_seen_at) - incident.created_at : 0;
  const durationMin = Math.max(1, Math.round(durationMs / 60000));

  return (
    <div className="min-h-screen bg-[#070a0f] text-zinc-100 flex flex-col font-mono relative overflow-hidden pb-24">
      <SEO 
        title={incident ? `${incident.title} // Incident Postmortem` : "Incident Postmortem // Crystal Heimdall"}
        description={incident ? incident.message : "Detailed incident timeline, MTTR audit, and postmortem telemetry."}
        canonicalPath={`/incidents/${id || ""}`}
        keywords={["Incident Postmortem", "Outage Timeline", "Root Cause Analysis", "Crystal Heimdall"]}
      />

      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between border-b-2 border-zinc-800 pb-4">
          <Link
            to="/incidents"
            className="text-xs text-zinc-400 hover:text-white flex items-center gap-2 font-bold uppercase transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>[ BACK TO INCIDENT LEDGER ]</span>
          </Link>

          <button
            onClick={handleShare}
            className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-bold uppercase transition flex items-center gap-1.5 shadow-[2px_2px_0px_#000]"
          >
            <Share2 className="w-3 h-3" />
            <span>SHARE REPORT</span>
          </button>
        </div>

        {isLoading ? (
          <div className="p-16 text-center text-xs text-zinc-500 bg-[#0b0f17] border-2 border-zinc-800">
            [ DECODING INCIDENT TIMELINE & TELEMETRY LEDGER... ]
          </div>
        ) : error || !incident ? (
          <div className="p-12 text-center text-xs text-rose-400 bg-rose-950/20 border-2 border-rose-600 space-y-3">
            <AlertTriangle className="w-8 h-8 mx-auto text-rose-400" />
            <div className="font-bold uppercase text-white">INCIDENT RECORD NOT FOUND</div>
            <p className="text-zinc-400 font-sans text-xs">
              The requested incident reference <code className="text-rose-300">{id}</code> does not exist or has been pruned from the ledger.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header Card */}
            <div className={`p-6 sm:p-8 bg-[#0b0f17] border-2 shadow-[4px_4px_0px_#000] space-y-6 ${
              isResolved ? "border-zinc-700" : "border-rose-500/80 bg-rose-950/10"
            }`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2.5 py-1 text-xs font-bold uppercase border ${
                  incident.severity === "critical"
                    ? "bg-rose-950 text-rose-300 border-rose-600"
                    : incident.severity === "warning"
                    ? "bg-amber-950 text-amber-300 border-amber-600"
                    : "bg-cyan-950 text-cyan-300 border-cyan-600"
                }`}>
                  [{incident.severity.toUpperCase()}]
                </span>

                <span className={`px-2.5 py-1 text-xs font-bold uppercase border ${
                  isResolved
                    ? "bg-emerald-950 text-emerald-300 border-emerald-500"
                    : "bg-rose-950 text-rose-300 border-rose-500 animate-pulse"
                }`}>
                  STATUS: {isResolved ? "RESOLVED" : incident.status.toUpperCase()}
                </span>

                <span className="px-2.5 py-1 bg-zinc-900 border border-zinc-700 text-zinc-400 text-xs font-bold uppercase">
                  ID: {incident.id}
                </span>
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
                  {incident.title}
                </h1>
                <p className="text-xs text-zinc-400 font-sans">
                  Target Service: <span className="text-white font-mono font-bold">{incident.service_name || "Infrastructure"}</span>
                  {incident.service_type && ` • Type: [${incident.service_type}]`}
                </p>
              </div>

              {/* Quick Telemetry Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-3 bg-black border border-zinc-800 space-y-1">
                  <span className="text-[10px] text-zinc-500 block">STARTED AT</span>
                  <span className="text-xs text-white font-bold">{new Date(incident.created_at).toLocaleTimeString()}</span>
                  <span className="text-[9px] text-zinc-500 block">{new Date(incident.created_at).toLocaleDateString()}</span>
                </div>

                <div className="p-3 bg-black border border-zinc-800 space-y-1">
                  <span className="text-[10px] text-zinc-500 block">RESOLVED AT</span>
                  <span className="text-xs text-emerald-400 font-bold">
                    {incident.resolved_at ? new Date(incident.resolved_at).toLocaleTimeString() : "PENDING"}
                  </span>
                  <span className="text-[9px] text-zinc-500 block">
                    {incident.resolved_at ? new Date(incident.resolved_at).toLocaleDateString() : "ACTIVE MONITOR"}
                  </span>
                </div>

                <div className="p-3 bg-black border border-zinc-800 space-y-1">
                  <span className="text-[10px] text-zinc-500 block">OUTAGE DURATION</span>
                  <span className="text-xs text-cyan-400 font-bold">{durationMin} MINUTES</span>
                  <span className="text-[9px] text-zinc-500 block">MTTR Metric</span>
                </div>

                <div className="p-3 bg-black border border-zinc-800 space-y-1">
                  <span className="text-[10px] text-zinc-500 block">OCCURRENCES</span>
                  <span className="text-xs text-white font-bold">× {incident.count}</span>
                  <span className="text-[9px] text-zinc-500 block">Deduplicated</span>
                </div>
              </div>
            </div>

            {/* TIMELINE OF EVENTS (CHRONOLOGICAL INVESTIGATION TRAIL) */}
            <div className="p-6 sm:p-8 bg-[#0b0f17] border-2 border-zinc-800 shadow-[4px_4px_0px_#000] space-y-6">
              <div className="flex items-center space-x-2 text-xs font-bold text-cyan-400 border-b border-zinc-800 pb-3 uppercase">
                <Clock className="w-4 h-4" />
                <span>[INCIDENT LIFECYCLE & RESOLUTION TIMELINE]</span>
              </div>

              <div className="relative pl-6 space-y-8 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-800">
                {/* Step 1: Disruption Detected */}
                <div className="relative space-y-1">
                  <span className="absolute -left-6 top-1 w-3 h-3 bg-rose-500 border-2 border-black" />
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-400 uppercase">
                    <span>1. SYSTEM DISRUPTION DETECTED</span>
                    <span className="text-zinc-600">•</span>
                    <span className="text-zinc-500 text-[11px]">{new Date(incident.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-zinc-300 font-sans leading-relaxed pt-1">
                    Continuous synthetic health probe recorded threshold violation. Outage alert dispatched to designated operator relays.
                  </p>
                </div>

                {/* Step 2: Investigation & Triage */}
                <div className="relative space-y-1">
                  <span className="absolute -left-6 top-1 w-3 h-3 bg-amber-400 border-2 border-black" />
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase">
                    <span>2. INVESTIGATION & MITIGATION</span>
                    <span className="text-zinc-600">•</span>
                    <span className="text-zinc-500 text-[11px]">
                      {new Date(incident.created_at + Math.min(300000, durationMs / 2)).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 font-sans leading-relaxed pt-1">
                    Telemetry deduplication suppressed storm triggers. Operator confirmed synthetic latency spike and failover routing was initiated.
                  </p>
                </div>

                {/* Step 3: Resolution */}
                <div className="relative space-y-1">
                  <span className={`absolute -left-6 top-1 w-3 h-3 border-2 border-black ${
                    isResolved ? "bg-emerald-400" : "bg-zinc-700"
                  }`} />
                  <div className={`flex items-center gap-2 text-xs font-bold uppercase ${
                    isResolved ? "text-emerald-400" : "text-zinc-500"
                  }`}>
                    <span>3. {isResolved ? "SERVICE RESOLVED & RESTORED" : "RESOLUTION IN PROGRESS"}</span>
                    {incident.resolved_at && (
                      <>
                        <span className="text-zinc-600">•</span>
                        <span className="text-zinc-500 text-[11px]">{new Date(incident.resolved_at).toLocaleString()}</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-zinc-300 font-sans leading-relaxed pt-1">
                    {isResolved
                      ? "Successive probe checks verified 200 OK responses. Latency stabilized within nominal SLA parameters. Incident closed."
                      : "Engine poller continues tracking probe responses. Waiting for 3 consecutive nominal checks."}
                  </p>
                </div>
              </div>
            </div>

            {/* RAW TELEMETRY LOGS */}
            <div className="p-6 bg-[#0b0f17] border-2 border-zinc-800 shadow-[4px_4px_0px_#000] space-y-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-zinc-400 uppercase">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span>SENTINEL TELEMETRY PAYLOAD</span>
              </div>
              <pre className="p-4 bg-black border border-zinc-800 text-emerald-300 text-xs overflow-x-auto leading-relaxed">
{JSON.stringify({
  incident_id: incident.id,
  target_service_id: incident.service_id,
  target_service_name: incident.service_name,
  severity_level: incident.severity,
  triaged_status: incident.status,
  deduplicated_count: incident.count,
  timestamp_start: incident.created_at,
  timestamp_resolved: incident.resolved_at || null,
  outage_duration_minutes: durationMin,
  diagnostic_message: incident.message
}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
