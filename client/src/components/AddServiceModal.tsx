import React, { useState, useEffect } from "react";
import { 
  X, 
  Plus, 
  Globe, 
  Clock, 
  Radio, 
  Eye, 
  EyeOff, 
  Server,
  ShieldCheck,
  Search,
  Check
} from "lucide-react";
import { useToast } from "../lib/ToastContext";

interface AddServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function AddServiceModal({ isOpen, onClose, onCreated }: AddServiceModalProps) {
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

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      let finalEndpoint = endpoint.trim();
      if (type === "port-check" && !finalEndpoint.includes("://")) {
        finalEndpoint = `tcp://${endpoint.trim()}:${port}`;
      }

      const res = await fetch("/api/v1/services", {
        method: "POST",
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
        throw new Error(data.error || "Failed to create target");
      }

      toast.success(`Target '${name.trim()}' registered successfully!`);
      setName("");
      setEndpoint("");
      setKeyword("");
      onCreated();
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
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-[#0b0f17] border-2 border-zinc-600 shadow-[6px_6px_0px_#000000] max-w-xl w-full p-6 sm:p-7 relative space-y-5 my-8">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-3 border-b-2 border-zinc-800 pb-4">
          <div className="w-8 h-8 bg-zinc-900 border border-emerald-400 flex items-center justify-center text-emerald-400 font-bold">
            <Plus className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-black text-white uppercase tracking-tight">
              Register Telemetry Target
            </h2>
            <p className="text-[11px] text-zinc-400 font-sans">
              Advanced multi-protocol monitoring: HTTP(s), TCP Port, Dead-Man Cron, or Crash Sink
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-zinc-400 text-[10px] font-mono mb-1 font-bold uppercase">
              // SERVICE / PROJECT NAME //
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Platform API Gateway, Postgres Internal, Billing Worker"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
            />
          </div>

          <div>
            <label className="block text-zinc-400 text-[10px] font-mono mb-1 font-bold uppercase">
              // PROJECT / ENVIRONMENT GROUP //
            </label>
            <input
              type="text"
              placeholder="e.g. Production, Campus Relay, KrishiSetu, Internal APIs"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full p-2 bg-black border border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
            />
            <div className="flex flex-wrap gap-1.5 pt-1.5">
              {["Production", "Campus Relay", "KrishiSetu", "OSCC", "Internal APIs", "Staging"].map((tag) => (
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

          <div>
            <label className="block text-zinc-400 text-[10px] font-mono mb-1 font-bold uppercase">
              // MONITOR PROTOCOL & TYPE //
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "http-poll", label: "HTTP(S)", icon: Globe, desc: "Status & keyword" },
                { id: "port-check", label: "TCP Port", icon: Server, desc: "DB/Redis/SSH" },
                { id: "deadman-cron", label: "Cron Push", icon: Clock, desc: "Heartbeat switch" },
                { id: "webhook-sink", label: "Crash Sink", icon: Radio, desc: "Sentry errors" },
              ].map((t) => {
                const Icon = t.icon;
                const isSelected = type === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setType(t.id as any)}
                    className={`p-2.5 border-2 text-center flex flex-col items-center justify-center space-y-1 transition ${
                      isSelected
                        ? "bg-zinc-800 border-emerald-400 text-emerald-300 font-bold shadow-[2px_2px_0px_#000]"
                        : "bg-black border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase">{t.label}</span>
                    <span className="text-[9px] text-zinc-500">{t.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {type === "http-poll" && (
            <div className="space-y-3">
              <div>
                <label className="block text-zinc-400 text-[10px] font-mono mb-1 font-bold uppercase">
                  // ENDPOINT URL (HTTP / HTTPS) //
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://api.crystalstudio.labs/health"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                />
                <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-zinc-400">
                  <span className="text-cyan-400 font-bold">[TIP]</span>
                  <span>Supabase REST API: use <button type="button" onClick={() => setEndpoint("https://<project-ref>.supabase.co/rest/v1/")} className="text-cyan-300 underline font-mono">https://&lt;ref&gt;.supabase.co/rest/v1/</button></span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 text-[10px] font-mono mb-1 font-bold uppercase">
                    EXPECTED STATUS CODE
                  </label>
                  <input
                    type="text"
                    placeholder="200-299 or 200, 301"
                    value={expectedStatusCode}
                    onChange={(e) => setExpectedStatusCode(e.target.value)}
                    className="w-full p-2 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                  />
                  <span className="text-[9px] text-zinc-500 mt-0.5 block">e.g. 200-299, or 200, 302</span>
                </div>

                <div>
                  <label className="block text-zinc-400 text-[10px] font-mono mb-1 font-bold uppercase">
                    ASSERT KEYWORD IN BODY
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Operational, OK"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="w-full p-2 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                  />
                  <span className="text-[9px] text-zinc-500 mt-0.5 block">Fails if string missing</span>
                </div>
              </div>
            </div>
          )}

          {type === "port-check" && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-zinc-400 text-[10px] font-mono mb-1 font-bold uppercase">
                    HOSTNAME / IP ADDRESS
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="db.internal.crystal or aws-0-us-east-1.pooler.supabase.com"
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 text-[10px] font-mono mb-1 font-bold uppercase">
                    PORT NUMBER
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="6543"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  { label: "Supabase Pooler (6543)", p: "6543" },
                  { label: "Postgres / Supabase Direct (5432)", p: "5432" },
                  { label: "Redis (6379)", p: "6379" },
                  { label: "MySQL (3306)", p: "3306" },
                  { label: "SSH (22)", p: "22" },
                ].map((preset) => (
                  <button
                    key={preset.p}
                    type="button"
                    onClick={() => setPort(preset.p)}
                    className={`px-2 py-0.5 text-[10px] font-mono border transition ${
                      port === preset.p
                        ? "bg-indigo-950 text-indigo-300 border-indigo-500 font-bold"
                        : "bg-black text-zinc-400 border-zinc-800 hover:text-white"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {type === "deadman-cron" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 text-[10px] font-mono mb-1 font-bold uppercase">
                    EXPECTED INTERVAL (SEC)
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="86400 (24h)"
                    value={expectedIntervalSec}
                    onChange={(e) => setExpectedIntervalSec(e.target.value)}
                    className="w-full p-2 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 text-[10px] font-mono mb-1 font-bold uppercase">
                    GRACE PERIOD (SEC)
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="300 (5m)"
                    value={gracePeriodSec}
                    onChange={(e) => setGracePeriodSec(e.target.value)}
                    className="w-full p-2 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                {[
                  { label: "5 Min", sec: "300" },
                  { label: "1 Hour", sec: "3600" },
                  { label: "6 Hours", sec: "21600" },
                  { label: "24 Hours", sec: "86400" },
                ].map((preset) => (
                  <button
                    key={preset.sec}
                    type="button"
                    onClick={() => setExpectedIntervalSec(preset.sec)}
                    className={`px-2 py-1 text-[10px] font-mono border ${
                      expectedIntervalSec === preset.sec
                        ? "bg-emerald-950 text-emerald-300 border-emerald-500 font-bold"
                        : "bg-black text-zinc-400 border-zinc-800 hover:text-white"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Polling Interval & Sensitivity Controls */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-zinc-400 text-[10px] font-mono mb-1 font-bold uppercase">
                CHECK INTERVAL (SEC)
              </label>
              <select
                value={pollIntervalSec}
                onChange={(e) => setPollIntervalSec(e.target.value)}
                className="w-full p-2 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
              >
                <option value="20">20s (Real-time)</option>
                <option value="30">30s (Rapid)</option>
                <option value="60">60s (Standard)</option>
                <option value="120">120s (2 Minutes)</option>
                <option value="300">300s (5 Minutes)</option>
              </select>
            </div>

            <div>
              <label className="block text-zinc-400 text-[10px] font-mono mb-1 font-bold uppercase">
                RETRIES BEFORE OUTAGE ALARM
              </label>
              <select
                value={retryCount}
                onChange={(e) => setRetryCount(e.target.value)}
                className="w-full p-2 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
              >
                <option value="1">1 Failure (Instant Alarm)</option>
                <option value="2">2 Failures (Standard Debounce)</option>
                <option value="3">3 Failures (High Tolerance)</option>
                <option value="5">5 Failures (Flapping Protection)</option>
              </select>
            </div>
          </div>

          {/* Visibility Toggle Switch */}
          <div className="p-3 bg-zinc-950 border-2 border-zinc-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center space-x-2 font-bold text-white text-xs">
                {isPublic ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4 text-zinc-400" />}
                <span className="uppercase">Publish to Public Status Page</span>
              </div>
              <p className="text-[10px] text-zinc-400 font-sans">
                {isPublic
                  ? "Target is visible publicly with its 30-day heartbeat availability strip."
                  : "Private: Visible only to authorized operators in the command deck."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsPublic(!isPublic)}
              className={`px-3 py-1 font-mono font-bold text-[10px] border uppercase ${
                isPublic
                  ? "bg-emerald-950 text-emerald-300 border-emerald-400"
                  : "bg-black text-zinc-400 border-zinc-700"
              }`}
            >
              {isPublic ? "[PUBLIC]" : "[PRIVATE]"}
            </button>
          </div>

          <div className="pt-3 border-t-2 border-zinc-800 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-xs font-bold uppercase"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 btn-primary text-xs font-black uppercase"
            >
              {isSubmitting ? "Registering..." : "[ REGISTER TARGET ]"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
