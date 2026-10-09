import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, ReferenceLine
} from "recharts";
import { 
  BarChart3, 
  Zap, 
  AlertTriangle, 
  RefreshCw, 
  Info,
  Layers,
  Server,
  Activity,
  CheckCircle2,
  Filter
} from "lucide-react";
import { useToast } from "../lib/ToastContext";

interface MonitorBreakdown {
  id: string;
  name: string;
  type: string;
  endpoint?: string;
  status: "healthy" | "warning" | "critical" | "maintenance";
  is_maintenance?: number;
  uptime24h: number;
  uptime7d: number;
  uptime30d: number;
  currentLatency: number;
  avgLatency: number;
  checksCount24h: number;
}

interface AnalyticsData {
  selectedServiceId: string | null;
  allServices: { id: string; name: string; type: string }[];
  monitorsBreakdown: MonitorBreakdown[];
  latencyTrend: { hour: string; latency: number; errors: number }[];
  percentiles: { p50: number; p95: number; p99: number };
  mttrMinutes: number;
  totalChecks24h: number;
}

export default function AnalyticsPage() {
  const toast = useToast();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAnalytics = async (serviceId?: string | null) => {
    try {
      const url = serviceId 
        ? `/api/v1/analytics?service_id=${encodeURIComponent(serviceId)}` 
        : "/api/v1/analytics";
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(selectedServiceId);
  }, [selectedServiceId]);

  const handleRecalculate = () => {
    setIsLoading(true);
    fetchAnalytics(selectedServiceId).then(() => toast.info("Performance percentiles and curves recalculated"));
  };

  const handleSelectMonitor = (id: string | null) => {
    setIsLoading(true);
    setSelectedServiceId(id);
    const monitorName = id ? data?.allServices.find(s => s.id === id)?.name : "All Monitors";
    toast.info(`Filtered telemetry curve to: ${monitorName}`);
  };

  const activeMonitorName = selectedServiceId
    ? data?.allServices.find((s) => s.id === selectedServiceId)?.name || "Selected Target"
    : "Aggregated Fleet Monitors";

  return (
    <div className="min-h-screen bg-[#070a0f] text-zinc-100 flex flex-col font-mono relative overflow-hidden pb-24">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b-2 border-zinc-800">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs text-sky-400 font-bold">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>// CRYSTAL HEIMDALL // PERFORMANCE TELEMETRY //</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
              Fleet Analytics & Latency Profiles
            </h1>
            <p className="text-xs text-zinc-400 font-sans">
              Uptime Kuma multi-point availability matrices, 24h response curves, and percentile tails.
            </p>
          </div>

          <button
            onClick={handleRecalculate}
            disabled={isLoading}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-700 text-zinc-200 hover:text-white text-xs font-bold uppercase flex items-center gap-2 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-sky-400" : ""}`} />
            <span>[ RECALCULATE METRICS ]</span>
          </button>
        </div>

        {/* UPTIME KUMA MONITOR SELECTOR BAR */}
        <div className="bg-[#0b0f17] border-2 border-zinc-700 p-4 shadow-[3px_3px_0px_#000] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-bold text-zinc-300">
              <Filter className="w-3.5 h-3.5 text-cyan-400" />
              <span>// SELECT MONITOR TARGET FOR FOCUSED TELEMETRY //</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-bold uppercase">
              ACTIVE SCOPE: {activeMonitorName}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => handleSelectMonitor(null)}
              className={`px-3 py-1.5 text-xs font-bold border-2 transition ${
                selectedServiceId === null
                  ? "bg-zinc-800 text-cyan-300 border-cyan-400 shadow-[2px_2px_0px_#000]"
                  : "bg-black text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white"
              }`}
            >
              [ ALL MONITORS (FLEET) ]
            </button>

            {data?.allServices.map((srv) => (
              <button
                key={srv.id}
                onClick={() => handleSelectMonitor(srv.id)}
                className={`px-3 py-1.5 text-xs font-bold border-2 transition flex items-center gap-1.5 ${
                  selectedServiceId === srv.id
                    ? "bg-zinc-800 text-emerald-300 border-emerald-400 shadow-[2px_2px_0px_#000]"
                    : "bg-black text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white"
                }`}
              >
                <Server className="w-3 h-3 text-zinc-500" />
                <span>{srv.name}</span>
                <span className="text-[9px] text-zinc-500 uppercase">({srv.type})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Industrial Metrics Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-[#0b0f17] border-2 border-zinc-700 p-5 shadow-[3px_3px_0px_#000] space-y-2">
            <span className="text-[10px] text-zinc-400 font-bold uppercase block">// P50 MEDIAN //</span>
            <div className="text-3xl sm:text-4xl font-black text-white">
              {data?.percentiles.p50 || 0}<span className="text-xs text-zinc-500 font-normal ml-1">ms</span>
            </div>
            <span className="text-[9px] text-zinc-500 uppercase block">Median response time</span>
          </div>

          <div className="bg-[#0b0f17] border-2 border-zinc-700 p-5 shadow-[3px_3px_0px_#000] space-y-2">
            <span className="text-[10px] text-amber-400 font-bold uppercase block">// P95 TAIL SLA //</span>
            <div className="text-3xl sm:text-4xl font-black text-amber-300">
              {data?.percentiles.p95 || 0}<span className="text-xs text-zinc-500 font-normal ml-1">ms</span>
            </div>
            <span className="text-[9px] text-zinc-500 uppercase block">95th percentile envelope</span>
          </div>

          <div className="bg-[#0b0f17] border-2 border-zinc-700 p-5 shadow-[3px_3px_0px_#000] space-y-2">
            <span className="text-[10px] text-rose-400 font-bold uppercase block">// P99 PEAK SPIKE //</span>
            <div className="text-3xl sm:text-4xl font-black text-rose-400">
              {data?.percentiles.p99 || 0}<span className="text-xs text-zinc-500 font-normal ml-1">ms</span>
            </div>
            <span className="text-[9px] text-zinc-500 uppercase block">Worst-case edge spike</span>
          </div>

          <div className="bg-[#0b0f17] border-2 border-zinc-700 p-5 shadow-[3px_3px_0px_#000] space-y-2">
            <span className="text-[10px] text-emerald-400 font-bold uppercase block">// MTTR AVERAGE //</span>
            <div className="text-3xl sm:text-4xl font-black text-emerald-300">
              {data?.mttrMinutes || 12}<span className="text-xs text-zinc-500 font-normal ml-1">min</span>
            </div>
            <span className="text-[9px] text-zinc-500 uppercase block">Mean Time To Resolution</span>
          </div>

          <div className="bg-[#0b0f17] border-2 border-zinc-700 p-5 shadow-[3px_3px_0px_#000] space-y-2 col-span-2 sm:col-span-1">
            <span className="text-[10px] text-sky-400 font-bold uppercase block">// 24H PROBES //</span>
            <div className="text-3xl sm:text-4xl font-black text-sky-300">
              {data?.totalChecks24h || 0}
            </div>
            <span className="text-[9px] text-zinc-500 uppercase block">Synthetic heartbeat tests</span>
          </div>
        </div>

        {/* UPTIME KUMA PER-MONITOR SLA BREAKDOWN TABLE */}
        <div className="bg-[#0b0f17] border-2 border-zinc-700 shadow-[4px_4px_0px_#000] p-6 sm:p-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-zinc-800 pb-3">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-zinc-900 border border-emerald-500 flex items-center justify-center text-emerald-400">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-tight">
                  Uptime Kuma Multi-Period Availability Matrix
                </h2>
                <p className="text-[11px] text-zinc-400 font-sans">
                  24-Hour, 7-Day, and 30-Day SLA calculations with real-time ping response tracking
                </p>
              </div>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 bg-emerald-950 border border-emerald-500 text-emerald-400 font-bold uppercase">
              UPTIME KUMA SPEC
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b-2 border-zinc-800 text-[10px] text-zinc-500 uppercase bg-black">
                  <th className="p-3">MONITOR TARGET</th>
                  <th className="p-3">STATUS</th>
                  <th className="p-3">24H UPTIME</th>
                  <th className="p-3">7D UPTIME</th>
                  <th className="p-3">30D SLA</th>
                  <th className="p-3">CURRENT PING</th>
                  <th className="p-3">AVG LATENCY</th>
                  <th className="p-3">CHECKS (24H)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {data?.monitorsBreakdown && data.monitorsBreakdown.length > 0 ? (
                  data.monitorsBreakdown.map((m) => {
                    const isMaint = m.status === "maintenance" || m.is_maintenance === 1;
                    const isHealthy = m.status === "healthy";
                    return (
                      <tr key={m.id} className="hover:bg-zinc-900/40 transition">
                        <td className="p-3">
                          <div className="font-bold text-white flex items-center gap-2">
                            <span>{m.name}</span>
                            <span className="px-1.5 py-0.2 text-[9px] bg-zinc-900 border border-zinc-700 text-zinc-400">
                              {m.type}
                            </span>
                          </div>
                          {m.endpoint && (
                            <span className="text-[10px] text-zinc-500 truncate block max-w-xs">{m.endpoint}</span>
                          )}
                        </td>
                        <td className="p-3">
                          {isMaint ? (
                            <span className="px-2 py-0.5 text-[9px] bg-cyan-950 border border-cyan-500 text-cyan-300 font-bold">
                              [MAINT]
                            </span>
                          ) : isHealthy ? (
                            <span className="px-2 py-0.5 text-[9px] bg-emerald-950 border border-emerald-500 text-emerald-400 font-bold">
                              [ONLINE]
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[9px] bg-rose-950 border border-rose-500 text-rose-300 font-bold">
                              [{m.status.toUpperCase()}]
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className={`font-bold ${m.uptime24h >= 99 ? "text-emerald-400" : "text-amber-400"}`}>
                            {m.uptime24h.toFixed(2)}%
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="text-zinc-300">{m.uptime7d.toFixed(2)}%</span>
                        </td>
                        <td className="p-3">
                          <span className="text-zinc-300">{m.uptime30d.toFixed(2)}%</span>
                        </td>
                        <td className="p-3">
                          <span className={`font-bold ${m.currentLatency < 100 ? "text-emerald-400" : m.currentLatency < 300 ? "text-amber-400" : "text-rose-400"}`}>
                            {m.currentLatency}ms
                          </span>
                        </td>
                        <td className="p-3 text-zinc-400">{m.avgLatency}ms</td>
                        <td className="p-3 text-zinc-500">{m.checksCount24h}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-zinc-500">
                      No monitors configured. Add targets from Dashboard.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Latency Trend Area Chart */}
        <div className="bg-[#0b0f17] border-2 border-zinc-700 p-6 sm:p-8 shadow-[4px_4px_0px_#000] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-zinc-800 pb-3">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-zinc-900 border border-emerald-500 flex items-center justify-center text-emerald-400">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-tight">
                  24-Hour Synthetic Latency Profile — {activeMonitorName}
                </h2>
                <p className="text-[11px] text-zinc-400 font-sans">
                  Hourly response distribution in milliseconds
                </p>
              </div>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 bg-emerald-950 border border-emerald-500 text-emerald-400 font-bold uppercase">
              SLA THRESHOLD: &lt;200ms
            </span>
          </div>

          <div className="h-80 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.latencyTrend || []} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="hour" stroke="#71717a" fontSize={11} tickLine={false} />
                <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
                <ReferenceLine y={200} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "200ms SLA", fill: "#f59e0b", fontSize: 10, position: "top" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#000000",
                    borderColor: "#52525b",
                    borderRadius: "0px",
                    color: "#fff",
                    fontSize: "12px",
                    fontFamily: "monospace",
                    boxShadow: "3px 3px 0px #000",
                  }}
                  itemStyle={{ color: "#34d399", fontWeight: "bold" }}
                  formatter={(value: any) => [`${value} ms`, "Average Latency"]}
                />
                <Area
                  type="monotone"
                  dataKey="latency"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#latencyGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Error Anomaly Histogram */}
        <div className="bg-[#0b0f17] border-2 border-zinc-700 p-6 sm:p-8 shadow-[4px_4px_0px_#000] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-zinc-800 pb-3">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-zinc-900 border border-rose-500 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-tight">
                  Hourly Error & Non-2xx Anomaly Histogram — {activeMonitorName}
                </h2>
                <p className="text-[11px] text-zinc-400 font-sans">
                  Network timeouts, 5xx server exceptions, and dropped connections
                </p>
              </div>
            </div>
            <span className="text-xs font-mono text-zinc-500 uppercase">[PAST 24H WINDOW]</span>
          </div>

          <div className="h-60 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.latencyTrend || []} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="hour" stroke="#71717a" fontSize={11} tickLine={false} />
                <YAxis stroke="#71717a" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#000000",
                    borderColor: "#52525b",
                    borderRadius: "0px",
                    color: "#fff",
                    fontSize: "12px",
                    fontFamily: "monospace",
                    boxShadow: "3px 3px 0px #000",
                  }}
                  itemStyle={{ color: "#fb7185", fontWeight: "bold" }}
                  formatter={(value: any) => [`${value} errors`, "Anomalies"]}
                />
                <Bar dataKey="errors" fill="#f43f5e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Telemetry Guide */}
        <div className="bg-[#0b0f17] border-2 border-sky-600/40 p-6 space-y-2">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 text-sky-400 shrink-0" />
            <h3 className="text-xs font-bold text-white uppercase font-mono">
              // TELEMETRY METHODOLOGY & UPTIME KUMA HARMONIZATION //
            </h3>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed font-sans">
            Crystal Heimdall calculates multi-window uptime (24H, 7D, 30D) using discrete round-trip probes and heartbeat timeouts. Select individual monitors above to isolate microservice latency spikes and diagnose edge network jitter.
          </p>
        </div>
      </main>
    </div>
  );
}
