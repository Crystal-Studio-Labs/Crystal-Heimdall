import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  X, 
  ShieldAlert, 
  CheckCircle, 
  Terminal, 
  Copy, 
  Check,
  Clock,
  Send,
  ExternalLink,
  Activity,
  AlertCircle
} from "lucide-react";
import { useToast } from "../lib/ToastContext";

export interface IncidentTimelineUpdate {
  id: string;
  incident_id: string;
  status: "investigating" | "identified" | "monitoring" | "resolved";
  message: string;
  created_at: number;
}

export interface IncidentItem {
  id: string;
  service_id: string;
  service_name?: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message?: string;
  stack_trace?: string;
  status: "active" | "acknowledged" | "resolved";
  occurrences_count: number;
  first_seen_at: number;
  last_seen_at: number;
  updates?: IncidentTimelineUpdate[];
}

interface IncidentDrawerProps {
  incident: IncidentItem | null;
  onClose: () => void;
  onResolve: (id: string) => Promise<void>;
  onIncidentUpdated?: () => void;
}

export default function IncidentDrawer({ 
  incident, 
  onClose, 
  onResolve,
  onIncidentUpdated 
}: IncidentDrawerProps) {
  const toast = useToast();
  const [copiedTrace, setCopiedTrace] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Timeline updates state
  const [updates, setUpdates] = useState<IncidentTimelineUpdate[]>([]);
  const [isLoadingUpdates, setIsLoadingUpdates] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<"investigating" | "identified" | "monitoring" | "resolved">("investigating");
  const [updateMessage, setUpdateMessage] = useState("");
  const [isPostingUpdate, setIsPostingUpdate] = useState(false);

  // Fetch complete updates when incident changes
  useEffect(() => {
    if (!incident) {
      setUpdates([]);
      return;
    }

    setIsLoadingUpdates(true);
    fetch(`/api/v1/incidents/${incident.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.incident && Array.isArray(data.incident.updates)) {
          setUpdates(data.incident.updates);
        } else {
          setUpdates([]);
        }
      })
      .catch(() => {
        setUpdates([]);
      })
      .finally(() => {
        setIsLoadingUpdates(false);
      });
  }, [incident]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && incident) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [incident, onClose]);

  if (!incident) return null;

  const isResolved = incident.status === "resolved";

  const handleCopyTrace = () => {
    if (!incident.stack_trace) return;
    navigator.clipboard.writeText(incident.stack_trace);
    setCopiedTrace(true);
    toast.success("Stack trace copied to clipboard");
    setTimeout(() => setCopiedTrace(false), 2000);
  };

  const handleAction = async () => {
    setIsUpdating(true);
    try {
      await onResolve(incident.id);
      toast.success(isResolved ? "Incident re-opened" : "Incident marked as resolved");
      if (onIncidentUpdated) onIncidentUpdated();
    } catch {
      toast.error("Failed to update incident");
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePostTimelineUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateMessage.trim()) {
      toast.warning("Please enter an update message");
      return;
    }

    setIsPostingUpdate(true);
    try {
      const res = await fetch(`/api/v1/incidents/${incident.id}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: updateStatus,
          message: updateMessage.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to post update");
      }

      const data = await res.json();
      setUpdates((prev) => [...prev, data.update]);
      setUpdateMessage("");
      toast.success(`Timeline updated: [${updateStatus.toUpperCase()}]`);

      if (onIncidentUpdated) onIncidentUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to post timeline update");
    } finally {
      setIsPostingUpdate(false);
    }
  };

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
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end font-mono text-xs">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer */}
      <div 
        className="relative w-full max-w-xl bg-[#0b0f17] border-l-2 border-zinc-700 shadow-2xl p-6 sm:p-7 flex flex-col justify-between overflow-y-auto z-10 space-y-6"
        role="dialog"
      >
        <div className="space-y-6">
          {/* Drawer Header */}
          <div className="flex items-center justify-between border-b-2 border-zinc-800 pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-rose-950 border border-rose-500 flex items-center justify-center text-rose-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-tight">
                  Diagnostic Incident Inspector
                </h3>
                <p className="text-[10px] text-zinc-500 font-mono">{incident.id}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white"
              aria-label="Close drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Diagnostic Metadata Cards */}
          <div className="grid grid-cols-2 gap-3 bg-black p-4 border border-zinc-800">
            <div>
              <span className="text-zinc-500 text-[10px] uppercase font-bold block">SEVERITY LEVEL</span>
              <p className={`font-black uppercase text-xs mt-0.5 ${incident.severity === "critical" ? "text-rose-400" : "text-amber-400"}`}>
                [{incident.severity.toUpperCase()}]
              </p>
            </div>
            <div>
              <span className="text-zinc-500 text-[10px] uppercase font-bold block">OCCURRENCE COUNT</span>
              <p className="text-sky-400 font-bold text-xs mt-0.5">× {incident.occurrences_count} events</p>
            </div>
            <div>
              <span className="text-zinc-500 text-[10px] uppercase font-bold block">FIRST RECORDED</span>
              <p className="text-zinc-300 text-[11px] mt-0.5">{new Date(incident.first_seen_at).toLocaleTimeString()}</p>
            </div>
            <div>
              <span className="text-zinc-500 text-[10px] uppercase font-bold block">CURRENT STATUS</span>
              <p className={`font-bold uppercase text-xs mt-0.5 ${isResolved ? "text-emerald-400" : "text-rose-400"}`}>
                [{incident.status.toUpperCase()}]
              </p>
            </div>
          </div>

          {/* Incident Title */}
          <div>
            <label className="text-zinc-500 text-[10px] uppercase font-bold block mb-1">
              // INCIDENT TITLE //
            </label>
            <div className="p-3 bg-black border border-zinc-800 text-white font-bold text-xs">
              {incident.title}
            </div>
          </div>

          {/* Contextual Message */}
          {incident.message && (
            <div>
              <label className="text-zinc-500 text-[10px] uppercase font-bold block mb-1">
                // CONTEXTUAL ERROR PAYLOAD //
              </label>
              <div className="p-3 bg-black border border-zinc-800 text-zinc-300 text-[11px] leading-relaxed break-words">
                {incident.message}
              </div>
            </div>
          )}

          {/* OPERATIONAL INCIDENT TIMELINE */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <label className="text-cyan-400 text-[10px] uppercase font-bold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                // INCIDENT CHRONOLOGICAL TIMELINE //
              </label>
              <span className="text-[10px] text-zinc-500 font-bold">{updates.length} ENTRIES</span>
            </div>

            {isLoadingUpdates ? (
              <div className="p-4 text-center text-[11px] text-zinc-500 bg-black border border-zinc-800">
                [ LOADING TIMELINE LEDGER... ]
              </div>
            ) : updates.length === 0 ? (
              <div className="p-3 text-center text-[11px] text-zinc-500 bg-black border border-zinc-800">
                No intermediate notes logged yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {updates.map((upd) => (
                  <div key={upd.id} className="p-3 bg-black border border-zinc-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${getStatusBadgeClass(upd.status)}`}>
                        [{upd.status.toUpperCase()}]
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {new Date(upd.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-relaxed font-sans">
                      {upd.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* OPERATOR TIMELINE NOTE COMPOSER */}
          <form onSubmit={handlePostTimelineUpdate} className="space-y-3 p-4 bg-[#070b12] border border-zinc-800">
            <label className="text-zinc-400 text-[10px] uppercase font-bold block">
              // LOG OPERATIONAL UPDATE //
            </label>

            {/* Status selection buttons */}
            <div className="grid grid-cols-4 gap-1.5">
              {(["investigating", "identified", "monitoring", "resolved"] as const).map((st) => (
                <button
                  type="button"
                  key={st}
                  onClick={() => setUpdateStatus(st)}
                  className={`py-1 text-[10px] font-bold uppercase border transition ${
                    updateStatus === st
                      ? getStatusBadgeClass(st)
                      : "bg-black border-zinc-800 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {st.substring(0, 5)}
                </button>
              ))}
            </div>

            <textarea
              value={updateMessage}
              onChange={(e) => setUpdateMessage(e.target.value)}
              placeholder="Operator status note: mitigation deployed, examining recovery..."
              rows={2}
              className="w-full bg-black border border-zinc-700 text-white p-2.5 text-xs focus:border-cyan-500 focus:outline-none resize-none"
            />

            <button
              type="submit"
              disabled={isPostingUpdate || !updateMessage.trim()}
              className="w-full py-2 bg-cyan-950 border border-cyan-500 text-cyan-300 hover:bg-cyan-900 disabled:opacity-40 font-bold uppercase text-[11px] flex items-center justify-center gap-1.5 transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isPostingUpdate ? "[ RECORDING UPDATE... ]" : "[ POST TIMELINE UPDATE ]"}</span>
            </button>
          </form>

          {/* Stack Trace Terminal */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-zinc-500 text-[10px] uppercase font-bold flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                RAW STACK TRACE & STDOUT
              </label>
              {incident.stack_trace && (
                <button
                  onClick={handleCopyTrace}
                  className="text-[10px] font-bold text-zinc-400 hover:text-white flex items-center gap-1 uppercase"
                >
                  {copiedTrace ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedTrace ? "COPIED" : "COPY TRACE"}</span>
                </button>
              )}
            </div>
            <pre className="p-3 bg-black border border-zinc-800 text-rose-300 text-[11px] overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-40 shadow-inner">
              {incident.stack_trace || "No raw stack trace provided by inbound reporter."}
            </pre>
          </div>
        </div>

        {/* Action Footer */}
        <div className="pt-4 border-t-2 border-zinc-800 space-y-3">
          <Link
            to={`/incidents/${incident.id}`}
            onClick={onClose}
            className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-cyan-400 hover:text-cyan-300 font-bold uppercase flex items-center justify-center space-x-1.5 transition text-xs"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>[ OPEN PUBLIC POSTMORTEM REPORT ]</span>
          </Link>

          <button
            onClick={handleAction}
            disabled={isUpdating}
            className={`w-full py-3 font-bold uppercase flex items-center justify-center space-x-2 transition ${
              isResolved
                ? "bg-zinc-800 text-zinc-300 border border-zinc-600 hover:bg-zinc-700"
                : "btn-primary"
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            <span>{isResolved ? "[ RE-OPEN INCIDENT ]" : "[ RESOLVE INCIDENT ]"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
