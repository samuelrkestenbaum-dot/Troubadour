import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";

/**
 * Dead Letter Queue admin router.
 * Allows admins to view, retry, and dismiss permanently failed jobs.
 */
export const dlqRouter = router({
  /** List DLQ entries with optional filter */
  list: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      processed: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      return db.getDeadLetterQueueItems({
        processed: input.processed,
        limit: input.limit,
      });
    }),

  /** Get DLQ stats (total + unprocessed counts) */
  stats: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      return db.getDlqStats();
    }),

  /** Mark a DLQ item as processed (retry or dismiss) */
  markProcessed: protectedProcedure
    .input(z.object({
      id: z.number(),
      reprocessedJobId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      await db.markDlqItemProcessed(input.id, input.reprocessedJobId);
      return { success: true };
    }),
});
