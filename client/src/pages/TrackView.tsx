import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useLocation } from "wouter";
import { scoreColor } from "@/lib/scoreColor";
import { useState, useRef, useMemo, useEffect } from "react";
import { useChat } from "@/contexts/ChatContext";
import { toast } from "sonner";
import {
  ArrowLeft, Headphones, FileText, Loader2, Music, BarChart3,
  AlertCircle, GitCompare, Upload, Mic, Save, Target, TrendingUp,
  ArrowUpRight, ArrowDownRight, Minus, RotateCcw, Zap, History, Download,
  ExternalLink, Trash2
} from "lucide-react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { TrackTags } from "@/components/TrackTags";
import { ScoreLineChart } from "@/components/ScoreLineChart";
import { formatDistanceToNow } from "date-fns";
import { Streamdown } from "streamdown";
import { MixReportView } from "@/components/MixReportView";
import { StructureAnalysisView } from "@/components/StructureAnalysisView";
import { MoodEnergyChart } from "@/components/MoodEnergyChart";
import { WaveformAnnotations } from "@/components/WaveformAnnotations";
import { DAWExportButton } from "@/components/DAWExportButton";
import { ReviewComparisonView } from "@/components/ReviewComparisonView";
import { ReviewQualityBadge } from "@/components/ReviewQualityBadge";
import { RevisionTimeline } from "@/components/RevisionTimeline";
import { VersionScoreTrend } from "@/components/ScoreTrendChart";
import { SentimentHeatmap } from "@/components/SentimentHeatmap";
import { MasteringChecklist } from "@/components/MasteringChecklist";
import { ABReviewComparison } from "@/components/ABReviewComparison";
import { TrackNotes } from "@/components/TrackNotes";
import { InstrumentationAdvisorView } from "@/components/InstrumentationAdvisorView";

