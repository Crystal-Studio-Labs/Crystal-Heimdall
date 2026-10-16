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
  Check,
  Copy,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  Sliders
} from "lucide-react";
import { useToast } from "../lib/ToastContext";

interface AddServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  onOpenSdk?: (service: any) => void;
}

export default function AddServiceModal({ isOpen, onClose, onCreated, onOpenSdk }: AddServiceModalProps) {
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdTarget, setCreatedTarget] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<string[]>(["Production"]);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/v1/groups")
        .then((r) => r.json())
        .then((data) => {
          if (data && data.groups && Array.isArray(data.groups)) {
            const names = data.groups.map((g: any) => g.name);
            if (!names.includes("Production")) names.unshift("Production");
            setAvailableGroups(names);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setCreatedTarget(null);
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Reset createdTarget on modal open/close
  useEffect(() => {
    if (!isOpen) {
      setCreatedTarget(null);
      setCopiedKey(false);
      setShowAdvanced(false);
    }
  }, [isOpen]);

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

      const data = await res.json();
      toast.success(`Target '${name.trim()}' registered successfully!`);
      setName("");
      setEndpoint("");
      setKeyword("");
      setShowAdvanced(false);
      onCreated();
      setCreatedTarget(data.service);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // If newly created, present clear confirmation with optional SDK prompt
  if (createdTarget) {
    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 font-mono text-xs overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setCreatedTarget(null);
            onClose();
          }
        }}
        role="dialog"
        aria-modal="true"
      >
        <div className="bg-[#0b0f17] border-2 border-emerald-500 shadow-[6px_6px_0px_#10b981] max-w-lg w-full max-h-[90vh] my-auto flex flex-col relative">
          <div className="p-4 sm:p-5 border-b-2 border-zinc-800 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-emerald-950 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                <Check className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-tight">
                  Target Registered &amp; Active
                </h2>
                <p className="text-[10px] text-emerald-400 font-mono">
                  [SYNTHETIC MONITORING LIVE // ZERO CODE CHANGES REQUIRED]
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setCreatedTarget(null);
                onClose();
              }}
              className="p-1.5 bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
            <div className="p-3 bg-black border border-zinc-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400 uppercase font-bold">TARGET:</span>
                <span className="text-white font-black truncate max-w-[240px]">{createdTarget.name}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400 uppercase font-bold">PROTOCOL:</span>
                <span className="text-cyan-400 font-mono font-bold uppercase">{createdTarget.type}</span>
              </div>
              {createdTarget.endpoint && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400 uppercase font-bold">ENDPOINT:</span>
                  <span className="text-zinc-300 font-mono truncate max-w-[240px]">{createdTarget.endpoint}</span>
                </div>
              )}
              <div className="pt-2 border-t border-zinc-800 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-zinc-400 block font-bold uppercase">TARGET API KEY:</span>
                  <code className="text-emerald-300 font-mono font-bold text-xs">{createdTarget.api_key}</code>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(createdTarget.api_key);
                    setCopiedKey(true);
                    toast.success("API key copied to clipboard!");
                    setTimeout(() => setCopiedKey(false), 2000);
                  }}
                  className="px-2.5 py-1 bg-zinc-900 border border-zinc-700 hover:border-emerald-400 text-xs text-zinc-200 font-bold flex items-center gap-1"
                >
                  {copiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-emerald-400" />}
                  <span>{copiedKey ? "COPIED" : "COPY"}</span>
                </button>
              </div>
            </div>

            <div className="p-3 bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300 space-y-1">
              <p className="font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Outbound synthetic probing is active right now.</span>
              </p>
              <p className="text-zinc-400 text-[10px] leading-relaxed">
                Heimdall probes this target automatically. Connecting your external application code via our SDK is strictly <strong>optional</strong> — use it only if you want your backend server to report startup, push custom heartbeats, or notify Heimdall during graceful restarts.
              </p>
            </div>
          </div>

          <div className="p-3 sm:p-4 border-t-2 border-zinc-800 bg-[#080c12] shrink-0 flex flex-col sm:flex-row items-center justify-end gap-2">
            {onOpenSdk && (
              <button
                type="button"
                onClick={() => {
                  const target = createdTarget;
                  setCreatedTarget(null);
                  onClose();
                  onOpenSdk(target);
                }}
                className="w-full sm:w-auto px-4 py-2 bg-purple-950/80 hover:bg-purple-900 border border-purple-500 text-purple-200 text-xs font-bold uppercase flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_#000]"
              >
                <Radio className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                <span>VIEW SDK SNIPPET (OPTIONAL)</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setCreatedTarget(null);
                onClose();
              }}
              className="w-full sm:w-auto px-5 py-2 btn-primary text-xs font-black uppercase flex items-center justify-center gap-1.5"
            >
              <span>[ DONE // GO TO DASHBOARD ]</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 font-mono text-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-[#0b0f17] border-2 border-zinc-600 shadow-[6px_6px_0px_#000000] max-w-lg w-full max-h-[90vh] my-auto flex flex-col relative">
        <div className="p-4 sm:p-5 border-b-2 border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-zinc-900 border border-emerald-400 flex items-center justify-center text-emerald-400 font-bold shrink-0">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-tight">
                Register Telemetry Target
              </h2>
              <p className="text-[10px] text-zinc-400 font-sans hidden sm:block">
                Synthetic multi-protocol monitoring: HTTP(S), TCP Port, Cron Push, Crash Sink
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white shrink-0"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
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
                {availableGroups.map((tag) => (
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
                // MONITOR PROTOCOL &amp; TYPE //
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "http-poll", label: "HTTP(S)", icon: Globe, desc: "Synthetic poll" },
                  { id: "port-check", label: "TCP Port", icon: Server, desc: "DB/Redis/SSH" },
                  { id: "deadman-cron", label: "Cron Push", icon: Clock, desc: "Heartbeat ping" },
                  { id: "webhook-sink", label: "Crash Sink", icon: Radio, desc: "Sentry errors" },
                ].map((t) => {
                  const Icon = t.icon;
                  const isSelected = type === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setType(t.id as any)}
                      className={`p-2 border-2 text-center flex flex-col items-center justify-center space-y-1 transition ${
                        isSelected
                          ? "bg-zinc-800 border-emerald-400 text-emerald-300 font-bold shadow-[2px_2px_0px_#000]"
                          : "bg-black border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase">{t.label}</span>
                      <span className="text-[8px] text-zinc-500">{t.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {type === "http-poll" && (
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
                      className="w-full p-2 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
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
                      className="w-full p-2 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    { label: "Supabase Pooler (6543)", p: "6543" },
                    { label: "Postgres (5432)", p: "5432" },
                    { label: "Redis (6379)", p: "6379" },
                    { label: "MySQL (3306)", p: "3306" },
                    { label: "SSH (22)", p: "22" },
                  ].map((preset) => (
                    <button
                      key={preset.p}
                      type="button"
                      onClick={() => setPort(preset.p)}
                      className={`px-2 py-0.5 text-[9px] font-mono border transition ${
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
                      className={`px-2 py-1 text-[9px] font-mono border ${
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

            {/* Collapsible Advanced Configuration Section */}
            <div className="border border-zinc-800 bg-black/60">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full p-2.5 flex items-center justify-between text-left hover:bg-zinc-900/60 transition"
              >
                <div className="flex items-center space-x-2 text-zinc-300">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    Advanced Probe &amp; Alert Settings
                  </span>
                </div>
                <div className="flex items-center space-x-1.5 text-[10px] text-zinc-400 font-mono">
                  <span>{showAdvanced ? "Hide settings" : "Interval, retries & assertions"}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                </div>
              </button>

              {showAdvanced && (
                <div className="p-3 border-t border-zinc-800 space-y-3 bg-zinc-950/70 animate-in fade-in duration-150">
                  {type === "http-poll" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-zinc-400 text-[10px] font-mono mb-1 font-bold uppercase">
                          EXPECTED STATUS CODE
                        </label>
                        <input
                          type="text"
                          placeholder="200-299 or 200, 301"
                          value={expectedStatusCode}
                          onChange={(e) => setExpectedStatusCode(e.target.value)}
                          className="w-full p-2 bg-black border border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                        />
                        <span className="text-[9px] text-zinc-500 mt-0.5 block">Default: 200-299</span>
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
                          className="w-full p-2 bg-black border border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                        />
                        <span className="text-[9px] text-zinc-500 mt-0.5 block">Fails if string missing</span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-400 text-[10px] font-mono mb-1 font-bold uppercase">
                        CHECK INTERVAL (SEC)
                      </label>
                      <select
                        value={pollIntervalSec}
                        onChange={(e) => setPollIntervalSec(e.target.value)}
                        className="w-full p-2 bg-black border border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
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
                        className="w-full p-2 bg-black border border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                      >
                        <option value="1">1 Failure (Instant Alarm)</option>
                        <option value="2">2 Failures (Standard Debounce)</option>
                        <option value="3">3 Failures (High Tolerance)</option>
                        <option value="5">5 Failures (Flapping Protection)</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-2.5 bg-black border border-zinc-800 flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-1.5 font-bold text-white text-[11px]">
                        {isPublic ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-zinc-400" />}
                        <span className="uppercase">PUBLISH TO PUBLIC STATUS BOARD</span>
                      </div>
                      <p className="text-[10px] text-zinc-500 font-sans">
                        {isPublic ? "Visible on /status with 30-day heartbeat strip" : "Operator eyes only (private)"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsPublic(!isPublic)}
                      className={`px-2.5 py-1 font-mono font-bold text-[10px] border uppercase transition ${
                        isPublic
                          ? "bg-emerald-950 text-emerald-300 border-emerald-400"
                          : "bg-zinc-900 text-zinc-400 border-zinc-700"
                      }`}
                    >
                      {isPublic ? "[PUBLIC]" : "[PRIVATE]"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Outbound synthetic reminder */}
            <div className="p-2.5 bg-zinc-950 border border-zinc-800 text-[10px] text-zinc-400 flex items-start gap-2">
              <Radio className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-zinc-200 uppercase">Outbound Probing Active:</strong>{" "}
                <span>
                  Synthetic health polling starts automatically upon registration with zero code required.
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 sm:p-4 border-t-2 border-zinc-800 bg-[#080c12] shrink-0 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-xs font-bold uppercase min-h-[38px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 btn-primary text-xs font-black uppercase min-h-[38px] flex items-center gap-1.5"
            >
              {isSubmitting ? "Registering..." : "[ REGISTER TARGET ]"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
