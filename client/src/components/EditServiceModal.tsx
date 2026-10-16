import React, { useState, useEffect } from "react";
import { 
  X, 
  Save, 
  Globe, 
  Clock, 
  Radio, 
  Eye, 
  EyeOff, 
  Server,
  Layers
} from "lucide-react";
import { useToast } from "../lib/ToastContext";
import { ServiceItem } from "./ServiceCard";

interface EditServiceModalProps {
  isOpen: boolean;
  service: ServiceItem | null;
  onClose: () => void;
  onUpdated: () => void;
}

const COMMON_PROJECT_TAGS = [
  "Production",
  "Campus Relay",
  "KrishiSetu",
  "OSCC",
  "Internal APIs",
  "Staging",
];

export default function EditServiceModal({ isOpen, service, onClose, onUpdated }: EditServiceModalProps) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [type, setType] = useState<"http-poll" | "port-check" | "deadman-cron" | "webhook-sink">("http-poll");
  const [endpoint, setEndpoint] = useState("");
  const [port, setPort] = useState("5432");
  const [groupName, setGroupName] = useState("Production");
  const [keyword, setKeyword] = useState("");
  const [expectedStatusCode, setExpectedStatusCode] = useState("200-299");
  const [pollIntervalSec, setPollIntervalSec] = useState("60");
  const [retryCount, setRetryCount] = useState("2");
  const [expectedIntervalSec, setExpectedIntervalSec] = useState("86400");
  const [gracePeriodSec, setGracePeriodSec] = useState("300");
  const [isPublic, setIsPublic] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Prepopulate state when service opens
  useEffect(() => {
    if (service) {
      setName(service.name || "");
      setType((service.type as any) || "http-poll");
      setEndpoint(service.endpoint || "");
      setPort(service.port ? String(service.port) : "5432");
      setGroupName(service.group_name || "Production");
      setKeyword(service.keyword || "");
      setExpectedStatusCode(service.expected_status_code || "200-299");
      setPollIntervalSec(String(service.poll_interval_sec || 60));
      setRetryCount(String(service.retry_count || 2));
      setExpectedIntervalSec(String(service.expected_interval_sec || 86400));
      setGracePeriodSec(String(service.grace_period_sec || 300));
      setIsPublic(service.is_public === 1);
    }
  }, [service]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !service) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      let finalEndpoint = endpoint.trim();
      if (type === "port-check" && !finalEndpoint.includes("://") && finalEndpoint) {
        finalEndpoint = `tcp://${finalEndpoint}:${port}`;
      }

      const res = await fetch(`/api/v1/services/${service.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          endpoint: type === "http-poll" || type === "port-check" ? finalEndpoint : null,
          port: type === "port-check" ? Number(port) : null,
          group_name: groupName.trim() || "Production",
          keyword: keyword.trim() || null,
          expected_status_code: expectedStatusCode.trim() || "200-299",
          poll_interval_sec: Number(pollIntervalSec) || 60,
          retry_count: Number(retryCount) || 2,
          expected_interval_sec: type === "deadman-cron" ? Number(expectedIntervalSec) : null,
          grace_period_sec: Number(gracePeriodSec) || 300,
          is_public: isPublic ? 1 : 0,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update target configuration");
      }

      toast.success(`Target '${name.trim()}' updated successfully!`);
      onUpdated();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 font-mono text-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl bg-[#0b0f17] border-2 border-zinc-700 shadow-[6px_6px_0px_#000] p-6 space-y-6 my-8 animate-in fade-in zoom-in-95 duration-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-zinc-800">
          <div>
            <h2 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-sky-400" />
              <span>EDIT TARGET CONFIGURATION</span>
            </h2>
            <p className="text-[11px] text-zinc-400 font-sans mt-0.5">
              Modify operational parameters for {service.name} (ID: {service.id})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Service Name */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
              TARGET NAME *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Campus Relay API Gateway"
              className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white placeholder-zinc-600 outline-none focus:border-cyan-400"
            />
          </div>

          {/* Project / Group Tag */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3 h-3 text-cyan-400" />
              <span>PROJECT / ENVIRONMENT GROUP</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Campus Relay, Production"
                className="flex-1 p-2.5 bg-black border-2 border-zinc-700 text-white placeholder-zinc-600 outline-none focus:border-cyan-400"
              />
            </div>
            {/* Quick Suggestions */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {COMMON_PROJECT_TAGS.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  onClick={() => setGroupName(tag)}
                  className={`px-2 py-0.5 text-[9px] font-bold border transition ${
                    groupName === tag
                      ? "bg-cyan-950 border-cyan-400 text-cyan-300"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Monitoring Type Selector */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
              MONITORING PROTOCOL
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "http-poll", label: "HTTP/S POLL", icon: Globe },
                { id: "port-check", label: "TCP PORT", icon: Server },
                { id: "deadman-cron", label: "DEAD-MAN", icon: Clock },
                { id: "webhook-sink", label: "CRASH SINK", icon: Radio },
              ].map((t) => {
                const Icon = t.icon;
                const isSelected = type === t.id;
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setType(t.id as any)}
                    className={`p-2 border-2 flex flex-col items-center justify-center space-y-1 text-center transition ${
                      isSelected
                        ? "bg-zinc-900 border-cyan-400 text-cyan-400 font-bold shadow-[2px_2px_0px_#000]"
                        : "bg-black border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[10px] tracking-tight">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Protocol-Specific Parameters */}
          {type === "http-poll" && (
            <div className="space-y-3 p-3 bg-black/50 border border-zinc-800">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">
                  ENDPOINT URL *
                </label>
                <input
                  type="url"
                  required
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="https://api.domain.com/health"
                  className="w-full p-2 bg-black border border-zinc-700 text-white placeholder-zinc-600 outline-none focus:border-cyan-400 text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">
                    EXPECTED STATUS CODE
                  </label>
                  <input
                    type="text"
                    value={expectedStatusCode}
                    onChange={(e) => setExpectedStatusCode(e.target.value)}
                    placeholder="200-299 or 200,204"
                    className="w-full p-2 bg-black border border-zinc-700 text-white placeholder-zinc-600 outline-none focus:border-cyan-400 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">
                    RESPONSE KEYWORD (OPTIONAL)
                  </label>
                  <input
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="e.g. OK, healthy, active"
                    className="w-full p-2 bg-black border border-zinc-700 text-white placeholder-zinc-600 outline-none focus:border-cyan-400 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">
                    POLL INTERVAL (SEC)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="3600"
                    value={pollIntervalSec}
                    onChange={(e) => setPollIntervalSec(e.target.value)}
                    className="w-full p-2 bg-black border border-zinc-700 text-white outline-none focus:border-cyan-400 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">
                    RETRY THRESHOLD
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={retryCount}
                    onChange={(e) => setRetryCount(e.target.value)}
                    className="w-full p-2 bg-black border border-zinc-700 text-white outline-none focus:border-cyan-400 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {type === "port-check" && (
            <div className="space-y-3 p-3 bg-black/50 border border-zinc-800">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">
                    HOST / IP ADDRESS *
                  </label>
                  <input
                    type="text"
                    required
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    placeholder="db.example.internal or 127.0.0.1"
                    className="w-full p-2 bg-black border border-zinc-700 text-white placeholder-zinc-600 outline-none focus:border-cyan-400 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">
                    PORT NUMBER *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="65535"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder="5432"
                    className="w-full p-2 bg-black border border-zinc-700 text-white placeholder-zinc-600 outline-none focus:border-cyan-400 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">
                    CHECK INTERVAL (SEC)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="3600"
                    value={pollIntervalSec}
                    onChange={(e) => setPollIntervalSec(e.target.value)}
                    className="w-full p-2 bg-black border border-zinc-700 text-white outline-none focus:border-cyan-400 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">
                    RETRY THRESHOLD
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={retryCount}
                    onChange={(e) => setRetryCount(e.target.value)}
                    className="w-full p-2 bg-black border border-zinc-700 text-white outline-none focus:border-cyan-400 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {type === "deadman-cron" && (
            <div className="space-y-3 p-3 bg-black/50 border border-zinc-800">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">
                    EXPECTED INTERVAL (SEC)
                  </label>
                  <input
                    type="number"
                    value={expectedIntervalSec}
                    onChange={(e) => setExpectedIntervalSec(e.target.value)}
                    className="w-full p-2 bg-black border border-zinc-700 text-white outline-none focus:border-cyan-400 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">
                    GRACE PERIOD (SEC)
                  </label>
                  <input
                    type="number"
                    value={gracePeriodSec}
                    onChange={(e) => setGracePeriodSec(e.target.value)}
                    className="w-full p-2 bg-black border border-zinc-700 text-white outline-none focus:border-cyan-400 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Public Visibility Toggle */}
          <div className="flex items-center justify-between p-3 bg-black border border-zinc-800">
            <div>
              <span className="font-bold text-white block uppercase">PUBLIC STATUS VISIBILITY</span>
              <span className="text-[10px] text-zinc-400 font-sans">
                {isPublic ? "Visible on public status ledger (/)" : "Hidden from public view (Operator eyes only)"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsPublic(!isPublic)}
              className={`px-3 py-1.5 border font-bold flex items-center gap-1.5 transition shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] ${
                isPublic
                  ? "bg-sky-950 border-sky-400 text-sky-300"
                  : "bg-zinc-900 border-zinc-700 text-zinc-400"
              }`}
            >
              {isPublic ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>{isPublic ? "PUBLIC" : "PRIVATE"}</span>
            </button>
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t-2 border-zinc-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 font-bold transition shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-black border-2 border-cyan-300 font-black flex items-center gap-1.5 transition shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
            >
              <Save className={`w-3.5 h-3.5 ${isSubmitting ? "animate-spin" : ""}`} />
              <span>{isSubmitting ? "SAVING..." : "SAVE CHANGES"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
