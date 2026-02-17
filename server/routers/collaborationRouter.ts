import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";
import { nanoid } from "nanoid";

export const collaborationRouter = {
  // ── Collaboration ──
  collaboration: router({
    invite: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        email: z.string().email(),
        role: z.enum(["viewer", "commenter"]).default("viewer"),
      }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only the project owner can invite collaborators" });
        }
        if (input.email === ctx.user.email) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot invite yourself" });
        }
        const existing = await db.getCollaboratorsByProject(input.projectId);
        if (existing.some(c => c.invitedEmail === input.email)) {
          throw new TRPCError({ code: "CONFLICT", message: "This email has already been invited" });
        }
        const inviteToken = nanoid(32);
        const invitedUser = await db.getUserByEmail(input.email);
        const result = await db.createCollaboratorInvite({
          projectId: input.projectId,
          invitedEmail: input.email,
          invitedUserId: invitedUser?.id || null,
          inviteToken,
          status: invitedUser ? "accepted" : "pending",
          role: input.role,
        });

        // Send email notification (fire-and-forget, non-blocking)
        const origin = ctx.req.headers.origin || ctx.req.headers.referer?.replace(/\/$/, '') || '';
        const inviteUrl = `${origin}/invite/${inviteToken}`;
        import("../services/emailNotification").then(({ sendCollaborationInvite }) => {
          sendCollaborationInvite({
            toEmail: input.email,
            inviterName: ctx.user.name || ctx.user.email || "Someone",
            projectTitle: project.title,
            inviteUrl,
          }).catch(err => console.error("[Email] invite send failed:", err));
        }).catch(err => console.error("[Email] import failed:", err));

        return { success: true, inviteToken, autoAccepted: !!invitedUser };
      }),

    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project) throw new TRPCError({ code: "NOT_FOUND" });
        const isOwner = project.userId === ctx.user.id;
        const isCollab = await db.isUserCollaborator(ctx.user.id, input.projectId);
        if (!isOwner && !isCollab) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return db.getCollaboratorsByProject(input.projectId);
      }),

    accept: protectedProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const invite = await db.getCollaboratorByToken(input.token);
        if (!invite) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found or expired" });
        }
        if (invite.status === "accepted") {
          return { success: true, projectId: invite.projectId, alreadyAccepted: true };
        }
        await db.acceptCollaboratorInvite(input.token, ctx.user.id);

        // Notify project owner that collaborator joined
        try {
          const project = await db.getProjectById(invite.projectId);
          if (project) {
            await db.createNotification({
              userId: project.userId,
              type: "collaboration_accepted",
              title: "Collaborator Joined",
              message: `${ctx.user.name || ctx.user.email || "Someone"} accepted your invite to "${project.title}"`,
              link: `/projects/${project.id}`,
            });
          }
        } catch (e) {
          console.warn("[Collaboration] Notification failed:", e);
        }

        return { success: true, projectId: invite.projectId, alreadyAccepted: false };
      }),

    remove: protectedProcedure
      .input(z.object({ id: z.number(), projectId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only the project owner can remove collaborators" });
        }
        await db.removeCollaborator(input.id);
        return { success: true };
      }),

    sharedProjects: protectedProcedure.query(async ({ ctx }) => {
      const sharedIds = await db.getSharedProjectIds(ctx.user.id);
      if (sharedIds.length === 0) return [];
      const results = [];
      for (const id of sharedIds) {
        const project = await db.getProjectById(id);
        if (project) results.push(project);
      }
      return results;
    }),
  }),

  // ── Review Comments ──
  comment: router({
    list: protectedProcedure
      .input(z.object({ reviewId: z.number() }))
      .query(async ({ input }) => {
        return db.getReviewComments(input.reviewId);
      }),

    create: protectedProcedure
      .input(z.object({
        reviewId: z.number(),
        content: z.string().min(1).max(5000),
        parentId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify user has access to this review (owner or commenter collaborator)
        const review = await db.getReviewById(input.reviewId);
        if (!review) throw new TRPCError({ code: "NOT_FOUND", message: "Review not found" });
        const project = await db.getProjectById(review.projectId);
        if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        const isOwner = project.userId === ctx.user.id;
        if (!isOwner) {
          const collab = await db.getCollaboratorRole(ctx.user.id, project.id);
          if (!collab || collab !== "commenter") {
            throw new TRPCError({ code: "FORBIDDEN", message: "You need commenter access to leave comments" });
          }
        }
        const result = await db.createReviewComment({
          reviewId: input.reviewId,
          userId: ctx.user.id,
          content: input.content,
          parentId: input.parentId || null,
        });
        // Notify project owner if commenter
        if (!isOwner) {
          try {
            await db.createNotification({
              userId: project.userId,
              type: "review_complete" as const,
              title: "New Comment on Review",
              message: `${ctx.user.name || ctx.user.email || "A collaborator"} commented on a review in "${project.title}"`,
              link: `/reviews/${input.reviewId}`,
            });
          } catch (e) { console.warn("[Comment] Notification failed:", e); }
        }
        return result;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        content: z.string().min(1).max(5000),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.updateReviewComment(input.id, ctx.user.id, input.content);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return db.deleteReviewComment(input.id, ctx.user.id);
      }),
  }),
};
