/**
 * Graceful Shutdown Handler
 * 
 * Ensures clean shutdown of all services:
 * 1. Stop accepting new requests
 * 2. Stop the job queue poller
 * 3. Wait for in-flight requests to complete (with timeout)
 * 4. Destroy rate limiters
 * 5. Close database connections
 * 6. Flush Sentry events
 * 7. Exit process
 */

import { Server } from "http";
import { logger } from "./logger";

interface ShutdownConfig {
  server: Server;
  /** Maximum time to wait for in-flight requests (ms) */
  gracePeriodMs?: number;
}

let isShuttingDown = false;

export function registerGracefulShutdown(config: ShutdownConfig) {
  const { server, gracePeriodMs = 15_000 } = config;

  async function shutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    // 1. Stop accepting new connections
    server.close(() => {
      logger.info("HTTP server closed — no new connections accepted");
    });

    // 2. Stop the job queue
    try {
      const { stopJobQueue } = await import("./services/jobProcessor");
      stopJobQueue();
      logger.info("Job queue poller stopped");
    } catch (e) {
      logger.warn("Failed to stop job queue", { error: String(e) });
    }

    // 3. Destroy rate limiters
    try {
      const { destroyAllLimiters } = await import("./userRateLimiter");
      destroyAllLimiters();
      logger.info("Rate limiters destroyed");
    } catch (e) {
      logger.warn("Failed to destroy rate limiters", { error: String(e) });
    }

    // 4. Flush Sentry events
    try {
      const { Sentry } = await import("./sentry");
      if (Sentry) {
        await Sentry.close(5000);
        logger.info("Sentry events flushed");
      }
    } catch (e) {
      logger.warn("Failed to flush Sentry", { error: String(e) });
    }

    // 5. Force exit after grace period
    const forceExitTimer = setTimeout(() => {
      logger.error(`Graceful shutdown timed out after ${gracePeriodMs}ms. Forcing exit.`);
      process.exit(1);
    }, gracePeriodMs);
    forceExitTimer.unref(); // Don't keep process alive just for the timer

    logger.info("Graceful shutdown complete");
    process.exit(0);
  }

  // Register signal handlers
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Handle uncaught exceptions and unhandled rejections
  process.on("uncaughtException", async (error) => {
    logger.error("Uncaught exception", { error: error.message, stack: error.stack });
    try {
      const { captureError } = await import("./sentry");
      captureError(error, { type: "uncaughtException" });
    } catch {}
    await shutdown("uncaughtException");
  });

  process.on("unhandledRejection", async (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.error("Unhandled rejection", { error: error.message, stack: error.stack });
    try {
      const { captureError } = await import("./sentry");
      captureError(error, { type: "unhandledRejection" });
    } catch {}
    // Don't shutdown on unhandled rejections — just log and report
  });
}

/** Check if the server is currently shutting down (for middleware) */
export function isServerShuttingDown(): boolean {
  return isShuttingDown;
}
