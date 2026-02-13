import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

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
  const app = express();
  const server = createServer(app);

  // Stripe webhook must be registered BEFORE express.json() to get raw body
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const { handleStripeWebhook } = await import("../stripe/webhook");
    return handleStripeWebhook(req, res);
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
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
      const quickTake = review.quickTake || "AI-powered music critique by FirstSpin.ai";
      const title = `${trackName}${scoreText ? ` — ${scoreText}` : ""} | FirstSpin.ai`;
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
  <meta property="og:site_name" content="FirstSpin.ai">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
</head>
<body><p>${description}</p></body>
</html>`);
    } catch (e) {
      console.warn("[OG] Failed to generate OG tags:", e);
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
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);

    // Start the persistent job queue after server is ready
    import("../services/jobProcessor").then(({ startJobQueue }) => {
      startJobQueue();
    }).catch(err => {
      console.error("[Server] Failed to start job queue:", err);
    });
  });
}

startServer().catch(console.error);
