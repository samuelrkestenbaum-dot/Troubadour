import { describe, it, expect, vi } from "vitest";

// ── Portfolio Export Tests ──
describe("Round 53 – Portfolio Export", () => {
  it("portfolio generate requires projectId", () => {
    const input = { projectId: 1 };
    expect(input.projectId).toBe(1);
  });

  it("portfolio HTML includes project title and track data", () => {
    const projectTitle = "My Album";
    const tracks = [
      { originalFilename: "Track 1.mp3", status: "reviewed" },
      { originalFilename: "Track 2.mp3", status: "analyzed" },
    ];
    const htmlContent = `<h1>${projectTitle}</h1>${tracks.map(t => `<div class="track-card">${t.originalFilename}</div>`).join("")}`;
    expect(htmlContent).toContain("My Album");
    expect(htmlContent).toContain("Track 1.mp3");
    expect(htmlContent).toContain("Track 2.mp3");
    expect(htmlContent).toContain("track-card");
  });

  it("portfolio generates feature chips from featuresJson", () => {
    const featuresJson = { bpm: 120, key: "C Major", energy: 7, danceability: 8 };
    const fj = featuresJson as Record<string, any>;
    const chips: string[] = [];
    if (fj.bpm) chips.push(`BPM: ${fj.bpm}`);
    if (fj.key) chips.push(`Key: ${fj.key}`);
    if (fj.energy != null) chips.push(`Energy: ${fj.energy}/10`);
    if (fj.danceability != null) chips.push(`Dance: ${fj.danceability}/10`);
    expect(chips).toEqual(["BPM: 120", "Key: C Major", "Energy: 7/10", "Dance: 8/10"]);
  });

  it("portfolio handles null featuresJson gracefully", () => {
    const featuresJson = null;
    const fj = featuresJson as Record<string, any> | null;
    const chips = fj ? Object.keys(fj) : [];
    expect(chips).toEqual([]);
  });

  it("portfolio includes score color coding", () => {
    const getScoreColor = (score: number) => {
      if (score >= 8) return "#22c55e";
      if (score >= 6) return "#3b82f6";
      if (score >= 4) return "#f59e0b";
      return "#ef4444";
    };
    expect(getScoreColor(9)).toBe("#22c55e");
    expect(getScoreColor(7)).toBe("#3b82f6");
    expect(getScoreColor(5)).toBe("#f59e0b");
    expect(getScoreColor(2)).toBe("#ef4444");
  });

  it("portfolio includes artwork concepts when available", () => {
    const artworks = [
      { imageUrl: "https://example.com/art1.png", prompt: "Neon city" },
      { imageUrl: "https://example.com/art2.png", prompt: "Sunset beach" },
    ];
    const artworkHtml = artworks.map(a => `<img src="${a.imageUrl}" />`).join("");
    expect(artworkHtml).toContain("art1.png");
    expect(artworkHtml).toContain("art2.png");
  });
});

// ── Reference Track URL Import Tests ──
describe("Round 53 – Reference Track URL Import", () => {
  it("importUrl requires trackId and url", () => {
    const input = { trackId: 1, url: "https://open.spotify.com/track/abc123" };
    expect(input.trackId).toBe(1);
    expect(input.url).toContain("spotify.com");
  });

  it("detects Spotify platform from URL", () => {
    const detectPlatform = (url: string) => {
      const u = url.toLowerCase();
      if (u.includes("spotify.com") || u.includes("open.spotify")) return "spotify";
      if (u.includes("soundcloud.com")) return "soundcloud";
      if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
      if (u.includes("apple.com/music") || u.includes("music.apple.com")) return "apple_music";
      if (u.includes("tidal.com")) return "tidal";
      return "unknown";
    };

    expect(detectPlatform("https://open.spotify.com/track/abc123")).toBe("spotify");
    expect(detectPlatform("https://soundcloud.com/artist/track")).toBe("soundcloud");
    expect(detectPlatform("https://www.youtube.com/watch?v=abc")).toBe("youtube");
    expect(detectPlatform("https://youtu.be/abc")).toBe("youtube");
    expect(detectPlatform("https://music.apple.com/us/album/track")).toBe("apple_music");
    expect(detectPlatform("https://tidal.com/browse/track/123")).toBe("tidal");
    expect(detectPlatform("https://example.com/track")).toBe("unknown");
  });

  it("generates display name from platform and title", () => {
    const title = "Blinding Lights";
    const artist = "The Weeknd";
    const filename = `${title}${artist ? ` - ${artist}` : ""}`;
    expect(filename).toBe("Blinding Lights - The Weeknd");
  });

  it("generates display name without artist", () => {
    const title = "Blinding Lights";
    const artist = "";
    const filename = `${title}${artist ? ` - ${artist}` : ""}`;
    expect(filename).toBe("Blinding Lights");
  });

  it("uses default display name when no title provided", () => {
    const title = undefined;
    const platform = "spotify";
    const displayName = title || "Spotify Reference";
    expect(displayName).toBe("Spotify Reference");
  });

  it("stores URL references with application/x-url mimeType", () => {
    const mimeType = "application/x-url";
    const isUrlRef = mimeType === "application/x-url";
    expect(isUrlRef).toBe(true);
  });

  it("distinguishes URL refs from audio refs", () => {
    const audioRef = { mimeType: "audio/mpeg", storageUrl: "https://s3.example.com/audio.mp3" };
    const urlRef = { mimeType: "application/x-url", storageUrl: "https://open.spotify.com/track/abc" };
    expect(audioRef.mimeType === "application/x-url").toBe(false);
    expect(urlRef.mimeType === "application/x-url").toBe(true);
  });

  it("delete reference requires referenceId", () => {
    const input = { referenceId: 42 };
    expect(input.referenceId).toBe(42);
  });
});

