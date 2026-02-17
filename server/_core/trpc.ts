import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

// ── Rate-limited procedure variants ──
// These combine auth + user-level rate limiting in a single procedure base.
// Use these instead of protectedProcedure for AI-intensive endpoints.
import {
  aiReviewLimiter,
  aiAnalysisLimiter,
  aiChatLimiter,
  imageGenLimiter,
  exportLimiter,
} from "../userRateLimiter";

function makeUserRateLimitMiddleware(limiter: { check: (userId: number) => { allowed: boolean; remaining: number; resetMs: number; limit: number } }) {
  return t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    const result = limiter.check(ctx.user.id);
    if (!result.allowed) {
      const retryAfterSec = Math.ceil(result.resetMs / 1000);
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Rate limit exceeded. You can make ${result.limit} requests per 5 minutes. Please try again in ${retryAfterSec} seconds.`,
      });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  });
}

/** Protected + AI review rate limit (10 req / 5 min per user) */
export const aiReviewProcedure = t.procedure.use(requireUser).use(makeUserRateLimitMiddleware(aiReviewLimiter));

/** Protected + AI analysis rate limit (15 req / 5 min per user) */
export const aiAnalysisProcedure = t.procedure.use(requireUser).use(makeUserRateLimitMiddleware(aiAnalysisLimiter));

/** Protected + AI chat rate limit (30 req / 5 min per user) */
export const aiChatProcedure = t.procedure.use(requireUser).use(makeUserRateLimitMiddleware(aiChatLimiter));

/** Protected + image generation rate limit (5 req / 5 min per user) */
export const imageGenProcedure = t.procedure.use(requireUser).use(makeUserRateLimitMiddleware(imageGenLimiter));

/** Protected + export rate limit (20 req / 5 min per user) */
export const exportProcedure = t.procedure.use(requireUser).use(makeUserRateLimitMiddleware(exportLimiter));

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
