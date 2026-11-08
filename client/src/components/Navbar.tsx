import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  Activity, 
  BarChart3, 
  Settings, 
  LayoutDashboard, 
  Volume2, 
  VolumeX, 
  Lock,
  BookOpen
} from "lucide-react";
import { isOperatorAuthenticated, getSessionInfo } from "../lib/api";
import { useToast } from "../lib/ToastContext";
import { isAudioMuted, setAudioMuted, playTestSound } from "../lib/audioAlerts";

export default function Navbar() {
  const location = useLocation();
  const toast = useToast();
  const isAuthenticated = isOperatorAuthenticated();
  const session = getSessionInfo();
  const [muted, setMuted] = useState(isAudioMuted());

  const handleToggleSound = () => {
    const next = !muted;
    setAudioMuted(next);
    setMuted(next);
    if (!next) {
      toast.success("Siren alert audio ARMED");
      playTestSound();
    } else {
      toast.info("Siren alert audio MUTED");
    }
  };

  const handleTestSiren = () => {
    if (muted) {
      setAudioMuted(false);
      setMuted(false);
    }
    toast.warning("Testing industrial siren alarm...");
    playTestSound();
  };

  const operatorNavItems = [
    { label: "[01] DASHBOARD", path: "/dashboard", icon: LayoutDashboard },
    { label: "[02] ANALYTICS", path: "/dashboard/analytics", icon: BarChart3 },
    { label: "[03] SETTINGS", path: "/dashboard/settings", icon: Settings },
    { label: "[04] INCIDENTS", path: "/incidents", icon: Activity },
    { label: "[05] DOCS", path: "/docs", icon: BookOpen },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-[#070a0f] border-b-2 border-zinc-800 transition-all">
      {/* Top Hardware Diagnostic Rail */}
      <div className="w-full bg-black/85 border-b border-zinc-800 px-4 sm:px-6 py-1 flex items-center justify-between text-[10px] font-mono text-zinc-400">
        <div className="flex items-center space-x-3">
          <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <span className="w-1.5 h-1.5 bg-emerald-400 inline-block animate-pulse" />
            [SYS.NOMINAL]
          </span>
          <span className="hidden sm:inline text-zinc-600">|</span>
          <span className="hidden sm:inline">CRYSTAL STUDIO LABS INFRASTRUCTURE</span>
        </div>
        
        {/* Hardware Sound Alarm Quick Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="flex items-center space-x-1">
            <button
              onClick={handleToggleSound}
              className={`px-2 py-0.5 border flex items-center gap-1 text-[9px] font-bold uppercase transition ${
                muted
                  ? "bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-zinc-300"
                  : "bg-rose-950/80 border-rose-500 text-rose-300"
              }`}
              title={muted ? "Unmute alarm sound" : "Mute alarm sound"}
            >
              {muted ? <VolumeX className="w-2.5 h-2.5" /> : <Volume2 className="w-2.5 h-2.5 text-rose-400 animate-pulse" />}
              <span>{muted ? "MUTED" : "ARMED"}</span>
            </button>

            <button
              onClick={handleTestSiren}
              className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white text-[9px] font-bold hidden sm:inline"
              title="Trigger test alarm tone"
            >
              TEST
            </button>
          </div>

          <span className="text-zinc-600 hidden md:inline">|</span>
          <span className="text-cyan-400 font-bold hidden sm:inline">POLL: 60s</span>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center space-x-2.5 sm:space-x-3 group">
          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-zinc-900 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 shadow-[2px_2px_0px_#000] group-hover:bg-emerald-400 group-hover:text-black transition-all shrink-0">
            <Activity className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              <span className="font-black text-xs sm:text-sm tracking-tight text-white uppercase font-mono">
                Crystal Heimdall
              </span>
              <span className="px-1 py-0.2 sm:px-1.5 sm:py-0.5 text-[8px] sm:text-[9px] font-mono font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-500 tracking-wider">
                SENTINEL
              </span>
            </div>
            <span className="text-[9px] sm:text-[10px] text-zinc-400 font-mono tracking-widest -mt-0.5 uppercase">
              CRYSTAL STUDIO LABS
            </span>
          </div>
        </Link>

        {/* Center Nav: Strict Role-Based Visibility (Desktop) */}
        <nav className="hidden lg:flex items-center space-x-1">
          {isAuthenticated ? (
            /* Authenticated Operator Menu */
            operatorNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-1.5 text-xs font-mono font-bold flex items-center gap-1.5 border-2 transition-all ${
                    isActive
                      ? "bg-zinc-800 text-cyan-300 border-cyan-400 shadow-[2px_2px_0px_#000]"
                      : "bg-transparent text-zinc-400 border-transparent hover:border-zinc-700 hover:text-white"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-cyan-300" : "text-zinc-500"}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })
          ) : (
            /* Public Visitors Menu (Strictly Status Page only) */
            <div className="flex items-center space-x-1 text-xs font-mono font-bold">
              <Link
                to="/"
                className={`px-3 py-1.5 border transition ${
                  location.pathname === "/" || location.pathname === "/status"
                    ? "bg-zinc-900 border-emerald-500 text-emerald-400 shadow-[2px_2px_0px_#000]"
                    : "border-transparent text-zinc-400 hover:text-white hover:border-zinc-800"
                }`}
              >
                STATUS
              </Link>
            </div>
          )}
        </nav>

        {/* Right Actions (Desktop & Mobile) */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {isAuthenticated ? (
            /* Authenticated Actions */
            <div className="flex items-center space-x-2">
              <Link
                to="/"
                className="hidden sm:flex px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border-2 border-zinc-700 items-center gap-1.5 transition text-xs font-mono font-bold shadow-[2px_2px_0px_#000]"
                title="View public status deck"
              >
                <span className="w-2 h-2 bg-emerald-400 inline-block animate-ping mr-0.5" />
                <span>PUBLIC STATUS</span>
              </Link>

              <Link
                to="/dashboard/settings"
                className="px-2.5 py-1 text-[10px] font-mono bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/60 hover:border-emerald-400 text-emerald-400 hover:text-emerald-300 font-bold uppercase transition flex items-center gap-1.5 shadow-[2px_2px_0px_#000]"
                title={`Active 2FA session valid for ~${session.daysRemaining || 30} days. Click to manage session or sign out in Settings.`}
              >
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                <span className="hidden sm:inline">[OPERATOR{session.daysRemaining ? `: ~${session.daysRemaining}d` : ""}]</span>
                <span className="sm:hidden">[OP]</span>
              </Link>
            </div>
          ) : (
            /* Public Visitor Login CTA */
            <Link
              to="/login"
              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border-2 border-zinc-700 flex items-center gap-1.5 text-xs font-mono font-bold shadow-[2px_2px_0px_#000] transition active:translate-x-[1px] active:translate-y-[1px]"
              title="Operator 2FA Access"
            >
              <Lock className="w-3 h-3 text-cyan-400" />
              <span className="hidden sm:inline">OPERATOR LOGIN</span>
              <span className="sm:hidden">LOGIN</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
