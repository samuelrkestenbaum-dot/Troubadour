import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, aiAnalysisProcedure, exportProcedure } from "../_core/trpc";
import * as db from "../db";
import { assertFeatureAllowed } from "../guards";
import { nanoid } from "nanoid";
import { eq, and, asc, desc } from "drizzle-orm";

export const portfolioRouter = {
  // ── A/B Review Comparison ──
  abCompare: router({
    generate: aiAnalysisProcedure
      .input(z.object({
        trackId: z.number(),
        templateAId: z.number().optional(),
        templateBId: z.number().optional(),
        focusA: z.enum(["songwriter", "producer", "arranger", "artist", "anr", "full"]).default("full").optional(),
        focusB: z.enum(["songwriter", "producer", "arranger", "artist", "anr", "full"]).default("full").optional(),
        reviewLength: z.enum(["brief", "standard", "detailed"]).default("standard"),
      }))
      .mutation(async ({ ctx, input }) => {
        const track = await db.getTrackById(input.trackId);
        if (!track || track.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });

        const batchId = `ab_${nanoid(8)}`;
        const metadataBase = { reviewLength: input.reviewLength };

        // Queue job A
        const metaA: Record<string, any> = { ...metadataBase, reviewFocus: "full", abSide: "A", abBatchId: batchId };
        if (input.templateAId) {
          const tpl = await db.getReviewTemplateById(input.templateAId);
          if (tpl) {
            metaA.templateId = tpl.id;
            metaA.templateFocusAreas = tpl.focusAreas;
            metaA.templateName = tpl.name;
          }
        }
        const jobA = await db.createJob({
          projectId: track.projectId,
          trackId: input.trackId,
          userId: ctx.user.id,
          type: "review",
          batchId,
          metadata: metaA,
        });

        // Queue job B
        const metaB: Record<string, any> = { ...metadataBase, reviewFocus: "full", abSide: "B", abBatchId: batchId };
        if (input.templateBId) {
          const tpl = await db.getReviewTemplateById(input.templateBId);
          if (tpl) {
            metaB.templateId = tpl.id;
            metaB.templateFocusAreas = tpl.focusAreas;
            metaB.templateName = tpl.name;
          }
        }
        const jobB = await db.createJob({
          projectId: track.projectId,
          trackId: input.trackId,
          userId: ctx.user.id,
          type: "review",
          batchId,
          metadata: metaB,
        });

        return { batchId, jobAId: jobA.id, jobBId: jobB.id };
      }),

    getResults: protectedProcedure
      .input(z.object({ batchId: z.string() }))
      .query(async ({ ctx, input }) => {
        const d = await db.getDb();
        if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { jobs: jobsTable, reviews: reviewsTable } = await import("../../drizzle/schema");

        const abJobs = await d.select().from(jobsTable)
          .where(and(eq(jobsTable.batchId, input.batchId), eq(jobsTable.userId, ctx.user.id)))
          .orderBy(asc(jobsTable.createdAt));

        if (abJobs.length < 2) return { status: "pending", jobs: abJobs, reviewA: null, reviewB: null };

        const allDone = abJobs.every(j => j.status === "done");
        const anyError = abJobs.some(j => j.status === "error");

        let reviewA = null;
        let reviewB = null;

        if (allDone) {
          for (const j of abJobs) {
            const meta = j.metadata as any;
            if (j.resultId) {
              const revRows = await d.select().from(reviewsTable).where(eq(reviewsTable.id, j.resultId)).limit(1);
              if (meta?.abSide === "A") reviewA = revRows[0] || null;
              else if (meta?.abSide === "B") reviewB = revRows[0] || null;
            }
          }
        }

        return {
          status: anyError ? "error" : allDone ? "complete" : "pending",
          jobs: abJobs,
          reviewA,
          reviewB,
        };
      }),
  }),

  // ── Track Notes / Journal ──
  trackNote: router({
    create: protectedProcedure
      .input(z.object({
        trackId: z.number(),
        content: z.string().min(1).max(10000),
        pinned: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const track = await db.getTrackById(input.trackId);
        if (!track || track.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        return db.createTrackNote({
          trackId: input.trackId,
          userId: ctx.user.id,
          content: input.content,
          pinned: input.pinned ?? false,
        });
      }),

    list: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.listTrackNotes(input.trackId, ctx.user.id);
      }),

    update: protectedProcedure
      .input(z.object({
        noteId: z.number(),
        content: z.string().min(1).max(10000).optional(),
        pinned: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const note = await db.getTrackNoteById(input.noteId);
        if (!note || note.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        const updates: Record<string, any> = {};
        if (input.content !== undefined) updates.content = input.content;
        if (input.pinned !== undefined) updates.pinned = input.pinned;
        await db.updateTrackNote(input.noteId, updates);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ noteId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const note = await db.getTrackNoteById(input.noteId);
        if (!note || note.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        await db.deleteTrackNote(input.noteId);
        return { success: true };
      }),
  }),

  // ── Portfolio Export (label-ready HTML report) ──
  portfolio: router({
    generate: exportProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        const user = await db.getUserById(ctx.user.id);
        assertFeatureAllowed(user?.tier || "free", "export");

        const data = await db.getPortfolioData(input.projectId);
        if (!data) throw new TRPCError({ code: "NOT_FOUND" });

        const { tracks: allTracks, reviews: allReviews, audioFeatures: allFeatures, artwork, insight } = data;

        // Build track cards
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

        let trackCardsHtml = '';
        for (const track of allTracks) {
          const review = allReviews.find(r => r.trackId === track.id && r.reviewType === 'track');
          const features = allFeatures.find(f => f.trackId === track.id);
          if (!review) continue;

          const scores = review.scoresJson as Record<string, number> | undefined;
          let scoresHtml = '';
          if (scores && Object.keys(scores).length > 0) {
            scoresHtml = `<div class="scores-grid">${Object.entries(scores).map(([k, v]) => {
              const pct = (v / 10) * 100;
              const color = v >= 8 ? '#22c55e' : v >= 6 ? '#3b82f6' : v >= 4 ? '#f59e0b' : '#ef4444';
              return `<div class="score-bar-item"><div class="score-bar-label">${k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</div><div class="score-bar-track"><div class="score-bar-fill" style="width:${pct}%;background:${color}"></div></div><div class="score-bar-value">${v}/10</div></div>`;
            }).join('')}</div>`;
          }

          const genreBadge = track.detectedGenre ? `<span class="genre-badge">${track.detectedGenre}</span>` : '';
          const subgenreBadge = track.detectedSubgenres ? `<span class="subgenre-badge">${track.detectedSubgenres}</span>` : '';
          const fj = features?.featuresJson as Record<string, any> | null;
          const featureChips = fj ? `<div class="feature-chips">${fj.bpm ? `<span class="chip">BPM: ${fj.bpm}</span>` : ''}${fj.key ? `<span class="chip">Key: ${fj.key}</span>` : ''}${fj.energy != null ? `<span class="chip">Energy: ${fj.energy}/10</span>` : ''}${fj.danceability != null ? `<span class="chip">Dance: ${fj.danceability}/10</span>` : ''}</div>` : '';

          trackCardsHtml += `
            <div class="track-card">
              <div class="track-header">
                <div class="track-number">${track.trackOrder ?? ''}</div>
                <div class="track-info">
                  <h3 class="track-title">${track.originalFilename.replace(/\.[^.]+$/, '')}</h3>
                  <div class="track-badges">${genreBadge}${subgenreBadge}</div>
                </div>
                ${scores?.overall !== undefined ? `<div class="overall-score" style="color:${(scores.overall ?? 0) >= 8 ? '#22c55e' : (scores.overall ?? 0) >= 6 ? '#3b82f6' : (scores.overall ?? 0) >= 4 ? '#f59e0b' : '#ef4444'}">${scores.overall}<span class="score-max">/10</span></div>` : ''}
              </div>
              ${featureChips}
              ${review.quickTake ? `<div class="quick-take">&ldquo;${review.quickTake}&rdquo;</div>` : ''}
              ${scoresHtml}
              <div class="review-excerpt"><p>${markdownToHtml(review.reviewMarkdown.slice(0, 1500))}${review.reviewMarkdown.length > 1500 ? '...' : ''}</p></div>
            </div>`;
        }

        // Album review section
        const albumReview = allReviews.find(r => r.reviewType === 'album');
        let albumHtml = '';
        if (albumReview) {
          albumHtml = `<div class="album-section"><h2 class="section-title">Album Review</h2>${albumReview.quickTake ? `<div class="quick-take">&ldquo;${albumReview.quickTake}&rdquo;</div>` : ''}<div class="review-content"><p>${markdownToHtml(albumReview.reviewMarkdown)}</p></div></div>`;
        }

        // Artwork gallery
        let artworkHtml = '';
        if (artwork.length > 0) {
          artworkHtml = `<div class="artwork-section"><h2 class="section-title">Artwork Concepts</h2><div class="artwork-grid">${artwork.map(a => a.imageUrl ? `<div class="artwork-item"><img src="${a.imageUrl}" alt="${a.moodDescription || 'Artwork concept'}" />${a.visualStyle ? `<p class="artwork-style">${a.visualStyle}</p>` : ''}</div>` : '').join('')}</div></div>`;
        }

        // Insight summary
        let insightHtml = '';
        if (insight) {
          const strengths = (insight.strengthsJson as string[] | null) || [];
          const weaknesses = (insight.weaknessesJson as string[] | null) || [];
          insightHtml = `<div class="insight-section"><h2 class="section-title">AI Project Summary</h2><div class="review-content"><p>${markdownToHtml(insight.summaryMarkdown)}</p></div>${strengths.length > 0 ? `<div class="strengths"><h4>Strengths</h4><ul>${strengths.map(s => `<li>${s}</li>`).join('')}</ul></div>` : ''}${weaknesses.length > 0 ? `<div class="weaknesses"><h4>Areas for Growth</h4><ul>${weaknesses.map(w => `<li>${w}</li>`).join('')}</ul></div>` : ''}</div>`;
        }

        // Stats summary
        const reviewedTracks = allTracks.filter(t => allReviews.some(r => r.trackId === t.id && r.reviewType === 'track'));
        const avgScore = reviewedTracks.length > 0
          ? reviewedTracks.reduce((sum, t) => {
              const r = allReviews.find(rv => rv.trackId === t.id && rv.reviewType === 'track');
              const s = r?.scoresJson as Record<string, number> | undefined;
              return sum + (s?.overall ?? 0);
            }, 0) / reviewedTracks.length
          : 0;

        const coverUrl = project.coverImageUrl || artwork[0]?.imageUrl || '';

        const htmlContent = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${project.title} — Portfolio</title><style>
          :root{--bg:#0a0a14;--surface:#12121f;--border:#1e1e35;--text:#e8e8f0;--muted:#888;--accent:#c8102e;--accent-soft:rgba(200,16,46,0.15)}
          *{margin:0;padding:0;box-sizing:border-box}
          body{font-family:'Inter',system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);line-height:1.7}
          .container{max-width:900px;margin:0 auto;padding:40px 24px}
          .hero{text-align:center;padding:60px 0 40px;border-bottom:2px solid var(--border);margin-bottom:40px}
          .hero-cover{width:200px;height:200px;border-radius:12px;object-fit:cover;margin:0 auto 24px;box-shadow:0 8px 32px rgba(0,0,0,0.4)}
          .hero h1{font-size:2.5em;font-weight:800;letter-spacing:-0.02em;margin-bottom:8px}
          .hero .subtitle{color:var(--muted);font-size:1.1em}
          .stats-row{display:flex;justify-content:center;gap:32px;margin-top:24px}
          .stat{text-align:center}
          .stat-value{font-size:1.8em;font-weight:700;color:var(--accent)}
          .stat-label{font-size:0.8em;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em}
          .section-title{font-size:1.4em;font-weight:700;margin:40px 0 20px;padding-bottom:8px;border-bottom:2px solid var(--border)}
          .track-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:24px;margin-bottom:20px}
          .track-header{display:flex;align-items:center;gap:16px;margin-bottom:16px}
          .track-number{width:36px;height:36px;border-radius:50%;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.9em;flex-shrink:0}
          .track-info{flex:1}
          .track-title{font-size:1.15em;font-weight:600;margin-bottom:4px}
          .track-badges{display:flex;gap:6px;flex-wrap:wrap}
          .genre-badge,.subgenre-badge{font-size:0.75em;padding:2px 10px;border-radius:12px;background:var(--accent-soft);color:var(--accent)}
          .subgenre-badge{background:rgba(59,130,246,0.15);color:#3b82f6}
          .overall-score{font-size:2em;font-weight:800;flex-shrink:0}
          .score-max{font-size:0.4em;color:var(--muted)}
          .feature-chips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
          .chip{font-size:0.75em;padding:3px 10px;border-radius:8px;background:rgba(255,255,255,0.05);border:1px solid var(--border);color:var(--muted)}
          .quick-take{font-style:italic;color:var(--muted);padding:12px 16px;background:var(--accent-soft);border-left:3px solid var(--accent);border-radius:0 8px 8px 0;margin:12px 0;font-size:0.95em}
          .scores-grid{display:grid;grid-template-columns:1fr;gap:8px;margin:16px 0}
          .score-bar-item{display:flex;align-items:center;gap:12px}
          .score-bar-label{width:120px;font-size:0.8em;color:var(--muted);text-align:right;flex-shrink:0}
          .score-bar-track{flex:1;height:8px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden}
          .score-bar-fill{height:100%;border-radius:4px;transition:width 0.3s}
          .score-bar-value{width:40px;font-size:0.8em;font-weight:600;flex-shrink:0}
          .review-excerpt{margin-top:16px;font-size:0.9em;color:rgba(232,232,240,0.8)}
          .review-excerpt p{margin-bottom:8px}
          .review-content p{margin-bottom:8px}
          h2,h3{margin-top:16px;margin-bottom:8px}
          blockquote{border-left:3px solid var(--accent);padding-left:12px;color:var(--muted);margin:12px 0}
          li{margin:4px 0;margin-left:20px}
          .album-section,.insight-section{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:24px;margin:24px 0}
          .strengths h4{color:#22c55e;margin:16px 0 8px} .weaknesses h4{color:#f59e0b;margin:16px 0 8px}
          .artwork-section{margin:32px 0}
          .artwork-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
          .artwork-item{border-radius:12px;overflow:hidden;border:1px solid var(--border)}
          .artwork-item img{width:100%;display:block}
          .artwork-style{padding:8px 12px;font-size:0.8em;color:var(--muted);background:var(--surface)}
          footer{text-align:center;padding:40px 0;color:var(--muted);font-size:0.8em;border-top:1px solid var(--border);margin-top:40px}
          @media print{body{background:#fff;color:#1a1a2e} .container{padding:20px} .track-card,.album-section,.insight-section{border-color:#ddd;background:#f8f8fc} .hero{padding:30px 0 20px} :root{--bg:#fff;--surface:#f8f8fc;--border:#e0e0e0;--text:#1a1a2e;--muted:#666}}
          @media(max-width:600px){.stats-row{flex-wrap:wrap;gap:16px} .track-header{flex-wrap:wrap} .artwork-grid{grid-template-columns:1fr}}
        </style></head><body>
          <div class="container">
            <div class="hero">
              ${coverUrl ? `<img class="hero-cover" src="${coverUrl}" alt="${project.title}" />` : ''}
              <h1>${project.title}</h1>
              <p class="subtitle">${project.type === 'album' ? 'Album' : 'Single'} &middot; ${allTracks.length} Track${allTracks.length !== 1 ? 's' : ''} &middot; AI-Reviewed by Troubadour</p>
              <div class="stats-row">
                <div class="stat"><div class="stat-value">${Math.round(avgScore * 10) / 10}</div><div class="stat-label">Avg Score</div></div>
                <div class="stat"><div class="stat-value">${reviewedTracks.length}</div><div class="stat-label">Reviewed</div></div>
                <div class="stat"><div class="stat-value">${allTracks.length}</div><div class="stat-label">Total Tracks</div></div>
              </div>
            </div>
            ${insightHtml}
            <h2 class="section-title">Track Reviews</h2>
            ${trackCardsHtml}
            ${albumHtml}
            ${artworkHtml}
            <footer>Generated by Troubadour AI &middot; ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</footer>
          </div>
        </body></html>`;

        return { htmlContent };
      }),
  }),

  // ── Project Completion Score ──
  completion: router({
    getScore: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });

        const d = await db.getDb();
        if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const { tracks: tracksTable, reviews: reviewsTable, masteringChecklists: mcTable } = await import("../../drizzle/schema");

        const projectTracks = await d.select().from(tracksTable)
          .where(eq(tracksTable.projectId, input.projectId))
          .orderBy(asc(tracksTable.trackOrder));

        if (projectTracks.length === 0) {
          return {
            overallScore: 0,
            trackCount: 0,
            reviewedCount: 0,
            readyCount: 0,
            averageReviewScore: 0,
            averageMasteringReadiness: 0,
            tracks: [],
          };
        }

        const trackDetails = await Promise.all(projectTracks.map(async (t) => {
          // Get latest review
          const latestReviews = await d.select().from(reviewsTable)
            .where(and(
              eq(reviewsTable.trackId, t.id),
              eq(reviewsTable.reviewType, "track"),
              eq(reviewsTable.isLatest, true)
            ))
            .limit(1);
          const latestReview = latestReviews[0] || null;

          // Get mastering checklist
          const checklists = await d.select().from(mcTable)
            .where(eq(mcTable.trackId, t.id))
            .orderBy(desc(mcTable.updatedAt))
            .limit(1);
          const checklist = checklists[0] || null;

          // Parse scores
          let reviewScore = 0;
          if (latestReview?.scoresJson) {
            const scores = latestReview.scoresJson as any;
            reviewScore = scores.overall ?? 0;
          }

          // Parse tags
          let tags: string[] = [];
          try { tags = t.tags ? JSON.parse(t.tags) : []; } catch { tags = []; }
          const isReady = tags.some((tag: string) => tag.toLowerCase().includes("ready") || tag.toLowerCase().includes("done") || tag.toLowerCase().includes("final"));

          // Calculate track completion
          const hasReview = !!latestReview;
          const masteringReadiness = checklist?.overallReadiness ?? 0;

          // Weighted: 40% review score, 30% mastering readiness, 20% has review, 10% tagged ready
          const trackScore = Math.round(
            (reviewScore / 10) * 40 +
            (masteringReadiness / 100) * 30 +
            (hasReview ? 20 : 0) +
            (isReady ? 10 : 0)
          );

          return {
            id: t.id,
            filename: t.originalFilename,
            trackOrder: t.trackOrder,
            status: t.status,
            reviewScore,
            masteringReadiness,
            hasReview,
            isReady,
            trackScore,
            tags,
          };
        }));

        const reviewedCount = trackDetails.filter(t => t.hasReview).length;
        const readyCount = trackDetails.filter(t => t.isReady).length;
        const avgReviewScore = trackDetails.filter(t => t.hasReview).length > 0
          ? trackDetails.filter(t => t.hasReview).reduce((sum, t) => sum + t.reviewScore, 0) / trackDetails.filter(t => t.hasReview).length
          : 0;
        const avgMastering = trackDetails.filter(t => t.masteringReadiness > 0).length > 0
          ? trackDetails.filter(t => t.masteringReadiness > 0).reduce((sum, t) => sum + t.masteringReadiness, 0) / trackDetails.filter(t => t.masteringReadiness > 0).length
          : 0;
        const overallScore = trackDetails.length > 0
          ? Math.round(trackDetails.reduce((sum, t) => sum + t.trackScore, 0) / trackDetails.length)
          : 0;

        return {
          overallScore,
          trackCount: projectTracks.length,
          reviewedCount,
          readyCount,
          averageReviewScore: Math.round(avgReviewScore * 10) / 10,
          averageMasteringReadiness: Math.round(avgMastering),
          tracks: trackDetails,
        };
      }),
  }),
};
