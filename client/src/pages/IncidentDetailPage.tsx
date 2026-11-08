import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import SEO from "../components/SEO";
import IncidentStepper from "../components/IncidentStepper";
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
  Share2,
  Send,
  Plus,
  FileText,
  Download,
  Copy,
  Check,
  X
} from "lucide-react";
import { useToast } from "../lib/ToastContext";
import { isOperatorAuthenticated } from "../lib/api";

export interface IncidentTimelineUpdate {
  id: string;
  incident_id: string;
  status: "investigating" | "identified" | "monitoring" | "resolved";
  message: string;
  created_at: number;
}

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
  occurrences_count?: number;
  count?: number;
  first_seen_at?: number;
  created_at?: number;
  last_seen_at?: number;
  resolved_at?: number | null;
  updates?: IncidentTimelineUpdate[];
}

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Authenticated operator composer state
  const [isAuthenticated] = useState(() => isOperatorAuthenticated());
  const [postStatus, setPostStatus] = useState<"investigating" | "identified" | "monitoring" | "resolved">("investigating");
  const [postMessage, setPostMessage] = useState("");
  const [isPosting, setIsPosting] = useState(false);

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

  const [showPostmortemModal, setShowPostmortemModal] = useState(false);
  const [postmortemData, setPostmortemData] = useState<{ markdown: string; mttr: string; durationMinutes: number } | null>(null);
  const [isGeneratingPostmortem, setIsGeneratingPostmortem] = useState(false);
  const [copiedPostmortem, setCopiedPostmortem] = useState(false);

  const handleGeneratePostmortem = async () => {
    if (!id) return;
    setIsGeneratingPostmortem(true);
    try {
      const res = await fetch(`/api/v1/incidents/${id}/postmortem`);
      if (!res.ok) throw new Error("Failed to generate postmortem");
      const data = await res.json();
      setPostmortemData({
        markdown: data.postmortemMarkdown,
        mttr: data.mttr,
        durationMinutes: data.durationMinutes,
      });
      setShowPostmortemModal(true);
      toast.success("RCA postmortem generated from telemetry!");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate postmortem");
    } finally {
      setIsGeneratingPostmortem(false);
    }
  };

  const handleCopyPostmortem = () => {
    if (postmortemData?.markdown && navigator.clipboard) {
      navigator.clipboard.writeText(postmortemData.markdown);
      setCopiedPostmortem(true);
      toast.success("Markdown postmortem copied to clipboard!");
      setTimeout(() => setCopiedPostmortem(false), 2000);
    }
  };

  const handleAppendUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postMessage.trim() || !id) {
      toast.warning("Please enter an update message");
      return;
    }

    setIsPosting(true);
    try {
      const res = await fetch(`/api/v1/incidents/${id}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: postStatus,
          message: postMessage.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to post update");
      }

      const json = await res.json();
      setIncident((prev) => {
        if (!prev) return null;
        const currentUpdates = prev.updates || [];
        return {
          ...prev,
          status: json.incident_status || prev.status,
          resolved_at: postStatus === "resolved" ? Date.now() : prev.resolved_at,
          updates: [...currentUpdates, json.update],
        };
      });

      setPostMessage("");
      toast.success(`Timeline update recorded: [${postStatus.toUpperCase()}]`);
    } catch (err: any) {
      toast.error(err.message || "Failed to append update");
    } finally {
      setIsPosting(false);
    }
  };

  const isResolved = incident?.status === "resolved";
  const startedAt = incident?.first_seen_at || incident?.created_at || Date.now();
  const lastSeen = incident?.last_seen_at || startedAt;
  const durationMs = incident ? (incident.resolved_at || lastSeen) - startedAt : 0;
  const durationMin = Math.max(1, Math.round(durationMs / 60000));
  const eventCount = incident?.occurrences_count || incident?.count || 1;

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "resolved":
        return "bg-emerald-950 text-emerald-300 border-emerald-500";
      case "monitoring":
        return "bg-sky-950 text-sky-300 border-sky-500";
      case "identified":
        return "bg-amber-950 text-amber-300 border-amber-500";
      case "investigating":
      default:
        return "bg-rose-950 text-rose-300 border-rose-500";
    }
  };

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

          <div className="flex items-center gap-2">
            <button
              onClick={handleGeneratePostmortem}
              disabled={isGeneratingPostmortem}
              className="px-3 py-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 hover:text-white border border-cyan-600 text-xs font-bold uppercase transition flex items-center gap-1.5 shadow-[2px_2px_0px_#000]"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{isGeneratingPostmortem ? "GENERATING..." : "RCA POSTMORTEM"}</span>
            </button>

            <button
              onClick={handleShare}
              className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-bold uppercase transition flex items-center gap-1.5 shadow-[2px_2px_0px_#000]"
            >
              <Share2 className="w-3 h-3" />
              <span>SHARE REPORT</span>
            </button>
          </div>
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
                  <span className="text-xs text-white font-bold">{new Date(startedAt).toLocaleTimeString()}</span>
                  <span className="text-[9px] text-zinc-500 block">{new Date(startedAt).toLocaleDateString()}</span>
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
                  <span className="text-xs text-white font-bold">× {eventCount}</span>
                  <span className="text-[9px] text-zinc-500 block">Deduplicated</span>
                </div>
              </div>

              {/* Canonical 4-Stage Lifecycle Stepper */}
              <div className="pt-2">
                <IncidentStepper
                  currentStatus={incident.status}
                  updates={incident.updates}
                  firstSeenAt={startedAt}
                  resolvedAt={incident.resolved_at}
                />
              </div>
            </div>

            {/* TIMELINE OF EVENTS (AUTHENTIC DATABASE LEDGER) */}
            <div className="p-6 sm:p-8 bg-[#0b0f17] border-2 border-zinc-800 shadow-[4px_4px_0px_#000] space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center space-x-2 text-xs font-bold text-cyan-400 uppercase">
                  <Clock className="w-4 h-4" />
                  <span>[INCIDENT LIFECYCLE & RESOLUTION TIMELINE]</span>
                </div>
                <span className="text-[11px] text-zinc-500 font-bold">
                  {incident.updates?.length || 1} CHRONOLOGICAL ENTRIES
                </span>
              </div>

              <div className="relative pl-6 space-y-8 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-800">
                {incident.updates && incident.updates.length > 0 ? (
                  incident.updates.map((upd, idx) => {
                    const isResolvedStep = upd.status === "resolved";
                    const isMonitoringStep = upd.status === "monitoring";
                    const isIdentifiedStep = upd.status === "identified";
                    const dotColor = isResolvedStep
                      ? "bg-emerald-400"
                      : isMonitoringStep
                      ? "bg-sky-400"
                      : isIdentifiedStep
                      ? "bg-amber-400"
                      : "bg-rose-500";

                    const textColor = isResolvedStep
                      ? "text-emerald-400"
                      : isMonitoringStep
                      ? "text-sky-400"
                      : isIdentifiedStep
                      ? "text-amber-300"
                      : "text-rose-400";

                    return (
                      <div key={upd.id || idx} className="relative space-y-1">
                        <span className={`absolute -left-6 top-1 w-3 h-3 ${dotColor} border-2 border-black`} />
                        <div className="flex items-center gap-2 text-xs font-bold uppercase">
                          <span className={textColor}>
                            {idx + 1}. [{upd.status.toUpperCase()}]
                          </span>
                          <span className="text-zinc-600">•</span>
                          <span className="text-zinc-500 text-[11px]">
                            {new Date(upd.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300 font-sans leading-relaxed pt-1">
                          {upd.message}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <div className="relative space-y-1">
                    <span className="absolute -left-6 top-1 w-3 h-3 bg-rose-500 border-2 border-black" />
                    <div className="flex items-center gap-2 text-xs font-bold text-rose-400 uppercase">
                      <span>1. [INVESTIGATING] INITIAL SYSTEM DISRUPTION DETECTED</span>
                      <span className="text-zinc-600">•</span>
                      <span className="text-zinc-500 text-[11px]">{new Date(startedAt).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-zinc-300 font-sans leading-relaxed pt-1">
                      {incident.message || "Automated telemetry probe recorded threshold violation. Outage logged to sentinel ledger."}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* OPERATOR TIMELINE NOTE COMPOSER (WHEN OPERATOR IS LOGGED IN) */}
            {isAuthenticated && (
              <div className="p-6 bg-[#0b0f17] border-2 border-zinc-700 shadow-[4px_4px_0px_#000] space-y-4">
                <div className="flex items-center space-x-2 text-xs font-bold text-cyan-400 uppercase border-b border-zinc-800 pb-2">
                  <Plus className="w-4 h-4" />
                  <span>// OPERATOR COMMAND // APPEND POSTMORTEM TIMELINE UPDATE</span>
                </div>

                <form onSubmit={handleAppendUpdate} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-400 uppercase font-bold block">
                      INCIDENT PROGRESSION STAGE
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(["investigating", "identified", "monitoring", "resolved"] as const).map((st) => (
                        <button
                          type="button"
                          key={st}
                          onClick={() => setPostStatus(st)}
                          className={`py-2 text-xs font-bold uppercase border transition ${
                            postStatus === st
                              ? getStatusBadgeClass(st)
                              : "bg-black border-zinc-800 text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          [{st.toUpperCase()}]
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-400 uppercase font-bold block">
                      OPERATOR POSTMORTEM NOTE / MITIGATION ACTION
                    </label>
                    <textarea
                      value={postMessage}
                      onChange={(e) => setPostMessage(e.target.value)}
                      placeholder="e.g. Applied cache connection pool patch. Error rate dropped below 0.1% across all ingress endpoints."
                      rows={3}
                      className="w-full bg-black border border-zinc-700 text-white p-3 text-xs focus:border-cyan-500 focus:outline-none resize-none font-sans"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isPosting || !postMessage.trim()}
                    className="w-full sm:w-auto px-6 py-2.5 bg-cyan-950 border border-cyan-500 text-cyan-300 hover:bg-cyan-900 disabled:opacity-40 font-bold uppercase text-xs flex items-center justify-center gap-2 transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isPosting ? "[ RECORDING TO AUDIT LEDGER... ]" : "[ APPEND TO AUDIT LEDGER ]"}</span>
                  </button>
                </form>
              </div>
            )}

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
  deduplicated_count: eventCount,
  timestamp_start: startedAt,
  timestamp_resolved: incident.resolved_at || null,
  outage_duration_minutes: durationMin,
  timeline_updates_count: incident.updates?.length || 0,
  diagnostic_message: incident.message
}, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* RCA Postmortem Modal */}
        {showPostmortemModal && postmortemData && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowPostmortemModal(false)}
          >
            <div
              className="w-full max-w-3xl brutal-panel border-2 border-cyan-500 shadow-[8px_8px_0px_#000000] bg-[#070a0f] max-h-[85vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b-2 border-zinc-800 bg-[#030712]">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-mono font-bold tracking-wider text-white uppercase">
                    [ AUTOMATED ROOT CAUSE ANALYSIS POSTMORTEM ]
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-950 border border-emerald-500 text-emerald-400 uppercase font-bold">
                    MTTR: {postmortemData.mttr}
                  </span>
                </div>
                <button
                  onClick={() => setShowPostmortemModal(false)}
                  className="text-zinc-500 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body / Markdown View */}
              <div className="flex-1 overflow-y-auto p-5 bg-[#0b0f17]">
                <pre className="font-mono text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed select-all">
                  {postmortemData.markdown}
                </pre>
              </div>

              {/* Modal Footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t-2 border-zinc-800 bg-[#030712]">
                <div className="text-[10px] font-mono text-zinc-500">
                  EXPORT FORMAT: GITHUB FLAVORED MARKDOWN (.MD)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyPostmortem}
                    className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-mono font-bold uppercase flex items-center gap-1.5"
                  >
                    {copiedPostmortem ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPostmortem ? "COPIED" : "COPY MD"}</span>
                  </button>
                  <a
                    href={`/api/v1/incidents/${id}/postmortem?download=1`}
                    download={`postmortem-${id}.md`}
                    className="px-3 py-1.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-500 text-cyan-300 hover:text-white text-xs font-mono font-bold uppercase flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>DOWNLOAD .MD</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
