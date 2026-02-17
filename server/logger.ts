/**
 * Structured Logger with Request ID Tracking
 * 
 * Provides consistent, structured logging across the application with:
 * - Unique request IDs for traceability
 * - Structured JSON output in production
 * - Human-readable output in development
 * - Context propagation through async operations
 */

import { randomUUID } from "crypto";
import { AsyncLocalStorage } from "async_hooks";

// ── Request Context ──

interface RequestContext {
  requestId: string;
  userId?: number;
  method?: string;
  path?: string;
  startTime: number;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

/** Generate a short request ID (first 8 chars of UUID) */
export function generateRequestId(): string {
  return randomUUID().substring(0, 8);
}

/** Get the current request context */
export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore();
}

// ── Log Levels ──

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LOG_LEVEL: LogLevel = process.env.NODE_ENV === "production" ? "info" : "debug";

// ── Logger ──

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  userId?: number;
  duration?: number;
  [key: string]: any;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[MIN_LOG_LEVEL];
}

function formatLog(entry: LogEntry): string {
  if (process.env.NODE_ENV === "production") {
    return JSON.stringify(entry);
  }
  // Human-readable format for development
  const { timestamp, level, message, requestId, userId, duration, ...extra } = entry;
  const prefix = requestId ? `[${requestId}]` : "";
  const userStr = userId ? ` user:${userId}` : "";
  const durationStr = duration !== undefined ? ` (${duration}ms)` : "";
  const extraStr = Object.keys(extra).length > 0 ? ` ${JSON.stringify(extra)}` : "";
  return `${timestamp} ${level.toUpperCase().padEnd(5)} ${prefix}${userStr} ${message}${durationStr}${extraStr}`;
}

function log(level: LogLevel, message: string, extra?: Record<string, any>) {
  if (!shouldLog(level)) return;

  const ctx = requestContext.getStore();
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    requestId: ctx?.requestId,
    userId: ctx?.userId,
    ...extra,
  };

  const formatted = formatLog(entry);

  switch (level) {
    case "error":
      console.error(formatted);
      break;
    case "warn":
      console.warn(formatted);
      break;
    default:
      console.log(formatted);
  }
}

export const logger = {
  debug: (message: string, extra?: Record<string, any>) => log("debug", message, extra),
  info: (message: string, extra?: Record<string, any>) => log("info", message, extra),
  warn: (message: string, extra?: Record<string, any>) => log("warn", message, extra),
  error: (message: string, extra?: Record<string, any>) => log("error", message, extra),
};

/**
 * Express middleware that:
 * 1. Generates a unique request ID
 * 2. Sets it in the response header (X-Request-ID)
 * 3. Stores it in AsyncLocalStorage for downstream use
 * 4. Logs request start and completion with timing
 */
export function requestIdMiddleware() {
  return (req: any, res: any, next: any) => {
    const requestId = (req.headers["x-request-id"] as string) || generateRequestId();
    const startTime = Date.now();

    // Set response header for client correlation
    res.setHeader("X-Request-ID", requestId);

    const context: RequestContext = {
      requestId,
      method: req.method,
      path: req.path,
      startTime,
    };

    requestContext.run(context, () => {
      // Log request start (skip health checks and static assets)
      const isNoise = req.path === "/health" || req.path.startsWith("/assets/") || req.path.startsWith("/@");
      if (!isNoise) {
        logger.debug(`→ ${req.method} ${req.path}`);
      }

      // Log request completion
      const originalEnd = res.end;
      res.end = function (...args: any[]) {
        const duration = Date.now() - startTime;
        if (!isNoise) {
          const logFn = res.statusCode >= 500 ? logger.error : res.statusCode >= 400 ? logger.warn : logger.info;
          logFn(`← ${req.method} ${req.path} ${res.statusCode}`, { duration });
        }
        return originalEnd.apply(this, args);
      };

      next();
    });
  };
}
