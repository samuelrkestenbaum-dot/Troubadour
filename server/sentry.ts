import * as Sentry from "@sentry/node";
import { ENV } from "./_core/env";

let initialized = false;

export function initSentry() {
  if (initialized || !ENV.sentryDsn) return;

  Sentry.init({
    dsn: ENV.sentryDsn,
    environment: ENV.isProduction ? "production" : "development",
    tracesSampleRate: ENV.isProduction ? 0.2 : 1.0,
    profilesSampleRate: ENV.isProduction ? 0.1 : 0,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
    beforeSend(event) {
      // Scrub sensitive data
      if (event.request?.cookies) {
        event.request.cookies = {};
      }
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
      }
      return event;
    },
  });

  initialized = true;
  console.log("[Sentry] Initialized server-side error monitoring");
}

export function captureError(error: Error, context?: Record<string, any>) {
  if (!initialized) {
    console.error("[Sentry] Not initialized, logging error:", error.message);
    return;
  }
  Sentry.captureException(error, {
    extra: context,
  });
}

export function captureMessage(message: string, level: "info" | "warning" | "error" = "info") {
  if (!initialized) return;
  Sentry.captureMessage(message, level);
}

export { Sentry };
