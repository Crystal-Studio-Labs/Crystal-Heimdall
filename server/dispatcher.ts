export interface AlertPayload {
  serviceName: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message?: string;
  timestamp?: number;
}

export async function sendTelegramAlert(
  payload: AlertPayload,
  customToken?: string,
  customChatId?: string
): Promise<{ success: boolean; message: string }> {
  const token = customToken || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = customChatId || process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return {
      success: false,
      message: "Telegram credentials missing (set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID)",
    };
  }

  const emoji =
    payload.severity === "critical" ? "🔴 [CRITICAL]" : payload.severity === "warning" ? "🟡 [WARNING]" : "🟢 [INFO]";

  const text = `${emoji} *CRYSTAL-HEIMDALL ALERT*\n\n` +
    `*Service:* \`${payload.serviceName}\`\n` +
    `*Issue:* *${payload.title}*\n` +
    (payload.message ? `*Details:* ${payload.message}\n` : "") +
    `*Time:* \`${new Date(payload.timestamp || Date.now()).toISOString()}\``;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    });

    const data = (await res.json()) as any;
    if (!res.ok) {
      return { success: false, message: data.description || "Telegram API error" };
    }

    return { success: true, message: "Telegram alert dispatched." };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to reach Telegram API" };
  }
}

export async function sendDiscordWebhookAlert(
  payload: AlertPayload,
  customWebhookUrl?: string
): Promise<{ success: boolean; message: string }> {
  const webhookUrl = customWebhookUrl || process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    return {
      success: false,
      message: "Discord Webhook URL not configured (set DISCORD_WEBHOOK_URL)",
    };
  }

  const color =
    payload.severity === "critical"
      ? 0xff2a4b
      : payload.severity === "warning"
      ? 0xffb800
      : 0x00ff88;

  const embed = {
    title: `🚨 ${payload.severity.toUpperCase()}: ${payload.title}`,
    description: payload.message || "No contextual details provided.",
    color,
    fields: [
      { name: "Service", value: `\`${payload.serviceName}\``, inline: true },
      { name: "Severity", value: `**${payload.severity.toUpperCase()}**`, inline: true },
    ],
    footer: { text: "Crystal Studio Labs • Heimdall Watcher" },
    timestamp: new Date(payload.timestamp || Date.now()).toISOString(),
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Heimdall Sentinel",
        avatar_url: "https://raw.githubusercontent.com/feathericons/feather/master/icons/activity.svg",
        embeds: [embed],
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { success: false, message: `Discord error: ${errorText}` };
    }

    return { success: true, message: "Discord webhook alert delivered successfully." };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to deliver Discord webhook" };
  }
}

export async function sendGenericWebhookAlert(
  payload: AlertPayload,
  customWebhookUrl?: string
): Promise<{ success: boolean; message: string; statusCode?: number }> {
  const webhookUrl = customWebhookUrl || process.env.GENERIC_WEBHOOK_URL;

  if (!webhookUrl) {
    return {
      success: false,
      message: "Generic Webhook URL not configured (provide URL or set GENERIC_WEBHOOK_URL)",
    };
  }

  const standardPayload = {
    event: "incident_alert",
    service: payload.serviceName,
    severity: payload.severity,
    title: payload.title,
    message: payload.message || "No contextual details provided.",
    timestamp: new Date(payload.timestamp || Date.now()).toISOString(),
    source: "Crystal-Heimdall",
    text: `🚨 [${payload.severity.toUpperCase()}] ${payload.serviceName}: ${payload.title}\n${payload.message || ""}`,
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Crystal-Heimdall/2.0 (+https://github.com/Crystal-Studio-Labs)",
      },
      body: JSON.stringify(standardPayload),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        message: `Generic webhook endpoint returned HTTP ${res.status}: ${errText.substring(0, 100)}`,
        statusCode: res.status,
      };
    }

    return {
      success: true,
      message: "Generic webhook delivered successfully.",
      statusCode: res.status,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Failed to deliver generic webhook alert",
    };
  }
}

