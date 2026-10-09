import { Router, Request, Response } from "express";
import { sendTelegramAlert, sendDiscordWebhookAlert } from "../dispatcher.js";

const router = Router();

router.post("/test", async (req: Request, res: Response) => {
  try {
    const { type, token, chatId, webhookUrl } = req.body;

    if (type === "telegram") {
      const result = await sendTelegramAlert(
        {
          serviceName: "Heimdall Sentinel",
          severity: "info",
          title: "Telegram Relay Connectivity Verified",
          message: "All operational conduits active. Crystal Studio Labs monitoring connected.",
        },
        token,
        chatId
      );
      return res.json(result);
    } else if (type === "discord") {
      const result = await sendDiscordWebhookAlert(
        {
          serviceName: "Heimdall Sentinel",
          severity: "info",
          title: "Discord Webhook Embed Verified",
          message: "Discord embed channel connected. Live status updates will stream here.",
        },
        webhookUrl
      );
      return res.json(result);
    }

    return res.status(400).json({ error: "Invalid type. Must be 'telegram' or 'discord'." });
  } catch (err: any) {
    return res.status(500).json({ error: "Test dispatch failed", details: err.message });
  }
});

export default router;
