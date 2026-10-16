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
  Server,
  Pencil
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
  group_name?: string;
  last_event?: "online" | "heartbeat" | "offline";
  runtime_meta?: string;
  hourlyBlocks?: Array<{ hour: number; status: "up" | "down" | "degraded" | "maintenance" }>;
}

interface ServiceCardProps {
  service: ServiceItem;
  onRefresh: () => void;
  onEdit?: (service: ServiceItem) => void;
  onConnect?: (service: ServiceItem) => void;
}

export default function ServiceCard({ service, onRefresh, onEdit, onConnect }: ServiceCardProps) {
  const toast = useToast();
  const [copiedKey, setCopiedKey] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [isTogglingMaint, setIsTogglingMaint] = useState(false);

  let parsedMeta: { uptime?: number; memoryMB?: number; reason?: string } | null = null;
  if (service.runtime_meta) {
    try {
      parsedMeta = JSON.parse(service.runtime_meta);
    } catch {
      // ignore
    }
  }

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

  // 24 mini-bars for dashboard card (powered by authentic hourly telemetry)
  const miniBlocks = (service.hourlyBlocks && service.hourlyBlocks.length === 24)
    ? service.hourlyBlocks.map((b) => {
        if (b.status === "maintenance") return "bg-sky-500";
        if (b.status === "down") return "bg-rose-500";
        if (b.status === "degraded") return "bg-amber-400";
        return "bg-emerald-500";
      })
    : Array.from({ length: 24 }).map((_, i) => {
        const isLatest = i === 23;
        if (isMaintenance) return "bg-sky-500";
        if (isLatest) return isHealthy ? "bg-emerald-400" : isWarning ? "bg-amber-400" : "bg-rose-500";
        return "bg-emerald-500";
      });

  return (
    <div className={`bg-[#0b0f17] border-2 shadow-[3px_3px_0px_#000] p-4 sm:p-5 flex flex-col justify-between space-y-4 hover:border-zinc-500 transition-all font-mono min-w-0 overflow-hidden ${
      isMaintenance ? "border-sky-700/80" : "border-zinc-700"
    }`}>
      <div className="space-y-3 min-w-0">
        {/* Top Type & Visibility Header */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold min-w-0">
            {service.type === "http-poll" ? (
              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-sky-950 border border-sky-500 text-sky-400 uppercase shrink-0">
                <Globe className="w-3 h-3 shrink-0" />
                <span>HTTP</span>
              </span>
            ) : service.type === "port-check" ? (
              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-indigo-950 border border-indigo-500 text-indigo-400 uppercase shrink-0">
                <Server className="w-3 h-3 shrink-0" />
                <span>TCP {service.port || ""}</span>
              </span>
            ) : service.type === "deadman-cron" ? (
              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-950 border border-amber-500 text-amber-400 uppercase shrink-0">
                <Clock className="w-3 h-3 shrink-0" />
                <span>CRON</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-950 border border-purple-500 text-purple-400 uppercase shrink-0">
                <Radio className="w-3 h-3 shrink-0" />
                <span>SINK</span>
              </span>
            )}

            {/* SSL Badge if available */}
            {service.ssl_expiry_days && (
              <span className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-700 text-emerald-400 text-[9px] font-bold shrink-0">
                SSL: {service.ssl_expiry_days}d
              </span>
            )}

            {/* Project Group Tag Badge */}
            {service.group_name && (
              <span className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-700 text-cyan-400 text-[9px] font-bold uppercase tracking-wider shrink-0">
                [{service.group_name}]
              </span>
            )}

            {/* Two-Way Sync Sentinel Event Badge */}
            {service.last_event && (
              <span className={`px-1.5 py-0.5 border text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0 ${
                service.last_event === "online"
                  ? "bg-emerald-950/80 border-emerald-600 text-emerald-300"
                  : service.last_event === "offline"
                  ? "bg-rose-950/80 border-rose-600 text-rose-300"
                  : "bg-purple-950/80 border-purple-600 text-purple-300"
              }`}>
                <Radio className="w-2.5 h-2.5 animate-pulse shrink-0" />
                <span>SYNC: {service.last_event}</span>
                {parsedMeta?.memoryMB ? <span className="text-zinc-400">({parsedMeta.memoryMB}M)</span> : null}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {/* Public / Private Visibility Pill */}
            <button
              onClick={handleToggleVisibility}
              disabled={isToggling}
              title={
                service.is_public === 1
                  ? "Public: Visible on /status (Click to set private)"
                  : "Private: Hidden from /status (Click to publish)"
              }
              className={`px-2 py-0.5 text-[10px] font-bold flex items-center gap-1 border transition-all shrink-0 ${
                service.is_public === 1
                  ? "bg-sky-950 border-sky-500 text-sky-300 shadow-[1px_1px_0px_#000]"
                  : "bg-black border-zinc-700 text-zinc-500 hover:text-white"
              }`}
            >
              {service.is_public === 1 ? <Eye className="w-3 h-3 text-sky-400 shrink-0" /> : <EyeOff className="w-3 h-3 text-zinc-500 shrink-0" />}
              <span>{service.is_public === 1 ? "PUBLIC" : "PRIVATE"}</span>
            </button>

            {/* Status Pill */}
            <span
              className={`px-2 py-0.5 text-[10px] font-black border uppercase shrink-0 ${
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
        <div className="min-w-0">
          <div className="flex items-center space-x-2 min-w-0">
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
            <h3 className="font-black text-white text-sm sm:text-base tracking-tight truncate uppercase min-w-0">
              {service.name}
            </h3>
          </div>

          <p className="text-xs text-zinc-400 font-mono truncate mt-1 pl-4 min-w-0" title={service.endpoint}>
            {service.endpoint || (service.type === "deadman-cron" ? "Crontab Heartbeat Ping" : "Inbound Crash Ingestion Sink")}
          </p>

          {/* Keyword assertion notice if set */}
          {service.keyword && (
            <p className="text-[10px] text-zinc-500 pl-4 mt-0.5 truncate min-w-0">
              Asserts Keyword: <span className="text-zinc-300 font-bold">"{service.keyword}"</span>
            </p>
          )}
        </div>
      </div>

      {/* Mini 24h Blocks Strip (Sharp Rectangular Bars) */}
      <div className="space-y-1 pt-1 min-w-0">
        <div className="flex items-center gap-0.5 h-3 min-w-0 w-full" title="24-Hour Availability Sparkline">
          {miniBlocks.map((c, i) => (
            <div key={i} className={`flex-1 h-full min-w-0 ${c} hover:brightness-125 transition`} />
          ))}
        </div>
        <div className="flex justify-between text-[10px] font-mono text-zinc-500 min-w-0">
          <span className="truncate">24H AVAILABILITY</span>
          <span className="font-bold text-emerald-400 shrink-0">{service.uptime_pct || 99.9}% UPTIME</span>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="pt-3 border-t-2 border-zinc-800 flex flex-col gap-2 text-xs font-mono min-w-0">
        <div className="flex items-center justify-between text-zinc-400 text-[11px] min-w-0">
          <div className="flex items-center space-x-1.5 shrink-0">
            <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
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

          {parsedMeta?.uptime ? (
            <span className="text-[10px] text-zinc-400 font-mono bg-zinc-900 px-1.5 py-0.5 border border-zinc-800 shrink-0">
              UP: {Math.floor(parsedMeta.uptime / 60)}m
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1.5 min-w-0">
          {/* Drop-in SDK Snippet & Beacon Button */}
          {onConnect && (
            <button
              onClick={() => onConnect(service)}
              className="px-2 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-purple-300 hover:text-purple-200 border border-purple-800/80 hover:border-purple-500 flex items-center justify-center gap-1 text-[10px] font-bold shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
              title="View drop-in SDK code and Two-Way Sync beacon"
            >
              <Radio className="w-2.5 h-2.5 text-purple-400 shrink-0" />
              <span>SDK</span>
            </button>
          )}

          {/* Instant Probe Test Button (Uptime Kuma style - supports HTTP and TCP Port) */}
          {(service.type === "http-poll" || service.type === "port-check") && (
            <button
              onClick={handleSingleProbe}
              disabled={isTriggering}
              className="px-2 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-1 text-[10px] font-bold"
              title="Test probe immediately"
            >
              <Play className={`w-2.5 h-2.5 shrink-0 ${isTriggering ? "animate-spin text-emerald-400" : "text-emerald-400"}`} />
              <span>TEST</span>
            </button>
          )}

          {/* Maintenance Mode Toggle Button */}
          <button
            onClick={handleToggleMaintenance}
            disabled={isTogglingMaint}
            className={`px-2 py-1.5 border flex items-center justify-center gap-1 text-[10px] font-bold shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition ${
              isMaintenance
                ? "bg-sky-950 border-sky-400 text-sky-300"
                : "bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border-zinc-700"
            }`}
            title="Toggle scheduled maintenance mode"
          >
            <Wrench className="w-2.5 h-2.5 shrink-0" />
            <span>{isMaintenance ? "MAINT: ON" : "MAINT"}</span>
          </button>

          {/* Copy Key */}
          <button
            onClick={handleCopy}
            className="px-2 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 flex items-center justify-center gap-1 text-[10px] font-bold shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
            title="Copy API key"
          >
            {copiedKey ? <Check className="w-3 h-3 text-emerald-400 shrink-0" /> : <Copy className="w-3 h-3 shrink-0" />}
            <span>{copiedKey ? "COPIED" : "KEY"}</span>
          </button>

          {/* Edit Target */}
          {onEdit && (
            <button
              onClick={() => onEdit(service)}
              className="px-2 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 flex items-center justify-center gap-1 text-[10px] font-bold shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
              title="Edit target configuration"
            >
              <Pencil className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
              <span>EDIT</span>
            </button>
          )}

          {/* Delete */}
          <button
            onClick={handleDelete}
            className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-950 border border-transparent hover:border-rose-600 transition flex items-center justify-center"
            title="Delete monitored target"
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}
