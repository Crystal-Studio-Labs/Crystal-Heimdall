import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Terminal, Activity, AlertTriangle, Sliders, BookOpen } from "lucide-react";
import { isOperatorAuthenticated } from "../lib/api";

export const MobileBottomNav: React.FC = () => {
  const location = useLocation();
  const isAuthenticated = isOperatorAuthenticated();

  const navItems = [
    {
      label: "DECK",
      path: isAuthenticated ? "/dashboard" : "/login",
      icon: Terminal,
      match: ["/", "/dashboard", "/login"],
    },
    {
      label: "STATUS",
      path: "/status",
      icon: Activity,
      match: ["/status"],
    },
    {
      label: "INCIDENTS",
      path: "/incidents",
      icon: AlertTriangle,
      match: ["/incidents"],
    },
    {
      label: "SETTINGS",
      path: "/settings",
      icon: Sliders,
      match: ["/settings"],
    },
    {
      label: "DOCS",
      path: "/docs",
      icon: BookOpen,
      match: ["/docs"],
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-[#030712] border-t-2 border-zinc-800 z-40 flex items-center justify-around px-1 shadow-[0_-4px_10px_rgba(0,0,0,0.5)]">
      {navItems.map((item) => {
        const isActive = item.match.some((m) =>
          m === "/" ? location.pathname === "/" : location.pathname.startsWith(m)
        );
        const Icon = item.icon;

        return (
          <Link
            key={item.label}
            to={item.path}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${
              isActive
                ? "text-cyan-400 border-t-2 border-cyan-400 -mt-[2px] bg-cyan-950/20"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Icon className="w-4 h-4 mb-0.5" />
            <span className="text-[9px] font-mono font-bold tracking-wider">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
};

export default MobileBottomNav;