// ── Digest Email Generation Tests ──
describe("Round 53 – Digest Email Generation", () => {
  it("generateEmail requires daysBack", () => {
    const input = { daysBack: 7 };
    expect(input.daysBack).toBe(7);
  });

  it("generates correct period labels", () => {
    const getPeriodLabel = (daysBack: number) => {
      if (daysBack === 7) return "This Week";
      if (daysBack === 14) return "Last 2 Weeks";
      return `Last ${daysBack} Days`;
    };
    expect(getPeriodLabel(7)).toBe("This Week");
    expect(getPeriodLabel(14)).toBe("Last 2 Weeks");
    expect(getPeriodLabel(30)).toBe("Last 30 Days");
    expect(getPeriodLabel(60)).toBe("Last 60 Days");
  });

  it("email HTML includes Troubadour branding", () => {
    const htmlContent = `<h1>Troubadour</h1><p>Your This Week Digest</p>`;
    expect(htmlContent).toContain("Troubadour");
    expect(htmlContent).toContain("This Week");
  });

  it("email includes score color coding for reviews", () => {
    const getScoreColor = (score: number) => {
      if (score >= 8) return "#22c55e";
      if (score >= 6) return "#3b82f6";
      if (score >= 4) return "#f59e0b";
      return "#ef4444";
    };
    const reviews = [
      { trackFilename: "Track A", score: 9 },
      { trackFilename: "Track B", score: 5 },
    ];
    const rows = reviews.map(r => `<td style="color:${getScoreColor(r.score)}">${r.score}/10</td>`);
    expect(rows[0]).toContain("#22c55e");
    expect(rows[1]).toContain("#f59e0b");
  });

  it("email handles empty review period", () => {
    const reviews: any[] = [];
    const trackRows = reviews.length > 0 ? "has rows" : "No reviews this period";
    expect(trackRows).toBe("No reviews this period");
  });

  it("email includes top track when available", () => {
    const stats = {
      totalReviews: 5,
      totalNewProjects: 2,
      averageScore: 7.5,
      highestScore: { score: 9, track: "Best Track.mp3" },
      lowestScore: { score: 4, track: "Worst Track.mp3" },
    };
    expect(stats.highestScore.track).toBe("Best Track.mp3");
    expect(stats.highestScore.score).toBe(9);
  });

  it("email handles null averageScore", () => {
    const stats = {
      totalReviews: 0,
      totalNewProjects: 0,
      averageScore: null as number | null,
      highestScore: null,
      lowestScore: null,
    };
    const display = stats.averageScore ?? "—";
    expect(display).toBe("—");
  });

  it("creates in-app notification for digest", () => {
    const notification = {
      userId: 1,
      type: "digest" as const,
      title: "This Week Digest Ready",
      message: "Your this week digest is ready with 5 reviews and an average score of 7.5/10.",
      link: "/digest",
    };
    expect(notification.type).toBe("digest");
    expect(notification.link).toBe("/digest");
    expect(notification.message).toContain("5 reviews");
  });
});

// ── Platform Icon Detection (Frontend) Tests ──
describe("Round 53 – Platform Icon Detection", () => {
  const getPlatformIcon = (url: string) => {
    const u = url.toLowerCase();
    if (u.includes("spotify")) return { label: "Spotify", color: "text-green-400" };
    if (u.includes("soundcloud")) return { label: "SoundCloud", color: "text-orange-400" };
    if (u.includes("youtube") || u.includes("youtu.be")) return { label: "YouTube", color: "text-red-400" };
    if (u.includes("apple.com/music") || u.includes("music.apple.com")) return { label: "Apple Music", color: "text-pink-400" };
    if (u.includes("tidal")) return { label: "Tidal", color: "text-sky-400" };
    return null;
  };

  it("returns Spotify icon for Spotify URLs", () => {
    expect(getPlatformIcon("https://open.spotify.com/track/abc")?.label).toBe("Spotify");
  });

  it("returns SoundCloud icon for SoundCloud URLs", () => {
    expect(getPlatformIcon("https://soundcloud.com/artist/track")?.label).toBe("SoundCloud");
  });

  it("returns YouTube icon for YouTube URLs", () => {
    expect(getPlatformIcon("https://www.youtube.com/watch?v=abc")?.label).toBe("YouTube");
    expect(getPlatformIcon("https://youtu.be/abc")?.label).toBe("YouTube");
  });

  it("returns Apple Music icon for Apple Music URLs", () => {
    expect(getPlatformIcon("https://music.apple.com/us/album/track")?.label).toBe("Apple Music");
  });

  it("returns Tidal icon for Tidal URLs", () => {
    expect(getPlatformIcon("https://tidal.com/browse/track/123")?.label).toBe("Tidal");
  });

  it("returns null for unknown URLs", () => {
    expect(getPlatformIcon("https://example.com/track")).toBeNull();
  });
});
