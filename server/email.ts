/**
 * Transactional Email Driver for Crystal Heimdall
 * Supports Resend API (RESEND_API_KEY) and Dry-Run Audit Logging
 */

export interface IncidentEmailOptions {
  to: string;
  token: string;
  subscriberId: string;
  incidentId: string;
  subject: string;
  title: string;
  severity: "info" | "warning" | "critical";
  status: string;
  serviceName?: string;
  message?: string;
  timestamp?: string;
}

export interface EmailDeliveryResult {
  success: boolean;
  provider: "resend" | "smtp" | "dry-run";
  messageId?: string;
  error?: string;
}

export function generateBrutalistHtml(options: IncidentEmailOptions): string {
  const appUrl = (process.env.APP_URL || "https://status.crystalstudiolabs.org").replace(/\/$/, "");
  const unsubscribeUrl = `${appUrl}/api/v1/subscribers/${options.subscriberId}?token=${options.token}`;
  const statusPageUrl = `${appUrl}/status`;

  const severityColor =
    options.severity === "critical" || options.status === "outage"
      ? "#ef4444"
      : options.severity === "warning" || options.status === "degraded"
      ? "#f59e0b"
      : "#10b981";

  const severityBadgeBg =
    options.severity === "critical" || options.status === "outage"
      ? "rgba(239, 68, 68, 0.15)"
      : options.severity === "warning" || options.status === "degraded"
      ? "rgba(245, 158, 11, 0.15)"
      : "rgba(16, 185, 129, 0.15)";

  const time = options.timestamp || new Date().toISOString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title}</title>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #070a0f; color: #f1f5f9; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 13px; line-height: 1.5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 620px; margin: 0 auto; background-color: #0b101b; border: 2px solid ${severityColor}; box-shadow: 4px 4px 0px rgba(0,0,0,0.8);">
    <!-- Header -->
    <tr>
      <td style="padding: 16px 20px; background-color: #030712; border-bottom: 2px solid #1f2937;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size: 13px; font-weight: bold; letter-spacing: 0.15em; color: #06b6d4; text-transform: uppercase;">
              [ CRYSTAL HEIMDALL // FLEET INCIDENT TELEMETRY ]
            </td>
            <td align="right" style="font-size: 11px; color: #64748b;">
              ORG: CRYSTAL STUDIO LABS
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 24px 20px;">
        <!-- Status Pill -->
        <div style="display: inline-block; padding: 4px 10px; margin-bottom: 16px; background-color: ${severityBadgeBg}; border: 1px solid ${severityColor}; color: ${severityColor}; font-weight: bold; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase;">
          ● ${options.severity.toUpperCase()} ALERT // STATUS: ${options.status.toUpperCase()}
        </div>

        <h1 style="margin: 0 0 12px 0; font-size: 18px; color: #ffffff; font-weight: 700; letter-spacing: -0.01em;">
          ${options.title}
        </h1>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px; border-collapse: collapse; font-size: 12px;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; width: 140px; border-bottom: 1px solid #1f2937;">AFFECTED TARGET:</td>
            <td style="padding: 6px 0; color: #38bdf8; font-weight: bold; border-bottom: 1px solid #1f2937;">${options.serviceName || "Fleet Gateway"}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; border-bottom: 1px solid #1f2937;">INCIDENT ID:</td>
            <td style="padding: 6px 0; color: #94a3b8; border-bottom: 1px solid #1f2937;">${options.incidentId}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; border-bottom: 1px solid #1f2937;">TIMESTAMP (UTC):</td>
            <td style="padding: 6px 0; color: #94a3b8; border-bottom: 1px solid #1f2937;">${time}</td>
          </tr>
        </table>

        <!-- Details block -->
        <div style="background-color: #030712; border: 1px solid #1f2937; padding: 14px 16px; margin-bottom: 24px; color: #cbd5e1; font-size: 12px; line-height: 1.6; white-space: pre-wrap;">
${options.message || "Automated diagnostic probe detected telemetry deviation. Engineering sentinel has recorded an active disruption event."}
        </div>

        <!-- Action CTA -->
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="background-color: #06b6d4;">
              <a href="${statusPageUrl}" target="_blank" style="display: inline-block; padding: 10px 18px; color: #000000; font-weight: bold; font-size: 12px; text-decoration: none; letter-spacing: 0.08em; text-transform: uppercase;">
                VIEW LIVE STATUS DECK &rarr;
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 16px 20px; background-color: #030712; border-top: 2px solid #1f2937; font-size: 11px; color: #475569; line-height: 1.5;">
        You received this notification because you subscribed to Crystal Heimdall incident alerts.<br>
        To unsubscribe immediately with 1-click, <a href="${unsubscribeUrl}" style="color: #64748b; text-decoration: underline;">click here to remove your address</a>.
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Dispatches an incident alert email to a subscriber via Resend API or Dry-Run logger
 */
export async function sendIncidentEmail(options: IncidentEmailOptions): Promise<EmailDeliveryResult> {
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const fromAddress = process.env.RESEND_FROM?.trim() || "Crystal Heimdall <alerts@crystalstudiolabs.org>";
  const html = generateBrutalistHtml(options);

  if (resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [options.to],
          subject: options.subject || `[HEIMDALL // ${options.severity.toUpperCase()}] ${options.title}`,
          html,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[RESEND API ERROR]: Status ${res.status}: ${errText}`);
        return { success: false, provider: "resend", error: errText };
      }

      const data = await res.json() as any;
      return { success: true, provider: "resend", messageId: data.id };
    } catch (err: any) {
      console.error("[EMAIL DISPATCH EXCEPTION]:", err.message);
      return { success: false, provider: "resend", error: err.message };
    }
  }

  // Dry-run mode for development and staging environments
  console.log(`[DRY-RUN EMAIL DISPATCH] To: ${options.to} | Subject: ${options.subject || options.title}`);
  return { success: true, provider: "dry-run" };
}
