import React, { useState, useEffect } from "react";
import { 
  X, 
  Copy, 
  Check, 
  Terminal, 
  Database, 
  Cpu, 
  Radio, 
  ArrowRight, 
  ShieldCheck, 
  Zap,
  Activity,
  Layers,
  FileCode,
  CheckCircle2,
  RefreshCw
} from "lucide-react";
import { useToast } from "../lib/ToastContext";

interface ConnectProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  initialService?: { id: string; name: string; api_key: string; endpoint?: string } | null;
}

export default function ConnectProjectModal({ isOpen, onClose, onCreated, initialService }: ConnectProjectModalProps) {
  const toast = useToast();
  const [step, setStep] = useState<"configure" | "snippet">("configure");
  const [platform, setPlatform] = useState<"nodejs" | "python" | "nextjs" | "supabase">("nodejs");
  
  // Project Info
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [groupName, setGroupName] = useState("Production");
  const [supabaseMode, setSupabaseMode] = useState<"rest" | "tcp">("rest");
  const [supabaseProjectRef, setSupabaseProjectRef] = useState("");
  const [supabaseAnonKey, setSupabaseAnonKey] = useState("");
  const [supabasePoolerHost, setSupabasePoolerHost] = useState("");
  const [supabasePort, setSupabasePort] = useState("6543");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedService, setGeneratedService] = useState<{ id: string; name: string; api_key: string; endpoint: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [handshakeStatus, setHandshakeStatus] = useState<"waiting" | "connected">("waiting");
  const [liveMeta, setLiveMeta] = useState<any>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Reset / initialize states on open/close
  useEffect(() => {
    if (isOpen) {
      if (initialService) {
        setGeneratedService({
          id: initialService.id,
          name: initialService.name,
          api_key: initialService.api_key,
          endpoint: initialService.endpoint || "",
        });
        setStep("snippet");
      } else {
        setStep("configure");
        setGeneratedService(null);
      }
      setHandshakeStatus("waiting");
      setLiveMeta(null);
    }
  }, [isOpen, initialService]);

  // Polling beacon for live handshake confirmation
  useEffect(() => {
    if (step !== "snippet" || !generatedService || handshakeStatus === "connected") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/v1/services");
        if (res.ok) {
          const data = await res.json();
          const target = data.services?.find((s: any) => s.id === generatedService.id);
          if (target && (target.last_ping_at || target.runtime_meta)) {
            setHandshakeStatus("connected");
            if (target.runtime_meta) {
              try {
                setLiveMeta(JSON.parse(target.runtime_meta));
              } catch {}
            }
            toast.success(`Handshake established with ${target.name}! Two-way sync live.`);
          }
        }
      } catch {}
    }, 2500);

    return () => clearInterval(interval);
  }, [step, generatedService, handshakeStatus]);

  if (!isOpen) return null;

  const originUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3030";

  const handleCreateAndGetSnippet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.warning("Please enter a project name");
      return;
    }

    setIsSubmitting(true);
    try {
      let finalEndpoint = endpoint.trim();
      let targetType = "http-poll";
      let targetPort = undefined;

      if (platform === "supabase") {
        if (supabaseMode === "rest") {
          const ref = supabaseProjectRef.trim().replace(/^https?:\/\//, "").replace(/\.supabase\.co.*$/, "");
          finalEndpoint = `https://${ref}.supabase.co/rest/v1/`;
          targetType = "http-poll";
        } else {
          finalEndpoint = `tcp://${supabasePoolerHost.trim()}:${supabasePort.trim()}`;
          targetType = "port-check";
          targetPort = Number(supabasePort.trim()) || 6543;
        }
      }

      const res = await fetch("/api/v1/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type: targetType,
          endpoint: finalEndpoint || null,
          port: targetPort,
          group_name: groupName.trim() || "Production",
          poll_interval_sec: 60,
          retry_count: 2,
          is_public: 1,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to register target");
      }

      const data = await res.json();
      setGeneratedService(data.service);
      setStep("snippet");
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Failed to create target");
    } finally {
      setIsSubmitting(false);
    }
  };

  const apiKey = generatedService?.api_key || "kh_live_key_sample_8f92a";

  const nodeSnippet = `// 1. Install or place this file as: heimdall-sentinel.mjs
// Native fetch requires zero extra dependencies (Node 18+)

const HEIMDALL_URL = "${originUrl}";
const HEIMDALL_KEY = "${apiKey}";

async function notifyHeimdall(event, details = {}) {
  try {
    await fetch(\`\${HEIMDALL_URL}/api/v1/ping/\${HEIMDALL_KEY}\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event, // "online" | "heartbeat" | "offline"
        uptime: Math.round(process.uptime()),
        memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        ...details,
      }),
    });
  } catch (err) {
    // Fail-safe: monitoring calls will never crash your application
  }
}

export function initHeimdall() {
  // 1. Handshake ONLINE event immediately on boot
  notifyHeimdall("online");

  // 2. Continuous 60s background heartbeat sync
  const timer = setInterval(() => notifyHeimdall("heartbeat"), 60000);
  if (timer.unref) timer.unref();

  // 3. Graceful OFFLINE shutdown notification (Maintenance mode)
  const shutdown = async (signal) => {
    await notifyHeimdall("offline", { reason: \`Graceful shutdown (\${signal})\` });
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

// In your server.js / index.js:
// import { initHeimdall } from "./heimdall-sentinel.mjs";
// app.listen(3000, () => { initHeimdall(); });`;

  const pythonSnippet = `# 1. Place this file as: heimdall_sentinel.py
# Uses httpx or urllib - zero heavy dependencies

import asyncio
import time
import psutil
import os
import httpx

HEIMDALL_URL = "${originUrl}"
HEIMDALL_KEY = "${apiKey}"
START_TIME = time.time()

async def notify_heimdall(event: str, reason: str = None):
    try:
        mem_mb = round(psutil.Process(os.getpid()).memory_info().rss / 1024 / 1024)
    except Exception:
        mem_mb = 0

    payload = {
        "event": event, # "online" | "heartbeat" | "offline"
        "uptime": int(time.time() - START_TIME),
        "memoryMB": mem_mb,
    }
    if reason:
        payload["reason"] = reason

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            await client.post(f"{HEIMDALL_URL}/api/v1/ping/{HEIMDALL_KEY}", json=payload)
    except Exception:
        pass

async def heartbeat_loop():
    while True:
        await asyncio.sleep(60)
        await notify_heimdall("heartbeat")

# FastAPI Lifespan context manager:
# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     await notify_heimdall("online")
#     task = asyncio.create_task(heartbeat_loop())
#     yield
#     task.cancel()
#     await notify_heimdall("offline", reason="FastAPI application shutdown")`;

  const nextjsSnippet = `// app/api/health/route.ts (Next.js App Router)
import { NextResponse } from "next/server";

const HEIMDALL_URL = "${originUrl}";
const HEIMDALL_KEY = "${apiKey}";

export async function GET() {
  // Fire background heartbeat ping to Heimdall
  fetch(\`\${HEIMDALL_URL}/api/v1/ping/\${HEIMDALL_KEY}\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "heartbeat",
      uptime: Math.round(process.uptime ? process.uptime() : 0),
    })
  }).catch(() => {});

  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString()
  });
}`;

  const supabaseSnippet = `// Supabase Database Connection & Monitoring Configuration
// Target Type: ${supabaseMode === "rest" ? "HTTP-Poll (REST API)" : "TCP Port Check (Connection Pooler)"}

${supabaseMode === "rest" ? `// Endpoint Monitored by Heimdall:
// URL: https://${supabaseProjectRef.trim() || "<project-ref>"}.supabase.co/rest/v1/
// Method: GET
// Headers:
//   apikey: ${supabaseAnonKey.trim() || "<SUPABASE_ANON_KEY>"}
// Expected Status: 200

