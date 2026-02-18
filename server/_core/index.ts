import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { initSentry, Sentry } from "../sentry";
import { requestIdMiddleware, logger } from "../logger";
import { registerGracefulShutdown, isServerShuttingDown } from "../shutdown";
import { getRateLimiterStats } from "../userRateLimiter";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Initialize Sentry before anything else
  initSentry();

  const app = express();
  const server = createServer(app);

  // ── Request ID Middleware (first, so all downstream logs have IDs) ──
  app.use(requestIdMiddleware());

  // ── Shutdown Guard ──
  app.use((_req, res, next) => {
    if (isServerShuttingDown()) {
      res.status(503).json({ error: "Server is shutting down. Please retry shortly." });
      return;
    }
    next();
  });

  // ── Security Headers ──
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://fonts.googleapis.com", "https://js.stripe.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "https://api.manus.im", "https://api.stripe.com", "https://*.sentry.io", "wss:", "ws:"],
        frameSrc: ["'self'", "https://js.stripe.com"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  }));

  // Stripe webhook must be registered BEFORE express.json() to get raw body
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const { handleStripeWebhook } = await import("../stripe/webhook");
    return handleStripeWebhook(req, res);
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ── Rate Limiting (IP-based) ──
  // Trust proxy for X-Forwarded-For behind reverse proxies
  app.set("trust proxy", 1);

  // Global baseline: 200 requests per minute per IP
  const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please try again later." },
  });
  app.use("/api/trpc", globalLimiter);

  // Strict limiter for file uploads: 10 per minute per IP
  const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Upload rate limit exceeded. Please wait before uploading more files." },
  });
  app.use("/api/trpc/track.upload", uploadLimiter);

  // Strict limiter for job creation: 20 per minute per IP
  const jobLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Job creation rate limit exceeded. Please wait before submitting more jobs." },
  });
  app.use("/api/trpc/job.analyze", jobLimiter);
  app.use("/api/trpc/job.review", jobLimiter);
  app.use("/api/trpc/job.compare", jobLimiter);
  app.use("/api/trpc/job.analyzeAndReview", jobLimiter);
  app.use("/api/trpc/job.albumReview", jobLimiter);
  app.use("/api/trpc/job.batchReviewAll", jobLimiter);
  app.use("/api/trpc/job.retry", jobLimiter);

  // Strict limiter for chat: 30 per minute per IP
  const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Chat rate limit exceeded. Please slow down." },
  });
  app.use("/api/trpc/chat.sendMessage", chatLimiter);
  app.use("/api/trpc/conversation.sendMessage", chatLimiter);

  // ── Health Check (enhanced with dependency status) ──
  app.get("/health", async (_req, res) => {
    const checks: Record<string, { status: string; detail?: string }> = {};

    // Database connectivity
    try {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (db) {
        await db.execute("SELECT 1 as ok");
        checks.database = { status: "healthy" };
      } else {
        checks.database = { status: "degraded", detail: "Database not connected" };
      }
    } catch (e: any) {
      checks.database = { status: "unhealthy", detail: e.message?.substring(0, 200) };
    }

    // Job queue status
    try {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (db) {
        const [queued] = await db.execute("SELECT COUNT(*) as c FROM jobs WHERE status = 'queued'");
        const [running] = await db.execute("SELECT COUNT(*) as c FROM jobs WHERE status = 'running'");
        const [errored] = await db.execute("SELECT COUNT(*) as c FROM jobs WHERE status = 'error'");
        checks.jobQueue = {
          status: "healthy",
          detail: `queued=${(queued as any)[0]?.c ?? 0}, running=${(running as any)[0]?.c ?? 0}, errored=${(errored as any)[0]?.c ?? 0}`,
        };
      } else {
        checks.jobQueue = { status: "degraded", detail: "Cannot query jobs without DB" };
      }
    } catch (e: any) {
      checks.jobQueue = { status: "unhealthy", detail: e.message?.substring(0, 200) };
    }

    // Rate limiter stats
    try {
      const stats = getRateLimiterStats();
      checks.rateLimiters = {
        status: "healthy",
        detail: Object.entries(stats).map(([k, v]) => `${k}:${v.activeUsers}`).join(", "),
      };
    } catch (e: any) {
      checks.rateLimiters = { status: "degraded", detail: e.message?.substring(0, 200) };
    }

    // Sentry status
    checks.sentry = {
      status: Sentry ? "healthy" : "not_configured",
      detail: Sentry ? "Initialized" : "No SENTRY_DSN configured",
    };

    const overallHealthy = Object.values(checks).every(c => c.status !== "unhealthy");
    res.status(overallHealthy ? 200 : 503).json({
      status: overallHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memoryUsage: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
      checks,
    });
  });

  // OG meta tags for shared review pages (crawlers don't run JS)
  app.get("/shared/:token", async (req, res, next) => {
    const ua = (req.headers["user-agent"] || "").toLowerCase();
    const isBot = /bot|crawl|spider|facebook|twitter|linkedin|slack|discord|telegram|whatsapp|preview/i.test(ua);
    if (!isBot) return next(); // Let SPA handle it for real users

    try {
      const { getReviewByShareToken, getTrackById } = await import("../db");
      const review = await getReviewByShareToken(req.params.token);
      if (!review) return next();

      let trackName = "Music Review";
      let genre = "";
      if (review.trackId) {
        const track = await getTrackById(review.trackId);
        if (track) {
          trackName = track.originalFilename.replace(/\.[^.]+$/, "");
          genre = track.detectedGenre || "";
        }
      }

      const scores = review.scoresJson as Record<string, number> | null;
      const overall = scores?.["overall"] ?? scores?.["Overall"] ?? null;
      const scoreText = overall !== null ? `${overall}/10` : "";
      const quickTake = review.quickTake || "AI-powered music critique by Troubadour";
      const title = `${trackName}${scoreText ? ` — ${scoreText}` : ""} | Troubadour`;
      const description = quickTake.substring(0, 200);

      res.status(200).set({ "Content-Type": "text/html" }).end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Troubadour">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
</head>
<body><p>${description}</p></body>
</html>`);
    } catch (e) {
      logger.warn("[OG] Failed to generate OG tags", { error: String(e) });
      next();
    }
  });

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    logger.info(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Sentry error handler (must be after all routes)
  if (Sentry) {
    Sentry.setupExpressErrorHandler(app);
  }

  // Global error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error("Unhandled error", { error: err.message, stack: err.stack });
    res.status(500).json({ error: "Internal server error" });
  });

  server.listen(port, () => {
    logger.info(`Server running on http://localhost:${port}/`);

    // Start the persistent job queue after server is ready
    import("../services/jobProcessor").then(({ startJobQueue }) => {
      startJobQueue();
    }).catch(err => {
      logger.error("Failed to start job queue", { error: err.message });
    });

    // Start the weekly digest scheduler
    import("../services/digestScheduler").then(({ startDigestScheduler }) => {
      startDigestScheduler();
    }).catch(err => {
      logger.error("Failed to start digest scheduler", { error: err.message });
    });

    // Start the daily churn alert scheduler
    import("../services/churnAlertScheduler").then(({ startChurnAlertScheduler }) => {
      startChurnAlertScheduler();
    }).catch(err => {
      logger.error("Failed to start churn alert scheduler", { error: err.message });
    });
  });

  // Register graceful shutdown handlers
  registerGracefulShutdown({ server, gracePeriodMs: 15_000 });

  // Ensure digest scheduler and churn alert scheduler are stopped on shutdown
  process.once("SIGTERM", async () => {
    try {
      const { stopDigestScheduler } = await import("../services/digestScheduler");
      stopDigestScheduler();
    } catch { /* already handled by graceful shutdown */ }
    try {
      const { stopChurnAlertScheduler } = await import("../services/churnAlertScheduler");
      stopChurnAlertScheduler();
    } catch { /* already handled by graceful shutdown */ }
  });
  process.once("SIGINT", async () => {
    try {
      const { stopDigestScheduler } = await import("../services/digestScheduler");
      stopDigestScheduler();
    } catch { /* already handled by graceful shutdown */ }
    try {
      const { stopChurnAlertScheduler } = await import("../services/churnAlertScheduler");
      stopChurnAlertScheduler();
    } catch { /* already handled by graceful shutdown */ }
  });
}

startServer().catch(console.error);
