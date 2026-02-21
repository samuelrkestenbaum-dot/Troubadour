import { nanoid } from "nanoid";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure, aiReviewProcedure, exportProcedure } from "../_core/trpc";
import * as db from "../db";
import { assertFeatureAllowed } from "../guards";
import archiver from "archiver";
import { storagePut } from "../storage";
import { reshapeReview, ACTION_MODES, type ActionModeKey } from "../services/actionModes";
import { exportReviewPdf } from "../services/pdfExport";

export const reviewRouter = router({
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const review = await db.getReviewById(input.id);
      if (!review || review.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Review not found" });
      }
      // Include detected genre from the track if this is a track review
      let genreInsight: { detectedGenre: string | null; detectedSubgenres: string | null; detectedInfluences: string | null } | null = null;
      if (review.trackId) {
        const track = await db.getTrackById(review.trackId);
        if (track) {
          genreInsight = {
            detectedGenre: track.detectedGenre,
            detectedSubgenres: track.detectedSubgenres,
            detectedInfluences: track.detectedInfluences,
          };
        }
      }
      return { ...review, genreInsight };
    }),

  listByTrack: protectedProcedure
    .input(z.object({ trackId: z.number() }))
    .query(async ({ ctx, input }) => {
      const track = await db.getTrackById(input.trackId);
      if (!track || track.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
      }
      return db.getReviewsByTrack(input.trackId);
    }),

  albumReview: aiReviewProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await db.getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      return db.getAlbumReview(input.projectId);
    }),

  versionDiff: protectedProcedure
    .input(z.object({ trackId: z.number() }))
    .query(async ({ ctx, input }) => {
      const track = await db.getTrackById(input.trackId);
      if (!track || track.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
      }
      if (!track.parentTrackId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This track has no previous version to compare" });
      }
      const parentTrack = await db.getTrackById(track.parentTrackId);
      if (!parentTrack) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Parent track not found" });
      }
      const currentReviews = await db.getReviewsByTrack(track.id);
      const parentReviews = await db.getReviewsByTrack(parentTrack.id);
      const currentReview = currentReviews.find(r => r.reviewType === "track");
      const parentReview = parentReviews.find(r => r.reviewType === "track");
      // Find comparison review
      const comparisonReviews = currentReviews.filter(r => r.reviewType === "comparison");
      const comparisonReview = comparisonReviews.length > 0 ? comparisonReviews[comparisonReviews.length - 1] : null;
      // Calculate score deltas
      const currentScores = (currentReview?.scoresJson as Record<string, number>) || {};
      const parentScores = (parentReview?.scoresJson as Record<string, number>) || {};
      const allKeys = Array.from(new Set([...Object.keys(currentScores), ...Object.keys(parentScores)]));
      const deltas: Record<string, { previous: number | null; current: number | null; delta: number }> = {};
      for (const key of allKeys) {
        const prev = parentScores[key] ?? null;
        const curr = currentScores[key] ?? null;
        deltas[key] = {
          previous: prev,
          current: curr,
          delta: (curr ?? 0) - (prev ?? 0),
        };
      }
      return {
        currentTrack: { id: track.id, filename: track.originalFilename, versionNumber: track.versionNumber, genre: track.detectedGenre },
        parentTrack: { id: parentTrack.id, filename: parentTrack.originalFilename, versionNumber: parentTrack.versionNumber, genre: parentTrack.detectedGenre },
        currentReview: currentReview ? { id: currentReview.id, quickTake: currentReview.quickTake, scores: currentScores } : null,
        parentReview: parentReview ? { id: parentReview.id, quickTake: parentReview.quickTake, scores: parentScores } : null,
        comparisonReview: comparisonReview ? { id: comparisonReview.id, markdown: comparisonReview.reviewMarkdown, quickTake: comparisonReview.quickTake } : null,
        deltas,
      };
    }),

  reviewDiff: protectedProcedure
    .input(z.object({ reviewIdA: z.number(), reviewIdB: z.number() }))
    .query(async ({ ctx, input }) => {
      const reviewA = await db.getReviewById(input.reviewIdA);
      const reviewB = await db.getReviewById(input.reviewIdB);
      if (!reviewA || reviewA.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Review A not found" });
      }
      if (!reviewB || reviewB.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Review B not found" });
      }
      const scoresA = (reviewA.scoresJson as Record<string, number>) || {};
      const scoresB = (reviewB.scoresJson as Record<string, number>) || {};
      const allKeys = Array.from(new Set([...Object.keys(scoresA), ...Object.keys(scoresB)]));
      const scoreDeltas: Record<string, { old: number | null; new_: number | null; delta: number }> = {};
      for (const key of allKeys) {
        const oldVal = scoresA[key] ?? null;
        const newVal = scoresB[key] ?? null;
        scoreDeltas[key] = {
          old: oldVal,
          new_: newVal,
          delta: (newVal ?? 0) - (oldVal ?? 0),
        };
      }
      return {
        reviewA: {
          id: reviewA.id,
          reviewVersion: reviewA.reviewVersion,
          reviewMarkdown: reviewA.reviewMarkdown,
          quickTake: reviewA.quickTake,
          scores: scoresA,
          createdAt: reviewA.createdAt,
        },
        reviewB: {
          id: reviewB.id,
          reviewVersion: reviewB.reviewVersion,
          reviewMarkdown: reviewB.reviewMarkdown,
          quickTake: reviewB.quickTake,
          scores: scoresB,
          createdAt: reviewB.createdAt,
        },
        scoreDeltas,
      };
    }),

  exportMarkdown: exportProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const review = await db.getReviewById(input.id);
      if (!review || review.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Review not found" });
      }
      const user = await db.getUserById(ctx.user.id);
      assertFeatureAllowed(user?.tier || "free", "export");
      let trackName = "Unknown Track";
      let genreLine = "";
      if (review.trackId) {
        const track = await db.getTrackById(review.trackId);
        if (track) {
          trackName = track.originalFilename;
          if (track.detectedGenre) {
            genreLine = `**Genre:** ${track.detectedGenre}`;
            if (track.detectedSubgenres) genreLine += ` | ${track.detectedSubgenres}`;
            genreLine += "\n";
          }
        }
      }
      const scores = review.scoresJson as Record<string, number> | null;
      let scoresTable = "";
      if (scores && Object.keys(scores).length > 0) {
        scoresTable = "\n## Scores\n\n| Category | Score |\n|----------|-------|\n";
        for (const [k, v] of Object.entries(scores)) {
          scoresTable += `| ${k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).trim()} | ${v}/10 |\n`;
        }
      }
      const exportMd = `# Troubadour Review — ${trackName}\n\n${genreLine}${review.quickTake ? `> ${review.quickTake}\n\n` : ""}${scoresTable}\n${review.reviewMarkdown || ""}\n\n---\n*Generated by Troubadour on ${new Date(review.createdAt).toLocaleDateString()}*\n`;
      return { markdown: exportMd, filename: `troubadour-review-${trackName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.md` };
    }),

  generateShareLink: protectedProcedure
    .input(z.object({
      id: z.number(),
      expiresIn: z.enum(["24h", "7d", "30d", "never"]).optional().default("never"),
    }))
    .mutation(async ({ ctx, input }) => {
      const review = await db.getReviewById(input.id);
      if (!review || review.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Review not found" });
      }
      const user = await db.getUserById(ctx.user.id);
      assertFeatureAllowed(user?.tier || "free", "share");
      if (review.shareToken) {
        return { shareToken: review.shareToken, expiresAt: review.shareExpiresAt };
      }
      const token = nanoid(24);
      const expiresAt = input.expiresIn === "never" ? null
        : input.expiresIn === "24h" ? new Date(Date.now() + 24 * 60 * 60 * 1000)
        : input.expiresIn === "7d" ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await db.setReviewShareToken(input.id, token, expiresAt);
      return { shareToken: token, expiresAt };
    }),
  revokeShareLink: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const review = await db.getReviewById(input.id);
      if (!review || review.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Review not found" });
      }
      await db.revokeReviewShareToken(input.id);
      return { success: true };
    }),

  history: protectedProcedure
    .input(z.object({ trackId: z.number() }))
    .query(async ({ ctx, input }) => {
      const track = await db.getTrackById(input.trackId);
      if (!track || track.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
      }
      return db.getReviewHistory(input.trackId);
    }),

  exportHtml: exportProcedure
    .input(z.object({ reviewId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const review = await db.getReviewById(input.reviewId);
      if (!review || review.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Review not found" });
      }
      const track = review.trackId ? await db.getTrackById(review.trackId) : null;
      const project = await db.getProjectById(review.projectId);
      const scores = review.scoresJson as Record<string, number> | undefined;

      // Convert markdown to basic HTML
      const reviewHtml = review.reviewMarkdown
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
        .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/gim, '<em>$1</em>')
        .replace(/^- (.*$)/gim, '<li>$1</li>')
        .replace(/\n\n/gim, '</p><p>')
        .replace(/\n/gim, '<br>');

      let scoresHtml = '';
      if (scores && Object.keys(scores).length > 0) {
        scoresHtml = `<h2>Scores</h2><div class="scores">${Object.entries(scores).map(([k, v]) =>
          `<div class="score-item"><span class="score-label">${k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</span><span class="score-value">${v}/10</span></div>`
        ).join('')}</div>`;
      }

      const htmlContent = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Review - ${project?.title || 'Project'} - ${track?.originalFilename || 'Review'}</title><style>
        body{font-family:system-ui,-apple-system,sans-serif;line-height:1.7;color:#1a1a2e;max-width:800px;margin:0 auto;padding:40px 20px}
        h1{font-size:2em;margin-bottom:0.3em;color:#0f0f23} h2{font-size:1.4em;margin-top:1.5em;color:#1a1a2e;border-bottom:2px solid #e8e8f0;padding-bottom:0.3em}
        h3{font-size:1.15em;margin-top:1.2em;color:#2a2a4a} .header{border-bottom:2px solid #c8102e;padding-bottom:16px;margin-bottom:24px}
        .quick-take{font-style:italic;color:#555;padding:12px 16px;background:#f8f8fc;border-left:4px solid #c8102e;margin:16px 0}
        .scores{display:grid;grid-template-columns:repeat(2,1fr);gap:8px 24px;padding:16px;background:#f8f8fc;border-radius:8px;margin:12px 0}
        .score-item{display:flex;justify-content:space-between;padding:4px 0} .score-label{font-weight:600;color:#555} .score-value{font-weight:700;color:#c8102e}
        blockquote{border-left:4px solid #ddd;padding-left:12px;color:#666;margin:12px 0} li{margin:4px 0}
        @media print{body{padding:20px}}
      </style></head><body>
        <div class="header"><h1>${project?.title || 'Project Review'}</h1>${track ? `<p style="font-size:1.2em;color:#555">Track: ${track.originalFilename}</p>` : ''}<p style="color:#888">Review Type: ${review.reviewType.charAt(0).toUpperCase() + review.reviewType.slice(1)} &middot; ${new Date(review.createdAt).toLocaleDateString()}</p></div>
        ${review.quickTake ? `<div class="quick-take">"${review.quickTake}"</div>` : ''}
        ${scoresHtml}
        <h2>Detailed Review</h2><div><p>${reviewHtml}</p></div>
        <footer style="margin-top:40px;padding-top:16px;border-top:1px solid #e8e8f0;color:#999;font-size:0.85em;text-align:center">Generated by Troubadour AI</footer>
      </body></html>`;

      return { htmlContent };
    }),

  getPublic: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input }) => {
      const review = await db.getReviewByShareToken(input.token);
      if (!review) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Review not found or link has expired" });
      }
      if (review.shareExpiresAt && new Date(review.shareExpiresAt) < new Date()) {
        throw new TRPCError({ code: "NOT_FOUND", message: "This share link has expired" });
      }
      let trackName = "Unknown Track";
      let genreInsight: { detectedGenre: string | null; detectedSubgenres: string | null; detectedInfluences: string | null } | null = null;
      if (review.trackId) {
        const track = await db.getTrackById(review.trackId);
        if (track) {
          trackName = track.originalFilename;
          genreInsight = {
            detectedGenre: track.detectedGenre,
            detectedSubgenres: track.detectedSubgenres,
            detectedInfluences: track.detectedInfluences,
          };
        }
      }
      return {
        reviewType: review.reviewType,
        reviewMarkdown: review.reviewMarkdown,
        scoresJson: review.scoresJson,
        quickTake: review.quickTake,
        createdAt: review.createdAt,
        trackName,
        genreInsight,
      };
    }),

  exportAllReviews: exportProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const project = await db.getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      const allTracks = await db.getTracksByProject(input.projectId);
      const allReviews = await db.getReviewsByProject(input.projectId);

      // Build a combined HTML report
      let tracksHtml = '';
      for (const track of allTracks) {
        const trackReview = allReviews.find(r => r.trackId === track.id && r.isLatest && r.reviewType === 'track');
        if (!trackReview) continue;
        const scores = trackReview.scoresJson as Record<string, number> | undefined;
        const reviewHtml = trackReview.reviewMarkdown
          .replace(/^### (.*$)/gim, '<h3>$1</h3>')
          .replace(/^## (.*$)/gim, '<h2>$1</h2>')
          .replace(/^# (.*$)/gim, '<h1>$1</h1>')
          .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
          .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/gim, '<em>$1</em>')
          .replace(/^- (.*$)/gim, '<li>$1</li>')
          .replace(/\n\n/gim, '</p><p>')
          .replace(/\n/gim, '<br>');

        let scoresHtml = '';
        if (scores && Object.keys(scores).length > 0) {
          scoresHtml = `<div class="scores">${Object.entries(scores).map(([k, v]) =>
            `<div class="score-item"><span class="score-label">${k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</span><span class="score-value">${v}/10</span></div>`
          ).join('')}</div>`;
        }

        tracksHtml += `
          <div class="track-section">
            <h2>${track.originalFilename}</h2>
            ${track.detectedGenre ? `<p class="genre">Genre: ${track.detectedGenre}${track.detectedSubgenres ? ` | ${track.detectedSubgenres}` : ''}</p>` : ''}
            ${trackReview.quickTake ? `<div class="quick-take">"${trackReview.quickTake}"</div>` : ''}
            ${scoresHtml}
            <div class="review-content"><p>${reviewHtml}</p></div>
          </div>
          <hr class="track-divider">`;
      }

      // Album review if exists
      const albumReview = allReviews.find(r => r.reviewType === 'album' && r.isLatest);
      let albumHtml = '';
      if (albumReview) {
        const albumContent = albumReview.reviewMarkdown
          .replace(/^### (.*$)/gim, '<h3>$1</h3>')
          .replace(/^## (.*$)/gim, '<h2>$1</h2>')
          .replace(/^# (.*$)/gim, '<h1>$1</h1>')
          .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
          .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/gim, '<em>$1</em>')
          .replace(/^- (.*$)/gim, '<li>$1</li>')
          .replace(/\n\n/gim, '</p><p>')
          .replace(/\n/gim, '<br>');
        albumHtml = `<div class="album-review"><h2>Album Review</h2>${albumReview.quickTake ? `<div class="quick-take">"${albumReview.quickTake}"</div>` : ''}<div class="review-content"><p>${albumContent}</p></div></div>`;
      }

      const htmlContent = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${project.title} - Full Review Report</title><style>
        body{font-family:system-ui,-apple-system,sans-serif;line-height:1.7;color:#1a1a2e;max-width:800px;margin:0 auto;padding:40px 20px}
        h1{font-size:2em;margin-bottom:0.3em;color:#0f0f23} h2{font-size:1.4em;margin-top:1.5em;color:#1a1a2e;border-bottom:2px solid #e8e8f0;padding-bottom:0.3em}
        h3{font-size:1.15em;margin-top:1.2em;color:#2a2a4a} .header{border-bottom:2px solid #c8102e;padding-bottom:16px;margin-bottom:24px}
        .quick-take{font-style:italic;color:#555;padding:12px 16px;background:#f8f8fc;border-left:4px solid #c8102e;margin:16px 0}
        .scores{display:grid;grid-template-columns:repeat(2,1fr);gap:8px 24px;padding:16px;background:#f8f8fc;border-radius:8px;margin:12px 0}
        .score-item{display:flex;justify-content:space-between;padding:4px 0} .score-label{font-weight:600;color:#555} .score-value{font-weight:700;color:#c8102e}
        blockquote{border-left:4px solid #ddd;padding-left:12px;color:#666;margin:12px 0} li{margin:4px 0}
        .track-section{margin:24px 0} .track-divider{border:none;border-top:2px solid #e8e8f0;margin:32px 0}
        .genre{color:#888;font-size:0.9em;margin-top:-8px} .album-review{margin-top:40px;padding-top:24px;border-top:3px solid #c8102e}
        @media print{body{padding:20px} .track-section{page-break-inside:avoid}}
      </style></head><body>
        <div class="header">
          <h1>${project.title}</h1>
          <p style="color:#888">${allTracks.length} track${allTracks.length !== 1 ? 's' : ''} &middot; ${project.type.charAt(0).toUpperCase() + project.type.slice(1)} &middot; ${new Date().toLocaleDateString()}</p>
        </div>
        ${tracksHtml}
        ${albumHtml}
        <footer style="margin-top:40px;padding-top:16px;border-top:1px solid #e8e8f0;color:#999;font-size:0.85em;text-align:center">Generated by Troubadour AI</footer>
      </body></html>`;

      return { htmlContent };
    }),

  exportHistory: exportProcedure
    .input(z.object({ trackId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const track = await db.getTrackById(input.trackId);
      if (!track || track.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
      }
      const allReviews = await db.getReviewsByTrack(input.trackId);
      const trackReviews = allReviews
        .filter(r => r.reviewType === "track")
        .sort((a, b) => (a.reviewVersion ?? 1) - (b.reviewVersion ?? 1));
      if (trackReviews.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No reviews found for this track" });
      }
      const markdownToHtml = (md: string) => md
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
        .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/gim, '<em>$1</em>')
        .replace(/^- (.*$)/gim, '<li>$1</li>')
        .replace(/\n\n/gim, '</p><p>')
        .replace(/\n/gim, '<br>');
      let versionsHtml = '';
      for (const review of trackReviews) {
        const scores = review.scoresJson as Record<string, number> | undefined;
        let scoresHtml = '';
        if (scores && Object.keys(scores).length > 0) {
          scoresHtml = `<div class="scores">${Object.entries(scores).map(([k, v]) =>
            `<div class="score-item"><span class="score-label">${k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</span><span class="score-value">${v}/10</span></div>`
          ).join('')}</div>`;
        }
        const reviewHtml = markdownToHtml(review.reviewMarkdown);
        const date = new Date(review.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        versionsHtml += `
          <div class="version-section">
            <div class="version-header">
              <span class="version-badge">Version ${review.reviewVersion ?? 1}</span>
              <span class="version-date">${date}</span>
              ${review.isLatest ? '<span class="latest-badge">Latest</span>' : ''}
            </div>
            ${review.quickTake ? `<div class="quick-take">"${review.quickTake}"</div>` : ''}
            ${scoresHtml}
            <div class="review-content"><p>${reviewHtml}</p></div>
          </div>
          <hr class="version-divider">`;
      }
      // Score comparison summary
      let comparisonHtml = '';
      if (trackReviews.length >= 2) {
        const first = trackReviews[0].scoresJson as Record<string, number> | undefined;
        const last = trackReviews[trackReviews.length - 1].scoresJson as Record<string, number> | undefined;
        if (first && last) {
          const dims = Object.keys(last);
          comparisonHtml = `<div class="comparison"><h2>Score Evolution</h2><div class="scores">${dims.map(k => {
            const delta = (last[k] ?? 0) - (first[k] ?? 0);
            const arrow = delta > 0 ? '\u2191' : delta < 0 ? '\u2193' : '\u2192';
            const color = delta > 0 ? '#22c55e' : delta < 0 ? '#ef4444' : '#888';
            return `<div class="score-item"><span class="score-label">${k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</span><span class="score-value" style="color:${color}">${first[k] ?? '-'} ${arrow} ${last[k] ?? '-'}</span></div>`;
          }).join('')}</div></div>`;
        }
      }
      const htmlContent = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${track.originalFilename} - Review History</title><style>
        body{font-family:system-ui,-apple-system,sans-serif;line-height:1.7;color:#1a1a2e;max-width:800px;margin:0 auto;padding:40px 20px}
        h1{font-size:2em;margin-bottom:0.3em;color:#0f0f23} h2{font-size:1.4em;margin-top:1.5em;color:#1a1a2e;border-bottom:2px solid #e8e8f0;padding-bottom:0.3em}
        h3{font-size:1.15em;margin-top:1.2em;color:#2a2a4a} .header{border-bottom:2px solid #c8102e;padding-bottom:16px;margin-bottom:24px}
        .quick-take{font-style:italic;color:#555;padding:12px 16px;background:#f8f8fc;border-left:4px solid #c8102e;margin:16px 0}
        .scores{display:grid;grid-template-columns:repeat(2,1fr);gap:8px 24px;padding:16px;background:#f8f8fc;border-radius:8px;margin:12px 0}
        .score-item{display:flex;justify-content:space-between;padding:4px 0} .score-label{font-weight:600;color:#555} .score-value{font-weight:700;color:#c8102e}
        blockquote{border-left:4px solid #ddd;padding-left:12px;color:#666;margin:12px 0} li{margin:4px 0}
        .version-section{margin:24px 0} .version-divider{border:none;border-top:2px solid #e8e8f0;margin:32px 0}
        .version-header{display:flex;align-items:center;gap:12px;margin-bottom:12px}
        .version-badge{background:#c8102e;color:white;padding:4px 12px;border-radius:20px;font-size:0.85em;font-weight:700}
        .version-date{color:#888;font-size:0.9em} .latest-badge{background:#22c55e;color:white;padding:2px 8px;border-radius:12px;font-size:0.75em;font-weight:600}
        .comparison{margin-top:32px;padding-top:24px;border-top:3px solid #c8102e}
        @media print{body{padding:20px} .version-section{page-break-inside:avoid}}
      </style></head><body>
        <div class="header">
          <h1>${track.originalFilename}</h1>
          <p style="color:#888">${trackReviews.length} review version${trackReviews.length !== 1 ? 's' : ''} &middot; ${track.detectedGenre || 'Unknown genre'} &middot; ${new Date().toLocaleDateString()}</p>
        </div>
        ${comparisonHtml}
        ${versionsHtml}
        <footer style="margin-top:40px;padding-top:16px;border-top:1px solid #e8e8f0;color:#999;font-size:0.85em;text-align:center">Generated by Troubadour AI</footer>
      </body></html>`;
      // Also generate markdown version
      let markdown = `# ${track.originalFilename} - Review History\n\n`;
      markdown += `> ${trackReviews.length} review version${trackReviews.length !== 1 ? 's' : ''} | ${track.detectedGenre || 'Unknown genre'} | ${new Date().toLocaleDateString()}\n\n---\n\n`;
      for (const review of trackReviews) {
        const scores = review.scoresJson as Record<string, number> | undefined;
        const date = new Date(review.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        markdown += `## Version ${review.reviewVersion ?? 1} — ${date}${review.isLatest ? ' (Latest)' : ''}\n\n`;
        if (review.quickTake) markdown += `> ${review.quickTake}\n\n`;
        if (scores) {
          markdown += `| Dimension | Score |\n|-----------|-------|\n`;
          for (const [k, v] of Object.entries(scores)) {
            markdown += `| ${k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())} | ${v}/10 |\n`;
          }
          markdown += `\n`;
        }
        markdown += review.reviewMarkdown + `\n\n---\n\n`;
      }
      return { htmlContent, markdown, trackName: track.originalFilename, versionCount: trackReviews.length };
    }),

  exportZip: exportProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const project = await db.getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      const allTracks = await db.getTracksByProject(input.projectId);
      const allReviews = await db.getReviewsByProject(input.projectId);
      const albumReview = allReviews.find(r => r.reviewType === "album" && r.isLatest);

      // Build ZIP in memory
      const chunks: Buffer[] = [];
      const archive = archiver("zip", { zlib: { level: 9 } });
      archive.on("data", (chunk: Buffer) => chunks.push(chunk));
      const finalized = new Promise<void>((resolve, reject) => {
        archive.on("end", resolve);
        archive.on("error", reject);
      });

      // Add each track review as a Markdown file
      for (const track of allTracks) {
        const trackReview = allReviews.find(r => r.trackId === track.id && r.isLatest && r.reviewType === "track");
        if (!trackReview) continue;

        const scores = trackReview.scoresJson as Record<string, number> | undefined;
        const safeName = track.originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.[^.]+$/, "");
        let md = `# ${track.originalFilename}\n\n`;
        const overallScore = scores?.overall ?? scores?.Overall;
        md += `**Overall Score:** ${overallScore ?? "N/A"}/10\n`;
        if (track.detectedGenre) md += `**Genre:** ${track.detectedGenre}${track.detectedSubgenres ? " | " + track.detectedSubgenres : ""}\n`;
        md += `**Model:** ${trackReview.modelUsed ?? "AI"}\n`;
        md += `**Date:** ${new Date(trackReview.createdAt).toLocaleDateString()}\n`;
        if (trackReview.quickTake) md += `\n> ${trackReview.quickTake}\n`;

        if (scores && Object.keys(scores).length > 0) {
          md += `\n| Category | Score |\n| --- | --- |\n`;
          for (const [k, v] of Object.entries(scores)) {
            md += `| ${k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())} | ${v}/10 |\n`;
          }
        }
        md += `\n---\n\n${trackReview.reviewMarkdown}\n`;
        archive.append(md, { name: `tracks/${safeName}.md` });
      }

      // Add album review if present
      if (albumReview) {
        const albumScores = albumReview.scoresJson as Record<string, number> | undefined;
        let albumMd = `# Album Review: ${project.title}\n\n`;
        const albumOverall = albumScores?.overall ?? albumScores?.Overall;
        albumMd += `**Overall Score:** ${albumOverall ?? "N/A"}/10\n`;
        albumMd += `**Model:** ${albumReview.modelUsed ?? "AI"}\n`;
        albumMd += `**Date:** ${new Date(albumReview.createdAt).toLocaleDateString()}\n`;
        if (albumReview.quickTake) albumMd += `\n> ${albumReview.quickTake}\n`;
        if (albumScores && Object.keys(albumScores).length > 0) {
          albumMd += `\n| Category | Score |\n| --- | --- |\n`;
          for (const [k, v] of Object.entries(albumScores)) {
            albumMd += `| ${k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())} | ${v}/10 |\n`;
          }
        }
        albumMd += `\n---\n\n${albumReview.reviewMarkdown}\n`;
        archive.append(albumMd, { name: "album-review.md" });
      }

      // Add a README
      const readmeMd = `# ${project.title} — AI Reviews\n\nExported from Troubadour on ${new Date().toLocaleDateString()}.\n\n## Contents\n\n- \`tracks/\` — Individual track reviews (${allTracks.length} tracks)\n${albumReview ? "- `album-review.md` — Album-level review\n" : ""}\n---\n\n*Generated by [Troubadour](https://troubadour.app) — AI-powered music critique*\n`;
      archive.append(readmeMd, { name: "README.md" });

      await archive.finalize();
      await finalized;

      const zipBuffer = Buffer.concat(chunks);
      const safeProjectName = project.title.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
      const fileKey = `exports/${ctx.user.id}/${safeProjectName}-reviews-${Date.now()}.zip`;
      const { url } = await storagePut(fileKey, zipBuffer, "application/zip");

      return {
        url,
        filename: `${safeProjectName}-reviews.zip`,
        trackCount: allTracks.filter(t => allReviews.some(r => r.trackId === t.id && r.isLatest && r.reviewType === "track")).length,
        hasAlbumReview: !!albumReview,
      };
    }),

  actionMode: protectedProcedure
    .input(z.object({
      reviewId: z.number(),
      mode: z.enum(["session-prep", "pitch-ready", "rewrite-focus", "remix-focus", "full-picture"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const review = await db.getReviewById(input.reviewId);
      if (!review || review.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Review not found" });
      }

      // Full picture just returns the original review
      if (input.mode === "full-picture") {
        return {
          mode: input.mode,
          content: review.reviewMarkdown,
          cached: true,
        };
      }

      // Check cache first
      const cached = await db.getCachedActionMode(input.reviewId, input.mode);
      if (cached) {
        return {
          mode: input.mode,
          content: cached.content,
          cached: true,
        };
      }

      const scores = review.scoresJson as Record<string, number> | null;
      const reshaped = await reshapeReview(
        review.reviewMarkdown,
        review.quickTake,
        scores,
        input.mode as ActionModeKey,
      );

      // Cache the result for future requests
      await db.setCachedActionMode(input.reviewId, ctx.user.id, input.mode, reshaped);

      return {
        mode: input.mode,
        content: reshaped,
        cached: false,
      };
    }),

  exportActionModePdf: protectedProcedure
    .input(z.object({
      reviewId: z.number(),
      mode: z.enum(["session-prep", "pitch-ready", "rewrite-focus", "remix-focus", "full-picture"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const review = await db.getReviewById(input.reviewId);
      if (!review || review.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Review not found" });
      }
      const user = await db.getUserById(ctx.user.id);
      // PDF export for action modes is available on all plans

      // Get the content — either from cache, original review, or generate fresh
      let content: string;
      const modeConfig = ACTION_MODES[input.mode as ActionModeKey];

      if (input.mode === "full-picture") {
        content = review.reviewMarkdown;
      } else {
        const cached = await db.getCachedActionMode(input.reviewId, input.mode);
        if (cached) {
          content = cached.content;
        } else {
          const scores = review.scoresJson as Record<string, number> | null;
          content = await reshapeReview(
            review.reviewMarkdown,
            review.quickTake,
            scores,
            input.mode as ActionModeKey,
          );
          await db.setCachedActionMode(input.reviewId, ctx.user.id, input.mode, content);
        }
      }

      // Get track info for the filename and metadata
      let trackName = "Unknown Track";
      let genre: string | undefined;
      if (review.trackId) {
        const track = await db.getTrackById(review.trackId);
        if (track) {
          trackName = track.originalFilename;
          genre = track.detectedGenre || undefined;
        }
      }

      const scores = review.scoresJson as Record<string, number> | null;

      const result = await exportReviewPdf({
        trackName,
        genre,
        quickTake: input.mode === "full-picture" ? review.quickTake : null,
        scores: input.mode === "full-picture" ? scores : null,
        content,
        mode: input.mode,
        modeLabel: modeConfig.label,
        date: new Date(review.createdAt),
        userId: ctx.user.id,
        reviewId: input.reviewId,
      });

      return result;
    }),

  updateVersionNote: protectedProcedure
    .input(z.object({
      reviewId: z.number(),
      versionNote: z.string().max(500).nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.updateReviewVersionNote(input.reviewId, ctx.user.id, input.versionNote);
      return { success: true } as const;
    }),
});
