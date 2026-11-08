import React, { useState } from "react";
import { Mail, Webhook, X, CheckCircle2, AlertCircle, ShieldCheck, Send, Bell, Smartphone } from "lucide-react";
import { useToast } from "../lib/ToastContext";

interface SubscribeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function SubscribeModal({ isOpen, onClose }: SubscribeModalProps) {
  const toast = useToast();
  const [channel, setChannel] = useState<"email" | "webhook" | "webpush">("email");
  const [target, setTarget] = useState("");
  const [scope, setScope] = useState<"all" | "critical">("all");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subscriptionResult, setSubscriptionResult] = useState<{
    status: string;
    target: string;
    scope: string;
    token: string;
    message: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (channel === "webpush") {
      await handleEnableWebPush();
      return;
    }

    if (!target.trim()) {
      toast.error(channel === "email" ? "Please enter a valid email address." : "Please enter a webhook URL.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: channel,
          target: target.trim(),
          scope,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to register subscription");
      }

      setSubscriptionResult(data);
      toast.success(data.message || "Subscribed successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to subscribe to alerts.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnableWebPush = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      toast.error("Web Push is not supported by your current browser.");
      return;
    }

    setIsSubmitting(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Notification permission denied. Please enable notifications in your browser settings.");
      }

      const registration = await navigator.serviceWorker.ready;
      const vapidRes = await fetch("/api/v1/push/vapid-public-key");
      if (!vapidRes.ok) throw new Error("Failed to retrieve push encryption key from sentinel.");
      const { publicKey } = await vapidRes.json();

      const convertedKey = urlBase64ToUint8Array(publicKey);
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey,
        });
      }

      const res = await fetch("/api/v1/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          scope,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Push subscription registration failed");

      setSubscriptionResult({
        status: "subscribed",
        target: "This Browser Device (W3C Push Active)",
        scope,
        token: data.token,
        message: "Closed-browser push armed. You will receive native alert banners even when this tab is closed.",
      });
      toast.success("Native Web Push alerts armed successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to arm push notifications");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setSubscriptionResult(null);
    setTarget("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-mono">
      <div className="bg-[#0b0f17] border-2 border-zinc-700 shadow-[6px_6px_0px_#000] w-full max-w-md p-6 space-y-5 text-xs text-zinc-100 relative">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b-2 border-zinc-800 pb-3">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-emerald-400 inline-block animate-pulse" />
            <span className="font-black text-white text-sm uppercase tracking-wider">
              Subscribe to Status Updates
            </span>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            className="p-1 text-zinc-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {subscriptionResult ? (
          /* Success Screen */
          <div className="space-y-4 py-2">
            <div className="p-4 bg-emerald-950/60 border-2 border-emerald-500 text-emerald-300 space-y-2">
              <div className="flex items-center space-x-2 font-black text-xs uppercase">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>Subscription Confirmed</span>
              </div>
              <p className="font-sans text-xs text-zinc-300 leading-relaxed">
                {subscriptionResult.message}
              </p>
            </div>

            <div className="bg-black border border-zinc-800 p-3 space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-zinc-500 uppercase">Target:</span>
                <span className="text-white font-bold">{subscriptionResult.target}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 uppercase">Alert Scope:</span>
                <span className="text-cyan-400 font-bold uppercase">{subscriptionResult.scope} Incidents</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 uppercase">Conduit:</span>
                <span className="text-zinc-300 font-bold uppercase">{channel}</span>
              </div>
            </div>

            <p className="text-[10px] text-zinc-500 font-sans leading-relaxed">
              Every dispatched alert includes a zero-friction 1-click unsubscribe conduit. You can revoke this subscription at any time.
            </p>

            <button
              type="button"
              onClick={handleResetAndClose}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-wider text-xs shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
            >
              [ DISMISS &amp; RETURN ]
            </button>
          </div>
        ) : (
          /* Subscription Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-zinc-400 font-sans text-xs leading-relaxed">
              Get notified immediately via Web Push, Email, or Webhook whenever a monitored service degrades or goes offline.
            </p>

            {/* Channel Tabs */}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setChannel("email")}
                className={`py-2 px-2 border text-[11px] font-bold uppercase flex flex-col sm:flex-row items-center justify-center gap-1.5 transition ${
                  channel === "email"
                    ? "bg-zinc-800 border-emerald-400 text-white shadow-[2px_2px_0px_#000]"
                    : "bg-black/50 border-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                <Mail className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Email</span>
              </button>

              <button
                type="button"
                onClick={() => setChannel("webpush")}
                className={`py-2 px-2 border text-[11px] font-bold uppercase flex flex-col sm:flex-row items-center justify-center gap-1.5 transition ${
                  channel === "webpush"
                    ? "bg-zinc-800 border-amber-400 text-white shadow-[2px_2px_0px_#000]"
                    : "bg-black/50 border-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                <Bell className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Web Push</span>
              </button>

              <button
                type="button"
                onClick={() => setChannel("webhook")}
                className={`py-2 px-2 border text-[11px] font-bold uppercase flex flex-col sm:flex-row items-center justify-center gap-1.5 transition ${
                  channel === "webhook"
                    ? "bg-zinc-800 border-cyan-400 text-white shadow-[2px_2px_0px_#000]"
                    : "bg-black/50 border-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                <Webhook className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Webhook</span>
              </button>
            </div>

            {/* Web Push Explainer vs Input Form */}
            {channel === "webpush" ? (
              <div className="p-3.5 bg-black border border-amber-500/60 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold uppercase text-[11px]">
                  <Smartphone className="w-4 h-4 shrink-0" />
                  <span>CLOSED-BROWSER PUSH NOTIFICATIONS</span>
                </div>
                <p className="text-zinc-300 font-sans text-xs leading-relaxed">
                  Arms native W3C Web Push on this device. You will receive real-time incident alerts even when this browser tab or app is completely closed.
                </p>
                <div className="text-[10px] text-zinc-500 font-mono">
                  Supported on Chrome, Edge, Firefox, Android, &amp; iOS 16.4+ (PWA).
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-400 uppercase font-bold block">
                  {channel === "email" ? "Email Address" : "Webhook Endpoint URL"}
                </label>
                <input
                  type={channel === "email" ? "email" : "url"}
                  required
                  placeholder={channel === "email" ? "operator@crystalstudiolabs.org" : "https://api.yourdomain.com/incident-webhook"}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="w-full bg-black border-2 border-zinc-700 text-white p-2.5 text-xs focus:border-cyan-400 focus:outline-none"
                />
              </div>
            )}

            {/* Scope Selection */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-400 uppercase font-bold block">
                Notification Scope
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScope("all")}
                  className={`p-2 border text-left transition ${
                    scope === "all"
                      ? "bg-zinc-800 border-zinc-400 text-white"
                      : "bg-black border-zinc-800 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <div className="font-bold text-[11px] uppercase">ALL INCIDENTS</div>
                  <div className="text-[10px] text-zinc-400 font-sans">Degraded &amp; Outage notices</div>
                </button>

                <button
                  type="button"
                  onClick={() => setScope("critical")}
                  className={`p-2 border text-left transition ${
                    scope === "critical"
                      ? "bg-zinc-800 border-zinc-400 text-white"
                      : "bg-black border-zinc-800 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <div className="font-bold text-[11px] uppercase text-rose-400">CRITICAL ONLY</div>
                  <div className="text-[10px] text-zinc-400 font-sans">Major total outages only</div>
                </button>
              </div>
            </div>

            {/* Submit CTA */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-2.5 font-black uppercase tracking-wider text-xs shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center space-x-2 transition ${
                channel === "webpush"
                  ? "bg-amber-400 hover:bg-amber-300 text-black"
                  : "bg-emerald-500 hover:bg-emerald-400 text-black"
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {isSubmitting
                  ? "ARMING CONDUIT..."
                  : channel === "webpush"
                  ? "ARM THIS DEVICE FOR ALERTS"
                  : "CONFIRM SUBSCRIPTION"}
              </span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
