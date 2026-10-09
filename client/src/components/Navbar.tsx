import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  Activity, 
  BarChart3, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  LayoutDashboard,
  ShieldCheck,
  Volume2,
  VolumeX,
  BellRing,
} from "lucide-react";
import { getAuthToken, clearAuthToken } from "../lib/api";
import { useToast } from "../lib/ToastContext";
import { isAudioMuted, setAudioMuted, playTestSound } from "../lib/audioAlerts";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const isAuthenticated = !!getAuthToken();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [muted, setMuted] = useState(isAudioMuted());

  const handleLogout = () => {
    clearAuthToken();
    toast.info("Signed out of Operator Console");
    navigate("/");
    setMobileMenuOpen(false);
  };

  const handleToggleSound = () => {
    const next = !muted;
    setAudioMuted(next);
    setMuted(next);
    if (!next) {
      toast.success("Siren alert audio ARMED (PWA Outage Audio On)");
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

  const navItems = [
    { label: "[01] DASHBOARD", path: "/dashboard", icon: LayoutDashboard },
    { label: "[02] ANALYTICS", path: "/dashboard/analytics", icon: BarChart3 },
    { label: "[03] SETTINGS", path: "/dashboard/settings", icon: Settings },
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
        <div className="flex items-center space-x-3">

          {/* Sound Alarm Toggle */}
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
              <span>{muted ? "ALARM: MUTED" : "ALARM: ARMED"}</span>
            </button>

            <button
              onClick={handleTestSiren}
              className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white text-[9px] font-bold"
              title="Trigger test alarm tone"
            >
              TEST
            </button>
          </div>

          <span className="text-zinc-600 hidden md:inline">|</span>
          <span className="text-cyan-400 font-bold hidden sm:inline">POLL: 60s</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center space-x-3 group" onClick={() => setMobileMenuOpen(false)}>
          <div className="w-8 h-8 bg-zinc-900 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 shadow-[2px_2px_0px_#000] group-hover:bg-emerald-400 group-hover:text-black transition-all">
            <Activity className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              <span className="font-black text-sm tracking-tight text-white uppercase font-mono">
                Crystal Heimdall
              </span>
              <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-500 tracking-wider">
                SENTINEL
              </span>
            </div>
            <span className="text-[10px] text-zinc-400 font-mono tracking-widest -mt-0.5 uppercase">
              CRYSTAL STUDIO LABS
            </span>
          </div>
        </Link>

        {/* Center Nav for Authenticated Operator (Desktop) */}
        {isAuthenticated && (
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3.5 py-2 text-xs font-mono font-bold flex items-center gap-2 border-2 transition-all ${
                    isActive
                      ? "bg-zinc-800 text-cyan-300 border-cyan-400 shadow-[2px_2px_0px_#000]"
                      : "bg-transparent text-zinc-400 border-transparent hover:border-zinc-700 hover:text-white"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-cyan-300" : "text-zinc-500"}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        )}

        {/* Right Actions (Desktop) */}
        <div className="hidden md:flex items-center space-x-3">
          <Link
            to="/"
            className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border-2 border-zinc-700 flex items-center gap-2 transition text-xs font-mono font-bold shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 bg-emerald-400" />
            </span>
            <span>PUBLIC STATUS</span>
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center space-x-2">
              <span className="px-2 py-1 text-[10px] font-mono bg-emerald-950/60 border border-emerald-500/60 text-emerald-400 font-bold uppercase">
                [OPERATOR]
              </span>
              <button
                onClick={handleLogout}
                className="p-2 bg-zinc-900 hover:bg-rose-950 text-zinc-400 hover:text-rose-300 border-2 border-zinc-700 hover:border-rose-600 transition shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                title="Sign out of Operator Session"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-black border-2 border-emerald-300 text-xs font-mono font-black uppercase tracking-wider flex items-center gap-1.5 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>OPERATOR LOGIN</span>
            </Link>
          )}
        </div>

        {/* Mobile Menu Trigger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 bg-zinc-900 text-zinc-300 border-2 border-zinc-700 shadow-[2px_2px_0px_#000]"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0a0e17] border-b-2 border-zinc-800 p-4 space-y-3 font-mono text-xs">
          {isAuthenticated && (
            <div className="space-y-1.5 pb-3 border-b border-zinc-800">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 border border-zinc-800 bg-zinc-900/60 text-zinc-300 font-bold hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}

          <div className="space-y-2 pt-1">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 bg-zinc-900 border border-zinc-700 text-zinc-200 text-center font-bold"
            >
              PUBLIC STATUS PAGE
            </Link>

            {isAuthenticated ? (
              <button
                onClick={handleLogout}
                className="w-full px-3 py-2 bg-rose-950/60 border border-rose-700 text-rose-300 text-center font-bold"
              >
                SIGN OUT OPERATOR
              </button>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 bg-emerald-400 text-black border border-emerald-300 text-center font-black"
              >
                OPERATOR LOGIN
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
