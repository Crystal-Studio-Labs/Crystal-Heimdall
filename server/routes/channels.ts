import { Router, Request, Response } from "express";
import {
  sendTelegramAlert,
  sendDiscordWebhookAlert,
  sendGenericWebhookAlert,
  AlertPayload,
} from "../dispatcher.js";

const router = Router();

// In-Browser Webhook Conduit & Alert Dispatch Simulator
router.post("/test", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { 
      type, 
      token, 
      chatId, 
      webhookUrl,
      severity = "info",
      title,
      message,
      serviceName = "Heimdall Sentinel [SIMULATION]"
    } = req.body;

    const cleanSeverity: "info" | "warning" | "critical" = 
      ["info", "warning", "critical"].includes(severity) ? severity : "info";

    const payload: AlertPayload = {
      serviceName: String(serviceName).trim() || "Crystal Sentinel",
      severity: cleanSeverity,
      title: title ? String(title).trim() : `Conduit Simulator: ${cleanSeverity.toUpperCase()} Telemetry Probe`,
      message: message ? String(message).trim() : `Conduit test signal dispatched from Crystal Heimdall Command Deck at ${new Date().toISOString()}.`,
      timestamp: Date.now(),
    };

    if (type === "telegram") {
      const result = await sendTelegramAlert(payload, token, chatId);
      const latencyMs = Date.now() - startTime;
      return res.json({
        ...result,
        latencyMs,
        simulatedPayload: payload,
      });
    } else if (type === "discord") {
      const result = await sendDiscordWebhookAlert(payload, webhookUrl);
      const latencyMs = Date.now() - startTime;
      return res.json({
        ...result,
        latencyMs,
        simulatedPayload: payload,
      });
    } else if (type === "generic" || type === "webhook") {
      const result = await sendGenericWebhookAlert(payload, webhookUrl);
      const latencyMs = Date.now() - startTime;
      return res.json({
        ...result,
        latencyMs,
        simulatedPayload: payload,
      });
    }

    return res.status(400).json({ error: "Invalid type. Must be 'telegram', 'discord', or 'generic'." });
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return res.status(500).json({ 
      error: "Test dispatch failed", 
      details: err.message,
      latencyMs 
    });
  }
});

export default router;
