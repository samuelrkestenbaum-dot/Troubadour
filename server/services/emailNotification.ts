/**
 * Email Notification Service
 * Uses Postmark for transactional emails (collaboration invites, review complete notifications).
 * Gracefully degrades when POSTMARK_API_TOKEN is not configured — logs instead of sending.
 */

import { ENV } from "../_core/env";
import { postmarkCircuitBreaker, CircuitOpenError } from "../utils/circuitBreaker";

interface EmailPayload {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
}

async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const apiToken = ENV.postmarkApiToken;

  if (!apiToken) {
    console.log(`[Email] Postmark not configured — would have sent to ${payload.to}: "${payload.subject}"`);
    return false;
  }

  try {
    return await postmarkCircuitBreaker.execute(async () => {
      return await _sendEmailInner(payload, apiToken);
    });
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      console.warn(`[Email] Postmark circuit open — skipping email to ${payload.to}: "${payload.subject}"`);
      return false;
    }
    console.error("[Email] Failed to send:", error);
    return false;
  }
}

async function _sendEmailInner(payload: EmailPayload, apiToken: string): Promise<boolean> {
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
        To: payload.to,
        Subject: payload.subject,
        HtmlBody: payload.htmlBody,
        TextBody: payload.textBody,
        MessageStream: "outbound",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Email] Postmark error (${response.status}):`, errorText);
      return false;
    }

    console.log(`[Email] Sent to ${payload.to}: "${payload.subject}"`);
    return true;
  } catch (error) {
    console.error("[Email] Failed to send:", error);
    return false;
  }
}

export async function sendCollaborationInvite(params: {
  toEmail: string;
  inviterName: string;
  projectTitle: string;
  inviteUrl: string;
}): Promise<boolean> {
  const { toEmail, inviterName, projectTitle, inviteUrl } = params;

  return sendEmail({
    to: toEmail,
    subject: `${inviterName} invited you to review "${projectTitle}" on Troubadour`,
    htmlBody: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 0;">
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 12px; padding: 32px; color: #e0e0e0;">
          <h1 style="color: #a78bfa; font-size: 20px; margin: 0 0 8px 0;">Troubadour</h1>
          <p style="font-size: 14px; color: #9ca3af; margin: 0 0 24px 0;">AI-Powered Music Critique</p>
          
          <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 24px; margin-bottom: 24px;">
            <p style="font-size: 16px; margin: 0 0 8px 0; color: #f3f4f6;">
              <strong>${inviterName}</strong> has invited you to collaborate on:
            </p>
            <p style="font-size: 20px; font-weight: 600; color: #a78bfa; margin: 0;">
              "${projectTitle}"
            </p>
          </div>
          
          <p style="font-size: 14px; color: #9ca3af; margin: 0 0 24px 0;">
            As a collaborator, you'll be able to view all tracks, reviews, and AI critiques for this project.
          </p>
          
          <a href="${inviteUrl}" style="display: inline-block; background: #7c3aed; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px;">
            Accept Invitation
          </a>
          
          <p style="font-size: 12px; color: #6b7280; margin: 24px 0 0 0;">
            If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
      </div>
    `,
    textBody: `${inviterName} invited you to collaborate on "${projectTitle}" on Troubadour.\n\nAccept the invitation: ${inviteUrl}\n\nAs a collaborator, you'll be able to view all tracks, reviews, and AI critiques for this project.\n\nIf you didn't expect this invitation, you can safely ignore this email.`,
  });
}

export async function sendReviewCompleteNotification(params: {
  toEmail: string;
  projectTitle: string;
  trackTitle: string;
  projectUrl: string;
}): Promise<boolean> {
  const { toEmail, projectTitle, trackTitle, projectUrl } = params;

  return sendEmail({
    to: toEmail,
    subject: `Review complete: "${trackTitle}" in ${projectTitle}`,
    htmlBody: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 0;">
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 12px; padding: 32px; color: #e0e0e0;">
          <h1 style="color: #a78bfa; font-size: 20px; margin: 0 0 8px 0;">Troubadour</h1>
          <p style="font-size: 14px; color: #9ca3af; margin: 0 0 24px 0;">AI-Powered Music Critique</p>
          
          <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 24px; margin-bottom: 24px;">
            <p style="font-size: 14px; color: #9ca3af; margin: 0 0 4px 0;">Review complete for</p>
            <p style="font-size: 18px; font-weight: 600; color: #f3f4f6; margin: 0 0 4px 0;">"${trackTitle}"</p>
            <p style="font-size: 14px; color: #9ca3af; margin: 0;">in project "${projectTitle}"</p>
          </div>
          
          <a href="${projectUrl}" style="display: inline-block; background: #7c3aed; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px;">
            View Review
          </a>
        </div>
      </div>
    `,
    textBody: `Review complete for "${trackTitle}" in project "${projectTitle}".\n\nView the review: ${projectUrl}`,
  });
}

/**
 * Notify all accepted collaborators when a review completes on a shared project.
 * Gracefully logs errors without throwing — review completion should never fail
 * because of a notification issue.
 */
export async function notifyCollaborators(params: {
  projectId: number;
  trackTitle: string;
  projectTitle: string;
  baseUrl: string;
  getCollaboratorsByProject: (projectId: number) => Promise<Array<{ invitedEmail: string; status: string }>>;
}): Promise<void> {
  const { projectId, trackTitle, projectTitle, baseUrl, getCollaboratorsByProject } = params;

  try {
    const collaborators = await getCollaboratorsByProject(projectId);
    const accepted = collaborators.filter(c => c.status === "accepted" && c.invitedEmail);

    if (accepted.length === 0) return;

    console.log(`[Email] Notifying ${accepted.length} collaborator(s) about review for "${trackTitle}"`);

    for (const collab of accepted) {
      try {
        await sendReviewCompleteNotification({
          toEmail: collab.invitedEmail,
          projectTitle,
          trackTitle,
          projectUrl: `${baseUrl}/projects/${projectId}`,
        });
      } catch (err) {
        console.warn(`[Email] Failed to notify collaborator ${collab.invitedEmail}:`, err);
      }
    }
  } catch (error) {
    console.error(`[Email] Failed to fetch collaborators for project ${projectId}:`, error);
  }
}
