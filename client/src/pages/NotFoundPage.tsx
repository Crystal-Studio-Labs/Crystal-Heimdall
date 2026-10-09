import React from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, Home, Activity } from "lucide-react";
import Navbar from "../components/Navbar";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#070a0f] text-zinc-100 flex flex-col justify-between font-mono relative overflow-hidden">
      <Navbar />

      <main className="max-w-md w-full mx-auto px-4 py-20 text-center space-y-6 my-auto">
        <div className="w-16 h-16 bg-rose-950 border-2 border-rose-500 text-rose-400 flex items-center justify-center mx-auto shadow-[4px_4px_0px_#000]">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-xs text-rose-400 font-bold tracking-wider uppercase block">
            [ERROR 404 // UNRECOGNIZED ROUTE]
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
            Endpoint Not Found
          </h1>
          <p className="text-xs text-zinc-400 font-sans leading-relaxed">
            The requested telemetry deck route does not exist or has been relocated to another sentinel sector.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            to="/"
            className="w-full sm:w-auto px-5 py-3 btn-primary text-xs flex items-center justify-center space-x-2"
          >
            <Home className="w-4 h-4" />
            <span>[ RETURN TO HOME ]</span>
          </Link>

          <Link
            to="/status"
            className="w-full sm:w-auto px-5 py-3 btn-secondary text-xs flex items-center justify-center space-x-2"
          >
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>[ PUBLIC STATUS ]</span>
          </Link>
        </div>
      </main>

      <footer className="py-6 text-center text-[11px] text-zinc-600 border-t-2 border-zinc-800">
        Uptime Tracker For Crystal Studio Labs • Sentinel Telemetry
      </footer>
    </div>
  );
}
