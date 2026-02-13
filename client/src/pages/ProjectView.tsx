import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useLocation } from "wouter";
import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Upload, Play, FileText, Loader2, Music, BarChart3,
  CheckCircle2, AlertCircle, Clock, Headphones, GitCompare, Trash2, BookOpen
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const trackStatusConfig: Record<string, { label: string; color: string }> = {
  uploaded: { label: "Uploaded", color: "text-muted-foreground" },
  analyzing: { label: "Analyzing...", color: "text-yellow-400" },
  analyzed: { label: "Analyzed", color: "text-blue-400" },
  reviewing: { label: "Reviewing...", color: "text-yellow-400" },
  reviewed: { label: "Reviewed", color: "text-green-400" },
  error: { label: "Error", color: "text-red-400" },
};

export default function ProjectView({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const versionInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingVersion, setUploadingVersion] = useState<number | null>(null);

  const { data, isLoading, error } = trpc.project.get.useQuery({ id }, {
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d) return false;
      const hasActive = d.jobs.some(j => j.status === "queued" || j.status === "running");
      return hasActive ? 3000 : false;
    },
  });

  const uploadTrack = trpc.track.upload.useMutation({
    onSuccess: () => {
      utils.project.get.invalidate({ id });
      toast.success("Track uploaded");
    },
    onError: (err) => toast.error(err.message),
  });

  const analyzeTrack = trpc.job.analyze.useMutation({
    onSuccess: () => {
      utils.project.get.invalidate({ id });
      toast.success("Analysis started — Gemini is listening");
    },
    onError: (err) => toast.error(err.message),
  });

  const reviewTrack = trpc.job.review.useMutation({
    onSuccess: () => {
      utils.project.get.invalidate({ id });
      toast.success("Review started — Claude is writing");
    },
    onError: (err) => toast.error(err.message),
  });

  const albumReview = trpc.job.albumReview.useMutation({
    onSuccess: () => {
      utils.project.get.invalidate({ id });
      toast.success("Album review started");
    },
    onError: (err) => toast.error(err.message),
  });

  const compareTrack = trpc.job.compare.useMutation({
    onSuccess: () => {
      utils.project.get.invalidate({ id });
      toast.success("Version comparison started");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteProject = trpc.project.delete.useMutation({
    onSuccess: () => {
      toast.success("Project deleted");
      setLocation("/dashboard");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleFileUpload = useCallback(async (files: FileList | null, parentTrackId?: number) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("audio/")) {
          toast.error(`${file.name} is not an audio file`);
          continue;
        }
        if (file.size > 50 * 1024 * 1024) {
          toast.error(`${file.name} exceeds 50MB limit`);
          continue;
        }
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        await uploadTrack.mutateAsync({
          projectId: id,
          filename: file.name,
          mimeType: file.type,
          fileBase64: base64,
          fileSize: file.size,
          ...(parentTrackId ? { parentTrackId, versionNumber: 2 } : {}),
        });
      }
    } catch (e) {
      // handled by mutation
    } finally {
      setUploading(false);
      setUploadingVersion(null);
    }
  }, [id, uploadTrack]);

  const handleAnalyzeAll = () => {
    if (!data) return;
    const uploadedTracks = data.tracks.filter(t => t.status === "uploaded");
    if (!uploadedTracks.length) {
      toast.info("No tracks to analyze");
      return;
    }
    uploadedTracks.forEach(t => analyzeTrack.mutate({ trackId: t.id }));
  };

  const handleReviewAll = () => {
    if (!data) return;
    const analyzedTracks = data.tracks.filter(t => t.status === "analyzed");
    if (!analyzedTracks.length) {
      toast.info("No analyzed tracks to review. Run analysis first.");
      return;
    }
    analyzedTracks.forEach(t => reviewTrack.mutate({ trackId: t.id }));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-8 w-8 text-destructive mb-4" />
        <p className="text-muted-foreground">Project not found</p>
        <Button variant="ghost" onClick={() => setLocation("/dashboard")} className="mt-4">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const { project, tracks, reviews, jobs } = data;
  const activeJobs = jobs.filter(j => j.status === "queued" || j.status === "running");
  const hasAnalyzedTracks = tracks.some(t => t.status === "analyzed" || t.status === "reviewed");
  const allReviewed = tracks.length > 0 && tracks.every(t => t.status === "reviewed");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{project.title}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <Badge variant="outline" className="capitalize">{project.type}</Badge>
              {project.genre && <span>{project.genre}</span>}
              <span>{formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm("Delete this project and all its tracks?")) {
                deleteProject.mutate({ id });
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete
          </Button>
        </div>
      </div>

      {project.description && (
        <p className="text-sm text-muted-foreground max-w-2xl">{project.description}</p>
      )}

      {/* Active Jobs */}
      {activeJobs.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4">
            <div className="space-y-3">
              {activeJobs.map(job => (
                <div key={job.id} className="flex items-center gap-3">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium capitalize">{job.type.replace("_", " ")}</span>
                      <span className="text-muted-foreground">{job.progress}%</span>
                    </div>
                    <Progress value={job.progress} className="h-1.5 mt-1" />
                    {job.progressMessage && (
                      <p className="text-xs text-muted-foreground mt-1">{job.progressMessage}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Bar */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          Upload Tracks
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          multiple
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files)}
        />
        <Button variant="secondary" onClick={handleAnalyzeAll} disabled={analyzeTrack.isPending}>
          <Headphones className="h-4 w-4 mr-2" />
          Analyze All
        </Button>
        <Button variant="secondary" onClick={handleReviewAll} disabled={reviewTrack.isPending || !hasAnalyzedTracks}>
          <FileText className="h-4 w-4 mr-2" />
          Review All
        </Button>
        {project.type === "album" && allReviewed && (
          <Button variant="secondary" onClick={() => albumReview.mutate({ projectId: id })} disabled={albumReview.isPending}>
            <BookOpen className="h-4 w-4 mr-2" />
            Album Review
          </Button>
        )}
      </div>

      <Separator />

      {/* Tracks List */}
      <div>
        <h2 className="text-lg font-semibold mb-4">
          Tracks ({tracks.length})
        </h2>
        {tracks.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Music className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">No tracks yet. Upload audio files to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {tracks.map((track, idx) => {
              const status = trackStatusConfig[track.status] || trackStatusConfig.uploaded;
              const trackReviews = reviews.filter(r => r.trackId === track.id);
              const isProcessing = track.status === "analyzing" || track.status === "reviewing";
              return (
                <Card key={track.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-4">
                      <div className="text-sm font-mono text-muted-foreground w-6 text-center shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="font-medium truncate cursor-pointer hover:text-primary transition-colors"
                            onClick={() => setLocation(`/tracks/${track.id}`)}
                          >
                            {track.originalFilename}
                          </span>
                          {track.versionNumber > 1 && (
                            <Badge variant="outline" className="text-xs shrink-0">v{track.versionNumber}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className={status.color}>
                            {isProcessing && <Loader2 className="h-3 w-3 inline mr-1 animate-spin" />}
                            {status.label}
                          </span>
                          <span>{(track.fileSize / (1024 * 1024)).toFixed(1)} MB</span>
                          {track.duration && <span>{Math.floor(track.duration / 60)}:{String(track.duration % 60).padStart(2, "0")}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {track.status === "uploaded" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => analyzeTrack.mutate({ trackId: track.id })}
                            disabled={analyzeTrack.isPending}
                          >
                            <Headphones className="h-3.5 w-3.5 mr-1.5" />
                            Analyze
                          </Button>
                        )}
                        {track.status === "analyzed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => reviewTrack.mutate({ trackId: track.id })}
                            disabled={reviewTrack.isPending}
                          >
                            <FileText className="h-3.5 w-3.5 mr-1.5" />
                            Review
                          </Button>
                        )}
                        {track.status === "reviewed" && trackReviews.length > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setLocation(`/reviews/${trackReviews[0].id}`)}
                          >
                            <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
                            View Review
                          </Button>
                        )}
                        {track.parentTrackId && track.status === "reviewed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => compareTrack.mutate({ trackId: track.id })}
                            disabled={compareTrack.isPending}
                          >
                            <GitCompare className="h-3.5 w-3.5 mr-1.5" />
                            Compare
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setUploadingVersion(track.id);
                            versionInputRef.current?.click();
                          }}
                          title="Upload new version"
                        >
                          <Upload className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <input
        ref={versionInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          if (uploadingVersion) {
            handleFileUpload(e.target.files, uploadingVersion);
          }
        }}
      />

      {/* Album Review Section */}
      {reviews.filter(r => r.reviewType === "album").length > 0 && (
        <>
          <Separator />
          <div>
            <h2 className="text-lg font-semibold mb-4">Album Review</h2>
            {reviews.filter(r => r.reviewType === "album").map(review => (
              <Card key={review.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setLocation(`/reviews/${review.id}`)}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <BookOpen className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">Album A&R Memo</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">View</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
