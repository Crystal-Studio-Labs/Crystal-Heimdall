import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { 
  ShieldCheck, 
  QrCode, 
  ArrowLeft, 
  Copy, 
  Check, 
  AlertCircle,
  KeyRound,
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

  // 2FA QR Setup Modal state
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrData, setQrData] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Submit 6-digit TOTP code directly (2FA Only)
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

  // Fetch 2FA Setup QR Code
  const handleFetchQrSetup = async () => {
    try {
      const res = await fetch("/api/v1/auth/setup-2fa");
      if (res.ok) {
        const json = await res.json();
        setQrData(json);
        setShowQrModal(true);
      }
    } catch {
      toast.error("Failed to load 2FA configuration");
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
          <span>[ AUTH_PROTOCOL: 2FA_ONLY ]</span>
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
              Enter the rolling 6-digit TOTP code from your authenticator app (Google Authenticator, Ente Auth, 1Password).
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
                <span>// 6-DIGIT AUTHENTICATOR CODE //</span>
                <span className="text-emerald-400">DEV CODE: 000000</span>
              </div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
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

            <div className="pt-3 border-t-2 border-zinc-800 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleFetchQrSetup}
                className="text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1.5 font-bold"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Pair / Show QR Code</span>
              </button>

              <span className="text-[10px] text-zinc-500">
                Auto-rotates every 30s
              </span>
            </div>
          </form>
        </div>
      </main>

      {/* 2FA SETUP MODAL */}
      {showQrModal && qrData && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 font-mono text-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowQrModal(false);
          }}
        >
          <div className="bg-[#0b0f17] border-2 border-zinc-600 shadow-[6px_6px_0px_#000] p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center justify-between border-b-2 border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-white text-xs uppercase font-mono">Pair Authenticator</span>
              </div>
              <button
                onClick={() => setShowQrModal(false)}
                className="text-zinc-500 hover:text-white font-mono text-sm"
              >
                [X]
              </button>
            </div>

            <div className="flex justify-center p-3 bg-white border border-zinc-700">
              <img src={qrData.qrDataUrl} alt="2FA QR Code" className="w-44 h-44" />
            </div>

            <p className="text-[11px] text-zinc-400 font-sans leading-relaxed text-center">
              Scan this QR code with Google Authenticator, Ente Auth, or 1Password to link your device.
            </p>

            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 font-mono block font-bold uppercase">// MANUAL SECRET KEY //</span>
              <div className="p-2.5 bg-black border border-zinc-800 text-[11px] font-mono text-emerald-400 flex items-center justify-between">
                <span className="truncate">{qrData.secret}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(qrData.secret);
                    setCopiedSecret(true);
                    setTimeout(() => setCopiedSecret(false), 2000);
                  }}
                  className="ml-2 text-zinc-400 hover:text-white"
                  title="Copy secret"
                >
                  {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-mono text-xs font-bold border border-zinc-600 uppercase"
            >
              [ CLOSE / RETURN TO LOGIN ]
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t-2 border-zinc-800 bg-black py-4 text-center text-[11px] text-zinc-500 font-mono">
        Uptime Tracker For Crystal Studio Labs • 2-Factor Authentication Only
      </footer>
    </div>
  );
}
