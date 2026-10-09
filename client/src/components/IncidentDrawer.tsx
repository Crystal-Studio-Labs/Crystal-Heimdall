import React, { useState, useEffect } from "react";
import { 
  X, 
  ShieldAlert, 
  CheckCircle, 
  Terminal, 
  Copy, 
  Check 
} from "lucide-react";
import { useToast } from "../lib/ToastContext";

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
}

interface IncidentDrawerProps {
  incident: IncidentItem | null;
  onClose: () => void;
  onResolve: (id: string) => Promise<void>;
}

export default function IncidentDrawer({ incident, onClose, onResolve }: IncidentDrawerProps) {
  const toast = useToast();
  const [copiedTrace, setCopiedTrace] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

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
    } catch {
      toast.error("Failed to update incident");
    } finally {
      setIsUpdating(false);
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
        className="relative w-full max-w-lg bg-[#0b0f17] border-l-2 border-zinc-700 shadow-2xl p-6 sm:p-7 flex flex-col justify-between overflow-y-auto z-10 space-y-6"
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
              <span className="text-zinc-500 text-[10px] uppercase font-bold block">OCCURRENCE DEBOUNCE</span>
              <p className="text-sky-400 font-bold text-xs mt-0.5">× {incident.occurrences_count} events</p>
            </div>
            <div>
              <span className="text-zinc-500 text-[10px] uppercase font-bold block">FIRST RECORDED</span>
              <p className="text-zinc-300 text-[11px] mt-0.5">{new Date(incident.first_seen_at).toLocaleTimeString()}</p>
            </div>
            <div>
              <span className="text-zinc-500 text-[10px] uppercase font-bold block">LAST RECURRED</span>
              <p className="text-zinc-300 text-[11px] mt-0.5">{new Date(incident.last_seen_at).toLocaleTimeString()}</p>
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
            <pre className="p-3 bg-black border border-zinc-800 text-rose-300 text-[11px] overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-56 shadow-inner">
              {incident.stack_trace || "No raw stack trace provided by inbound reporter."}
            </pre>
          </div>
        </div>

        {/* Action Footer */}
        <div className="pt-4 border-t-2 border-zinc-800">
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
