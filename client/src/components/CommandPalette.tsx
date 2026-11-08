import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Terminal,
  Activity,
  AlertTriangle,
  Sliders,
  BookOpen,
  Volume2,
  VolumeX,
  Palette,
  Play,
  X,
  Radio,
  Bell,
} from "lucide-react";
import { isAudioMuted, setAudioMuted } from "../lib/audioAlerts";
import { setActiveTheme, TerminalTheme } from "../lib/theme";
import { useToast } from "../lib/ToastContext";

interface CommandItem {
  id: string;
  category: "PAGES" | "ACTIONS" | "SERVICES" | "THEMES";
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  onSelect: () => void;
}

export const CommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [services, setServices] = useState<Array<{ id: string; name: string; type: string; status: string }>>([]);
  const navigate = useNavigate();
  const { addToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is actively typing in form inputs, unless Ctrl/Cmd + K
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "/" && !isInput && !isOpen) {
        e.preventDefault();
        setIsOpen(true);
      } else if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Focus input and fetch services when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);

      fetch("/api/v1/services")
        .then((res) => res.json())
        .then((data) => {
          if (data.services) setServices(data.services);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Build items list
  const allItems: CommandItem[] = [
    // Pages
    {
      id: "page-deck",
      category: "PAGES",
      title: "OPERATOR COMMAND DECK",
      subtitle: "Live telemetry dashboard & service controls",
      icon: <Terminal className="w-4 h-4 text-cyan-400" />,
      onSelect: () => navigate("/dashboard"),
    },
    {
      id: "page-status",
      category: "PAGES",
      title: "PUBLIC STATUS HUB",
      subtitle: "30-Day SLA metrics & subscriber notices",
      icon: <Activity className="w-4 h-4 text-emerald-400" />,
      onSelect: () => navigate("/status"),
    },
    {
      id: "page-incidents",
      category: "PAGES",
      title: "INCIDENT MANAGEMENT",
      subtitle: "Triage log, postmortems & timeline ledger",
      icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
      onSelect: () => navigate("/incidents"),
    },
    {
      id: "page-settings",
      category: "PAGES",
      title: "SYSTEM & DISPATCH SETTINGS",
      subtitle: "Conduit config, alerts, subscriber indices",
      icon: <Sliders className="w-4 h-4 text-purple-400" />,
      onSelect: () => navigate("/settings"),
    },
    {
      id: "page-docs",
      category: "PAGES",
      title: "SENTINEL SPECIFICATION DOCS",
      subtitle: "API references & heartbeat integration guides",
      icon: <BookOpen className="w-4 h-4 text-blue-400" />,
      onSelect: () => navigate("/docs"),
    },

    // Actions
    {
      id: "action-poll",
      category: "ACTIONS",
      title: "TRIGGER IMMEDIATE FLEET PROBE",
      subtitle: "Execute synthetic cron poller on all fleet endpoints",
      icon: <Play className="w-4 h-4 text-cyan-400" />,
      onSelect: async () => {
        try {
          const res = await fetch("/api/v1/cron/poll", { method: "POST" });
          const data = await res.json();
          addToast(
            `Probe complete: ${data.summary?.polledCount || 0} checked, ${data.summary?.failedCount || 0} failed.`,
            data.summary?.failedCount ? "warning" : "success"
          );
        } catch {
          addToast("Failed to trigger fleet poll", "error");
        }
      },
    },
    {
      id: "action-mute",
      category: "ACTIONS",
      title: isAudioMuted() ? "UNMUTE SIREN AUDIO ALERTS" : "MUTE SIREN AUDIO ALERTS",
      subtitle: isAudioMuted() ? "Enable audio alarms for critical outages" : "Silence all audio sirens",
      icon: isAudioMuted() ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-red-400" />,
      onSelect: () => {
        const next = !isAudioMuted();
        setAudioMuted(next);
        addToast(next ? "Audio alerts MUTED." : "Audio alerts UNMUTED.", "info");
      },
    },
    {
      id: "action-webpush",
      category: "ACTIONS",
      title: "ARM CLOSED-BROWSER WEB PUSH ALERTS",
      subtitle: "Enable native system push alerts on this device",
      icon: <Bell className="w-4 h-4 text-amber-400" />,
      onSelect: async () => {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
          addToast("Web Push is not supported by this browser.", "error");
          return;
        }
        try {
          const permission = await Notification.requestPermission();
          if (permission !== "granted") {
            addToast("Permission denied for push notifications.", "error");
            return;
          }
          const reg = await navigator.serviceWorker.ready;
          const vapidRes = await fetch("/api/v1/push/vapid-public-key");
          const { publicKey } = await vapidRes.json();
          const padding = "=".repeat((4 - (publicKey.length % 4)) % 4);
          const base64 = (publicKey + padding).replace(/-/g, "+").replace(/_/g, "/");
          const rawData = window.atob(base64);
          const outputArray = new Uint8Array(rawData.length);
          for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
          }
          let sub = await reg.pushManager.getSubscription();
          if (!sub) {
            sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: outputArray });
          }
          await fetch("/api/v1/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscription: sub.toJSON(), scope: "all" }),
          });
          addToast("Closed-browser Web Push alerts armed on this device!", "success");
        } catch (err: any) {
          addToast(err.message || "Failed to arm push alerts", "error");
        }
      },
    },

    // Themes
    {
      id: "theme-obsidian",
      category: "THEMES",
      title: "THEME: OBSIDIAN NIGHT (DEFAULT)",
      subtitle: "Brutalist dark pitch black (#070a0f) with neon accents",
      icon: <Palette className="w-4 h-4 text-zinc-400" />,
      onSelect: () => {
        setActiveTheme("obsidian");
        addToast("Terminal theme switched to OBSIDIAN.", "info");
      },
    },
    {
      id: "theme-amber",
      category: "THEMES",
      title: "THEME: AMBER CRT PHOSPHOR",
      subtitle: "Retro 80s monochrome amber terminal phosphor",
      icon: <Palette className="w-4 h-4 text-amber-500" />,
      onSelect: () => {
        setActiveTheme("amber-crt");
        addToast("Terminal theme switched to AMBER CRT.", "warning");
      },
    },
    {
      id: "theme-matrix",
      category: "THEMES",
      title: "THEME: MATRIX EMERALD",
      subtitle: "Cyberpunk phosphor green terminal glow",
      icon: <Palette className="w-4 h-4 text-emerald-400" />,
      onSelect: () => {
        setActiveTheme("matrix-emerald");
        addToast("Terminal theme switched to MATRIX EMERALD.", "success");
      },
    },
    {
      id: "theme-paper",
      category: "THEMES",
      title: "THEME: PAPER LIGHT BRUTALISM",
      subtitle: "Ultra high contrast stark white paper brutalism",
      icon: <Palette className="w-4 h-4 text-blue-500" />,
      onSelect: () => {
        setActiveTheme("paper-light");
        addToast("Terminal theme switched to PAPER LIGHT.", "info");
      },
    },

    // Services
    ...services.map((svc) => ({
      id: `svc-${svc.id}`,
      category: "SERVICES" as const,
      title: `SERVICE: ${svc.name}`,
      subtitle: `Type: [${svc.type}] | Status: ${svc.status.toUpperCase()}`,
      icon: <Radio className="w-4 h-4 text-cyan-400" />,
      onSelect: () => navigate(`/service/${svc.id}`),
    })),
  ];

  // Filter items by query
  const filteredItems = allItems.filter((item) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
      item.category.toLowerCase().includes(q)
    );
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = filteredItems[selectedIndex];
      if (selected) {
        selected.onSelect();
        setIsOpen(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center pt-16 sm:pt-24 px-4 animate-in fade-in duration-100"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="w-full max-w-xl brutal-panel border-2 border-cyan-500 shadow-[8px_8px_0px_#000000] overflow-hidden bg-[#070a0f]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header Search Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b-2 border-zinc-800 bg-[#030712]">
          <Search className="w-4 h-4 text-cyan-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command, page name, or service... (ESC to exit)"
            className="w-full bg-transparent text-sm font-mono text-zinc-100 placeholder-zinc-500 outline-none"
          />
          <button
            onClick={() => setIsOpen(false)}
            className="text-zinc-500 hover:text-zinc-300 p-1 text-xs font-mono"
          >
            [ESC]
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-zinc-900">
          {filteredItems.length === 0 ? (
            <div className="p-6 text-center text-xs font-mono text-zinc-500">
              No commands or services match &quot;{query}&quot;
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    item.onSelect();
                    setIsOpen(false);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-cyan-950/60 border-l-4 border-cyan-400 text-cyan-100"
                      : "hover:bg-zinc-900/60 text-zinc-300"
                  }`}
                >
                  <div className="shrink-0">{item.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold tracking-wider truncate">
                        {item.title}
                      </span>
                      <span className="text-[9px] font-mono px-1 py-0.2 bg-zinc-800 text-zinc-400 border border-zinc-700 uppercase">
                        {item.category}
                      </span>
                    </div>
                    {item.subtitle && (
                      <div className="text-[11px] font-mono text-zinc-500 truncate mt-0.5">
                        {item.subtitle}
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <span className="text-[10px] font-mono text-cyan-400 shrink-0">
                      [ENTER &crarr;]
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-800 bg-[#030712] text-[10px] font-mono text-zinc-500">
          <div className="flex items-center gap-3">
            <span>&uarr;&darr; Navigate</span>
            <span>&crarr; Select</span>
            <span>ESC Close</span>
          </div>
          <span className="text-cyan-500/80">CRYSTAL HEIMDALL HUD</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
