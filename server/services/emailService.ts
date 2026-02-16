import { ENV } from "../_core/env";

interface EmailOptions {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  tag?: string;
  messageStream?: string;
}

interface PostmarkResponse {
  To: string;
  SubmittedAt: string;
  MessageID: string;
  ErrorCode: number;
  Message: string;
}

/**
 * Send an email via Postmark API.
 * Falls back to console logging if POSTMARK_API_TOKEN is not configured.
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiToken = ENV.postmarkApiToken;

  if (!apiToken) {
    console.log("[Email] Postmark not configured — logging email instead:");
    console.log(`  To: ${options.to}`);
    console.log(`  Subject: ${options.subject}`);
    console.log(`  Tag: ${options.tag || "none"}`);
    console.log(`  Body length: ${options.htmlBody.length} chars`);
    return { success: true, messageId: `local-${Date.now()}` };
  }

  try {
    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": apiToken,
      },
      body: JSON.stringify({
        From: ENV.postmarkFromEmail || "noreply@troubadour.app",
        To: options.to,
        Subject: options.subject,
        HtmlBody: options.htmlBody,
        TextBody: options.textBody || stripHtml(options.htmlBody),
        Tag: options.tag || "transactional",
        MessageStream: options.messageStream || "outbound",
        TrackOpens: true,
        TrackLinks: "HtmlAndText" as const,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Email] Postmark API error (${response.status}):`, errorText);
      return { success: false, error: `Postmark API error: ${response.status}` };
    }

    const result = (await response.json()) as PostmarkResponse;

    if (result.ErrorCode !== 0) {
      console.error(`[Email] Postmark error code ${result.ErrorCode}: ${result.Message}`);
      return { success: false, error: result.Message };
    }

    console.log(`[Email] Sent successfully to ${options.to} (MessageID: ${result.MessageID})`);
    return { success: true, messageId: result.MessageID };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Email] Failed to send:", message);
    return { success: false, error: message };
  }
}

/**
 * Send a digest email to a user.
 */
export async function sendDigestEmail(options: {
  to: string;
  userName: string;
  htmlContent: string;
  periodLabel: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return sendEmail({
    to: options.to,
    subject: `Troubadour Weekly Digest — ${options.periodLabel}`,
    htmlBody: options.htmlContent,
    tag: "digest",
    messageStream: "outbound",
  });
}

/**
 * Send a notification email (review complete, collaboration invite, etc.)
 */
export async function sendNotificationEmail(options: {
  to: string;
  subject: string;
  preheader: string;
  bodyHtml: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const wrappedHtml = wrapInEmailTemplate(options.subject, options.preheader, options.bodyHtml);
  return sendEmail({
    to: options.to,
    subject: options.subject,
    htmlBody: wrappedHtml,
    tag: "notification",
  });
}

/**
 * Strip HTML tags for plain text fallback.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "  • ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Wrap body content in a branded email template.
 */
function wrapInEmailTemplate(title: string, preheader: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .preheader { display: none !important; visibility: hidden; mso-hide: all; font-size: 1px; color: #0a0a0a; line-height: 1px; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; }
    .container { max-width: 600px; margin: 0 auto; padding: 32px 24px; }
    .header { text-align: center; padding: 24px 0; border-bottom: 1px solid #1a1a2e; margin-bottom: 24px; }
    .logo { font-size: 24px; font-weight: 700; color: #a78bfa; letter-spacing: -0.5px; }
    .content { color: #e2e8f0; font-size: 15px; line-height: 1.6; }
    .content h2 { color: #f8fafc; font-size: 18px; margin: 24px 0 12px; }
    .content h3 { color: #cbd5e1; font-size: 16px; margin: 20px 0 8px; }
    .content a { color: #a78bfa; text-decoration: none; }
    .content a:hover { text-decoration: underline; }
    .footer { text-align: center; padding: 24px 0; border-top: 1px solid #1a1a2e; margin-top: 32px; color: #64748b; font-size: 12px; }
    .btn { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #7c3aed, #a78bfa); color: #ffffff !important; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
  </style>
</head>
<body>
  <div class="preheader">${preheader}</div>
  <div class="container">
    <div class="header">
      <div class="logo">🎵 Troubadour</div>
    </div>
    <div class="content">
      ${bodyHtml}
    </div>
    <div class="footer">
      <p>Troubadour — AI-Powered Album Critique</p>
      <p>You're receiving this because you have an active Troubadour account.</p>
    </div>
  </div>
</body>
</html>`;
}
