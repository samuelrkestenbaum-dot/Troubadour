/**
 * Postmark Bounce/Complaint Webhook Handler
 * Handles bounce and spam complaint events from Postmark to mark emails as undeliverable.
 * 
 * Postmark sends JSON webhooks with RecordType: "Bounce" or "SpamComplaint".
 * We mark the user's email as bounced and skip them in future sends.
 */
import { Request, Response } from "express";
import { markEmailBounced } from "../db";
import { logAuditEvent } from "../utils/auditTrail";

interface PostmarkBouncePayload {
  RecordType: "Bounce" | "SpamComplaint";
  Email: string;
  Type?: string; // e.g., "HardBounce", "SoftBounce", "Transient"
  TypeCode?: number;
  Name?: string;
  Description?: string;
  Details?: string;
  Tag?: string;
  MessageID?: string;
  ServerID?: number;
  BouncedAt?: string;
}

// Bounce types that should permanently mark an email as bounced
const PERMANENT_BOUNCE_TYPES = [
  "HardBounce",
  "SpamNotification",
  "SpamComplaint",
  "BadEmailAddress",
  "Blocked",
  "ManuallyDeactivated",
];

export async function handlePostmarkBounceWebhook(req: Request, res: Response) {
  try {
    const payload = req.body as PostmarkBouncePayload;

    // Validate required fields
    if (!payload || !payload.RecordType || !payload.Email) {
      console.warn("[Postmark Webhook] Invalid payload — missing RecordType or Email");
      return res.status(400).json({ error: "Invalid payload" });
    }

    const email = payload.Email.toLowerCase().trim();
    const recordType = payload.RecordType;
    const bounceType = payload.Type || recordType;

    console.log(`[Postmark Webhook] Received ${recordType} for ${email} (type: ${bounceType})`);

    // Handle bounces and spam complaints
    if (recordType === "Bounce" || recordType === "SpamComplaint") {
      // For spam complaints, always mark as bounced
      if (recordType === "SpamComplaint") {
        await markEmailBounced(email, `SpamComplaint: ${payload.Description || "User marked as spam"}`);
        console.log(`[Postmark Webhook] Marked ${email} as bounced (spam complaint)`);
        
        logAuditEvent({
          action: "email_spam_complaint",
          details: `Email ${email} reported as spam. Description: ${payload.Description || "N/A"}`,
        });
      }
      // For bounces, only permanently mark for hard bounces
      else if (PERMANENT_BOUNCE_TYPES.includes(bounceType)) {
        await markEmailBounced(email, `${bounceType}: ${payload.Description || payload.Details || "Permanent bounce"}`);
        console.log(`[Postmark Webhook] Marked ${email} as bounced (${bounceType})`);
        
        logAuditEvent({
          action: "email_hard_bounce",
          details: `Email ${email} hard bounced. Type: ${bounceType}, Description: ${payload.Description || "N/A"}`,
        });
      } else {
        // Soft bounces — log but don't permanently mark
        console.log(`[Postmark Webhook] Soft bounce for ${email} (${bounceType}) — not marking as bounced`);
        
        logAuditEvent({
          action: "email_soft_bounce",
          details: `Email ${email} soft bounced. Type: ${bounceType}, Description: ${payload.Description || "N/A"}`,
        });
      }
    } else {
      console.log(`[Postmark Webhook] Ignoring RecordType: ${recordType}`);
    }

    // Always return 200 to Postmark to acknowledge receipt
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("[Postmark Webhook] Error processing webhook:", error);
    // Still return 200 to prevent Postmark from retrying
    return res.status(200).json({ received: true, error: "Processing failed but acknowledged" });
  }
}
