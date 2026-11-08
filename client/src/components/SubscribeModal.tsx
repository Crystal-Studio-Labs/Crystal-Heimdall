import React, { useState } from "react";
import { Mail, Webhook, X, CheckCircle2, AlertCircle, ShieldCheck, Send } from "lucide-react";
import { useToast } from "../lib/ToastContext";

interface SubscribeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SubscribeModal({ isOpen, onClose }: SubscribeModalProps) {
  const toast = useToast();
  const [channel, setChannel] = useState<"email" | "webhook">("email");
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
              Get notified immediately via Email or Webhook whenever a monitored service degrades or goes offline.
            </p>

            {/* Channel Tabs */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setChannel("email")}
                className={`py-2 px-3 border text-xs font-bold uppercase flex items-center justify-center gap-2 transition ${
                  channel === "email"
                    ? "bg-zinc-800 border-emerald-400 text-white shadow-[2px_2px_0px_#000]"
                    : "bg-black/50 border-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                <Mail className="w-3.5 h-3.5 text-emerald-400" />
                <span>Email Alerts</span>
              </button>

              <button
                type="button"
                onClick={() => setChannel("webhook")}
                className={`py-2 px-3 border text-xs font-bold uppercase flex items-center justify-center gap-2 transition ${
                  channel === "webhook"
                    ? "bg-zinc-800 border-cyan-400 text-white shadow-[2px_2px_0px_#000]"
                    : "bg-black/50 border-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                <Webhook className="w-3.5 h-3.5 text-cyan-400" />
                <span>Webhook Relay</span>
              </button>
            </div>

            {/* Destination Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-400 font-bold uppercase block">
                {channel === "email" ? "Email Address" : "Webhook URL (Discord / Slack / Generic)"}
              </label>
              <input
                type={channel === "email" ? "email" : "url"}
                placeholder={
                  channel === "email"
                    ? "engineer@crystalstudiolabs.org"
                    : "https://discord.com/api/webhooks/..."
                }
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                required
                className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white text-xs outline-none focus:border-cyan-400 font-mono"
              />
              <span className="text-[10px] text-zinc-500 block">
                {channel === "email"
                  ? "We never spam. You only receive operational and incident notices."
                  : "Receives raw structured JSON incident payloads in real time."}
              </span>
            </div>

            {/* Scope Selection */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-400 font-bold uppercase block">
                Notification Sensitivity
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScope("all")}
                  className={`p-2 border text-[11px] font-bold uppercase text-left transition ${
                    scope === "all"
                      ? "bg-zinc-900 border-emerald-400 text-emerald-300"
                      : "bg-black border-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  <span className="block font-black">[ ALL INCIDENTS ]</span>
                  <span className="text-[9px] text-zinc-500 font-normal block mt-0.5">
                    Warnings &amp; outages
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setScope("critical")}
                  className={`p-2 border text-[11px] font-bold uppercase text-left transition ${
                    scope === "critical"
                      ? "bg-zinc-900 border-rose-500 text-rose-300"
                      : "bg-black border-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  <span className="block font-black">[ CRITICAL ONLY ]</span>
                  <span className="text-[9px] text-zinc-500 font-normal block mt-0.5">
                    Total target downtime
                  </span>
                </button>
              </div>
            </div>

            {/* Submit & Cancel Buttons */}
            <div className="pt-2 flex items-center justify-end space-x-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="px-3 py-2 bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-bold uppercase"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-xs font-black uppercase flex items-center gap-1.5 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? "Subscribing..." : "Subscribe"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
