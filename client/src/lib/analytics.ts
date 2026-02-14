/**
 * PostHog Analytics - Client-side event tracking
 * 
 * Scaffold ready for activation. Set VITE_POSTHOG_KEY env var to enable.
 * Events are no-ops when PostHog is not configured.
 */
import posthog from "posthog-js";

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST as string) || "https://us.i.posthog.com";

let initialized = false;

export function initAnalytics() {
  if (!POSTHOG_KEY || initialized) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    persistence: "localStorage+cookie",
  });
  initialized = true;
}

/** Identify user on login */
export function identifyUser(user: {
  id: number;
  openId: string;
  name: string | null;
  email?: string | null;
  tier: string | null;
}) {
  if (!POSTHOG_KEY) return;
  posthog.identify(user.openId, {
    name: user.name || "Unknown",
    email: user.email || undefined,
    tier: user.tier || "free",
    userId: user.id,
  });
}

/** Reset identity on logout */
export function resetAnalytics() {
  if (!POSTHOG_KEY) return;
  posthog.reset();
}

/** Track a custom event */
export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!POSTHOG_KEY) return;
  posthog.capture(event, properties);
}

// ─── Pre-defined event helpers ───────────────────────────────────────

export function trackProjectCreated(projectId: number, projectName: string) {
  trackEvent("project_created", { projectId, projectName });
}

export function trackTrackUploaded(projectId: number, trackName: string) {
  trackEvent("track_uploaded", { projectId, trackName });
}

export function trackReviewStarted(trackId: number, reviewType: string) {
  trackEvent("review_started", { trackId, reviewType });
}

export function trackReviewCompleted(trackId: number, overallScore?: number) {
  trackEvent("review_completed", { trackId, overallScore });
}

export function trackUpgradeClicked(fromTier: string, toTier: string, source: string) {
  trackEvent("upgrade_clicked", { fromTier, toTier, source });
}

export function trackFeatureGated(feature: string, userTier: string) {
  trackEvent("feature_gated", { feature, userTier });
}

export function trackChatSent(reviewId: number) {
  trackEvent("chat_message_sent", { reviewId });
}

export function trackExportUsed(reviewId: number, format: string) {
  trackEvent("review_exported", { reviewId, format });
}

export function trackShareLinkCreated(reviewId: number) {
  trackEvent("share_link_created", { reviewId });
}

export function trackCheckoutStarted(tier: string) {
  trackEvent("checkout_started", { tier });
}

export function trackPageView(page: string) {
  trackEvent("$pageview", { page });
}
