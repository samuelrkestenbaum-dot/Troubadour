import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { claudeCircuitBreaker, geminiCircuitBreaker, postmarkCircuitBreaker } from "../utils/circuitBreaker";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  serviceHealth: publicProcedure
    .query(() => {
      const services = [
        {
          name: "Claude (AI Reviews)",
          status: claudeCircuitBreaker.getState(),
        },
        {
          name: "Gemini (Audio Analysis)",
          status: geminiCircuitBreaker.getState(),
        },
        {
          name: "Postmark (Email)",
          status: postmarkCircuitBreaker.getState(),
        },
      ].map(s => ({
        name: s.name,
        status: s.status === "CLOSED" ? "healthy" : s.status === "HALF_OPEN" ? "degraded" : "unavailable",
      }));
      return { services };
    }),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
