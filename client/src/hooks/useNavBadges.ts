/**
 * useNavBadges — Lightweight sidebar badge system for Intelligence Suite features.
 *
 * Tracks "last visited" timestamps in localStorage per feature path.
 * Compares against the latest data timestamps from existing tRPC queries
 * to show a "new activity" dot on sidebar items.
 *
 * No new DB tables needed — purely client-side with server data timestamps.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const STORAGE_KEY = "troubadour_nav_visits";

/** Features that can show badges */
const BADGE_FEATURES = [
  "/insights",
  "/digest",
] as const;

type BadgeFeature = (typeof BADGE_FEATURES)[number];

interface VisitMap {
  [path: string]: number; // timestamp of last visit
}

function getVisitMap(): VisitMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setVisitMap(map: VisitMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage full or unavailable
  }
}

export function useNavBadges() {
  const { user } = useAuth();
  const [visitMap, setVisitMapState] = useState<VisitMap>(getVisitMap);

  // Fetch lightweight data to determine "new activity" for each feature
  // Only fetch when user is logged in
  const streakQuery = trpc.streak.get.useQuery(undefined, {
    enabled: !!user,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const skillQuery = trpc.skillTracker.overview.useQuery(undefined, {
    enabled: !!user,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const artistDNAQuery = trpc.artistDNA.latest.useQuery(undefined, {
    enabled: !!user,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const flywheelQuery = trpc.flywheel.archetype.useQuery(undefined, {
    enabled: !!user,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  /** Mark a feature as "visited now" */
  const markVisited = useCallback((path: string) => {
    const updated = { ...getVisitMap(), [path]: Date.now() };
    setVisitMap(updated);
    setVisitMapState(updated);
  }, []);

  /** Determine which features have new activity since last visit */
  const badges = useMemo(() => {
    const result: Record<string, boolean> = {};

    for (const path of BADGE_FEATURES) {
      result[path] = false;
    }

    if (!user) return result;

    const lastVisit = (path: string) => visitMap[path] || 0;

    // Insights: show badge if any Intelligence Suite data has been updated since last visit
    const insightsLastVisit = lastVisit("/insights");
    let insightsHasNew = false;

    if (streakQuery.data) {
      const streakData = streakQuery.data as { updatedAt?: string | Date; currentStreak?: number };
      const updatedAt = streakData.updatedAt ? new Date(streakData.updatedAt).getTime() : 0;
      if (updatedAt > insightsLastVisit && (streakData.currentStreak ?? 0) > 0) insightsHasNew = true;
    }
    if (skillQuery.data) {
      const skillData = skillQuery.data as { latestAt?: string | Date; totalEntries?: number };
      const latestAt = skillData.latestAt ? new Date(skillData.latestAt).getTime() : 0;
      if (latestAt > insightsLastVisit && (skillData.totalEntries ?? 0) > 0) insightsHasNew = true;
    }
    if (artistDNAQuery.data) {
      const dnaData = artistDNAQuery.data as { generatedAt?: string | Date };
      const generatedAt = dnaData.generatedAt ? new Date(dnaData.generatedAt).getTime() : 0;
      if (generatedAt > insightsLastVisit) insightsHasNew = true;
    }
    if (flywheelQuery.data) {
      const fwData = flywheelQuery.data as { updatedAt?: string | Date };
      const updatedAt = fwData.updatedAt ? new Date(fwData.updatedAt).getTime() : 0;
      if (updatedAt > insightsLastVisit) insightsHasNew = true;
    }
    if (!visitMap["/insights"]) {
      const hasReviews = (skillQuery.data as { totalEntries?: number })?.totalEntries ?? 0;
      if (hasReviews > 0) insightsHasNew = true;
    }
    result["/insights"] = insightsHasNew;

    // Digest: show badge if never visited
    if (!visitMap["/digest"]) result["/digest"] = true;

    return result;
  }, [user, visitMap, streakQuery.data, skillQuery.data, artistDNAQuery.data, flywheelQuery.data]);

  /** Count of features with new activity */
  const totalBadges = useMemo(() => {
    return Object.values(badges).filter(Boolean).length;
  }, [badges]);

  return { badges, totalBadges, markVisited };
}
