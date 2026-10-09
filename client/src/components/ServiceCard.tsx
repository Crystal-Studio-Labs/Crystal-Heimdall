import React, { useState } from "react";
import { 
  Globe, 
  Clock, 
  Radio, 
  Copy, 
  Check, 
  Trash2, 
  Eye, 
  EyeOff, 
  Zap,
  Play,
  Wrench,
  ShieldCheck,
  Server
} from "lucide-react";
import { useToast } from "../lib/ToastContext";

export interface ServiceItem {
  id: string;
  name: string;
  type: string;
  endpoint?: string;
  status: "healthy" | "warning" | "critical" | "maintenance";
  is_public: number;
  api_key: string;
  latency_ms: number;
  uptime_pct: number;
  port?: number;
  keyword?: string;
  expected_status_code?: string;
  retry_count?: number;
  ssl_expiry_days?: number;
  is_maintenance?: number;
}

interface ServiceCardProps {
  service: ServiceItem;
  onRefresh: () => void;
}

export default function ServiceCard({ service, onRefresh }: ServiceCardProps) {
  const toast = useToast();
  const [copiedKey, setCopiedKey] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [isTogglingMaint, setIsTogglingMaint] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(service.api_key);
    setCopiedKey(true);
    toast.success(`Copied API key for ${service.name}`);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleToggleVisibility = async () => {
    setIsToggling(true);
    try {
      const nextPublic = service.is_public === 1 ? 0 : 1;
      const res = await fetch(`/api/v1/services/${service.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public: nextPublic }),
      });
      if (res.ok) {
        toast.info(nextPublic === 1 ? `Target '${service.name}' published to public status` : `Target '${service.name}' set to private`);
        onRefresh();
      }
    } catch {
      toast.error("Failed to update visibility");
    } finally {
      setIsToggling(false);
    }
  };

  const handleToggleMaintenance = async () => {
    setIsTogglingMaint(true);
    try {
      const isCurrentlyMaint = service.is_maintenance === 1 || service.status === "maintenance";
      const nextMaint = isCurrentlyMaint ? 0 : 1;
      const res = await fetch(`/api/v1/services/${service.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_maintenance: nextMaint }),
      });
      if (res.ok) {
        toast.info(nextMaint === 1 ? `Target '${service.name}' entered MAINTENANCE mode (alerts suppressed)` : `Target '${service.name}' resumed ACTIVE monitoring`);
        onRefresh();
      }
    } catch {
      toast.error("Failed to toggle maintenance mode");
    } finally {
      setIsTogglingMaint(false);
    }
  };

  const handleSingleProbe = async () => {
    setIsTriggering(true);
    try {
      const res = await fetch(`/api/v1/services/${service.id}/probe`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.isHealthy) {
          toast.success(`Probe Nominal: ${data.latency_ms}ms (Status ${data.statusCode})`);
        } else {
          toast.error(`Probe Failure: ${data.error || "Service down"} (${data.latency_ms}ms)`);
        }
        onRefresh();
      }
    } catch {
      toast.error("Manual probe failed");
    } finally {
      setIsTriggering(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to remove target '${service.name}'?`)) return;
    try {
      const res = await fetch(`/api/v1/services/${service.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.info(`Target '${service.name}' removed`);
        onRefresh();
      }
    } catch {
      toast.error("Failed to delete service");
    }
  };

  const isHealthy = service.status === "healthy";
  const isWarning = service.status === "warning";
  const isMaintenance = service.status === "maintenance" || service.is_maintenance === 1;

  // 24 mini-bars for dashboard card
  const miniBlocks = Array.from({ length: 24 }).map((_, i) => {
    const isLatest = i === 23;
    if (isMaintenance) return "bg-sky-500";
    if (isLatest) return isHealthy ? "bg-emerald-400" : isWarning ? "bg-amber-400" : "bg-rose-500";
    if (i === 11 && isWarning) return "bg-amber-400";
    return "bg-emerald-500";
  });

  return (
    <div className={`bg-[#0b0f17] border-2 shadow-[3px_3px_0px_#000] p-5 flex flex-col justify-between space-y-4 hover:border-zinc-500 transition-all font-mono ${
      isMaintenance ? "border-sky-700/80" : "border-zinc-700"
    }`}>
      <div className="space-y-3">
        {/* Top Type & Visibility Header */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1.5 text-[10px] font-bold">
            {service.type === "http-poll" ? (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-sky-950 border border-sky-500 text-sky-400 uppercase">
                <Globe className="w-3 h-3" />
                <span>Synthetic HTTP</span>
              </span>
            ) : service.type === "port-check" ? (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-950 border border-indigo-500 text-indigo-400 uppercase">
                <Server className="w-3 h-3" />
                <span>TCP Port {service.port || ""}</span>
              </span>
            ) : service.type === "deadman-cron" ? (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-950 border border-amber-500 text-amber-400 uppercase">
                <Clock className="w-3 h-3" />
                <span>Dead-Man Cron</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-950 border border-purple-500 text-purple-400 uppercase">
                <Radio className="w-3 h-3" />
                <span>Crash Sink</span>
              </span>
            )}

            {/* SSL Badge if available */}
            {service.ssl_expiry_days && (
              <span className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-700 text-emerald-400 text-[9px] font-bold">
                SSL: {service.ssl_expiry_days}d
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* Public / Private Visibility Pill */}
            <button
              onClick={handleToggleVisibility}
              disabled={isToggling}
              title={
                service.is_public === 1
                  ? "Public: Visible on /status (Click to set private)"
                  : "Private: Hidden from /status (Click to publish)"
              }
              className={`px-2 py-0.5 text-[10px] font-bold flex items-center gap-1 border transition-all ${
                service.is_public === 1
                  ? "bg-sky-950 border-sky-500 text-sky-300 shadow-[1px_1px_0px_#000]"
                  : "bg-black border-zinc-700 text-zinc-500 hover:text-white"
              }`}
            >
              {service.is_public === 1 ? <Eye className="w-3 h-3 text-sky-400" /> : <EyeOff className="w-3 h-3 text-zinc-500" />}
              <span>{service.is_public === 1 ? "PUBLIC" : "PRIVATE"}</span>
            </button>

            {/* Status Pill */}
            <span
              className={`px-2 py-0.5 text-[10px] font-black border uppercase ${
                isMaintenance
                  ? "bg-sky-950 border-sky-400 text-sky-300"
                  : isHealthy
                  ? "bg-emerald-950 border-emerald-500 text-emerald-400"
                  : isWarning
                  ? "bg-amber-950 border-amber-500 text-amber-400"
                  : "bg-rose-950 border-rose-500 text-rose-400"
              }`}
            >
              [{service.status.toUpperCase()}]
            </span>
          </div>
        </div>

        {/* Title & Endpoint */}
        <div>
          <div className="flex items-center space-x-2">
            <span
              className={`w-2.5 h-2.5 inline-block shrink-0 ${
                isMaintenance
                  ? "bg-sky-400"
                  : isHealthy
                  ? "bg-emerald-400"
                  : isWarning
                  ? "bg-amber-400"
                  : "bg-rose-500"
              }`}
            />
            <h3 className="font-black text-white text-sm sm:text-base tracking-tight truncate uppercase">
              {service.name}
            </h3>
          </div>

          <p className="text-xs text-zinc-400 font-mono truncate mt-1 pl-4">
            {service.endpoint || (service.type === "deadman-cron" ? "Crontab Heartbeat Ping" : "Inbound Crash Ingestion Sink")}
          </p>

          {/* Keyword assertion notice if set */}
          {service.keyword && (
            <p className="text-[10px] text-zinc-500 pl-4 mt-0.5">
              Asserts Keyword: <span className="text-zinc-300 font-bold">"{service.keyword}"</span>
            </p>
          )}
        </div>
      </div>

      {/* Mini 24h Blocks Strip (Sharp Rectangular Bars) */}
      <div className="space-y-1 pt-1">
        <div className="flex items-center gap-0.5 h-3" title="24-Hour Availability Sparkline">
          {miniBlocks.map((c, i) => (
            <div key={i} className={`flex-1 h-full ${c} hover:brightness-125 transition`} />
          ))}
        </div>
        <div className="flex justify-between text-[10px] font-mono text-zinc-500">
          <span>24H AVAILABILITY</span>
          <span className="font-bold text-emerald-400">{service.uptime_pct || 99.9}% UPTIME</span>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="pt-3 border-t-2 border-zinc-800 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center space-x-1.5 text-zinc-400 text-[11px]">
          <Zap className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            {service.latency_ms > 0 ? (
              <span className={`font-bold ${service.latency_ms < 100 ? "text-emerald-400" : service.latency_ms < 300 ? "text-amber-400" : "text-rose-400"}`}>
                {service.latency_ms}ms
              </span>
            ) : (
              <span className="text-zinc-500">Passive</span>
            )}
          </span>
        </div>

        <div className="flex items-center space-x-1.5">
          {/* Instant Probe Test Button (Uptime Kuma style) */}
          {service.type === "http-poll" && (
            <button
              onClick={handleSingleProbe}
              disabled={isTriggering}
              className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] flex items-center gap-1 text-[10px] font-bold"
              title="Test probe immediately"
            >
              <Play className={`w-2.5 h-2.5 ${isTriggering ? "animate-spin text-emerald-400" : "text-emerald-400"}`} />
              <span>TEST</span>
            </button>
          )}

          {/* Maintenance Mode Toggle Button */}
          <button
            onClick={handleToggleMaintenance}
            disabled={isTogglingMaint}
            className={`px-2 py-1 border flex items-center gap-1 text-[10px] font-bold shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition ${
              isMaintenance
                ? "bg-sky-950 border-sky-400 text-sky-300"
                : "bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border-zinc-700"
            }`}
            title="Toggle scheduled maintenance mode"
          >
            <Wrench className="w-2.5 h-2.5" />
            <span>{isMaintenance ? "MAINT: ON" : "MAINT"}</span>
          </button>

          {/* Copy Key */}
          <button
            onClick={handleCopy}
            className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 flex items-center gap-1 text-[10px] font-bold shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
            title="Copy API key"
          >
            {copiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copiedKey ? "COPIED" : "KEY"}</span>
          </button>

          {/* Delete */}
          <button
            onClick={handleDelete}
            className="p-1 text-zinc-500 hover:text-rose-400 hover:bg-rose-950 border border-transparent hover:border-rose-600 transition"
            title="Delete monitored target"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