// In your application, verify PostgREST or deep query:
app.get("/health/db", async (req, res) => {
  const start = performance.now();
  const { data, error } = await supabase.from("_health").select("count").limit(1);
  const latency = Math.round(performance.now() - start);
  
  if (error) {
    return res.status(503).json({ status: "database_error", error: error.message });
  }
  return res.json({ status: "healthy", db_latency_ms: latency });
});` : `// Native TCP Socket Probe Configured:
// Host: ${supabasePoolerHost.trim() || "aws-0-ap-south-1.pooler.supabase.com"}
// Port: ${supabasePort.trim() || "6543"}
// Protocol: Raw TCP Socket Handshake

// Heimdall verifies that the Supabase transaction pooler socket opens
// in under 4000ms. If the connection pool exhausts or AWS route drops,
// Heimdall immediately triggers the Mobile Sentinel siren.`}`;

  const activeSnippet = 
    platform === "nodejs" ? nodeSnippet :
    platform === "python" ? pythonSnippet :
    platform === "nextjs" ? nextjsSnippet : supabaseSnippet;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(activeSnippet);
    setCopiedCode(true);
    toast.success("Copied drop-in snippet to clipboard!");
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    toast.success("Copied API key!");
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 font-mono text-xs overflow-y-auto backdrop-blur-sm">
      <div className="bg-[#0b0f17] border-2 border-cyan-500 shadow-[6px_6px_0px_#06b6d4] w-full max-w-2xl my-auto p-4 sm:p-6 text-zinc-100 space-y-5 animate-in fade-in duration-150 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-zinc-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 bg-cyan-950 border border-cyan-400 flex items-center justify-center text-cyan-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black uppercase tracking-tight text-white flex items-center gap-2">
                Two-Way Sentinel Sync &amp; SDK (Optional)
              </h2>
              <span className="text-[10px] text-zinc-400 block -mt-0.5">
                Drop-in lifecycle sync: Startup, Heartbeats &amp; Graceful Shutdowns (Optional for monitored targets)
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-transparent hover:border-zinc-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Global Optional SDK Reminder Banner */}
        <div className="p-2.5 bg-zinc-950 border border-zinc-800 flex items-start gap-2.5 text-[11px] text-zinc-300">
          <Radio className="w-4 h-4 text-purple-400 shrink-0 mt-0.5 animate-pulse" />
          <div>
            <span className="font-bold text-zinc-200 uppercase text-[10px]">Zero Code Required For Synthetic Health: </span>
            <span className="text-zinc-400 text-[10px] leading-relaxed">
              Heimdall monitors your endpoints automatically via outbound synthetic probes. Integrating this SDK into your application is 100% optional — use it if you want your backend server to report startup, send periodic heartbeats, or notify Heimdall during graceful restarts.
            </span>
          </div>
        </div>

        {step === "configure" ? (
          <form onSubmit={handleCreateAndGetSnippet} className="space-y-4">
            {/* Step 1: Platform Presets */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
                [01] SELECT PLATFORM / DATABASE ARCHITECTURE
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "nodejs", label: "Node.js / Express", icon: Terminal },
                  { id: "python", label: "Python / FastAPI", icon: Cpu },
                  { id: "nextjs", label: "Next.js / Fullstack", icon: Layers },
                  { id: "supabase", label: "Supabase / Postgres", icon: Database },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = platform === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPlatform(item.id as any)}
                      className={`p-2.5 border-2 flex flex-col items-center justify-center gap-1.5 text-center transition ${
                        isSelected
                          ? "bg-cyan-950 border-cyan-400 text-cyan-300 shadow-[2px_2px_0px_#06b6d4]"
                          : "bg-black border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Target Project Details */}
            <div className="space-y-3 pt-2 border-t border-zinc-800">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
                [02] CONFIGURE TARGET INFORMATION
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">PROJECT NAME *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Campus Relay API Gateway"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-black border-2 border-zinc-700 p-2 text-xs text-white focus:border-cyan-400 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">PROJECT GROUP / TAG</label>
                  <input
                    type="text"
                    placeholder="Production, Campus Relay, KrishiSetu..."
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="w-full bg-black border-2 border-zinc-700 p-2 text-xs text-white focus:border-cyan-400 outline-none"
                  />
                </div>
              </div>

              {platform !== "supabase" ? (
                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">
                    PROJECT HOST URL (HEIMDALL PROBES THIS OUTBOUND)
                  </label>
                  <input
                    type="text"
                    placeholder="https://campusrelay.internal or http://localhost:4000"
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    className="w-full bg-black border-2 border-zinc-700 p-2 text-xs text-white focus:border-cyan-400 outline-none"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Heimdall will proactively probe this URL every 60s while listening for inbound startup/heartbeat/shutdown events.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 p-3 bg-black border border-zinc-800">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSupabaseMode("rest")}
                      className={`px-3 py-1 text-[10px] font-bold uppercase border ${
                        supabaseMode === "rest"
                          ? "bg-emerald-950 border-emerald-400 text-emerald-300"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400"
                      }`}
                    >
                      Mode 1: HTTPS REST API Probe
                    </button>
                    <button
                      type="button"
                      onClick={() => setSupabaseMode("tcp")}
                      className={`px-3 py-1 text-[10px] font-bold uppercase border ${
                        supabaseMode === "tcp"
                          ? "bg-cyan-950 border-cyan-400 text-cyan-300"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400"
                      }`}
                    >
                      Mode 2: TCP Pooler Socket (Port 6543)
                    </button>
                  </div>

                  {supabaseMode === "rest" ? (
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-0.5">SUPABASE PROJECT REF</label>
                        <input
                          type="text"
                          placeholder="e.g. xyzabcdefghijklmnopqrst"
                          value={supabaseProjectRef}
                          onChange={(e) => setSupabaseProjectRef(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-700 p-1.5 text-xs text-white focus:border-cyan-400 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-0.5">ANON PUBLIC API KEY</label>
                        <input
                          type="password"
                          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                          value={supabaseAnonKey}
                          onChange={(e) => setSupabaseAnonKey(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-700 p-1.5 text-xs text-white focus:border-cyan-400 outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label className="text-[10px] text-zinc-400 block mb-0.5">POOLER HOST</label>
                        <input
                          type="text"
                          placeholder="aws-0-ap-south-1.pooler.supabase.com"
                          value={supabasePoolerHost}
                          onChange={(e) => setSupabasePoolerHost(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-700 p-1.5 text-xs text-white focus:border-cyan-400 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-400 block mb-0.5">PORT</label>
                        <input
                          type="text"
                          value={supabasePort}
                          onChange={(e) => setSupabasePort(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-700 p-1.5 text-xs text-white focus:border-cyan-400 outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-bold uppercase transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-cyan-400 hover:bg-cyan-300 text-black border-2 border-cyan-300 text-xs font-black uppercase flex items-center gap-1.5 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{isSubmitting ? "GENERATING..." : "[ GENERATE KEY & GET SDK ]"}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            {/* Confirmation Banner */}
            <div className="p-3 bg-emerald-950/60 border border-emerald-500 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <span className="font-bold text-white uppercase text-xs">
                    Target Registered: [{generatedService?.name}]
                  </span>
                  <span className="text-[10px] text-zinc-400 block font-mono">
                    API Key: <code className="text-emerald-300 font-bold">{apiKey}</code>
                  </span>
                </div>
              </div>

              <button
                onClick={handleCopyKey}
                className="px-3 py-1 bg-black border border-emerald-500 text-emerald-300 hover:text-white text-[10px] font-bold uppercase flex items-center gap-1 self-start sm:self-auto"
              >
                {copiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey ? "COPIED" : "COPY KEY"}</span>
              </button>
            </div>

            {/* Live Handshake Radar Beacon */}
            <div className={`p-3.5 border flex items-center justify-between transition-all ${
              handshakeStatus === "connected"
                ? "bg-[#0b1712] border-emerald-500 text-emerald-300"
                : "bg-black border-zinc-700 text-zinc-400"
            }`}>
              <div className="flex items-center space-x-3">
                <div className="relative flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    handshakeStatus === "connected" ? "bg-emerald-400" : "bg-cyan-400"
                  }`} />
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${
                    handshakeStatus === "connected" ? "bg-emerald-500" : "bg-cyan-500"
                  }`} />
                </div>
                <div>
                  <span className="font-bold uppercase text-xs">
                    {handshakeStatus === "connected" 
                      ? "🟢 TWO-WAY HANDSHAKE CONFIRMED // LIVE SYNC ACTIVE" 
                      : "⏳ WAITING FOR FIRST INBOUND HANDSHAKE..."}
                  </span>
                  <span className="text-[10px] text-zinc-500 block font-sans">
                    {handshakeStatus === "connected"
                      ? `Target reports live: Uptime ~${liveMeta?.uptime || 0}s | Memory: ${liveMeta?.memoryMB || 0}MB`
                      : "Drop the snippet into your project and start your app to establish two-way sync."}
                  </span>
                </div>
              </div>

              {handshakeStatus === "connected" && (
                <span className="px-2 py-0.5 bg-emerald-950 border border-emerald-400 text-emerald-300 font-bold text-[10px]">
                  NOMINAL
                </span>
              )}
            </div>

            {/* Snippet Code Container */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span className="font-bold uppercase">
                  DROP-IN CODE FOR {platform.toUpperCase()} (ZERO EXTRA PACKAGES)
                </span>
                <button
                  onClick={handleCopyCode}
                  className="px-3 py-1 bg-zinc-900 border border-zinc-700 hover:border-cyan-400 text-cyan-300 text-xs font-bold uppercase flex items-center gap-1.5 transition"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? "COPIED SNIPPET" : "COPY CODE"}</span>
                </button>
              </div>

              <div className="relative">
                <pre className="p-3 bg-black border border-zinc-800 text-[11px] text-zinc-300 font-mono overflow-x-auto max-h-64 leading-relaxed scrollbar-thin">
                  <code>{activeSnippet}</code>
                </pre>
              </div>
            </div>

            {/* Footer Finish */}
            <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep("configure")}
                className="text-xs text-zinc-400 hover:text-white transition font-bold"
              >
                &larr; Configure Another Target
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-black border-2 border-emerald-400 text-xs font-black uppercase shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
              >
                [ DONE // CLOSE ]
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
