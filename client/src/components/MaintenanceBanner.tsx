import React from "react";
import { Wrench, Calendar, Clock, Download, AlertCircle } from "lucide-react";

export interface MaintenanceItem {
  id: string;
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  affectedServices: string[];
  status: "scheduled" | "in_progress" | "completed";
  createdAt: number;
}

interface MaintenanceBannerProps {
  maintenanceWindows: MaintenanceItem[];
}

export default function MaintenanceBanner({ maintenanceWindows }: MaintenanceBannerProps) {
  if (!maintenanceWindows || maintenanceWindows.length === 0) return null;

  return (
    <div className="space-y-3">
      {maintenanceWindows.map((m) => {
        const isInProgress = m.status === "in_progress";
        const startDate = new Date(m.startTime).toLocaleString();
        const endDate = new Date(m.endTime).toLocaleString();

        return (
          <div
            key={m.id}
            className={`p-4 border-2 shadow-[3px_3px_0px_#000] font-mono text-xs space-y-2.5 transition ${
              isInProgress
                ? "bg-[#161206] border-amber-500 text-amber-200"
                : "bg-[#06121a] border-sky-500 text-sky-200"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-current/20 pb-2">
              <div className="flex items-center space-x-2">
                <Wrench className={`w-4 h-4 shrink-0 ${isInProgress ? "text-amber-400 animate-spin" : "text-sky-400"}`} />
                <span className="font-black uppercase tracking-wider text-white">
                  {isInProgress ? "[MAINTENANCE IN PROGRESS]" : "[SCHEDULED SYSTEM MAINTENANCE]"}
                </span>
                <span className={`px-1.5 py-0.2 text-[9px] font-bold uppercase border ${
                  isInProgress ? "bg-amber-950 border-amber-400 text-amber-300" : "bg-sky-950 border-sky-400 text-sky-300"
                }`}>
                  {isInProgress ? "ACTIVE" : "UPCOMING"}
                </span>
              </div>

              {/* Add to Calendar (.ics) Download Button */}
              <a
                href={`/api/v1/maintenance/${m.id}/ics`}
                download
                className="px-2.5 py-1 bg-black/60 border border-current text-white hover:bg-black text-[11px] font-bold uppercase flex items-center gap-1.5 self-start sm:self-auto transition shadow-[1px_1px_0px_#000]"
                title="Download .ics file to add to Google Calendar, Apple Calendar, or Outlook"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Add to Calendar (.ics)</span>
                <Download className="w-3 h-3 opacity-60" />
              </a>
            </div>

            <div className="space-y-1">
              <h4 className="font-bold text-white text-xs uppercase">{m.title}</h4>
              {m.description && (
                <p className="font-sans text-xs text-zinc-300 leading-relaxed max-w-2xl">
                  {m.description}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[11px] pt-1 text-zinc-400">
              <div className="flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                <span>Window: <span className="text-white font-bold">{startDate} &rarr; {endDate}</span></span>
              </div>

              {m.affectedServices && m.affectedServices.length > 0 && (
                <div className="flex items-center space-x-1.5">
                  <span className="text-zinc-500">Affected:</span>
                  <div className="flex flex-wrap gap-1">
                    {m.affectedServices.map((svc) => (
                      <span key={svc} className="px-1.5 py-0.5 bg-black border border-zinc-700 text-zinc-200 text-[9px] font-mono uppercase">
                        {svc}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
