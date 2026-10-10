import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { 
  ShieldCheck, 
  ArrowLeft, 
  AlertCircle,
  Lock
} from "lucide-react";
import { setAuthToken } from "../lib/api";
import { useToast } from "../lib/ToastContext";
import SEO from "../components/SEO";

export default function LoginPage() {
  const navigate = useNavigate();
  const toast = useToast();
  
  const [totpCode, setTotpCode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Submit 6-digit TOTP code directly (2FA Enforced)
  const handleSubmit2Fa = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    const cleanedCode = totpCode.trim();
    if (!cleanedCode) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: cleanedCode }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "2FA verification failed");

      setAuthToken(data.token);
      toast.success("2FA code verified • Operator session authorized!");
      navigate("/dashboard");
    } catch (err: any) {
      setErrorMessage(err.message);
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070a0f] text-zinc-100 flex flex-col justify-between font-mono relative overflow-hidden">
      <SEO 
        title="Operator Authentication Gate // Crystal Heimdall"
        description="Direct Two-Factor Authentication (RFC 6238 TOTP) access gate for Crystal Studio Labs infrastructure operators."
        canonicalPath="/login"
        noIndex={true}
      />
      {/* Top Bar */}
      <header className="border-b-2 border-zinc-800 bg-[#070a0f] px-4 sm:px-6 h-14 flex items-center justify-between text-xs">
        <Link to="/" className="text-zinc-400 hover:text-white flex items-center gap-2 transition font-bold">
          <ArrowLeft className="w-4 h-4 text-emerald-400" />
          <span>[ RETURN TO STATUS PAGE ]</span>
        </Link>
        <div className="flex items-center space-x-2 text-[11px] font-bold text-emerald-400">
          <span className="w-1.5 h-1.5 bg-emerald-400 inline-block animate-pulse" />
          <span>[ AUTH_PROTOCOL: 2FA_ENFORCED ]</span>
        </div>
      </header>

      {/* Main 2FA Form Center */}
      <main className="flex-1 flex items-center justify-center p-4 py-12">
        <div className="w-full max-w-md bg-[#0b0f17] border-2 border-zinc-700 shadow-[6px_6px_0px_#000000] p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="space-y-2 border-b-2 border-zinc-800 pb-5">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 text-[10px] bg-emerald-950 border border-emerald-500 text-emerald-400 font-bold uppercase">
                [GATE_01] 2FA DIRECT ACCESS
              </span>
              <span className="text-[10px] text-zinc-500">CRYSTAL STUDIO LABS</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
              Two-Factor Authentication
            </h1>
            <p className="text-xs text-zinc-400 font-sans leading-relaxed">
              Enter the rolling 6-digit TOTP code from your paired authenticator app (Google Authenticator, Ente Auth, 1Password).
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-950/60 border-2 border-rose-600 text-rose-300 text-xs font-mono flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
          )}

          {/* Direct 2FA Code Input Form */}
          <form onSubmit={handleSubmit2Fa} className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] text-zinc-400 font-bold">
                <span>// 6-DIGIT ROLLING TOTP CODE //</span>
                <span className="text-emerald-400 font-mono flex items-center gap-1 text-[10px]">
                  <Lock className="w-3 h-3 text-emerald-400" />
                  <span>[ LOCKED & ACTIVE ]</span>
                </span>
              </div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="------"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                className="w-full p-3.5 bg-black border-2 border-emerald-500/80 text-emerald-400 font-mono text-center tracking-[0.6em] text-3xl font-black shadow-[inset_2px_2px_0px_#000] outline-none focus:border-cyan-400"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || totpCode.length < 6}
              className="w-full py-4 btn-primary text-xs flex items-center justify-center gap-2 uppercase tracking-wider"
            >
              <span>{isSubmitting ? "Authorizing Session..." : "[ VERIFY & AUTHORIZE OPERATOR ]"}</span>
              <ShieldCheck className="w-4 h-4" />
            </button>

            {/* Bottom Bar: Secure Lockdown indicators */}
            <div className="pt-3 border-t-2 border-zinc-800 flex items-center justify-between text-xs">
              <span className="text-zinc-500 font-mono flex items-center gap-1.5 text-[11px]">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Pairing Sealed • Deployed Guard</span>
              </span>

              <span className="text-[10px] text-zinc-500 font-mono">
                RFC 6238 • 30s Steps
              </span>
            </div>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-zinc-800 bg-black py-4 text-center text-[11px] text-zinc-500 font-mono">
        Uptime Tracker For Crystal Studio Labs • 2-Factor Authentication Only
      </footer>
    </div>
  );
}
