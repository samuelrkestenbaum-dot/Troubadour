import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, aiAnalysisProcedure, exportProcedure } from "../_core/trpc";
import * as db from "../db";
import { assertFeatureAllowed } from "../guards";
import { generateMixReport, generateStructureAnalysis, generateDAWSessionNotes, aggregateGenreBenchmarks, generateProjectInsights } from "../services/analysisService";
import { generateInstrumentationAdvice, TARGET_STATES, type TargetState } from "../services/instrumentationAdvisor";

export const analysisRouter = {
  // ── Mix Report (Feature 3) ──
  mixReport: router({
    get: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .query(async ({ input }) => {
        return db.getMixReportByTrack(input.trackId) ?? null;
      }),

    generate: aiAnalysisProcedure
      .input(z.object({ trackId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        assertFeatureAllowed(ctx.user.tier, "mixReport");
        const track = await db.getTrackById(input.trackId);
        if (!track) throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        const features = await db.getAudioFeaturesByTrack(input.trackId);
        if (!features?.geminiAnalysisJson) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Track needs audio analysis first. Run a review to generate analysis." });
        const analysis = features.geminiAnalysisJson as any;
        const trackReviews = await db.getReviewsByTrack(input.trackId);
        const latestReview = trackReviews.length > 0 ? trackReviews[0] : null;
        const report = await generateMixReport(analysis, track.originalFilename, track.detectedGenre || "Unknown", latestReview?.reviewMarkdown);
        const id = await db.createMixReport({
          trackId: input.trackId,
          userId: ctx.user.id,
          reportMarkdown: report.reportMarkdown,
          frequencyAnalysis: report.frequencyAnalysis,
          dynamicsAnalysis: report.dynamicsAnalysis,
          stereoAnalysis: report.stereoAnalysis,
          loudnessData: report.loudnessData,
          dawSuggestions: report.dawSuggestions,
        });
        return { id, ...report };
      }),

    exportHtml: exportProcedure
      .input(z.object({ trackId: z.number() }))
      .query(async ({ ctx, input }) => {
        const report = await db.getMixReportByTrack(input.trackId);
        if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "No mix report found. Generate one first." });
        const track = await db.getTrackById(input.trackId);
        const trackName = track?.originalFilename || "Track";

        // Build HTML for PDF-style export
        const freq = report.frequencyAnalysis as any;
        const dynamics = report.dynamicsAnalysis as any;
        const stereo = report.stereoAnalysis as any;
        const loudness = report.loudnessData as any;
        const suggestions = report.dawSuggestions as any[];

        let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Mix Report - ${trackName}</title>
<style>
  body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #1a1a2e; background: #fff; }
  h1 { font-size: 24px; border-bottom: 3px solid #e74c6f; padding-bottom: 12px; margin-bottom: 24px; }
  h2 { font-size: 18px; color: #e74c6f; margin-top: 28px; margin-bottom: 12px; }
  h3 { font-size: 14px; color: #666; margin-top: 16px; }
  .meta { color: #666; font-size: 13px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 13px; }
  th { background: #f8f9fa; font-weight: 600; color: #333; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
  .badge-excellent { background: #d4edda; color: #155724; }
  .badge-good { background: #d1ecf1; color: #0c5460; }
  .badge-adequate { background: #fff3cd; color: #856404; }
  .badge-weak { background: #f8d7da; color: #721c24; }
  .badge-high { background: #f8d7da; color: #721c24; }
  .badge-medium { background: #fff3cd; color: #856404; }
  .badge-low { background: #d1ecf1; color: #0c5460; }
  .lufs-box { display: flex; gap: 32px; align-items: center; padding: 16px; background: #f8f9fa; border-radius: 8px; margin: 12px 0; }
  .lufs-value { text-align: center; }
  .lufs-value .num { font-size: 28px; font-weight: 700; font-family: monospace; }
  .lufs-value .label { font-size: 11px; color: #666; }
  .suggestion { padding: 10px 14px; margin: 6px 0; background: #f8f9fa; border-left: 3px solid #e74c6f; border-radius: 0 6px 6px 0; }
  .suggestion .element { font-weight: 600; }
  .suggestion .issue { color: #666; font-size: 12px; }
  .report-md { line-height: 1.7; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; color: #999; font-size: 11px; text-align: center; }
  @media print { body { padding: 20px; } }
</style></head><body>`;

        html += `<h1>Mix Feedback Report</h1>`;
        html += `<div class="meta"><strong>${trackName}</strong> &mdash; Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>`;

        // Frequency Analysis
        if (freq) {
          html += `<h2>Frequency Analysis</h2><table><tr><th>Band</th><th>Rating</th><th>Notes</th></tr>`;
          const bands = [
            { label: "Low End (20–250Hz)", ...(freq.lowEnd || {}) },
            { label: "Mid Range (250Hz–4kHz)", ...(freq.midRange || {}) },
            { label: "High End (4kHz–20kHz)", ...(freq.highEnd || {}) },
          ];
          for (const b of bands) {
            html += `<tr><td>${b.label}</td><td><span class="badge badge-${b.rating || 'adequate'}">${b.rating || 'N/A'}</span></td><td>${b.notes || ''}</td></tr>`;
          }
          html += `</table>`;
          if (freq.overallBalance) html += `<p><strong>Overall Balance:</strong> ${freq.overallBalance}</p>`;
        }

        // Dynamics
        if (dynamics) {
          html += `<h2>Dynamics</h2><table><tr><th>Aspect</th><th>Assessment</th></tr>`;
          if (dynamics.dynamicRange) html += `<tr><td>Dynamic Range</td><td>${dynamics.dynamicRange}</td></tr>`;
          if (dynamics.compression) html += `<tr><td>Compression</td><td>${dynamics.compression}</td></tr>`;
          if (dynamics.transients) html += `<tr><td>Transients</td><td>${dynamics.transients}</td></tr>`;
          if (dynamics.loudness) html += `<tr><td>Loudness</td><td>${dynamics.loudness}</td></tr>`;
          html += `</table>`;
        }

        // Loudness
        if (loudness && typeof loudness.estimatedLUFS === 'number') {
          html += `<h2>Loudness Target</h2>`;
          html += `<div class="lufs-box">`;
          html += `<div class="lufs-value"><div class="num">${loudness.estimatedLUFS}</div><div class="label">Estimated LUFS</div></div>`;
          if (typeof loudness.targetLUFS === 'number') {
            const diff = loudness.estimatedLUFS - loudness.targetLUFS;
            html += `<div class="lufs-value"><div class="num" style="color:${Math.abs(diff) <= 1 ? '#28a745' : Math.abs(diff) <= 3 ? '#ffc107' : '#dc3545'}">${diff > 0 ? '+' : ''}${diff.toFixed(1)}</div><div class="label">vs Target</div></div>`;
            html += `<div class="lufs-value"><div class="num">${loudness.targetLUFS}</div><div class="label">Target LUFS</div></div>`;
          }
          html += `</div>`;
          if (loudness.recommendation) html += `<p>${loudness.recommendation}</p>`;
        }

        // Stereo
        if (stereo) {
          html += `<h2>Stereo Image</h2><table><tr><th>Aspect</th><th>Assessment</th></tr>`;
          if (stereo.width) html += `<tr><td>Width</td><td>${stereo.width}</td></tr>`;
          if (stereo.balance) html += `<tr><td>Balance</td><td>${stereo.balance}</td></tr>`;
          if (stereo.monoCompatibility) html += `<tr><td>Mono Compatibility</td><td>${stereo.monoCompatibility}</td></tr>`;
          if (stereo.panningNotes) html += `<tr><td>Panning</td><td>${stereo.panningNotes}</td></tr>`;
          html += `</table>`;
        }

        // DAW Suggestions
        if (suggestions && suggestions.length > 0) {
          html += `<h2>DAW Action Items (${suggestions.length})</h2>`;
          for (const s of suggestions) {
            html += `<div class="suggestion">`;
            html += `<span class="badge badge-${s.priority || 'medium'}">${s.priority || 'medium'}</span> `;
            if (s.timestamp) html += `<span style="font-family:monospace;color:#666;font-size:12px">${s.timestamp}</span> `;
            if (s.element) html += `<span class="element">${s.element}</span>`;
            if (s.issue) html += `<div class="issue">${s.issue}</div>`;
            if (s.suggestion) html += `<div>${s.suggestion}</div>`;
            html += `</div>`;
          }
        }

        // Full markdown report
        if (report.reportMarkdown) {
          html += `<h2>Full Report</h2><div class="report-md">`;
          const md = (report.reportMarkdown as string)
            .replace(/### (.+)/g, '<h3>$1</h3>')
            .replace(/## (.+)/g, '<h2 style="font-size:16px">$1</h2>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/^- (.+)/gm, '<li>$1</li>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
          html += `<p>${md}</p></div>`;
        }

        html += `<div class="footer">Generated by Troubadour &mdash; AI-Powered Music Review Platform</div>`;
        html += `</body></html>`;

        return { html, trackName };
      }),
  }),

  // ── Structure Analysis (Feature 7) ──
  structure: router({
    get: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .query(async ({ input }) => {
        return db.getStructureAnalysis(input.trackId) ?? null;
      }),

    generate: aiAnalysisProcedure
      .input(z.object({ trackId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        assertFeatureAllowed(ctx.user.tier, "structureAnalysis");
        const track = await db.getTrackById(input.trackId);
        if (!track) throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        const features = await db.getAudioFeaturesByTrack(input.trackId);
        if (!features?.geminiAnalysisJson) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Track needs audio analysis first. Run a review to generate analysis." });
        const analysis = features.geminiAnalysisJson as any;
        const lyricsRow = await db.getLyricsByTrack(input.trackId);
        const result = await generateStructureAnalysis(analysis, track.originalFilename, track.detectedGenre || "Unknown", lyricsRow?.[0]?.text || undefined);
        await db.upsertStructureAnalysis({
          trackId: input.trackId,
          sectionsJson: result.sections,
          structureScore: result.structureScore,
          genreExpectations: result.genreExpectations,
          suggestions: result.suggestions,
        });
        return result;
      }),
  }),

  // ── Genre Benchmarks (Feature 5) ──
  benchmark: router({
    genres: protectedProcedure.query(async () => {
      return db.getAllGenresWithCounts();
    }),

    byGenre: protectedProcedure
      .input(z.object({ genre: z.string() }))
      .query(async ({ input }) => {
        const data = await db.getGenreBenchmarks(input.genre);
        if (!data || data.trackCount === 0) return null;
        const scores = data.reviews
          .map(r => {
            try { return typeof r.scoresJson === "string" ? JSON.parse(r.scoresJson) : r.scoresJson; } catch { return null; }
          })
          .filter((s): s is Record<string, number> => s !== null);
        return aggregateGenreBenchmarks(input.genre, data.trackCount, scores);
      }),
  }),

  // ── Revision Timeline (Feature 2) ──
  timeline: router({
    get: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .query(async ({ input }) => {
        return db.getVersionTimeline(input.trackId);
      }),
  }),

  // ── DAW Session Notes Export (Feature 6) ──
  dawExport: router({
    generate: aiAnalysisProcedure
      .input(z.object({ trackId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        assertFeatureAllowed(ctx.user.tier, "dawExport");
        const exportData = await db.getTrackExportData(input.trackId);
        if (!exportData) throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        const features = await db.getAudioFeaturesByTrack(input.trackId);
        if (!features?.geminiAnalysisJson) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Track needs audio analysis first." });
        const analysis = features.geminiAnalysisJson as any;
        const notes = await generateDAWSessionNotes(
          analysis,
          exportData.track.originalFilename,
          exportData.track.detectedGenre || "Unknown",
          exportData.review?.reviewMarkdown,
          exportData.mixReport?.reportMarkdown,
        );
        return notes;
      }),
  }),

  // ── Mood/Energy Curve (Feature 8) — reads from existing Gemini analysis ──
  moodEnergy: router({
    get: protectedProcedure
      .input(z.object({ trackId: z.number() }))
      .query(async ({ input }) => {
        const features = await db.getAudioFeaturesByTrack(input.trackId);
        if (!features?.geminiAnalysisJson) return null;
        const analysis = features.geminiAnalysisJson as any;
        return {
          energyCurve: analysis.energy?.curve || [],
          overallEnergy: analysis.energy?.overall || "unknown",
          dynamicRange: analysis.energy?.dynamicRange || "unknown",
          mood: analysis.mood || [],
          sections: (analysis.sections || []).map((s: any) => ({
            name: s.name,
            startTime: s.startTime,
            endTime: s.endTime,
            energy: s.energy,
            description: s.description,
          })),
          arrangement: analysis.arrangement || {},
        };
      }),
  }),

  // ── Project Insights (Round 40 Feature 1) ──
  insights: router({
    get: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        return db.getLatestProjectInsight(input.projectId);
      }),

    generate: aiAnalysisProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        const user = await db.getUserById(ctx.user.id);
        assertFeatureAllowed(user?.tier || "free", "analytics");

        const allTracks = await db.getTracksByProject(input.projectId);
        const allReviews = await db.getReviewsByProject(input.projectId);
        const reviewedTracks = allTracks.filter(t => t.status === "reviewed");
        if (reviewedTracks.length < 2) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Need at least 2 reviewed tracks to generate insights" });
        }

        const trackData = reviewedTracks.map(track => {
          const review = allReviews.find(r => r.trackId === track.id && r.isLatest && r.reviewType === "track");
          return {
            filename: track.originalFilename,
            genre: track.detectedGenre,
            quickTake: review?.quickTake || null,
            scores: (review?.scoresJson as Record<string, number>) || {},
            reviewExcerpt: review?.reviewMarkdown?.slice(0, 500) || "",
          };
        });

        const result = await generateProjectInsights(project.title, trackData);
        const { id } = await db.createProjectInsight({
          projectId: input.projectId,
          userId: ctx.user.id,
          summaryMarkdown: result.summaryMarkdown,
          strengthsJson: result.strengths,
          weaknessesJson: result.weaknesses,
          recommendationsJson: result.recommendations,
          averageScoresJson: result.averageScores,
          trackCount: reviewedTracks.length,
        });
        return { id, ...result };
      }),
  }),

  // ── Score Matrix (Round 40 Feature 2) ──
  matrix: router({
    get: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        return db.getProjectScoreMatrix(input.projectId);
      }),
  }),

  // ── CSV Export (Round 40 Feature 3) ──
  csvExport: router({
    generate: exportProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        const user = await db.getUserById(ctx.user.id);
        assertFeatureAllowed(user?.tier || "free", "export");

        const { rows } = await db.getProjectCsvData(input.projectId);
        if (rows.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No tracks to export" });
        }

        // Collect all score keys
        const allScoreKeys = new Set<string>();
        for (const row of rows) {
          for (const k of Object.keys(row.scores)) allScoreKeys.add(k);
        }
        const scoreKeys = Array.from(allScoreKeys).sort();

        // Build CSV
        const headers = ["Track", "Genre", "Status", "Quick Take", ...scoreKeys.map(k => k.replace(/([A-Z])/g, " $1").trim()), "Review Date"];
        const csvRows = [headers.join(",")];
        for (const row of rows) {
          const values = [
            `"${row.trackName.replace(/"/g, '""')}"`,
            `"${row.genre.replace(/"/g, '""')}"`,
            row.status,
            `"${row.quickTake.replace(/"/g, '""').replace(/\n/g, " ")}"`,
            ...scoreKeys.map(k => row.scores[k]?.toString() || ""),
            row.reviewDate ? new Date(row.reviewDate).toLocaleDateString() : "",
          ];
          csvRows.push(values.join(","));
        }

        return {
          csv: csvRows.join("\n"),
          filename: `${project.title.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}-scores.csv`,
        };
      }),
  }),

  // ── Instrumentation Advisor (AI-powered instrument/part suggestions per section) ──
  instrumentation: router({
    targetStates: protectedProcedure
      .query(() => {
        return Object.entries(TARGET_STATES).map(([key, val]) => ({
          key: key as TargetState,
          label: val.label,
          description: val.description,
          icon: val.icon,
        }));
      }),

    generate: aiAnalysisProcedure
      .input(z.object({
        trackId: z.number(),
        targetState: z.enum(["fuller", "stripped", "radioReady", "cinematic", "liveReady", "electronic"]),
        artistNotes: z.string().max(1000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        assertFeatureAllowed(ctx.user.tier, "version_comparison"); // Artist+ feature
        
        const track = await db.getTrackById(input.trackId);
        if (!track) throw new TRPCError({ code: "NOT_FOUND", message: "Track not found" });
        
        const features = await db.getAudioFeaturesByTrack(input.trackId);
        if (!features?.geminiAnalysisJson) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Track needs audio analysis first. Run a review to generate analysis.",
          });
        }
        
        const analysis = features.geminiAnalysisJson as any;
        const lyricsRow = await db.getLyricsByTrack(input.trackId);
        
        const advice = await generateInstrumentationAdvice({
          trackTitle: track.originalFilename,
          genre: track.detectedGenre || analysis.genre?.primary || "Unknown",
          targetState: input.targetState,
          audioAnalysis: analysis,
          lyrics: lyricsRow?.[0]?.text || undefined,
          artistNotes: input.artistNotes,
        });
        
        return advice;
      }),
  }),
};
