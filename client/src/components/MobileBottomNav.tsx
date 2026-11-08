import React from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  Terminal, 
  Activity, 
  AlertTriangle, 
  Sliders, 
  BarChart3,
  Globe, 
  Lock 
} from "lucide-react";
import { isOperatorAuthenticated } from "../lib/api";

export const MobileBottomNav: React.FC = () => {
  const location = useLocation();
  const isAuthenticated = isOperatorAuthenticated();

  // Public items for unauthenticated visitors (Normal users ONLY see public status, incidents, overview)
  const publicNavItems = [
    {
      label: "STATUS",
      path: "/",
      icon: Activity,
      match: ["/", "/status"],
    },
    {
      label: "INCIDENTS",
      path: "/incidents",
      icon: AlertTriangle,
      match: ["/incidents"],
    },
    {
      label: "OVERVIEW",
      path: "/overview",
      icon: Globe,
      match: ["/overview", "/about"],
    },
    {
      label: "LOGIN",
      path: "/login",
      icon: Lock,
      match: ["/login"],
    },
  ];

  // Operator-only items when 2FA session is active
  const operatorNavItems = [
    {
      label: "DECK",
      path: "/dashboard",
      icon: Terminal,
      match: ["/dashboard"],
    },
    {
      label: "STATUS",
      path: "/",
      icon: Activity,
      match: ["/", "/status"],
    },
    {
      label: "INCIDENTS",
      path: "/incidents",
      icon: AlertTriangle,
      match: ["/incidents"],
    },
    {
      label: "METRICS",
      path: "/dashboard/analytics",
      icon: BarChart3,
      match: ["/dashboard/analytics"],
    },
    {
      label: "SETTINGS",
      path: "/dashboard/settings",
      icon: Sliders,
      match: ["/dashboard/settings", "/settings"],
    },
  ];

  const items = isAuthenticated ? operatorNavItems : publicNavItems;

  return (
    <nav 
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-[#030712] border-t-2 border-zinc-800 z-40 flex items-center justify-around px-1 shadow-[0_-4px_10px_rgba(0,0,0,0.6)] backdrop-blur-md"
    >
      {items.map((item) => {
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
                ? "text-cyan-300 border-t-2 border-cyan-400 -mt-[2px] bg-cyan-950/25 font-black"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Icon className={`w-4 h-4 mb-0.5 ${isActive ? "text-cyan-400" : "text-zinc-500"}`} />
            <span className="text-[9px] font-mono tracking-wider">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
};

export default MobileBottomNav;
