import React from "react";
import { CheckCircle2, Clock, Radio } from "lucide-react";

export interface StepperUpdate {
  status: string;
  created_at: number;
  message?: string;
}

interface IncidentStepperProps {
  currentStatus: string;
  updates?: StepperUpdate[];
  firstSeenAt?: number;
  resolvedAt?: number | null;
  compact?: boolean;
}

const STAGES = [
  { id: "investigating", label: "INVESTIGATING", stepNum: "01" },
  { id: "identified", label: "IDENTIFIED", stepNum: "02" },
  { id: "monitoring", label: "MONITORING", stepNum: "03" },
  { id: "resolved", label: "RESOLVED", stepNum: "04" },
];

export const IncidentStepper: React.FC<IncidentStepperProps> = ({
  currentStatus,
  updates = [],
  firstSeenAt,
  resolvedAt,
  compact = false,
}) => {
  // Determine highest completed stage
  const isResolved =
    currentStatus === "resolved" ||
    Boolean(resolvedAt) ||
    updates.some((u) => u.status === "resolved");

  const hasMonitoring =
    isResolved ||
    currentStatus === "monitoring" ||
    updates.some((u) => u.status === "monitoring");

  const hasIdentified =
    hasMonitoring ||
    currentStatus === "identified" ||
    currentStatus === "acknowledged" ||
    updates.some((u) => u.status === "identified" || u.status === "acknowledged");

  // Map each stage to state: 'completed' | 'active' | 'pending'
  const getStageState = (stageId: string): "completed" | "active" | "pending" => {
    if (stageId === "resolved") {
      return isResolved ? "completed" : hasMonitoring ? "active" : "pending";
    }
    if (stageId === "monitoring") {
      if (isResolved) return "completed";
      if (hasMonitoring) return "active";
      return hasIdentified ? "pending" : "pending";
    }
    if (stageId === "identified") {
      if (hasMonitoring || isResolved) return "completed";
      if (hasIdentified) return "active";
      return "pending";
    }
    // investigating
    if (hasIdentified || hasMonitoring || isResolved) return "completed";
    return "active";
  };

  // Find timestamp for stage
  const getStageTime = (stageId: string): string | null => {
    if (stageId === "resolved" && resolvedAt) {
      return new Date(resolvedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    const match = updates
      .filter((u) => {
        if (stageId === "identified") return u.status === "identified" || u.status === "acknowledged";
        return u.status === stageId;
      })
      .sort((a, b) => b.created_at - a.created_at)[0];

    if (match) {
      return new Date(match.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    if (stageId === "investigating" && firstSeenAt) {
      return new Date(firstSeenAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return null;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 py-1">
        {STAGES.map((s, idx) => {
          const state = getStageState(s.id);
          return (
            <React.Fragment key={s.id}>
              <div
                className={`px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider border ${
                  state === "completed"
                    ? "border-emerald-500/70 bg-emerald-950/40 text-emerald-400"
                    : state === "active"
                    ? "border-cyan-400 bg-cyan-950/60 text-cyan-300 animate-pulse"
                    : "border-zinc-800 bg-zinc-950/40 text-zinc-600"
                }`}
              >
                {s.label}
              </div>
              {idx < STAGES.length - 1 && <span className="text-zinc-600 text-[10px] font-mono">&rarr;</span>}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full my-3">
      {STAGES.map((stage) => {
        const state = getStageState(stage.id);
        const time = getStageTime(stage.id);

        return (
          <div
            key={stage.id}
            className={`border p-2.5 flex flex-col justify-between transition-all ${
              state === "completed"
                ? "border-emerald-500/80 bg-emerald-950/20 text-emerald-400"
                : state === "active"
                ? "border-cyan-400 bg-cyan-950/40 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                : "border-zinc-800 bg-zinc-950/30 text-zinc-600"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono font-bold tracking-widest opacity-80">
                [{stage.stepNum}]
              </span>
              {state === "completed" ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : state === "active" ? (
                <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-zinc-700" />
              )}
            </div>

            <div>
              <div className="text-xs font-mono font-bold tracking-wider">{stage.label}</div>
              <div className="text-[10px] font-mono mt-0.5 opacity-75">
                {time ? `${time} UTC` : state === "pending" ? "Awaiting" : "In Progress"}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default IncidentStepper;
