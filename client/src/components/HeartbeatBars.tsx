import React, { useState } from "react";

export interface HistoryBlock {
  date: string;
  status: "up" | "down" | "degraded" | "none" | "maintenance";
  uptimePct: number | null;
}

interface HeartbeatBarsProps {
  blocks: HistoryBlock[];
  compact?: boolean;
}

export default function HeartbeatBars({ blocks, compact = false }: HeartbeatBarsProps) {
  const [hoveredBlock, setHoveredBlock] = useState<{ block: HistoryBlock; index: number } | null>(null);

  // Fallback: only today's block is active, prior 29 days are none
  const displayBlocks = blocks && blocks.length > 0 
    ? blocks 
    : Array.from({ length: 30 }).map((_, i) => ({
        date: `Day -${29 - i}`,
        status: (i === 29 ? "up" : "none") as const,
        uptimePct: i === 29 ? 100 : null,
      }));

  return (
    <div className={`relative font-mono ${compact ? "space-y-1 pt-0" : "space-y-2 pt-2"}`}>
      {/* 30-Day Segmented Bars (0px Sharp Industrial Rectangles) */}
      <div 
        className={`grid grid-cols-30 gap-[2px] sm:gap-1 ${compact ? "h-3.5 sm:h-4" : "h-7"}`}
        role="region"
        aria-label="30-day availability history"
      >
        {displayBlocks.map((b, i) => {
          const isUp = b.status === "up";
          const isDegraded = b.status === "degraded";
          const isDown = b.status === "down";
          const isMaint = b.status === "maintenance";
          const isNone = b.status === "none";
          const isHovered = hoveredBlock?.index === i;

          return (
            <div
              key={i}
              tabIndex={0}
              role="button"
              aria-label={
                isNone
                  ? `${b.date}: No telemetry (pre-registration)`
                  : `${b.date}: ${b.uptimePct !== null ? `${b.uptimePct}% uptime` : "Active"} (${b.status})`
              }
              onMouseEnter={() => setHoveredBlock({ block: b, index: i })}
              onMouseLeave={() => setHoveredBlock(null)}
              onFocus={() => setHoveredBlock({ block: b, index: i })}
              onBlur={() => setHoveredBlock(null)}
              className={`transition-all duration-100 cursor-pointer outline-none ${
                isNone
                  ? "bg-zinc-800/60 hover:bg-zinc-700/80 border border-zinc-800/40"
                  : isMaint
                  ? "bg-sky-500 hover:bg-sky-300"
                  : isUp
                  ? "bg-emerald-500 hover:bg-emerald-300"
                  : isDegraded
                  ? "bg-amber-500 hover:bg-amber-300"
                  : "bg-rose-600 hover:bg-rose-400"
              } ${isHovered ? "scale-110 -translate-y-1 z-10 border border-white" : ""}`}
            />
          );
        })}
      </div>

      {/* Floating Dynamic Tooltip (Sharp Brutalist Box) */}
      {hoveredBlock && (
        <div 
          className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1 bg-black border-2 border-zinc-500 text-xs font-mono shadow-[3px_3px_0px_#000] flex items-center space-x-2 pointer-events-none z-30 whitespace-nowrap"
          style={{
            left: `${Math.min(Math.max((hoveredBlock.index / 29) * 100, 15), 85)}%`,
          }}
        >
          <span
            className={`w-2 h-2 shrink-0 ${
              hoveredBlock.block.status === "none"
                ? "bg-zinc-600"
                : hoveredBlock.block.status === "maintenance"
                ? "bg-sky-400"
                : hoveredBlock.block.status === "up"
                ? "bg-emerald-400"
                : hoveredBlock.block.status === "degraded"
                ? "bg-amber-400"
                : "bg-rose-400"
            }`}
          />
          <span className="text-zinc-200 font-semibold">{hoveredBlock.block.date}</span>
          <span className="text-zinc-600">|</span>
          <span className="text-white font-extrabold">
            {hoveredBlock.block.uptimePct !== null ? `${hoveredBlock.block.uptimePct}%` : "NO DATA"}
          </span>
          <span className={`uppercase text-[10px] font-bold ${
            hoveredBlock.block.status === "none"
              ? "text-zinc-400"
              : hoveredBlock.block.status === "maintenance"
              ? "text-sky-400"
              : hoveredBlock.block.status === "up"
              ? "text-emerald-400"
              : hoveredBlock.block.status === "degraded"
              ? "text-amber-400"
              : "text-rose-400"
          }`}>
            [{hoveredBlock.block.status === "none" ? "PRE-REGISTRATION" : hoveredBlock.block.status === "up" ? "NOMINAL" : hoveredBlock.block.status.toUpperCase()}]
          </span>
        </div>
      )}

      {/* Legend & Timeline Boundaries */}
      <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono pt-0.5 select-none">
        <span>30 days ago</span>
        {!compact ? (
          <div className="flex items-center space-x-3 text-[10px]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-400 inline-block" />
              <span className="text-zinc-400">OPERATIONAL</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-amber-400 inline-block" />
              <span className="text-zinc-400">DEGRADED</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-rose-500 inline-block" />
              <span className="text-zinc-400">OUTAGE</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-zinc-800 border border-zinc-700 inline-block" />
              <span className="text-zinc-400">NO DATA</span>
            </span>
          </div>
        ) : (
          <span className="text-[9px] text-zinc-500">
            {(() => {
              const activeCount = displayBlocks.filter((b) => b.status !== "none").length;
              if (activeCount === 1) return "Registered today";
              if (activeCount > 1) return `${activeCount} days monitored`;
              return "No data";
            })()}
          </span>
        )}
        <span>Today</span>
      </div>
    </div>
  );
}
