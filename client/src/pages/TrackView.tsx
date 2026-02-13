import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useLocation } from "wouter";
import { useState, useRef } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Headphones, FileText, Loader2, Music, BarChart3,
  AlertCircle, GitCompare, Upload, Mic, Save
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Streamdown } from "streamdown";

export default function TrackView({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [lyricsText, setLyricsText] = useState("");
  const [lyricsEditing, setLyricsEditing] = useState(false);
  const versionInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error } = trpc.track.get.useQuery({ id }, {
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d) return false;
      const processing = d.track.status === "analyzing" || d.track.status === "reviewing";
      return processing ? 3000 : false;
    },
  });

  const analyzeTrack = trpc.job.analyze.useMutation({
    onSuccess: () => { utils.track.get.invalidate({ id }); toast.success("Analysis started"); },
    onError: (err) => toast.error(err.message),
  });

  const reviewTrack = trpc.job.review.useMutation({
    onSuccess: () => { utils.track.get.invalidate({ id }); toast.success("Review started"); },
    onError: (err) => toast.error(err.message),
  });

  const compareMut = trpc.job.compare.useMutation({
    onSuccess: () => { utils.track.get.invalidate({ id }); toast.success("Comparison started"); },
    onError: (err) => toast.error(err.message),
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
    onSuccess: (result) => {
      utils.track.get.invalidate({ id });
      toast.success("Transcription complete");
    },
    onError: (err) => toast.error(err.message),
  });

  const uploadTrack = trpc.track.upload.useMutation({
    onSuccess: () => {
      utils.track.get.invalidate({ id });
      toast.success("New version uploaded");
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

  const { track, features, reviews, lyrics: trackLyricsArr, versions } = data;
  const trackLyrics = trackLyricsArr?.[0] ?? null;
  const isProcessing = track.status === "analyzing" || track.status === "reviewing";
  const geminiAnalysis = features?.geminiAnalysisJson as any;
  const audioFeaturesData = features?.featuresJson as any;
  const sections = features?.sectionsJson as any[];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation(`/projects/${track.projectId}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{track.originalFilename}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              {track.versionNumber > 1 && <Badge variant="outline">v{track.versionNumber}</Badge>}
              <span>{(track.fileSize / (1024 * 1024)).toFixed(1)} MB</span>
              {track.duration && <span>{Math.floor(track.duration / 60)}:{String(track.duration % 60).padStart(2, "0")}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Audio Player */}
      <Card>
        <CardContent className="py-4">
          <audio controls className="w-full" src={track.storageUrl} preload="metadata">
            Your browser does not support audio playback.
          </audio>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {(track.status === "uploaded" || track.status === "error") && (
          <Button onClick={() => analyzeTrack.mutate({ trackId: id })} disabled={analyzeTrack.isPending}>
            {analyzeTrack.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Headphones className="h-4 w-4 mr-2" />}
            Analyze Audio
          </Button>
        )}
        {track.status === "analyzed" && (
          <Button onClick={() => reviewTrack.mutate({ trackId: id })} disabled={reviewTrack.isPending}>
            {reviewTrack.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
            Generate Review
          </Button>
        )}
        {track.parentTrackId && track.status === "reviewed" && (
          <Button variant="secondary" onClick={() => compareMut.mutate({ trackId: id })} disabled={compareMut.isPending}>
            <GitCompare className="h-4 w-4 mr-2" />
            Compare Versions
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => versionInputRef.current?.click()}
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload New Version
        </Button>
        <input
          ref={versionInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
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
        <TabsList>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
          <TabsTrigger value="lyrics">Lyrics</TabsTrigger>
          {versions.length > 0 && <TabsTrigger value="versions">Versions ({versions.length})</TabsTrigger>}
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
                          <p className="text-lg font-semibold">{audioFeaturesData.tempo} BPM</p>
                        </div>
                      )}
                      {audioFeaturesData.key && (
                        <div className="p-3 rounded-lg bg-secondary">
                          <p className="text-xs text-muted-foreground">Key</p>
                          <p className="text-lg font-semibold">{audioFeaturesData.key}</p>
                        </div>
                      )}
                      {audioFeaturesData.timeSignature && (
                        <div className="p-3 rounded-lg bg-secondary">
                          <p className="text-xs text-muted-foreground">Time Sig</p>
                          <p className="text-lg font-semibold">{audioFeaturesData.timeSignature}</p>
                        </div>
                      )}
                      {audioFeaturesData.overallEnergy && (
                        <div className="p-3 rounded-lg bg-secondary">
                          <p className="text-xs text-muted-foreground">Energy</p>
                          <p className="text-lg font-semibold">{audioFeaturesData.overallEnergy}/10</p>
                        </div>
                      )}
                    </div>
                    {audioFeaturesData.instruments && (
                      <div className="mt-4">
                        <p className="text-xs text-muted-foreground mb-2">Instruments Detected</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(audioFeaturesData.instruments as string[]).map((inst: string) => (
                            <Badge key={inst} variant="secondary" className="text-xs">{inst}</Badge>
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
          {reviews.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No reviews yet. Analyze the track first, then request a review.</p>
              </CardContent>
            </Card>
          ) : (
            reviews.map(review => (
              <Card key={review.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setLocation(`/reviews/${review.id}`)}>
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
                <Music className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No lyrics yet. Add them manually or auto-transcribe.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Versions Tab */}
        {versions.length > 0 && (
          <TabsContent value="versions" className="space-y-2">
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
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(v.createdAt), { addSuffix: true })}
                  </span>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