// ── Mix Report Tab Wrapper ──
function MixReportTab({ trackId }: { trackId: number }) {
  const { data: existingReport, refetch } = trpc.mixReport.get.useQuery({ trackId });
  const [generatedReport, setGeneratedReport] = useState<any>(null);
  const generateMutation = trpc.mixReport.generate.useMutation({
    onSuccess: (data: any) => {
      setGeneratedReport(data);
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });
  // Use generated report if available (fresh from mutation), otherwise use DB report
  const report = generatedReport || (existingReport ? {
    reportMarkdown: existingReport.reportMarkdown,
    frequencyAnalysis: existingReport.frequencyAnalysis as any,
    dynamicsAnalysis: existingReport.dynamicsAnalysis as any,
    stereoAnalysis: existingReport.stereoAnalysis as any,
    loudnessData: existingReport.loudnessData as any,
    dawSuggestions: existingReport.dawSuggestions as any,
  } : null);
  return <MixReportView data={report} isGenerating={generateMutation.isPending} onGenerate={() => generateMutation.mutate({ trackId })} trackId={trackId} />;
}

// ── Structure Analysis Tab Wrapper ──
function StructureTab({ trackId }: { trackId: number }) {
  const { data: existingData, refetch } = trpc.structure.get.useQuery({ trackId });
  const [generatedData, setGeneratedData] = useState<any>(null);
  const generateMutation = trpc.structure.generate.useMutation({
    onSuccess: (d: any) => {
      setGeneratedData(d);
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });
  // Use generated data if available, otherwise use DB data
  const data = generatedData || (existingData ? {
    sections: existingData.sectionsJson as any,
    structureScore: existingData.structureScore,
    genreExpectations: existingData.genreExpectations as any,
    suggestions: existingData.suggestions as any,
  } : null);
  return <StructureAnalysisView data={data} isGenerating={generateMutation.isPending} onGenerate={() => generateMutation.mutate({ trackId })} />;
}

// ── Instrumentation Advisor Tab Wrapper ──
function InstrumentationAdvisorTab({ trackId }: { trackId: number }) {
  return <InstrumentationAdvisorView trackId={trackId} />;
}

// ── Mood/Energy Tab Wrapper ──
function MoodEnergyTab({ trackId }: { trackId: number }) {
  const { data: trackData } = trpc.track.get.useQuery({ id: trackId });
  const features = trackData?.features;
  const geminiData = features?.geminiAnalysisJson ? (typeof features.geminiAnalysisJson === 'string' ? JSON.parse(features.geminiAnalysisJson as string) : features.geminiAnalysisJson) : null;
  // Energy data is nested under geminiData.energy in the Gemini analysis JSON
  const energyObj = geminiData?.energy || {};
  const energyCurve = energyObj?.curve || geminiData?.energyCurve || geminiData?.energy_curve || [];
  const sections = (geminiData?.sections || []).map((s: any) => ({
    name: s.name || s.section || '',
    startTime: s.startTime || s.start_time || '',
    endTime: s.endTime || s.end_time || '',
    energy: s.energy || 5,
    description: s.description || s.notes || '',
  }));
  const moodData = {
    energyCurve,
    overallEnergy: energyObj?.overall || geminiData?.overallEnergy || geminiData?.overall_energy || 'N/A',
    dynamicRange: energyObj?.dynamicRange || geminiData?.dynamicRange || geminiData?.dynamic_range || 'N/A',
    mood: geminiData?.mood || geminiData?.moods || [],
    sections,
    arrangement: geminiData?.arrangement || {},
  };
  if (!geminiData) {
    return (
      <Card className="border-border/40">
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">No audio analysis data available yet. Run a review to generate analysis.</p>
        </CardContent>
      </Card>
    );
  }
  return <MoodEnergyChart data={moodData} />;
}

// ── Reference Track Section ──

function getPlatformIcon(url: string) {
  const u = url.toLowerCase();
  if (u.includes("spotify")) return { label: "Spotify", color: "text-green-400", bg: "bg-green-400/10" };
  if (u.includes("soundcloud")) return { label: "SoundCloud", color: "text-orange-400", bg: "bg-orange-400/10" };
  if (u.includes("youtube") || u.includes("youtu.be")) return { label: "YouTube", color: "text-red-400", bg: "bg-red-400/10" };
  if (u.includes("apple.com/music") || u.includes("music.apple.com")) return { label: "Apple Music", color: "text-pink-400", bg: "bg-pink-400/10" };
  if (u.includes("tidal")) return { label: "Tidal", color: "text-sky-400", bg: "bg-sky-400/10" };
  return null;
}

function ReferenceTrackSection({ trackId }: { trackId: number }) {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showUrlForm, setShowUrlForm] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlTitle, setUrlTitle] = useState("");
  const [urlArtist, setUrlArtist] = useState("");

  const { data: references, isLoading } = trpc.reference.list.useQuery({ trackId });

  const uploadRef = trpc.reference.upload.useMutation({
    onSuccess: () => {
      utils.reference.list.invalidate({ trackId });
      toast.success("Reference track uploaded");
      setUploading(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setUploading(false);
    },
  });

  const importUrl = trpc.reference.importUrl.useMutation({
    onSuccess: (result) => {
      utils.reference.list.invalidate({ trackId });
      toast.success(`${result.displayName} added as reference`);
      setShowUrlForm(false);
      setUrlInput("");
      setUrlTitle("");
      setUrlArtist("");
    },
    onError: (err) => toast.error(err.message),
  });

  const compareMut = trpc.reference.compare.useMutation({
    onSuccess: () => {
      utils.reference.list.invalidate({ trackId });
      toast.success("Comparison complete");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMut = trpc.reference.delete.useMutation({
    onSuccess: () => {
      utils.reference.list.invalidate({ trackId });
      toast.success("Reference removed");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleUpload = async (file: File) => {
    setUploading(true);
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    uploadRef.mutate({
      trackId,
      filename: file.name,
      mimeType: file.type,
      fileBase64: base64,
      fileSize: file.size,
    });
  };

  const isUrlRef = (mimeType: string) => mimeType === "application/x-url";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Reference Track Comparison</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Upload audio or paste a Spotify/SoundCloud/YouTube link
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowUrlForm(!showUrlForm)}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Add URL
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || uploadRef.isPending}
          >
            {uploading || uploadRef.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Target className="h-3.5 w-3.5 mr-1.5" />
            )}
            Upload Audio
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />
      </div>

      {showUrlForm && (
        <Card className="border-primary/30">
          <CardContent className="py-4 space-y-3">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Paste a link to a reference track</label>
              <input
                type="url"
                placeholder="https://open.spotify.com/track/... or SoundCloud/YouTube URL"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Track Title (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Blinding Lights"
                  value={urlTitle}
                  onChange={(e) => setUrlTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Artist (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. The Weeknd"
                  value={urlArtist}
                  onChange={(e) => setUrlArtist(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
            {urlInput && getPlatformIcon(urlInput) && (
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getPlatformIcon(urlInput)!.bg} ${getPlatformIcon(urlInput)!.color}`}>
                {getPlatformIcon(urlInput)!.label} detected
              </div>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => importUrl.mutate({ trackId, url: urlInput, title: urlTitle || undefined, artist: urlArtist || undefined })}
                disabled={!urlInput || importUrl.isPending}
              >
                {importUrl.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5 mr-1.5" />}
                Add Reference
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowUrlForm(false); setUrlInput(""); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && <Skeleton className="h-24 w-full" />}

      {(!references || references.length === 0) && !isLoading && !showUrlForm && (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <Target className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No reference tracks yet. Upload audio or paste a streaming link.
            </p>
          </CardContent>
        </Card>
      )}

      {references?.map((ref) => {
        const platform = isUrlRef(ref.mimeType) ? getPlatformIcon(ref.storageUrl) : null;
        return (
          <Card key={ref.id} className="overflow-hidden">
            <CardContent className="py-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {platform ? (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${platform.bg} ${platform.color}`}>
                      {platform.label}
                    </span>
                  ) : (
                    <Target className="h-4 w-4 text-primary" />
                  )}
                  <span className="text-sm font-medium">{ref.filename}</span>
                </div>
                <div className="flex items-center gap-2">
                  {!ref.comparisonResult && !isUrlRef(ref.mimeType) && (
                    <Button
                      size="sm"
                      onClick={() => compareMut.mutate({ referenceId: ref.id })}
                      disabled={compareMut.isPending}
                    >
                      {compareMut.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <GitCompare className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Compare
                    </Button>
                  )}
                  {isUrlRef(ref.mimeType) && (
                    <Button size="sm" variant="outline" onClick={() => window.open(ref.storageUrl, "_blank")}>
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                      Open
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => deleteMut.mutate({ referenceId: ref.id })}
                    disabled={deleteMut.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {!isUrlRef(ref.mimeType) && (
                <AudioPlayer
                  src={ref.storageUrl}
                  title={ref.originalFilename}
                  subtitle="Reference Track"
                  compact
                  className="mb-3"
                />
              )}

              {isUrlRef(ref.mimeType) && (
                <div className="text-xs text-muted-foreground mb-3 truncate">
                  {ref.storageUrl}
                </div>
              )}

              {ref.comparisonResult && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <div className="prose prose-sm prose-invert max-w-none">
                    <Streamdown>{ref.comparisonResult}</Streamdown>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Progress Tracker ──

const scoreBgColor = (score: number) => {
  if (score >= 8) return "bg-emerald-400/20";
  if (score >= 6) return "bg-sky-400/20";
  if (score >= 4) return "bg-amber-400/20";
  return "bg-rose-400/20";
};

// ── Review History Section ──

function ReviewHistorySection({ trackId, reviews, onNavigate }: { trackId: number; reviews: any[]; onNavigate: (path: string) => void }) {
  const { data: history } = trpc.review.history.useQuery({ trackId });

  // If we have history data with versions, show the enhanced view
  const hasMultipleVersions = history && history.length > 1;

  if (reviews.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No reviews yet. Analyze the track first, then request a review.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {hasMultipleVersions && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-primary font-medium">{history.length} review versions</span>
              <span className="text-muted-foreground">— re-running critique preserves previous reviews for comparison</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Show history entries if available, otherwise fall back to reviews list */}
      {history && history.length > 0 ? (
        history.map((entry, idx) => {
          const scores = entry.scoresJson as Record<string, number> | null;
          const overall = scores?.overall ?? scores?.Overall ?? null;
          const prevEntry = history[idx + 1]; // history is desc order, so idx+1 is older
          const prevScores = prevEntry?.scoresJson as Record<string, number> | null;
          const prevOverall = prevScores?.overall ?? prevScores?.Overall ?? null;
          const delta = overall !== null && prevOverall !== null ? overall - prevOverall : null;

          return (
            <Card
              key={entry.id}
              className={`cursor-pointer transition-colors ${
                entry.isLatest ? "border-primary/30 hover:border-primary/50" : "hover:border-primary/20 opacity-80"
              }`}
              onClick={() => onNavigate(`/reviews/${entry.id}`)}
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <BarChart3 className={`h-5 w-5 flex-shrink-0 ${entry.isLatest ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">Review v{entry.reviewVersion}</p>
                        {entry.isLatest && <Badge variant="default" className="text-xs">Latest</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Troubadour — {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    {overall !== null && (
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold ${
                          overall >= 8 ? "text-emerald-500" : overall >= 6 ? "text-yellow-500" : "text-rose-500"
                        }`}>{overall}/10</span>
                        {delta !== null && delta !== 0 && (
                          <span className={`text-xs flex items-center gap-0.5 ${
                            delta > 0 ? "text-emerald-500" : "text-rose-500"
                          }`}>
                            {delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {delta > 0 ? "+" : ""}{delta}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {entry.quickTake && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{entry.quickTake}</p>
                )}
                <div className="mt-2">
                  <ReviewQualityBadge reviewId={entry.id} compact />
                </div>
              </CardContent>
            </Card>
          );
        })
      ) : (
        reviews.map(review => (
          <Card key={review.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => onNavigate(`/reviews/${review.id}`)}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium capitalize">{review.reviewType} Review</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                {review.quickTake && (
                  <p className="text-sm text-muted-foreground max-w-xs truncate hidden sm:block">{review.quickTake}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function ProgressTracker({ trackId }: { trackId: number }) {
  const { data: scoreHistory, isLoading } = trpc.scoreHistory.get.useQuery({ trackId });

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!scoreHistory || scoreHistory.length < 2) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center">
          <TrendingUp className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Upload multiple versions to see your improvement trajectory.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            At least 2 reviewed versions needed.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Parse scores for chart data
  const chartData = scoreHistory.map(v => ({
    versionNumber: v.versionNumber,
    filename: v.filename,
    scores: typeof v.scores === "string" ? (() => { try { return JSON.parse(v.scores); } catch { return {}; } })() : (v.scores || {}),
  }));

  const latest = chartData[chartData.length - 1];
  const first = chartData[0];
  const overallDelta = (latest.scores.overall ?? 0) - (first.scores.overall ?? 0);

  return (
    <div className="space-y-4">
      {/* Overall Progress Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Score Evolution
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary stats */}
          <div className="flex items-center gap-6 pb-4 border-b border-border/50">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Versions</p>
              <p className="text-2xl font-bold">{chartData.length}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">First Score</p>
              <p className={`text-2xl font-bold ${scoreColor(first.scores.overall ?? 0)}`}>
                {first.scores.overall ?? "—"}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Latest Score</p>
              <p className={`text-2xl font-bold ${scoreColor(latest.scores.overall ?? 0)}`}>
                {latest.scores.overall ?? "—"}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Change</p>
              <p className={`text-2xl font-bold ${
                overallDelta > 0 ? "text-emerald-400" : overallDelta < 0 ? "text-rose-400" : "text-muted-foreground"
              }`}>
                {overallDelta > 0 ? `+${overallDelta}` : overallDelta === 0 ? "—" : overallDelta}
              </p>
            </div>
          </div>

          {/* Line Chart */}
          <ScoreLineChart data={chartData} />
        </CardContent>
      </Card>

      {/* Version Quick Takes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Version Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {scoreHistory.map((v, i) => (
            <div key={i} className="flex gap-3 py-2 border-b border-border/50 last:border-0">
              <Badge variant={i === scoreHistory.length - 1 ? "default" : "outline"} className="shrink-0 mt-0.5">
                v{v.versionNumber}
              </Badge>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">{v.filename}</p>
                {v.quickTake && (
                  <p className="text-sm text-foreground/80 line-clamp-2">{v.quickTake}</p>
                )}
              </div>
              {(() => {
                const scores = typeof v.scores === "string" ? (() => { try { return JSON.parse(v.scores); } catch { return {}; } })() : (v.scores || {});
                const overall = scores.overall;
                return overall !== undefined ? (
                  <span className={`text-lg font-bold shrink-0 ${scoreColor(overall)}`}>
                    {overall}
                  </span>
                ) : null;
              })()}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Export History Button ──
function ExportHistoryButton({ trackId }: { trackId: number }) {
  const exportHistory = trpc.review.exportHistory.useMutation({
    onSuccess: (result) => {
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(result.htmlContent);
        win.document.close();
        setTimeout(() => win.print(), 500);
      }
      toast.success(`Review history exported (${result.versionCount} versions)`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const exportMarkdown = trpc.review.exportHistory.useMutation({
    onSuccess: (result) => {
      const blob = new Blob([result.markdown], { type: "text/markdown;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${result.trackName.replace(/\.[^/.]+$/, "")}-review-history.md`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Markdown downloaded");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="flex items-center gap-2 justify-end">
      <Button
        variant="outline"
        size="sm"
        onClick={() => exportHistory.mutate({ trackId })}
        disabled={exportHistory.isPending}
        className="gap-1.5"
      >
        {exportHistory.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <History className="h-3.5 w-3.5" />}
        Export History (PDF)
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => exportMarkdown.mutate({ trackId })}
        disabled={exportMarkdown.isPending}
        className="gap-1.5"
      >
        {exportMarkdown.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        Markdown
      </Button>
    </div>
  );
}

// ── Main TrackView ──

export default function TrackView({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [lyricsText, setLyricsText] = useState("");
  const [lyricsEditing, setLyricsEditing] = useState(false);
  const versionInputRef = useRef<HTMLInputElement>(null);
  const { setContext } = useChat();

  useEffect(() => {
    setContext({ trackId: id });
  }, [id, setContext]);

  const { data, isLoading, error } = trpc.track.get.useQuery({ id }, {
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d) return false;
      const processing = d.track.status === "analyzing" || d.track.status === "reviewing";
      return processing ? 3000 : false;
    },
  });

  const handleJobError = (err: any) => {
    if (err.message?.includes("limit") || err.data?.code === "FORBIDDEN") {
      toast.error(err.message, {
        action: { label: "Upgrade", onClick: () => setLocation("/pricing") },
        duration: 8000,
      });
    } else {
      toast.error(err.message);
    }
  };

  const analyzeTrack = trpc.job.analyze.useMutation({
    onSuccess: () => { utils.track.get.invalidate({ id }); toast.success("Analysis started"); },
    onError: handleJobError,
  });

  const reviewTrack = trpc.job.review.useMutation({
    onSuccess: () => { utils.track.get.invalidate({ id }); toast.success("Review started"); },
    onError: handleJobError,
  });

  const compareMut = trpc.job.compare.useMutation({
    onSuccess: () => { utils.track.get.invalidate({ id }); toast.success("Comparison started"); },
    onError: handleJobError,
  });

  const saveLyrics = trpc.lyrics.save.useMutation({
    onSuccess: () => {
      utils.track.get.invalidate({ id });
      setLyricsEditing(false);
      toast.success("Lyrics saved");
    },
    onError: (err) => toast.error(err.message),
  });

  const transcribe = trpc.lyrics.transcribe.useMutation({
    onSuccess: () => {
      utils.track.get.invalidate({ id });
      toast.success("Transcription complete");
    },
    onError: (err) => {
      const msg = err.message?.toLowerCase() || "";
      if (msg.includes("size") || msg.includes("16mb") || msg.includes("too large")) {
        toast.error("Audio file is too large for transcription (max 16MB). Try a shorter clip or compressed format.");
      } else if (msg.includes("format") || msg.includes("unsupported")) {
        toast.error("Unsupported audio format. Transcription works best with MP3, WAV, or M4A files.");
      } else if (msg.includes("timeout") || msg.includes("timed out")) {
        toast.error("Transcription timed out. The audio may be too long — try a shorter track.");
      } else {
        toast.error(`Transcription failed: ${err.message}`);
      }
    },
  });

  const retryJob = trpc.job.retry.useMutation({
    onSuccess: () => {
      utils.track.get.invalidate({ id });
      toast.success("Retrying...");
    },
    onError: (err) => toast.error(err.message),
  });

  const analyzeAndReview = trpc.job.analyzeAndReview.useMutation({
    onSuccess: () => {
      utils.track.get.invalidate({ id });
      toast.success("Analysis & review started");
    },
    onError: handleJobError,
  });

  const uploadTrack = trpc.track.upload.useMutation({
    onSuccess: () => {
      utils.track.get.invalidate({ id });
      toast.success("New version uploaded");
    },
    onError: (err) => toast.error(err.message),
  });

  const exportHtmlMut = trpc.review.exportHtml.useMutation({
    onSuccess: (data) => {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(data.htmlContent);
        printWindow.document.close();
        printWindow.print();
        toast.success("Preparing review for print...");
      } else {
        toast.error("Failed to open print window. Please allow pop-ups.");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const shareMut = trpc.review.generateShareLink.useMutation({
    onSuccess: (data) => {
      const link = `${window.location.origin}/shared/${data.shareToken}`;
      navigator.clipboard.writeText(link);
      toast.success("Share link copied to clipboard!");
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-8 w-8 text-destructive mb-4" />
        <p className="text-muted-foreground">Track not found</p>
      </div>
    );
  }

  const { track, features, reviews, lyrics: trackLyricsArr, versions, jobError } = data;
  const trackLyrics = trackLyricsArr?.[0] ?? null;
  const isProcessing = track.status === "analyzing" || track.status === "reviewing";
  const geminiAnalysis = features?.geminiAnalysisJson as any;
  const audioFeaturesData = features?.featuresJson as any;
  const sections = features?.sectionsJson as any[];
  const hasVersions = versions.length > 0 || track.parentTrackId;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation(`/projects/${track.projectId}`)} aria-label="Back to project">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>{track.originalFilename}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              {track.versionNumber > 1 && <Badge variant="outline">v{track.versionNumber}</Badge>}
              <span>{(track.fileSize / (1024 * 1024)).toFixed(1)} MB</span>
              {track.duration && <span>{Math.floor(track.duration / 60)}:{String(track.duration % 60).padStart(2, "0")}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Genre Insight - shown after analysis */}
      {track.detectedGenre && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground italic">We hear:</span>
          <Badge variant="secondary" className="font-normal">
            {track.detectedGenre}
          </Badge>
          {track.detectedSubgenres && track.detectedSubgenres.split(", ").filter(Boolean).map((sub: string) => (
            <Badge key={sub} variant="outline" className="font-normal text-xs">
              {sub}
            </Badge>
          ))}
          {track.detectedInfluences && (
            <span className="text-xs text-muted-foreground ml-1 italic">
              touches of {track.detectedInfluences}
            </span>
          )}
        </div>
      )}

      {/* Tags */}
      <TrackTags trackId={id} />

      {/* Audio Player */}
      <AudioPlayer
        src={track.storageUrl}
        title={track.originalFilename}
        subtitle={track.detectedGenre ? `${track.detectedGenre}${track.detectedSubgenres ? ` · ${track.detectedSubgenres}` : ""}` : undefined}
      />

      {/* Error Banner */}
      {track.status === "error" && jobError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-destructive">Processing failed</p>
              <p className="text-xs text-muted-foreground mt-1 break-words">{jobError}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {(track.status === "uploaded" || track.status === "error") && (
          <>
            <Button
              onClick={() => analyzeAndReview.mutate({ trackId: id })}
              disabled={analyzeAndReview.isPending || analyzeTrack.isPending}
              className="bg-primary"
            >
              {analyzeAndReview.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
              Analyze & Review
            </Button>
            <Button variant="outline" onClick={() => analyzeTrack.mutate({ trackId: id })} disabled={analyzeTrack.isPending || analyzeAndReview.isPending}>
              {analyzeTrack.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Headphones className="h-4 w-4 mr-2" />}
              Analyze Only
            </Button>
          </>
        )}
        {track.status === "analyzed" && (
          <Button onClick={() => reviewTrack.mutate({ trackId: id })} disabled={reviewTrack.isPending}>
            {reviewTrack.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
            Generate Review
          </Button>
        )}
        {track.parentTrackId && track.status === "reviewed" && (
          <>
            <Button variant="secondary" onClick={() => setLocation(`/tracks/${id}/diff`)}>
              <GitCompare className="h-4 w-4 mr-2" />
              Version Diff
            </Button>
            <Button variant="outline" onClick={() => compareMut.mutate({ trackId: id })} disabled={compareMut.isPending}>
              <GitCompare className="h-4 w-4 mr-2" />
              AI Compare
            </Button>
          </>
        )}
        <Button
          variant="outline"
          onClick={() => versionInputRef.current?.click()}
          disabled={uploadTrack.isPending}
        >
          {uploadTrack.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          {uploadTrack.isPending ? "Uploading..." : "Upload New Version"}
        </Button>
        <input
          ref={versionInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          aria-label="Upload new version of this track"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (!file.type.startsWith("audio/")) {
              toast.error("Invalid file type", { description: "Please upload an audio file (MP3, WAV, FLAC, etc.)" });
              return;
            }
            if (file.size > 50 * 1024 * 1024) {
              toast.error("File too large", { description: "Maximum file size is 50MB." });
              return;
            }
            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve((reader.result as string).split(",")[1]);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            uploadTrack.mutate({
              projectId: track.projectId,
              filename: file.name,
              mimeType: file.type,
              fileBase64: base64,
              fileSize: file.size,
              parentTrackId: track.parentTrackId || track.id,
              versionNumber: (track.versionNumber || 1) + 1,
            });
          }}
        />
        {reviews.length > 0 && <DAWExportButton trackId={id} />}
      </div>

      {isProcessing && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium">
              {track.status === "analyzing" ? "Listening to your track..." : "Writing the critique..."}
            </span>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue={reviews.length > 0 ? "reviews" : "analysis"} className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
          <TabsTrigger value="lyrics">Lyrics</TabsTrigger>
          <TabsTrigger value="reference">Reference</TabsTrigger>
          {hasVersions && <TabsTrigger value="versions">Versions</TabsTrigger>}
          {hasVersions && <TabsTrigger value="progress">Progress</TabsTrigger>}
          <TabsTrigger value="mix-report">Mix Report</TabsTrigger>
          <TabsTrigger value="structure">Structure</TabsTrigger>
          <TabsTrigger value="mood">Mood/Energy</TabsTrigger>
          <TabsTrigger value="instrumentation">Instrumentation</TabsTrigger>
          <TabsTrigger value="annotations">Notes</TabsTrigger>
          {reviews.length >= 2 && <TabsTrigger value="compare">Compare</TabsTrigger>}
        </TabsList>

        {/* Analysis Tab */}
        <TabsContent value="analysis" className="space-y-4">
          {!features ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Headphones className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No analysis yet. Click "Analyze Audio" to start.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {audioFeaturesData && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Audio Features</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {audioFeaturesData.tempo && (
                        <div className="p-3 rounded-lg bg-secondary">
                          <p className="text-xs text-muted-foreground">Tempo</p>
                          <p className="text-lg font-semibold">
                            {typeof audioFeaturesData.tempo === 'object' ? `${audioFeaturesData.tempo.bpm}` : audioFeaturesData.tempo} BPM
                          </p>
                          {typeof audioFeaturesData.tempo === 'object' && audioFeaturesData.tempo.feel && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{audioFeaturesData.tempo.feel}</p>
                          )}
                        </div>
                      )}
                      {audioFeaturesData.key && (
                        <div className="p-3 rounded-lg bg-secondary">
                          <p className="text-xs text-muted-foreground">Key</p>
                          <p className="text-lg font-semibold">
                            {typeof audioFeaturesData.key === 'object' ? audioFeaturesData.key.estimated : audioFeaturesData.key}
                          </p>
                        </div>
                      )}
                      {audioFeaturesData.timeSignature && (
                        <div className="p-3 rounded-lg bg-secondary">
                          <p className="text-xs text-muted-foreground">Time Sig</p>
                          <p className="text-lg font-semibold">
                            {typeof audioFeaturesData.timeSignature === 'object'
                              ? `${audioFeaturesData.timeSignature.beats ?? audioFeaturesData.timeSignature.numerator ?? 4}/${audioFeaturesData.timeSignature.value ?? audioFeaturesData.timeSignature.denominator ?? 4}`
                              : audioFeaturesData.timeSignature}
                          </p>
                        </div>
                      )}
                      {audioFeaturesData.overallEnergy && (
                        <div className="p-3 rounded-lg bg-secondary">
                          <p className="text-xs text-muted-foreground">Energy</p>
                          <p className="text-lg font-semibold">
                            {typeof audioFeaturesData.overallEnergy === 'object'
                              ? (audioFeaturesData.overallEnergy.level ?? audioFeaturesData.overallEnergy.score ?? audioFeaturesData.overallEnergy.value ?? "—")
                              : audioFeaturesData.overallEnergy}/10
                          </p>
                        </div>
                      )}
                      {audioFeaturesData.mood && Array.isArray(audioFeaturesData.mood) && (
                        <div className="p-3 rounded-lg bg-secondary col-span-2">
                          <p className="text-xs text-muted-foreground">Mood</p>
                          <p className="text-sm font-medium mt-1">{audioFeaturesData.mood.join(", ")}</p>
                        </div>
                      )}
                    </div>
                    {(audioFeaturesData.instruments || audioFeaturesData.instrumentation) && (
                      <div className="mt-4">
                        <p className="text-xs text-muted-foreground mb-2">Instruments Detected</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(Array.isArray(audioFeaturesData.instruments || audioFeaturesData.instrumentation)
                            ? (audioFeaturesData.instruments || audioFeaturesData.instrumentation)
                            : []
                          ).map((inst: any, i: number) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {typeof inst === 'object' ? (inst.name || inst.instrument || inst.label || Object.values(inst).filter(v => typeof v === 'string')[0] || 'Unknown') : String(inst)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {sections && sections.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Song Structure</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {sections.map((section: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                          <span className="text-xs font-mono text-muted-foreground w-16 shrink-0">
                            {section.startTime || section.start || "—"}
                          </span>
                          <Badge variant="outline" className="capitalize shrink-0">
                            {section.label || section.name || section.type || "Section"}
                          </Badge>
                          <span className="text-sm text-muted-foreground truncate">
                            {section.description || section.notes || ""}
                          </span>
                          {section.energy !== undefined && (
                            <span className="text-xs text-muted-foreground ml-auto shrink-0">
                              Energy: {section.energy}/10
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {geminiAnalysis && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Raw Audio Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm prose-invert max-w-none">
                      <Streamdown>{typeof geminiAnalysis === "string" ? geminiAnalysis : JSON.stringify(geminiAnalysis, null, 2)}</Streamdown>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Reviews Tab */}
        <TabsContent value="reviews" className="space-y-4">
          {/* Score Trend Chart — shows score changes across review versions */}
          {reviews.filter((r: any) => r.reviewType === "track").length >= 1 && (
            <VersionScoreTrend trackId={track.id} />
          )}
          {reviews.length > 0 && reviews.filter((r: any) => r.reviewType === "track").length >= 2 && (
            <ExportHistoryButton trackId={track.id} />
          )}
          {reviews.filter((r: any) => r.reviewType === "track").length >= 1 && (
            <SentimentHeatmap trackId={track.id} />
          )}
          {reviews.filter((r: any) => r.reviewType === "track").length >= 1 && (
            <MasteringChecklist trackId={track.id} />
          )}
          {reviews.filter((r: any) => r.reviewType === "track").length >= 1 && (
            <ABReviewComparison trackId={track.id} />
          )}
          <TrackNotes trackId={track.id} />
          {reviews.length > 0 && (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const latestReview = reviews.find((r: any) => r.isLatest && r.reviewType === "track");
                  if (latestReview) {
                    exportHtmlMut.mutate({ reviewId: latestReview.id });
                  } else {
                    toast.error("No review available to export");
                  }
                }}
                disabled={exportHtmlMut.isPending}
              >
                {exportHtmlMut.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileText className="h-3.5 w-3.5 mr-1.5" />}
                Export PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const latestReview = reviews.find((r: any) => r.isLatest && r.reviewType === "track");
                  if (latestReview) {
                    shareMut.mutate({ id: latestReview.id });
                  } else {
                    toast.error("No review available to share");
                  }
                }}
                disabled={shareMut.isPending}
              >
                {shareMut.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ArrowUpRight className="h-3.5 w-3.5 mr-1.5" />}
                Share
              </Button>
            </div>
          )}
          <ReviewHistorySection trackId={track.id} reviews={reviews} onNavigate={setLocation} />
        </TabsContent>

        {/* Lyrics Tab */}
        <TabsContent value="lyrics" className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => transcribe.mutate({ trackId: id })}
              disabled={transcribe.isPending}
            >
              {transcribe.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Mic className="h-3.5 w-3.5 mr-1.5" />}
              Auto-Transcribe
            </Button>
            {!lyricsEditing && (
              <Button variant="outline" size="sm" onClick={() => {
                setLyricsText(trackLyrics?.text || "");
                setLyricsEditing(true);
              }}>
                {trackLyrics ? "Edit Lyrics" : "Add Lyrics"}
              </Button>
            )}
          </div>
          {lyricsEditing ? (
            <div className="space-y-3">
              <Textarea
                value={lyricsText}
                onChange={(e) => setLyricsText(e.target.value)}
                rows={15}
                placeholder="Paste your lyrics here..."
                className="font-mono text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => saveLyrics.mutate({ trackId: id, text: lyricsText })}
                  disabled={saveLyrics.isPending || !lyricsText.trim()}
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  Save
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setLyricsEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : trackLyrics ? (
            <Card>
              <CardContent className="py-4">
                <pre className="whitespace-pre-wrap text-sm font-mono text-muted-foreground leading-relaxed">
                  {trackLyrics.text}
                </pre>
                <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
                  Source: {trackLyrics.source} — {formatDistanceToNow(new Date(trackLyrics.updatedAt), { addSuffix: true })}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No lyrics yet. Add them manually or auto-transcribe.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Reference Track Tab */}
        <TabsContent value="reference">
          <ReferenceTrackSection trackId={id} />
        </TabsContent>

        {/* Versions Tab */}
        {hasVersions && (
          <TabsContent value="versions" className="space-y-2">
            {/* Show current track in version list if it's the parent */}
            {!track.parentTrackId && (
              <Card className="border-primary/50 bg-primary/5">
                <CardContent className="py-3 px-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="default">v{track.versionNumber}</Badge>
                    <span className="text-sm">{track.originalFilename}</span>
                    <Badge variant="secondary" className="text-xs">Current</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(track.createdAt), { addSuffix: true })}
                  </span>
                </CardContent>
              </Card>
            )}
            {versions.map(v => (
              <Card
                key={v.id}
                className={`cursor-pointer transition-colors ${v.id === track.id ? "border-primary/50 bg-primary/5" : "hover:border-primary/30"}`}
                onClick={() => { if (v.id !== track.id) setLocation(`/tracks/${v.id}`); }}
              >
                <CardContent className="py-3 px-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant={v.id === track.id ? "default" : "outline"}>v{v.versionNumber}</Badge>
                    <span className="text-sm">{v.originalFilename}</span>
                    {v.id === track.id && <Badge variant="secondary" className="text-xs">Current</Badge>}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(v.createdAt), { addSuffix: true })}
                  </span>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        )}

        {/* Progress Tracker Tab */}
        {hasVersions && (
          <TabsContent value="progress">
            <ProgressTracker trackId={id} />
          </TabsContent>
        )}
        {/* Mix Report Tab */}
        <TabsContent value="mix-report">
          <MixReportTab trackId={id} />
        </TabsContent>

        {/* Structure Analysis Tab */}
        <TabsContent value="structure">
          <StructureTab trackId={id} />
        </TabsContent>

        {/* Mood/Energy Tab */}
        <TabsContent value="mood">
          <MoodEnergyTab trackId={id} />
        </TabsContent>

        {/* Instrumentation Advisor Tab */}
        <TabsContent value="instrumentation">
          <InstrumentationAdvisorTab trackId={id} />
        </TabsContent>

        {/* Annotations Tab */}
        <TabsContent value="annotations">
          <WaveformAnnotations trackId={id} />
        </TabsContent>

        {reviews.length >= 2 && (
          <TabsContent value="compare">
            <ReviewComparisonView trackId={id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
