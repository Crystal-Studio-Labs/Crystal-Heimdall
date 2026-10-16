import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import SEO from "../components/SEO";
import { 
  BellRing, 
  Send, 
  Check, 
  AlertCircle, 
  Code2, 
  Copy, 
  Shield, 
  Terminal, 
  Globe, 
  Clock, 
  MessageSquare,
  Eye, 
  EyeOff,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Save,
  Wrench,
  Trash2,
  Database,
  Cpu,
  Layers,
  Server,
  Webhook,
  Rss,
  ExternalLink
} from "lucide-react";
import { useToast } from "../lib/ToastContext";

interface StatusSettings {
  page_title: string;
  page_description: string;
  announcement_banner: string;
  announcement_type: "none" | "info" | "warning" | "critical";
  show_sla: boolean;
  show_incidents: boolean;
  footer_text: string;
  support_url: string;
}

interface AdvancedSettings {
  default_poll_interval: string;
  default_timeout: string;
  max_retries: string;
  resend_interval: string;
  ssl_warning_days: string;
  ignore_ssl_errors: boolean;
  default_http_method: string;
  user_agent: string;
  follow_redirects: boolean;
  accepted_status_codes: string;
  telemetry_retention_days: string;
}

export default function SettingsPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"status" | "alerts" | "inbound" | "security" | "advanced">("status");

  // Status Page Configuration (Uptime Kuma Style)
  const [statusSettings, setStatusSettings] = useState<StatusSettings>({
    page_title: "Crystal Heimdall",
    page_description: "Continuous Multi-Point Health Monitoring & Real-Time Incident Status",
    announcement_banner: "All core systems nominal across all regions.",
    announcement_type: "info",
    show_sla: true,
    show_incidents: true,
    footer_text: "Crystal Studio Labs • Autonomous Reliability Sentinel",
    support_url: "https://github.com/Crystal-Studio-Labs",
  });
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  // Uptime Kuma Advanced Engine Settings
  const [advancedSettings, setAdvancedSettings] = useState<AdvancedSettings>({
    default_poll_interval: "60",
    default_timeout: "10",
    max_retries: "2",
    resend_interval: "5",
    ssl_warning_days: "30",
    ignore_ssl_errors: false,
    default_http_method: "GET",
    user_agent: "Crystal-Heimdall/2.0 (+https://github.com/Crystal-Studio-Labs)",
    follow_redirects: true,
    accepted_status_codes: "200-299, 301, 302",
    telemetry_retention_days: "30",
  });
  const [isSavingAdvanced, setIsSavingAdvanced] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  // Load Status Page & Advanced settings from server
  useEffect(() => {
    fetch("/api/v1/status/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data && data.settings) {
          const s = data.settings;
          setStatusSettings({
            page_title: s.page_title || "Crystal Heimdall",
            page_description: s.page_description || "Continuous Multi-Point Health Monitoring & Real-Time Incident Status",
            announcement_banner: s.announcement_banner || "",
            announcement_type: (s.announcement_type as any) || "info",
            show_sla: s.show_sla === "true" || s.show_sla === true,
            show_incidents: s.show_incidents === "true" || s.show_incidents === true,
            footer_text: s.footer_text || "Crystal Studio Labs • Autonomous Reliability Sentinel",
            support_url: s.support_url || "https://github.com/Crystal-Studio-Labs",
          });

          setAdvancedSettings({
            default_poll_interval: s.default_poll_interval || "60",
            default_timeout: s.default_timeout || "10",
            max_retries: s.max_retries || "2",
            resend_interval: s.resend_interval || "5",
            ssl_warning_days: s.ssl_warning_days || "30",
            ignore_ssl_errors: s.ignore_ssl_errors === "true" || s.ignore_ssl_errors === true,
            default_http_method: s.default_http_method || "GET",
            user_agent: s.user_agent || "Crystal-Heimdall/2.0 (+https://github.com/Crystal-Studio-Labs)",
            follow_redirects: s.follow_redirects === "true" || s.follow_redirects === true || s.follow_redirects === undefined,
            accepted_status_codes: s.accepted_status_codes || "200-299, 301, 302",
            telemetry_retention_days: s.telemetry_retention_days || "30",
          });
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingStatus(false));
  }, []);

  const handleSaveStatusSettings = async () => {
    setIsSavingStatus(true);
    try {
      const res = await fetch("/api/v1/status/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...statusSettings,
          show_sla: String(statusSettings.show_sla),
          show_incidents: String(statusSettings.show_incidents),
        }),
      });

      if (res.ok) {
        toast.success("Status page settings updated successfully!");
      } else {
        toast.error("Failed to save settings");
      }
    } catch {
      toast.error("Network error while saving settings");
    } finally {
      setIsSavingStatus(false);
    }
  };

  const handleSaveAdvancedSettings = async () => {
    setIsSavingAdvanced(true);
    try {
      const res = await fetch("/api/v1/status/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...advancedSettings,
          ignore_ssl_errors: String(advancedSettings.ignore_ssl_errors),
          follow_redirects: String(advancedSettings.follow_redirects),
        }),
      });

      if (res.ok) {
        toast.success("Uptime Kuma advanced configuration saved!");
      } else {
        toast.error("Failed to save advanced settings");
      }
    } catch {
      toast.error("Network error while saving advanced settings");
    } finally {
      setIsSavingAdvanced(false);
    }
  };

  const handlePurgeAction = async (action: string, label: string) => {
    setIsPurging(true);
    try {
      const res = await fetch("/api/v1/status/purge-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || `${label} executed nominal!`);
      } else {
        toast.error(data.error || "Failed to execute purge action");
      }
    } catch {
      toast.error("Network error executing maintenance action");
    } finally {
      setIsPurging(false);
    }
  };

  // Discord State
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState(
    localStorage.getItem("heimdall_discord_webhook") || ""
  );
  const [showDiscord, setShowDiscord] = useState(false);
  const [discordTesting, setDiscordTesting] = useState(false);
  const [discordStatus, setDiscordStatus] = useState<string | null>(null);

  // Telegram State
  const [telegramToken, setTelegramToken] = useState(
    localStorage.getItem("heimdall_telegram_token") || ""
  );
  const [telegramChatId, setTelegramChatId] = useState(
    localStorage.getItem("heimdall_telegram_chat_id") || ""
  );
  const [showTelegramToken, setShowTelegramToken] = useState(false);
  const [telegramTesting, setTelegramTesting] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<string | null>(null);

  // Inbound Snippet Tab
  const [activeSnippetTab, setActiveSnippetTab] = useState<"http" | "cron" | "curl">("http");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Snippet copied to clipboard");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTestDiscord = async () => {
    if (!discordWebhookUrl.trim()) {
      setDiscordStatus("Please enter a Discord Webhook URL first.");
      toast.error("Please enter a Discord Webhook URL");
      return;
    }
    setDiscordTesting(true);
    setDiscordStatus(null);
    try {
      localStorage.setItem("heimdall_discord_webhook", discordWebhookUrl.trim());
      const res = await fetch("/api/v1/channels/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "discord", webhookUrl: discordWebhookUrl.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setDiscordStatus("✅ Test embed dispatched successfully to your Discord channel!");
        toast.success("Test embed sent to Discord!");
      } else {
        setDiscordStatus(`❌ Dispatch failed: ${data.error || "Unknown error"}`);
        toast.error("Discord dispatch failed");
      }
    } catch (err: any) {
      setDiscordStatus(`❌ Network error: ${err.message}`);
      toast.error(err.message);
    } finally {
      setDiscordTesting(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!telegramToken.trim() || !telegramChatId.trim()) {
      setTelegramStatus("Please enter both Telegram Bot Token and Chat ID.");
      toast.error("Please enter Bot Token and Chat ID");
      return;
    }
    setTelegramTesting(true);
    setTelegramStatus(null);
    try {
      localStorage.setItem("heimdall_telegram_token", telegramToken.trim());
      localStorage.setItem("heimdall_telegram_chat_id", telegramChatId.trim());
      const res = await fetch("/api/v1/channels/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "telegram",
          token: telegramToken.trim(),
          chatId: telegramChatId.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTelegramStatus("✅ Test alert sent to Telegram chat!");
        toast.success("Test alert sent to Telegram!");
      } else {
        setTelegramStatus(`❌ Dispatch failed: ${data.error || "Unknown error"}`);
        toast.error("Telegram dispatch failed");
      }
    } catch (err: any) {
      setTelegramStatus(`❌ Network error: ${err.message}`);
      toast.error(err.message);
    } finally {
      setTelegramTesting(false);
    }
  };

  // Generic Webhook State
  const [genericWebhookUrl, setGenericWebhookUrl] = useState(
    localStorage.getItem("heimdall_generic_webhook") || ""
  );
  const [genericTesting, setGenericTesting] = useState(false);
  const [genericStatus, setGenericStatus] = useState<string | null>(null);

  const handleTestGenericWebhook = async () => {
    if (!genericWebhookUrl.trim()) {
      setGenericStatus("Please enter a Generic Webhook URL first.");
      toast.error("Please enter a Generic Webhook URL");
      return;
    }
    setGenericTesting(true);
    setGenericStatus(null);
    try {
      localStorage.setItem("heimdall_generic_webhook", genericWebhookUrl.trim());
      const res = await fetch("/api/v1/channels/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "generic", webhookUrl: genericWebhookUrl.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setGenericStatus("✅ Test alert successfully dispatched to generic webhook endpoint!");
        toast.success("Test payload delivered to generic webhook!");
      } else {
        setGenericStatus(`❌ Dispatch failed: ${data.message || data.error || "Unknown error"}`);
        toast.error("Generic webhook dispatch failed");
      }
    } catch (err: any) {
      setGenericStatus(`❌ Network error: ${err.message}`);
      toast.error(err.message);
    } finally {
      setGenericTesting(false);
    }
  };

  const snippets = {
    http: `// Inbound HTTP Exception Relay
fetch("https://status.crystalstudio.labs/api/v1/sink/YOUR_API_KEY", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: "Unhandled Exception: Order Processor",
    message: "Database query timed out during checkout transaction.",
    severity: "critical",
    stack: error.stack
  })
}).catch(console.error);`,
    cron: `#!/usr/bin/env bash
# Dead-Man's Switch Backup Runner
set -e

# Run your scheduled worker command
./run-nightly-backup.sh

# Ping Sentinel to signal nominal execution
curl -fsS -m 10 --retry 3 https://status.crystalstudio.labs/api/v1/ping/YOUR_API_KEY > /dev/null`,
    curl: `curl -X POST https://status.crystalstudio.labs/api/v1/sink/YOUR_API_KEY \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Manual Health Check",
    "message": "Endpoint alive and responding nominally.",
    "severity": "info"
  }'`,
  };

  return (
    <div className="min-h-screen bg-[#070a0f] text-zinc-100 flex flex-col font-mono relative overflow-hidden pb-24">
      <SEO 
        title="Control Deck Settings // Crystal Heimdall"
        description="Configure public status customization, Uptime Kuma poller defaults, TLS/SSL matrices, notification relays, and telemetry lifecycle."
        canonicalPath="/dashboard/settings"
        noIndex={true}
      />
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b-2 border-zinc-800">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs text-cyan-400 font-bold">
              <Sliders className="w-3.5 h-3.5" />
              <span>[CONFIGURATION & STATUS PAGE SETTINGS]</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase text-white tracking-tight">
              Control Deck Settings
            </h1>
            <p className="text-xs text-zinc-400 font-sans">
              Manage public status customization (Uptime Kuma style), notification conduits, and telemetry sinks.
            </p>
          </div>
        </div>

        {/* TOP TAB CONTROLS (INDUSTRIAL BRUTALIST ROCKER TABS) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {[
            { id: "status", label: "[01] STATUS PAGE EDITOR" },
            { id: "advanced", label: "[02] UPTIME KUMA ENGINE" },
            { id: "alerts", label: "[03] DISPATCH CONDUITS" },
            { id: "inbound", label: "[04] INBOUND SINKS" },
            { id: "security", label: "[05] ACCESS & SECURITY" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`p-3 text-xs font-bold font-mono border-2 transition-all text-center uppercase ${
                activeTab === tab.id
                  ? "bg-zinc-800 text-emerald-300 border-emerald-400 shadow-[3px_3px_0px_#000]"
                  : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: STATUS PAGE EDITOR (UPTIME KUMA STYLE) */}
        {activeTab === "status" && (
          <div className="space-y-6">
            <div className="bg-[#0b0f17] border-2 border-zinc-700 shadow-[4px_4px_0px_#000] p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-zinc-800 pb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-white uppercase">
                    Status Page Customizer (Uptime Kuma Style)
                  </h2>
                  <p className="text-xs text-zinc-400 font-sans">
                    Configure the title, description, maintenance announcement banner, SLA display, and footer.
                  </p>
                </div>
                <button
                  onClick={handleSaveStatusSettings}
                  disabled={isSavingStatus}
                  className="px-6 py-2.5 btn-primary text-xs flex items-center justify-center gap-2 self-start sm:self-auto"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingStatus ? "Saving..." : "[ SAVE SETTINGS ]"}</span>
                </button>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Field 1: Page Title */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase block">
                    STATUS PAGE TITLE
                  </label>
                  <input
                    type="text"
                    value={statusSettings.page_title}
                    onChange={(e) => setStatusSettings({ ...statusSettings, page_title: e.target.value })}
                    placeholder="Uptime Tracker For Crystal Studio Labs"
                    className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                  />
                  <span className="text-[10px] text-zinc-500">Displayed in browser title bar and main status header</span>
                </div>

                {/* Field 2: Subtitle / Description */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase block">
                    STATUS PAGE SUBTITLE
                  </label>
                  <input
                    type="text"
                    value={statusSettings.page_description}
                    onChange={(e) => setStatusSettings({ ...statusSettings, page_description: e.target.value })}
                    placeholder="Continuous Multi-Point Health Monitoring & Incident Status"
                    className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                  />
                  <span className="text-[10px] text-zinc-500">Subtitle displayed under the hero banner</span>
                </div>
              </div>

              {/* ANNOUNCEMENT BANNER SECTION */}
              <div className="p-5 bg-black border-2 border-zinc-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase">// LIVE ANNOUNCEMENT BANNER //</h3>
                    <p className="text-[11px] text-zinc-400 font-sans">
                      Display scheduled maintenance, emergency broadcast, or operational notice.
                    </p>
                  </div>

                  {/* Banner Type Selector */}
                  <div className="flex border border-zinc-700 bg-zinc-900 p-0.5 text-[10px]">
                    {[
                      { id: "none", label: "OFF" },
                      { id: "info", label: "INFO" },
                      { id: "warning", label: "WARNING" },
                      { id: "critical", label: "OUTAGE" },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setStatusSettings({ ...statusSettings, announcement_type: mode.id as any })}
                        className={`px-3 py-1 font-bold uppercase transition ${
                          statusSettings.announcement_type === mode.id
                            ? mode.id === "critical"
                              ? "bg-rose-600 text-white"
                              : mode.id === "warning"
                              ? "bg-amber-500 text-black"
                              : mode.id === "info"
                              ? "bg-cyan-400 text-black"
                              : "bg-zinc-700 text-white"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <textarea
                    rows={3}
                    value={statusSettings.announcement_banner}
                    onChange={(e) => setStatusSettings({ ...statusSettings, announcement_banner: e.target.value })}
                    placeholder="e.g. All core systems nominal. Scheduled database index maintenance completed with zero downtime."
                    className="w-full p-2.5 bg-zinc-950 border-2 border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none resize-none"
                  />
                </div>

                {/* Live Preview Box */}
                {statusSettings.announcement_type !== "none" && statusSettings.announcement_banner && (
                  <div className="space-y-1 pt-2">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold">LIVE BANNER PREVIEW:</span>
                    <div
                      className={`p-3.5 border-2 flex items-start gap-3 ${
                        statusSettings.announcement_type === "critical"
                          ? "bg-rose-950/40 border-rose-600 text-rose-300"
                          : statusSettings.announcement_type === "warning"
                          ? "bg-amber-950/40 border-amber-500 text-amber-300"
                          : "bg-cyan-950/40 border-cyan-500 text-cyan-300"
                      }`}
                    >
                      {statusSettings.announcement_type === "critical" ? (
                        <Flame className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                      ) : statusSettings.announcement_type === "warning" ? (
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-cyan-400 mt-0.5" />
                      )}
                      <div>
                        <span className="font-bold text-[11px] uppercase mr-2">
                          [{statusSettings.announcement_type.toUpperCase()} NOTICE]:
                        </span>
                        <span className="text-xs">{statusSettings.announcement_banner}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* TOGGLES & DISPLAY CONTROLS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <label className="p-4 bg-zinc-950 border-2 border-zinc-800 flex items-center justify-between cursor-pointer hover:border-zinc-700">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-white block uppercase">Display 30-Day Fleet SLA</span>
                    <span className="text-[11px] text-zinc-500 font-sans block">Show calculated uptime percentage on public page</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={statusSettings.show_sla}
                    onChange={(e) => setStatusSettings({ ...statusSettings, show_sla: e.target.checked })}
                    className="w-4 h-4 accent-emerald-400 cursor-pointer"
                  />
                </label>

                <label className="p-4 bg-zinc-950 border-2 border-zinc-800 flex items-center justify-between cursor-pointer hover:border-zinc-700">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-white block uppercase">Display Incident History</span>
                    <span className="text-[11px] text-zinc-500 font-sans block">Show recent incidents and outage ledger</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={statusSettings.show_incidents}
                    onChange={(e) => setStatusSettings({ ...statusSettings, show_incidents: e.target.checked })}
                    className="w-4 h-4 accent-emerald-400 cursor-pointer"
                  />
                </label>
              </div>

              {/* FOOTER & SUPPORT URL */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase block">
                    CUSTOM FOOTER TEXT
                  </label>
                  <input
                    type="text"
                    value={statusSettings.footer_text}
                    onChange={(e) => setStatusSettings({ ...statusSettings, footer_text: e.target.value })}
                    placeholder="Crystal Studio Labs • Autonomous Reliability Sentinel"
                    className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase block">
                    ORGANIZATION SUPPORT URL
                  </label>
                  <input
                    type="text"
                    value={statusSettings.support_url}
                    onChange={(e) => setStatusSettings({ ...statusSettings, support_url: e.target.value })}
                    placeholder="https://github.com/Crystal-Studio-Labs"
                    className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: UPTIME KUMA ADVANCED ENGINE & RETENTION */}
        {activeTab === "advanced" && (
          <div className="space-y-6">
            <div className="bg-[#0b0f17] border-2 border-zinc-700 shadow-[4px_4px_0px_#000] p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-zinc-800 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 text-xs text-cyan-400 font-bold">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    <span>[CORE ENGINE SPECIFICATION & PROBE DEFAULTS]</span>
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-white uppercase">
                    Uptime Kuma Engine & Advanced Poller Settings
                  </h2>
                  <p className="text-xs text-zinc-400 font-sans">
                    Configure polling timeouts, retry backoffs, SSL certificate monitoring thresholds, and telemetry lifecycle.
                  </p>
                </div>
                <button
                  onClick={handleSaveAdvancedSettings}
                  disabled={isSavingAdvanced}
                  className="px-6 py-2.5 btn-primary text-xs flex items-center justify-center gap-2 self-start sm:self-auto"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingAdvanced ? "Saving..." : "[ SAVE ENGINE CONFIG ]"}</span>
                </button>
              </div>

              {/* SECTION 1: POLLER DAEMON HEARTBEAT & TIMEOUTS */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase text-cyan-400 border-b border-zinc-800 pb-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>01 / Poller Heartbeat & Backoff Intervals</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase block">
                      DEFAULT INTERVAL (SEC)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="86400"
                      value={advancedSettings.default_poll_interval}
                      onChange={(e) => setAdvancedSettings({ ...advancedSettings, default_poll_interval: e.target.value })}
                      className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                    />
                    <span className="text-[10px] text-zinc-500">Global probe cycle frequency (Default: 60s)</span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase block">
                      TIMEOUT THRESHOLD (SEC)
                    </label>
                    <input
                      type="number"
                      min="2"
                      max="120"
                      value={advancedSettings.default_timeout}
                      onChange={(e) => setAdvancedSettings({ ...advancedSettings, default_timeout: e.target.value })}
                      className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                    />
                    <span className="text-[10px] text-zinc-500">Connection read & TLS handshake timeout</span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase block">
                      MAX RETRY ATTEMPTS
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={advancedSettings.max_retries}
                      onChange={(e) => setAdvancedSettings({ ...advancedSettings, max_retries: e.target.value })}
                      className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                    />
                    <span className="text-[10px] text-zinc-500">Consecutive failures before tripping incident</span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase block">
                      RESEND ALERT COOLDOWN (MIN)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="1440"
                      value={advancedSettings.resend_interval}
                      onChange={(e) => setAdvancedSettings({ ...advancedSettings, resend_interval: e.target.value })}
                      className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                    />
                    <span className="text-[10px] text-zinc-500">Repeat dispatch rate for continuing outages</span>
                  </div>
                </div>
              </div>

              {/* SECTION 2: TLS / SSL CERTIFICATE INSPECTION */}
              <div className="space-y-3 pt-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase text-amber-400 border-b border-zinc-800 pb-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span>02 / TLS / SSL Certificate Validation Matrix</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase block">
                      CERTIFICATE EXPIRY ALERT WINDOW (DAYS)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={advancedSettings.ssl_warning_days}
                      onChange={(e) => setAdvancedSettings({ ...advancedSettings, ssl_warning_days: e.target.value })}
                      className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-amber-400 outline-none"
                    />
                    <span className="text-[10px] text-zinc-500">Trigger proactive warning when cert expires within N days (Default: 30)</span>
                  </div>

                  <label className="p-4 bg-zinc-950 border-2 border-zinc-800 flex items-center justify-between cursor-pointer hover:border-zinc-700">
                    <div className="space-y-0.5 pr-2">
                      <span className="text-xs font-bold text-white block uppercase">Ignore Invalid / Self-Signed SSL</span>
                      <span className="text-[11px] text-zinc-500 font-sans block">Permit self-signed certificates and hostname mismatches without marking service offline</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={advancedSettings.ignore_ssl_errors}
                      onChange={(e) => setAdvancedSettings({ ...advancedSettings, ignore_ssl_errors: e.target.checked })}
                      className="w-4 h-4 accent-amber-400 cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* SECTION 3: HTTP PROBE DEFAULTS & ASSERTIONS */}
              <div className="space-y-3 pt-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase text-emerald-400 border-b border-zinc-800 pb-1.5">
                  <Server className="w-3.5 h-3.5" />
                  <span>03 / HTTP Protocol Specifications & Assertions</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase block">
                      DEFAULT HTTP METHOD
                    </label>
                    <select
                      value={advancedSettings.default_http_method}
                      onChange={(e) => setAdvancedSettings({ ...advancedSettings, default_http_method: e.target.value })}
                      className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-emerald-400 outline-none"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="HEAD">HEAD</option>
                      <option value="PUT">PUT</option>
                      <option value="PATCH">PATCH</option>
                    </select>
                    <span className="text-[10px] text-zinc-500">Method used for generic URL endpoints</span>
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase block">
                      CUSTOM USER-AGENT HEADER
                    </label>
                    <input
                      type="text"
                      value={advancedSettings.user_agent}
                      onChange={(e) => setAdvancedSettings({ ...advancedSettings, user_agent: e.target.value })}
                      className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-emerald-400 outline-none"
                    />
                    <span className="text-[10px] text-zinc-500">Sent with all automated synthetic ping requests</span>
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase block">
                      ACCEPTED HTTP STATUS CODES
                    </label>
                    <input
                      type="text"
                      value={advancedSettings.accepted_status_codes}
                      onChange={(e) => setAdvancedSettings({ ...advancedSettings, accepted_status_codes: e.target.value })}
                      placeholder="200-299, 301, 302"
                      className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-emerald-400 outline-none"
                    />
                    <span className="text-[10px] text-zinc-500">Ranges and comma-separated codes treated as healthy</span>
                  </div>

                  <label className="p-4 bg-zinc-950 border-2 border-zinc-800 flex items-center justify-between cursor-pointer hover:border-zinc-700">
                    <div className="space-y-0.5 pr-2">
                      <span className="text-xs font-bold text-white block uppercase">Follow HTTP Redirects</span>
                      <span className="text-[11px] text-zinc-500 font-sans block">Automatically follow 301/302 redirects up to 5 hops</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={advancedSettings.follow_redirects}
                      onChange={(e) => setAdvancedSettings({ ...advancedSettings, follow_redirects: e.target.checked })}
                      className="w-4 h-4 accent-emerald-400 cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* SECTION 4: DATA RETENTION & SQLITE MAINTENANCE */}
              <div className="space-y-4 pt-3 border-t-2 border-zinc-800">
                <div className="flex items-center gap-2 text-xs font-black uppercase text-red-400">
                  <Database className="w-3.5 h-3.5" />
                  <span>04 / Data Retention Policy & Maintenance Center</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase block">
                      TELEMETRY RETENTION (DAYS)
                    </label>
                    <input
                      type="number"
                      min="7"
                      max="365"
                      value={advancedSettings.telemetry_retention_days}
                      onChange={(e) => setAdvancedSettings({ ...advancedSettings, telemetry_retention_days: e.target.value })}
                      className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-red-400 outline-none"
                    />
                    <span className="text-[10px] text-zinc-500">Purge heartbeats older than N days</span>
                  </div>

                  <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3 self-center pt-1">
                    <button
                      onClick={() => handlePurgeAction("purge_resolved_incidents", "Purge Incidents")}
                      disabled={isPurging}
                      className="p-3 bg-zinc-950 border-2 border-zinc-800 hover:border-amber-500/80 hover:bg-zinc-900 text-zinc-300 hover:text-white transition flex flex-col items-center justify-center gap-1.5 text-center group"
                    >
                      <Trash2 className="w-4 h-4 text-zinc-400 group-hover:text-amber-400" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">[ PURGE RESOLVED INCIDENTS ]</span>
                    </button>

                    <button
                      onClick={() => handlePurgeAction("prune_telemetry", "Prune Telemetry")}
                      disabled={isPurging}
                      className="p-3 bg-zinc-950 border-2 border-zinc-800 hover:border-cyan-500/80 hover:bg-zinc-900 text-zinc-300 hover:text-white transition flex flex-col items-center justify-center gap-1.5 text-center group"
                    >
                      <Layers className="w-4 h-4 text-zinc-400 group-hover:text-cyan-400" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">[ PRUNE OLD TELEMETRY ]</span>
                    </button>

                    <button
                      onClick={() => handlePurgeAction("vacuum", "Vacuum Database")}
                      disabled={isPurging}
                      className="p-3 bg-zinc-950 border-2 border-zinc-800 hover:border-emerald-500/80 hover:bg-zinc-900 text-zinc-300 hover:text-white transition flex flex-col items-center justify-center gap-1.5 text-center group"
                    >
                      <Database className="w-4 h-4 text-zinc-400 group-hover:text-emerald-400" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">[ VACUUM SQLITE DATABASE ]</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: EMERGENCY RELAYS (DISCORD, TELEGRAM & GENERIC WEBHOOK) */}
        {activeTab === "alerts" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Discord */}
              <div className="bg-[#0b0f17] border-2 border-zinc-700 shadow-[4px_4px_0px_#000] p-6 space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-zinc-900 border-2 border-[#5865F2] flex items-center justify-center text-[#5865F2]">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-white text-sm uppercase">Discord Relay</h3>
                      <p className="text-[11px] text-zinc-400 font-sans">Rich embeds with severity & traces</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-zinc-400 block mb-1 font-bold uppercase">
                      DISCORD WEBHOOK URL
                    </label>
                    <div className="relative">
                      <input
                        type={showDiscord ? "text" : "password"}
                        placeholder="https://discord.com/api/webhooks/..."
                        value={discordWebhookUrl}
                        onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                        className="w-full p-2.5 bg-black border-2 border-zinc-700 pr-10 text-white font-mono text-xs focus:border-[#5865F2] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowDiscord(!showDiscord)}
                        className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300"
                      >
                        {showDiscord ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {discordStatus && (
                    <div className="p-3 bg-black border border-zinc-800 text-[11px] font-mono">
                      {discordStatus}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t-2 border-zinc-800">
                  <button
                    onClick={handleTestDiscord}
                    disabled={discordTesting}
                    className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 border-2 border-[#5865F2] text-[#a5b4fc] text-xs font-bold uppercase flex items-center justify-center gap-2 active:translate-x-[1px] active:translate-y-[1px]"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{discordTesting ? "Dispatching..." : "Send Test Discord"}</span>
                  </button>
                </div>
              </div>

              {/* Telegram */}
              <div className="bg-[#0b0f17] border-2 border-zinc-700 shadow-[4px_4px_0px_#000] p-6 space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-zinc-900 border-2 border-[#229ED9] flex items-center justify-center text-[#229ED9]">
                      <Send className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-white text-sm uppercase">Telegram Bot</h3>
                      <p className="text-[11px] text-zinc-400 font-sans">Instant mobile push notifications</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-mono text-zinc-400 block mb-1 font-bold uppercase">
                        TELEGRAM BOT TOKEN
                      </label>
                      <div className="relative">
                        <input
                          type={showTelegramToken ? "text" : "password"}
                          placeholder="123456789:ABCdefGhIJKlmNoPQRstuVWxyz"
                          value={telegramToken}
                          onChange={(e) => setTelegramToken(e.target.value)}
                          className="w-full p-2.5 bg-black border-2 border-zinc-700 pr-10 text-white font-mono text-xs focus:border-[#229ED9] outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowTelegramToken(!showTelegramToken)}
                          className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300"
                        >
                          {showTelegramToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-mono text-zinc-400 block mb-1 font-bold uppercase">
                        TARGET CHAT ID
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 987654321"
                        value={telegramChatId}
                        onChange={(e) => setTelegramChatId(e.target.value)}
                        className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-[#229ED9] outline-none"
                      />
                    </div>
                  </div>

                  {telegramStatus && (
                    <div className="p-3 bg-black border border-zinc-800 text-[11px] font-mono">
                      {telegramStatus}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t-2 border-zinc-800">
                  <button
                    onClick={handleTestTelegram}
                    disabled={telegramTesting}
                    className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 border-2 border-[#229ED9] text-[#7dd3fc] text-xs font-bold uppercase flex items-center justify-center gap-2 active:translate-x-[1px] active:translate-y-[1px]"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{telegramTesting ? "Dispatching..." : "Send Test Telegram"}</span>
                  </button>
                </div>
              </div>

              {/* Generic Webhook */}
              <div className="bg-[#0b0f17] border-2 border-zinc-700 shadow-[4px_4px_0px_#000] p-6 space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-zinc-900 border-2 border-emerald-500 flex items-center justify-center text-emerald-400">
                      <Webhook className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-white text-sm uppercase">Generic Webhook</h3>
                      <p className="text-[11px] text-zinc-400 font-sans">Slack, n8n, Zapier & custom relays</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-zinc-400 block mb-1 font-bold uppercase">
                      WEBHOOK ENDPOINT URL
                    </label>
                    <input
                      type="text"
                      placeholder="https://hooks.slack.com/... or https://n8n.internal/..."
                      value={genericWebhookUrl}
                      onChange={(e) => setGenericWebhookUrl(e.target.value)}
                      className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-emerald-400 outline-none"
                    />
                    <span className="text-[10px] text-zinc-500 mt-1 block">Receives standard structured JSON incident alerts</span>
                  </div>

                  {genericStatus && (
                    <div className="p-3 bg-black border border-zinc-800 text-[11px] font-mono">
                      {genericStatus}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t-2 border-zinc-800">
                  <button
                    onClick={handleTestGenericWebhook}
                    disabled={genericTesting}
                    className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 border-2 border-emerald-500 text-emerald-300 text-xs font-bold uppercase flex items-center justify-center gap-2 active:translate-x-[1px] active:translate-y-[1px]"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{genericTesting ? "Dispatching..." : "Send Test Webhook"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Dynamic Badges & RSS Feed Hub */}
            <div className="bg-[#0b0f17] border-2 border-zinc-700 shadow-[4px_4px_0px_#000] p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-zinc-800 pb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 bg-zinc-900 border-2 border-cyan-500 flex items-center justify-center text-cyan-400">
                    <Rss className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-white uppercase">
                      Dynamic SVG Badges & Public Incident RSS Feed
                    </h2>
                    <p className="text-xs text-zinc-400 font-sans">
                      Embed live status shields into GitHub READMEs and subscribe via RSS readers.
                    </p>
                  </div>
                </div>

                <a
                  href="/status/feed.xml"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-zinc-900 border border-zinc-700 hover:border-cyan-400 text-cyan-300 text-xs font-bold uppercase flex items-center gap-1.5 self-start sm:self-auto transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>[ OPEN RSS FEED XML ]</span>
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* SVG Status Badge Preview & Markdown */}
                <div className="space-y-3 p-4 bg-black border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-emerald-400" />
                      Dynamic Status Shield
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">Shields.io Compatible</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 py-2">
                    <img src="/api/v1/badges/fleet/status.svg" alt="Fleet Status Badge" className="h-5" />
                    <img src="/api/v1/badges/fleet/status.svg?metric=uptime" alt="Fleet Uptime Badge" className="h-5" />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold">README Embed Markdown:</span>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={`![Status](${window.location.origin}/api/v1/badges/fleet/status.svg)`}
                        className="w-full p-2 bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300 font-mono outline-none"
                      />
                      <button
                        onClick={() => handleCopy("badge", `![Status](${window.location.origin}/api/v1/badges/fleet/status.svg)`)}
                        className="px-3 py-2 bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-bold shrink-0"
                      >
                        {copiedKey === "badge" ? "COPIED" : "COPY"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* RSS Incident Feed */}
                <div className="space-y-3 p-4 bg-black border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
                      <Rss className="w-3.5 h-3.5 text-cyan-400" />
                      Incident RSS 2.0 Feed
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">Live Syndicate</span>
                  </div>

                  <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                    External incident management systems, Slack RSS integrations, and reader clients can subscribe directly to this endpoint:
                  </p>

                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold">Public Feed URL:</span>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={`${window.location.origin}/status/feed.xml`}
                        className="w-full p-2 bg-zinc-950 border border-zinc-800 text-[11px] text-cyan-300 font-mono outline-none"
                      />
                      <button
                        onClick={() => handleCopy("rss", `${window.location.origin}/status/feed.xml`)}
                        className="px-3 py-2 bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-bold shrink-0"
                      >
                        {copiedKey === "rss" ? "COPIED" : "COPY"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: INBOUND SINKS */}
        {activeTab === "inbound" && (
          <div className="bg-[#0b0f17] border-2 border-zinc-700 shadow-[4px_4px_0px_#000] p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-zinc-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 bg-zinc-900 border-2 border-emerald-500 flex items-center justify-center text-emerald-400">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-white uppercase">
                    Inbound Telemetry Sinks & Dead-Man Hooks
                  </h2>
                  <p className="text-xs text-zinc-400 font-sans">
                    Integrate your workers, cron jobs, and error reporters into the Sentinel ledger.
                  </p>
                </div>
              </div>

              {/* Protocol Tabs */}
              <div className="flex border border-zinc-700 bg-zinc-900 p-0.5 text-xs font-mono">
                {[
                  { id: "http", label: "HTTP EXCEPTION SINK" },
                  { id: "cron", label: "CRON DEAD-MAN PING" },
                  { id: "curl", label: "TERMINAL CURL" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveSnippetTab(t.id as any)}
                    className={`px-3 py-1 uppercase text-[10px] font-bold transition ${
                      activeSnippetTab === t.id
                        ? "bg-zinc-700 text-white"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-zinc-400 flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  {activeSnippetTab === "http"
                    ? "Inbound HTTP POST Crash Webhook"
                    : activeSnippetTab === "cron"
                    ? "Shell / Cron Heartbeat Dead-Man Switch"
                    : "cURL Terminal Test"}
                </span>

                <button
                  onClick={() => handleCopy(activeSnippetTab, snippets[activeSnippetTab])}
                  className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-600 text-xs font-mono flex items-center gap-1.5"
                >
                  {copiedKey === activeSnippetTab ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedKey === activeSnippetTab ? "Copied" : "Copy Snippet"}</span>
                </button>
              </div>

              <pre className="p-4 bg-black border-2 border-zinc-800 text-emerald-300 font-mono text-xs overflow-x-auto leading-relaxed shadow-inner">
                {snippets[activeSnippetTab]}
              </pre>
            </div>
          </div>
        )}

        {/* TAB 4: ACCESS & SECURITY */}
        {activeTab === "security" && (
          <div className="bg-[#0b0f17] border-2 border-emerald-500/50 shadow-[4px_4px_0px_#000] p-6 sm:p-8 space-y-4">
            <div className="flex items-center space-x-3">
              <Shield className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-black text-white uppercase font-mono">
                SECURITY & 2FA-ONLY OPERATOR ACCESS SPECIFICATION
              </h2>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed font-sans">
              Crystal-Heimdall strictly isolates operator commands behind direct Two-Factor Authentication (2FA Only). There are no master passcodes and no GitHub OAuth dependencies. Operators authenticate directly using a rolling 6-digit Time-based One-Time Password (RFC 6238 TOTP) from Google Authenticator, Ente Auth, or 1Password. In development and testing environments, bypass code <code className="text-emerald-400 font-mono font-bold">000000</code> is accepted.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
