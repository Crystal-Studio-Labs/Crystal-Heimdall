import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { 
  ShieldCheck, 
  ArrowLeft, 
  AlertCircle,
  Lock,
  LayoutDashboard,
  LogOut,
  CheckCircle2,
  QrCode,
  Copy,
  Check
} from "lucide-react";
import { setAuthToken, getSessionInfo, clearAuthToken } from "../lib/api";
import { useToast } from "../lib/ToastContext";
import SEO from "../components/SEO";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  
  const searchParams = new URLSearchParams(location.search);
  const isExplicitReauth = searchParams.get("reauth") === "true" || searchParams.get("switch") === "true";
  
  const [session, setSession] = useState(() => getSessionInfo());
  const [totpCode, setTotpCode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [qrData, setQrData] = useState<{ qrDataUrl: string; secret: string; otpauth: string } | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Check whether 2FA pairing is locked or if this is a first-time fresh installation
  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch("/api/v1/auth/status");
        if (res.ok) {
          const data = await res.json();
          const locked = data.isLocked !== false;
          setIsLocked(locked);
          if (!locked) {
            const setupRes = await fetch("/api/v1/auth/setup-2fa");
            if (setupRes.ok) {
              const setupData = await setupRes.json();
              setQrData({
                qrDataUrl: setupData.qrDataUrl,
                secret: setupData.secret,
                otpauth: setupData.otpauth,
              });
            }
          }
        }
      } catch {
        setIsLocked(true);
      }
    }
    checkStatus();
  }, []);

  const handleCopySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    setCopiedSecret(true);
    toast.success("Secret key copied to clipboard");
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  // Auto-redirect to dashboard if operator already has an active, valid session (at least 7 days)
  useEffect(() => {
    if (session.isValid && !isExplicitReauth) {
      toast.info("Active operator session detected • Returning to Command Deck");
      navigate("/dashboard", { replace: true });
    }
  }, [session.isValid, isExplicitReauth, navigate, toast]);

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
      toast.success("2FA verified • 7+ Day Operator session authorized!");
      navigate("/dashboard");
    } catch (err: any) {
      setErrorMessage(err.message);
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwitchOperator = () => {
    clearAuthToken();
    setSession(getSessionInfo());
    setTotpCode("");
    toast.info("Previous session cleared. Enter 2FA code to authenticate.");
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
                {!isLocked ? "[FIRST-TIME SETUP] 2FA PAIRING" : "[GATE_01] 2FA DIRECT ACCESS"}
              </span>
              <span className="text-[10px] text-zinc-500">CRYSTAL STUDIO LABS</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
              {!isLocked ? "Setup 2FA Authenticator" : "Two-Factor Authentication"}
            </h1>
            <p className="text-xs text-zinc-400 font-sans leading-relaxed">
              {!isLocked
                ? "Scan this QR code with Google Authenticator, Ente Auth, or 1Password, then enter the 6-digit rolling code below to permanently seal and pair your credentials."
                : "Enter the rolling 6-digit TOTP code from your paired authenticator app (Google Authenticator, Ente Auth, 1Password)."}
            </p>
          </div>

          {/* First-Time QR Code Display */}
          {!isLocked && qrData && (
            <div className="p-4 bg-black border-2 border-emerald-500/80 shadow-[4px_4px_0px_#10b981] space-y-3 flex flex-col items-center text-center">
              <div className="p-2 bg-white border border-zinc-200 shadow-sm">
                <img
                  src={qrData.qrDataUrl}
                  alt="2FA Pairing QR Code"
                  className="w-44 h-44 block"
                />
              </div>

              <div className="space-y-1 w-full text-left">
                <span className="text-[10px] text-zinc-500 font-mono uppercase block">
                  Manual Base32 Secret Key:
                </span>
                <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 p-2 text-xs font-mono">
                  <span className="text-emerald-400 font-bold tracking-wider truncate flex-1 select-all">
                    {qrData.secret}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopySecret(qrData.secret)}
                    className="p-1 px-2 bg-zinc-900 border border-zinc-700 hover:border-emerald-400 text-[10px] text-zinc-300 hover:text-white uppercase font-bold flex items-center gap-1"
                  >
                    {copiedSecret ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSecret ? "COPIED" : "COPY"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-950/60 border-2 border-rose-600 text-rose-300 text-xs font-mono flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
          )}

          {/* Active Session Notice Banner if session is currently valid */}
          {session.isValid && (
            <div className="p-4 bg-emerald-950/50 border-2 border-emerald-500 text-emerald-300 space-y-3 font-mono shadow-[2px_2px_0px_#000]">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  [ ACTIVE OPERATOR SESSION ]
                </span>
                <span className="text-[10px] bg-emerald-900/80 px-2 py-0.5 border border-emerald-400">
                  ~{session.daysRemaining}d VALID
                </span>
              </div>
              <p className="text-xs text-zinc-300 font-sans">
                You are currently authenticated as <strong>{session.operator}</strong>. Your session is remembered and remains valid for at least 7 days.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => navigate("/dashboard")}
                  className="flex-1 py-2.5 bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-xs uppercase flex items-center justify-center gap-2 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>[ RETURN TO COMMAND DECK ]</span>
                </button>
                <button
                  type="button"
                  onClick={handleSwitchOperator}
                  className="px-3 py-2.5 bg-zinc-900 hover:bg-rose-950 border border-zinc-700 hover:border-rose-600 text-zinc-400 hover:text-rose-300 font-bold text-xs uppercase flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_#000]"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>SWITCH OPERATOR</span>
                </button>
              </div>
            </div>
          )}

          {/* Direct 2FA Code Input Form */}
          <form onSubmit={handleSubmit2Fa} className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] text-zinc-400 font-bold">
                <span>// 6-DIGIT ROLLING TOTP CODE //</span>
                <span className="text-emerald-400 font-mono flex items-center gap-1 text-[10px]">
                  <Lock className="w-3 h-3 text-emerald-400" />
                  <span>{!isLocked ? "[ PAIRING PENDING ]" : "[ LOCKED & ACTIVE ]"}</span>
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
              <span>{isSubmitting ? "Authorizing Session..." : !isLocked ? "[ PAIR & AUTHORIZE OPERATOR ]" : "[ VERIFY & AUTHORIZE OPERATOR ]"}</span>
              <ShieldCheck className="w-4 h-4" />
            </button>

            {/* Bottom Bar: Secure Lockdown indicators */}
            <div className="pt-3 border-t-2 border-zinc-800 flex items-center justify-between text-xs">
              <span className="text-zinc-500 font-mono flex items-center gap-1.5 text-[11px]">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>{!isLocked ? "Unsealed Setup Mode" : "Pairing Sealed • Deployed Guard"}</span>
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
