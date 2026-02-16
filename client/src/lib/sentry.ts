import * as Sentry from "@sentry/react";

let initialized = false;

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (initialized || !dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.MODE === "production" ? 0.2 : 1.0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: import.meta.env.MODE === "production" ? 1.0 : 0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    beforeSend(event) {
      // Don't send events in development unless DSN is explicitly set
      if (import.meta.env.MODE !== "production" && !dsn) {
        return null;
      }
      return event;
    },
  });

  initialized = true;
  console.log("[Sentry] Initialized client-side error monitoring");
}

export function captureError(error: Error, context?: Record<string, any>) {
  if (!initialized) return;
  Sentry.captureException(error, { extra: context });
}

export const SentryErrorBoundary = Sentry.ErrorBoundary;
export { Sentry };
