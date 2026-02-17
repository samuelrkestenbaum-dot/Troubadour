/**
 * User-Level Rate Limiter
 * 
 * Provides per-userId throttling for AI-intensive endpoints.
 * Unlike the IP-based express-rate-limit, this tracks usage by authenticated user ID,
 * preventing abuse from users behind shared IPs (corporate networks, VPNs).
 * 
 * Uses an in-memory sliding window approach with automatic cleanup.
 */

interface RateLimitEntry {
  timestamps: number[];
  lastCleanup: number;
}

interface UserRateLimiterConfig {
  /** Maximum number of requests allowed within the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Human-readable name for logging */
  name: string;
}

export class UserRateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private config: UserRateLimiterConfig;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: UserRateLimiterConfig) {
    this.config = config;
    // Periodic cleanup of expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Check if a user is allowed to make a request.
   * Returns { allowed, remaining, resetMs } 
   */
  check(userId: number): { allowed: boolean; remaining: number; resetMs: number; limit: number } {
    const key = `user:${userId}`;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    let entry = this.store.get(key);
    if (!entry) {
      entry = { timestamps: [], lastCleanup: now };
      this.store.set(key, entry);
    }

    // Remove timestamps outside the window
    entry.timestamps = entry.timestamps.filter(t => t > windowStart);

    const remaining = Math.max(0, this.config.maxRequests - entry.timestamps.length);
    const oldestInWindow = entry.timestamps[0];
    const resetMs = oldestInWindow ? (oldestInWindow + this.config.windowMs) - now : 0;

    if (entry.timestamps.length >= this.config.maxRequests) {
      return { allowed: false, remaining: 0, resetMs, limit: this.config.maxRequests };
    }

    // Record this request
    entry.timestamps.push(now);
    return { allowed: true, remaining: remaining - 1, resetMs: this.config.windowMs, limit: this.config.maxRequests };
  }

  /** Remove expired entries from the store */
  private cleanup() {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const keys = Array.from(this.store.keys());
    for (const key of keys) {
      const entry = this.store.get(key)!;
      entry.timestamps = entry.timestamps.filter((t: number) => t > windowStart);
      if (entry.timestamps.length === 0) {
        this.store.delete(key);
      }
    }
  }

  /** Get the current store size (for monitoring) */
  get size(): number {
    return this.store.size;
  }

  /** Reset all rate limit state (for testing) */
  reset() {
    this.store.clear();
  }

  /** Destroy the limiter and clear the cleanup interval */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

// ── Pre-configured limiters for different endpoint categories ──

/** AI Review generation: 10 requests per 5 minutes per user */
export const aiReviewLimiter = new UserRateLimiter({
  name: "ai-review",
  maxRequests: 10,
  windowMs: 5 * 60 * 1000,
});

/** AI Analysis (mix report, structure, DAW notes, insights): 15 per 5 minutes */
export const aiAnalysisLimiter = new UserRateLimiter({
  name: "ai-analysis",
  maxRequests: 15,
  windowMs: 5 * 60 * 1000,
});

/** AI Chat/Follow-up: 30 per 5 minutes */
export const aiChatLimiter = new UserRateLimiter({
  name: "ai-chat",
  maxRequests: 30,
  windowMs: 5 * 60 * 1000,
});

/** Image generation: 5 per 5 minutes */
export const imageGenLimiter = new UserRateLimiter({
  name: "image-gen",
  maxRequests: 5,
  windowMs: 5 * 60 * 1000,
});

/** Export operations: 20 per 5 minutes */
export const exportLimiter = new UserRateLimiter({
  name: "export",
  maxRequests: 20,
  windowMs: 5 * 60 * 1000,
});

/**
 * tRPC middleware factory that enforces user-level rate limiting.
 * Use inside protectedProcedure chains:
 * 
 * ```ts
 * myProcedure: protectedProcedure
 *   .use(userRateLimit(aiReviewLimiter))
 *   .mutation(async ({ ctx }) => { ... })
 * ```
 */
export function userRateLimit(limiter: UserRateLimiter) {
  return async function rateLimit({ ctx, next }: { ctx: { user: { id: number } }; next: () => Promise<any> }) {
    const result = limiter.check(ctx.user.id);
    if (!result.allowed) {
      const { TRPCError } = await import("@trpc/server");
      const retryAfterSec = Math.ceil(result.resetMs / 1000);
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Rate limit exceeded. You can make ${result.limit} requests per 5 minutes. Please try again in ${retryAfterSec} seconds.`,
      });
    }
    return next();
  };
}

/** Get stats for all limiters (for health check / monitoring) */
export function getRateLimiterStats() {
  return {
    aiReview: { activeUsers: aiReviewLimiter.size },
    aiAnalysis: { activeUsers: aiAnalysisLimiter.size },
    aiChat: { activeUsers: aiChatLimiter.size },
    imageGen: { activeUsers: imageGenLimiter.size },
    export: { activeUsers: exportLimiter.size },
  };
}

/** Reset all limiters (for testing) */
export function resetAllLimiters() {
  aiReviewLimiter.reset();
  aiAnalysisLimiter.reset();
  aiChatLimiter.reset();
  imageGenLimiter.reset();
  exportLimiter.reset();
}

/** Destroy all limiters (for graceful shutdown) */
export function destroyAllLimiters() {
  aiReviewLimiter.destroy();
  aiAnalysisLimiter.destroy();
  aiChatLimiter.destroy();
  imageGenLimiter.destroy();
  exportLimiter.destroy();
}
