/**
 * Lightweight user action audit trail.
 * Logs significant user actions for compliance and debugging.
 * Uses the existing adminAuditLog table via createAuditLogEntry.
 */
import * as db from "../db";

export type AuditAction =
  | "login"
  | "logout"
  | "project.create"
  | "project.delete"
  | "track.upload"
  | "track.delete"
  | "review.generate"
  | "review.share"
  | "subscription.checkout"
  | "subscription.cancel"
  | "settings.update"
  | "collaboration.invite"
  | "collaboration.accept"
  | "email.verify"
  | "template.create"
  | "template.delete"
  | "admin.action"
  | "email_spam_complaint"
  | "email_hard_bounce"
  | "email_soft_bounce"
  | "cancellation_survey";

interface AuditEntry {
  userId?: number;
  action: AuditAction;
  details?: string;
  resourceType?: string;
  resourceId?: number;
  targetUserId?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Log a user action to the audit trail.
 * Fire-and-forget — never throws.
 */
export async function logAuditEvent(entry: AuditEntry): Promise<void> {
  try {
    await db.createAuditLogEntry({
      adminUserId: entry.userId ?? 0,
      action: entry.action,
      targetUserId: entry.targetUserId,
      details: {
        ...(entry.details ? { description: entry.details } : {}),
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        ...(entry.metadata || {}),
      },
    });
  } catch (e) {
    // Audit logging should never break the main flow
    console.warn("[AuditTrail] Failed to log event:", entry.action, e);
  }
}
