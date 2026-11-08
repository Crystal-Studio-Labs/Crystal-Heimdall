import React, { useMemo } from "react";
import { Activity, Clock } from "lucide-react";

interface TelemetryPoint {
  timestamp: number;
  latency_ms: number;
  status_code?: number;
}

interface LatencyHeatmapProps {
  telemetry: TelemetryPoint[];
  serviceName?: string;
}

export const LatencyHeatmap: React.FC<LatencyHeatmapProps> = ({
  telemetry = [],
  serviceName = "Target",
}) => {
  // Compute P50, P90, P95, P99
  const stats = useMemo(() => {
    const latencies = telemetry
      .map((t) => Number(t.latency_ms))
      .filter((l) => !isNaN(l) && l > 0)
      .sort((a, b) => a - b);

    if (latencies.length === 0) {
      return { p50: 0, p90: 0, p95: 0, p99: 0, avg: 0, count: 0 };
    }

    const getP = (p: number) => {
      const idx = Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length));
      return latencies[idx];
    };

    const sum = latencies.reduce((acc, v) => acc + v, 0);
    return {
      p50: getP(50),
      p90: getP(90),
      p95: getP(95),
      p99: getP(99),
      avg: Math.round(sum / latencies.length),
      count: latencies.length,
    };
  }, [telemetry]);

  // Compute 24-hour hourly blocks
  const hourlyBuckets = useMemo(() => {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const buckets: Array<{
      hourIndex: number;
      label: string;
      avgLatency: number;
      p95Latency: number;
      count: number;
      colorClass: string;
    }> = [];

    for (let i = 23; i >= 0; i--) {
      const start = now - (i + 1) * oneHour;
      const end = now - i * oneHour;
      const points = telemetry.filter((t) => t.timestamp >= start && t.timestamp < end);

      const hourDate = new Date(start);
      const label = hourDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      if (points.length === 0) {
        buckets.push({
          hourIndex: 23 - i,
          label,
          avgLatency: 0,
          p95Latency: 0,
          count: 0,
          colorClass: "bg-zinc-900 border-zinc-800 text-zinc-600",
        });
      } else {
        const sorted = points.map((p) => p.latency_ms).sort((a, b) => a - b);
        const avg = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);
        const p95 = sorted[Math.min(sorted.length - 1, Math.floor(0.95 * sorted.length))];

        let colorClass = "bg-emerald-950/70 border-emerald-500/80 text-emerald-400";
        if (p95 > 600) {
          colorClass = "bg-red-950/80 border-red-500 text-red-300";
        } else if (p95 > 350) {
          colorClass = "bg-amber-950/80 border-amber-500 text-amber-300";
        } else if (p95 > 150) {
          colorClass = "bg-emerald-900/50 border-emerald-400 text-emerald-300";
        }

        buckets.push({
          hourIndex: 23 - i,
          label,
          avgLatency: avg,
          p95Latency: p95,
          count: points.length,
          colorClass,
        });
      }
    }

    return buckets;
  }, [telemetry]);

  return (
    <div className="brutal-card p-4 border border-zinc-800 bg-[#070a0f] my-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-mono font-bold tracking-widest text-zinc-200 uppercase">
            [ LATENCY PERCENTILES & 24H HOURLY HEATMAP ]
          </h3>
        </div>
        <span className="text-[10px] font-mono text-zinc-500">
          PROBES RECORDED: {stats.count} SAMPLES
        </span>
      </div>

      {/* 4-Metric Percentile Deck */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <div className="border border-zinc-800 bg-zinc-950/60 p-2.5">
          <div className="text-[10px] font-mono text-zinc-500 uppercase">P50 (Median)</div>
          <div className="text-base font-mono font-bold text-emerald-400 mt-0.5">
            {stats.p50} <span className="text-xs text-zinc-500 font-normal">ms</span>
          </div>
        </div>

        <div className="border border-zinc-800 bg-zinc-950/60 p-2.5">
          <div className="text-[10px] font-mono text-zinc-500 uppercase">P90 Percentile</div>
          <div className="text-base font-mono font-bold text-cyan-400 mt-0.5">
            {stats.p90} <span className="text-xs text-zinc-500 font-normal">ms</span>
          </div>
        </div>

        <div className="border border-zinc-800 bg-zinc-950/60 p-2.5">
          <div className="text-[10px] font-mono text-zinc-500 uppercase">P95 Percentile</div>
          <div className="text-base font-mono font-bold text-amber-400 mt-0.5">
            {stats.p95} <span className="text-xs text-zinc-500 font-normal">ms</span>
          </div>
        </div>

        <div className="border border-zinc-800 bg-zinc-950/60 p-2.5">
          <div className="text-[10px] font-mono text-zinc-500 uppercase">P99 Percentile</div>
          <div className="text-base font-mono font-bold text-red-400 mt-0.5">
            {stats.p99} <span className="text-xs text-zinc-500 font-normal">ms</span>
          </div>
        </div>
      </div>

      {/* 24-Hour Hourly Heatmap Grid */}
      <div className="mt-2">
        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 mb-1.5">
          <span>-24 HOURS</span>
          <span>NOW</span>
        </div>

        <div className="grid grid-cols-12 sm:grid-cols-24 gap-1">
          {hourlyBuckets.map((bucket, i) => (
            <div
              key={i}
              title={`${bucket.label}: ${
                bucket.count > 0 ? `${bucket.avgLatency}ms (P95: ${bucket.p95Latency}ms, ${bucket.count} checks)` : "No probes"
              }`}
              className={`h-7 border flex items-center justify-center text-[9px] font-mono transition-transform hover:scale-110 cursor-pointer ${bucket.colorClass}`}
            >
              {bucket.count > 0 ? (
                <span className="scale-75 sm:scale-90 font-bold">
                  {bucket.avgLatency > 999 ? `${Math.round(bucket.avgLatency / 1000)}s` : bucket.avgLatency}
                </span>
              ) : (
                <span className="opacity-30">·</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Heatmap Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2.5 border-t border-zinc-900 text-[10px] font-mono text-zinc-500">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-zinc-600" />
          <span>HOURLY P95 LATENCY MATRIX</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 bg-emerald-500 border border-emerald-400 inline-block" />
            <span>&lt;150ms</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 bg-emerald-800 border border-emerald-600 inline-block" />
            <span>150-350ms</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 bg-amber-500 border border-amber-400 inline-block" />
            <span>350-600ms</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 bg-red-600 border border-red-500 inline-block" />
            <span>&gt;600ms</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LatencyHeatmap;
