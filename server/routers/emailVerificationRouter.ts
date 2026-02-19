/**
 * Email Verification Router
 * 
 * Handles sending verification emails and verifying tokens.
 * Uses Postmark for transactional email delivery.
 * Tokens expire after 24 hours and are single-use.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { ENV } from "../_core/env";

const TOKEN_EXPIRY_HOURS = 24;
const RESEND_COOLDOWN_MS = 60_000; // 1 minute between resends

/**
 * Send a verification email via Postmark
 */
async function sendVerificationEmail(params: {
  toEmail: string;
  token: string;
  origin: string;
  userName?: string | null;
}): Promise<boolean> {
  const { toEmail, token, origin, userName } = params;
  const verifyUrl = `${origin}/verify-email?token=${token}`;
  const apiToken = ENV.postmarkApiToken;

  if (!apiToken) {
    console.log(`[EmailVerification] Postmark not configured — would have sent verification to ${toEmail}`);
    console.log(`[EmailVerification] Verification URL: ${verifyUrl}`);
    return false;
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
        To: toEmail,
        Subject: "Verify your email — Troubadour",
        HtmlBody: buildVerificationHtml(userName || "there", verifyUrl),
        TextBody: buildVerificationText(userName || "there", verifyUrl),
        MessageStream: "outbound",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[EmailVerification] Postmark error (${response.status}):`, errorText);
      return false;
    }

    console.log(`[EmailVerification] Verification email sent to ${toEmail}`);
    return true;
  } catch (error) {
    console.error("[EmailVerification] Failed to send:", error);
    return false;
  }
}

function buildVerificationHtml(name: string, verifyUrl: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 0;">
      <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 12px; padding: 32px; color: #e0e0e0;">
        <h1 style="color: #a78bfa; font-size: 20px; margin: 0 0 8px 0;">Troubadour</h1>
        <p style="font-size: 14px; color: #9ca3af; margin: 0 0 24px 0;">AI-Powered Music Critique</p>
        
        <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 24px; margin-bottom: 24px;">
          <p style="font-size: 16px; margin: 0 0 12px 0; color: #f3f4f6;">
            Hey ${name},
          </p>
          <p style="font-size: 14px; color: #d1d5db; margin: 0;">
            Please verify your email address to unlock the full Troubadour experience — including email digests, collaboration invites, and review notifications.
          </p>
        </div>
        
        <a href="${verifyUrl}" style="display: inline-block; background: #7c3aed; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
          Verify Email Address
        </a>
        
        <p style="font-size: 12px; color: #6b7280; margin: 24px 0 0 0;">
          This link expires in 24 hours. If you didn't create a Troubadour account, you can safely ignore this email.
        </p>
        
        <p style="font-size: 11px; color: #4b5563; margin: 16px 0 0 0; word-break: break-all;">
          Or copy this link: ${verifyUrl}
        </p>
      </div>
    </div>
  `;
}

function buildVerificationText(name: string, verifyUrl: string): string {
  return `Hey ${name},\n\nPlease verify your email address to unlock the full Troubadour experience.\n\nVerify here: ${verifyUrl}\n\nThis link expires in 24 hours.\n\nIf you didn't create a Troubadour account, you can safely ignore this email.`;
}

export const emailVerificationRouter = router({
  /**
   * Get current verification status for the logged-in user
   */
  status: protectedProcedure.query(async ({ ctx }) => {
    return {
      emailVerified: ctx.user.emailVerified,
      email: ctx.user.email,
      hasEmail: !!ctx.user.email,
    };
  }),

  /**
   * Send a verification email to the user's registered email address.
   * Rate-limited to 1 per minute.
   */
  sendVerification: protectedProcedure
    .input(z.object({
      origin: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user;

      if (!user.email) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No email address on file. Please update your profile first.",
        });
      }

      if (user.emailVerified) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Your email is already verified.",
        });
      }

      // Check for existing active token (rate limit)
      const existingToken = await db.getActiveVerificationToken(user.id);
      if (existingToken) {
        const timeSinceCreated = Date.now() - new Date(existingToken.createdAt).getTime();
        if (timeSinceCreated < RESEND_COOLDOWN_MS) {
          const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - timeSinceCreated) / 1000);
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Please wait ${waitSeconds} seconds before requesting another verification email.`,
          });
        }
      }

      // Generate token
      const token = nanoid(48);
      const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

      // Save to DB
      await db.createEmailVerificationToken(user.id, user.email, token, expiresAt);

      // Send email
      const sent = await sendVerificationEmail({
        toEmail: user.email,
        token,
        origin: input.origin,
        userName: user.name,
      });

      return {
        sent,
        email: user.email,
        message: sent
          ? `Verification email sent to ${user.email}. Check your inbox.`
          : "Verification email could not be sent. Please try again later.",
      };
    }),

  /**
   * Verify a token from the email link.
   * Public procedure — the user clicks a link, may not be logged in.
   */
  verify: publicProcedure
    .input(z.object({
      token: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const tokenRow = await db.getEmailVerificationToken(input.token);

      if (!tokenRow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid or expired verification link.",
        });
      }

      if (tokenRow.usedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This verification link has already been used.",
        });
      }

      if (new Date(tokenRow.expiresAt) < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This verification link has expired. Please request a new one.",
        });
      }

      // Mark token as used
      await db.markEmailVerificationTokenUsed(tokenRow.id);

      // Mark user as verified
      await db.setUserEmailVerified(tokenRow.userId, true);

      return {
        success: true,
        email: tokenRow.email,
        message: "Email verified successfully!",
      };
    }),
});
