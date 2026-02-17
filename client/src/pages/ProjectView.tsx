import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { useLocation } from "wouter";
import { useState, useRef, useCallback, useEffect } from "react";
import { useChat } from "@/contexts/ChatContext";
import { toast } from "sonner";
import {
  ArrowLeft, Upload, Play, FileText, Loader2, Music, BarChart3,
  CheckCircle2, AlertCircle, Clock, Headphones, GitCompare, Trash2, BookOpen, Zap, RotateCcw, UploadCloud, Star, FileDown, Table2, GripVertical, ArrowUp, ArrowDown
} from "lucide-react";
import { DropZone } from "@/components/DropZone";
import { TrackTagsBadges } from "@/components/TrackTags";
import { CollaborationPanel } from "@/components/CollaborationPanel";
import { TemplateSelector } from "@/components/TemplateSelector";
import { ReviewLengthSelector, type ReviewLength } from "@/components/ReviewLengthSelector";
import { ProjectInsightsCard } from "@/components/ProjectInsightsCard";
import { ScoreMatrix } from "@/components/ScoreMatrix";
import { SentimentTimeline } from "@/components/SentimentTimeline";
import { BatchActionsToolbar } from "@/components/BatchActionsToolbar";
import { DraggableTrackList } from "@/components/DraggableTrackList";
import { PlaylistSuggestion } from "@/components/PlaylistSuggestion";
import { ArtworkGallery } from "@/components/ArtworkGallery";
import { ProjectTimeline } from "@/components/ProjectTimeline";
import { ProjectCompletionScore } from "@/components/ProjectCompletionScore";
import { useAuth } from "@/_core/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { trackTrackUploaded, trackReviewStarted } from "@/lib/analytics";

const trackStatusConfig: Record<string, { label: string; color: string }> = {
  uploaded: { label: "Uploaded", color: "text-muted-foreground" },
  analyzing: { label: "Analyzing...", color: "text-amber-400" },
  analyzed: { label: "Analyzed", color: "text-sky-400" },
  reviewing: { label: "Reviewing...", color: "text-amber-400" },
  reviewed: { label: "Reviewed", color: "text-emerald-400" },
  error: { label: "Error", color: "text-rose-400" },
};

export default function ProjectView({ id }: { id: number }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const versionInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingVersion, setUploadingVersion] = useState<number | null>(null);
  const { setContext } = useChat();

  // Full-page drag overlay state
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [reviewLength, setReviewLength] = useState<ReviewLength>("standard");
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<number>>(new Set());
  const [reorderMode, setReorderMode] = useState(false);

  useEffect(() => {
    setContext({ projectId: id, trackId: null });
  }, [id, setContext]);

  const { data, isLoading, error } = trpc.project.get.useQuery({ id }, {
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d) return false;
      const hasActive = d.jobs.some(j => j.status === "queued" || j.status === "running");
      return hasActive ? 3000 : false;
    },
  });

  const uploadTrack = trpc.track.upload.useMutation({
    onError: (err) => toast.error(err.message),
  });

  const analyzeTrack = trpc.job.analyze.useMutation({
    onSuccess: () => {
      utils.project.get.invalidate({ id });
      toast.success("Analysis started — listening to your track");
    },
    onError: (err) => toast.error(err.message),
  });

  const reviewTrack = trpc.job.review.useMutation({
    onSuccess: () => {
      trackReviewStarted(id, "review");
      utils.project.get.invalidate({ id });
      toast.success("Review started — writing your critique");
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

  const analyzeAndReview = trpc.job.analyzeAndReview.useMutation({
    onSuccess: () => {
      utils.project.get.invalidate({ id });
    },
    onError: (err) => toast.error(err.message),
  });

  const retryJob = trpc.job.retry.useMutation({
    onSuccess: () => {
      utils.project.get.invalidate({ id });
      toast.success("Retrying...");
    },
    onError: (err) => toast.error(err.message),
  });

  const batchReviewAll = trpc.job.batchReviewAll.useMutation({
    onSuccess: (result) => {
      utils.project.get.invalidate({ id });
      toast.success(`Queued ${result.queued} track${result.queued !== 1 ? "s" : ""} for full review`);
    },
    onError: (err) => toast.error(err.message),
  });

  const batchReReview = trpc.job.batchReReview.useMutation({
    onSuccess: (result) => {
      utils.project.get.invalidate({ id });
      toast.success(`Re-review queued for ${result.queued} track${result.queued !== 1 ? "s" : ""}`, {
        description: "Fresh critiques using the latest review format",
      });
    },
    onError: (err) => toast.error(err.message),
  });

  const updateProject = trpc.project.update.useMutation({
    onSuccess: () => {
      utils.project.get.invalidate({ id });
      toast.success("Project updated");
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

  const exportAllReviews = trpc.review.exportAllReviews.useMutation({
    onSuccess: (result) => {
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(result.htmlContent);
        win.document.close();
        setTimeout(() => win.print(), 500);
      }
      toast.success("Report generated — print dialog opened");
    },
    onError: (err) => toast.error(err.message),
  });

  const exportZip = trpc.review.exportZip.useMutation({
    onSuccess: (result) => {
      window.open(result.url, "_blank");
      toast.success(`ZIP downloaded — ${result.trackCount} track${result.trackCount !== 1 ? "s" : ""}${result.hasAlbumReview ? " + album review" : ""}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const portfolioExport = trpc.portfolio.generate.useMutation({
    onSuccess: (result) => {
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(result.htmlContent);
        win.document.close();
      }
      toast.success("Portfolio generated in new tab");
    },
    onError: (err) => toast.error(err.message),
  });

  const csvExport = trpc.csvExport.generate.useMutation({
    onSuccess: (result) => {
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported");
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleFavorite = trpc.favorite.toggle.useMutation({
    onSuccess: (result) => {
      utils.favorite.ids.invalidate();
      toast.success(result.isFavorited ? "Added to favorites" : "Removed from favorites");
    },
    onError: (err) => toast.error(err.message),
  });

  const { data: favoriteIds } = trpc.favorite.ids.useQuery();

  const uploadCoverImage = trpc.project.uploadCoverImage.useMutation({
    onSuccess: () => {
      utils.project.get.invalidate({ id });
      toast.success("Cover image updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const reorderTracks = trpc.reorder.update.useMutation({
    onSuccess: () => {
      utils.project.get.invalidate({ id });
      toast.success("Track order saved");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleMoveTrack = (trackId: number, direction: "up" | "down") => {
    const currentIndex = tracks.findIndex(t => t.id === trackId);
    if (currentIndex < 0) return;
    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= tracks.length) return;
    const newOrder = [...tracks.map(t => t.id)];
    [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]];
    reorderTracks.mutate({ projectId: id, orderedTrackIds: newOrder });
  };

  const handleFileUpload = useCallback(async (files: FileList | File[] | null, parentTrackId?: number) => {
    if (!files || (files instanceof FileList && !files.length) || (Array.isArray(files) && !files.length)) return;
    setUploading(true);
    const fileArr = Array.from(files);
    let succeeded = 0;
    let failed = 0;
    const uploadedTrackIds: number[] = [];

    try {
      // Validate files first
      const validFiles: File[] = [];
      for (const file of fileArr) {
        if (!file.type.startsWith("audio/")) {
          toast.error(`${file.name} is not an audio file`);
          failed++;
        } else if (file.size > 50 * 1024 * 1024) {
          toast.error(`${file.name} exceeds 50MB limit`);
          failed++;
        } else {
          validFiles.push(file);
        }
      }

      // Upload valid files in parallel
      const results = await Promise.allSettled(
        validFiles.map(async (file) => {
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve, reject) => {
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(",")[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          const uploadResult = await uploadTrack.mutateAsync({
            projectId: id,
            filename: file.name,
            mimeType: file.type,
            fileBase64: base64,
            fileSize: file.size,
            ...(parentTrackId ? { parentTrackId, versionNumber: 2 } : {}),
          });
          trackTrackUploaded(id, "track");
          return uploadResult.trackId;
        })
      );

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === "fulfilled") {
          succeeded++;
          uploadedTrackIds.push(result.value);
        } else {
          toast.error(`Failed to upload ${validFiles[i].name}: ${result.reason?.message || "Unknown error"}`);
          failed++;
        }
      }

      // Show summary for multi-file uploads
      if (fileArr.length > 1) {
        if (failed === 0) {
          toast.success(`All ${succeeded} tracks uploaded successfully`);
        } else if (succeeded > 0) {
          toast.warning(`${succeeded} of ${fileArr.length} tracks uploaded. ${failed} failed.`);
        }
      } else if (succeeded === 1) {
        toast.success("Track uploaded");
      }

      // Auto-trigger analyzeAndReview for newly uploaded tracks (not versions)
      if (uploadedTrackIds.length > 0 && !parentTrackId) {
        const analyzeResults = await Promise.allSettled(
          uploadedTrackIds.map(trackId => analyzeAndReview.mutateAsync({ trackId }))
        );
        const analyzedCount = analyzeResults.filter(r => r.status === "fulfilled").length;
        if (analyzedCount > 0) {
          toast.success(
            `${analyzedCount} track${analyzedCount !== 1 ? "s" : ""} queued for analysis & review`,
            { description: "Sit back — Troubadour is listening." }
          );
        }
      } else if (uploadedTrackIds.length > 0 && parentTrackId) {
        toast.info("New version uploaded. Use 'Full Review' to analyze it.");
      }
    } catch (e) {
      // Individual errors handled above
    } finally {
      setUploading(false);
      setUploadingVersion(null);
      utils.project.get.invalidate({ id });
    }
  }, [id, uploadTrack, analyzeAndReview, utils.project.get]);

  // Global drag listeners for full-page drag overlay
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current++;
      if (e.dataTransfer?.types?.includes("Files")) {
        setIsDragOver(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current--;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setIsDragOver(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragOver(false);

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleFileUpload(e.dataTransfer.files);
      }
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [handleFileUpload]);

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
      {/* Full-page Drag Overlay */}
      {isDragOver && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-4 p-12 rounded-3xl border-4 border-dashed border-primary/60 bg-primary/10">
            <UploadCloud className="h-20 w-20 text-primary animate-pulse" />
            <p className="text-2xl font-bold text-white">Drop to add tracks</p>
            <p className="text-base text-gray-300">Audio files only (MP3, WAV, FLAC, etc.)</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {/* Cover Image */}
          <div className="relative group">
            {project.coverImageUrl ? (
              <img
                src={project.coverImageUrl}
                alt="Cover"
                className="h-14 w-14 rounded-lg object-cover border border-border"
              />
            ) : (
              <div className="h-14 w-14 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center border border-border">
                <Music className="h-6 w-6 text-primary/60" />
              </div>
            )}
            <label className="absolute inset-0 rounded-lg bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center">
              <Upload className="h-4 w-4 text-white" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) {
                    toast.error("Image must be under 5 MB");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => {
                    uploadCoverImage.mutate({
                      projectId: id,
                      base64Image: reader.result as string,
                      contentType: file.type,
                    });
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </label>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>{project.title}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <Badge variant="outline" className="capitalize">{project.type}</Badge>
              <span>{formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}</span>
              <Select
                value={project.reviewFocus || "full"}
                onValueChange={(value) => {
                  updateProject.mutate({ id, reviewFocus: value as any });
                }}
              >
                <SelectTrigger className="h-7 w-[140px] text-xs border-dashed">
                  <User className="h-3 w-3 mr-1 opacity-60" />
                  <SelectValue placeholder="Persona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Review</SelectItem>
                  <SelectItem value="songwriter">Songwriter</SelectItem>
                  <SelectItem value="producer">Producer</SelectItem>
                  <SelectItem value="arranger">Arranger</SelectItem>
                  <SelectItem value="artist">Artist Dev</SelectItem>
                  <SelectItem value="anr">A&R Executive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tracks.some(t => t.status === "reviewed") && (
            <Button variant="outline" size="sm" onClick={() => setLocation(`/projects/${id}/quick-review`)}>
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              Quick Review
            </Button>
          )}
          {tracks.filter(t => t.status === "reviewed").length >= 2 && (
            <Button variant="outline" size="sm" onClick={() => setLocation(`/projects/${id}/compare`)}>
              <GitCompare className="h-3.5 w-3.5 mr-1.5" />
              Compare
            </Button>
          )}
          {tracks.some(t => t.status === "reviewed") && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => csvExport.mutate({ projectId: id })}
                disabled={csvExport.isPending}
                title="Download scores as CSV"
              >
                <Table2 className="h-3.5 w-3.5 mr-1.5" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportAllReviews.mutate({ projectId: id })}
                disabled={exportAllReviews.isPending}
              >
                <FileDown className="h-3.5 w-3.5 mr-1.5" />
                {exportAllReviews.isPending ? "Generating..." : "Export All"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportZip.mutate({ projectId: id })}
                disabled={exportZip.isPending}
                title="Download all reviews as a ZIP of Markdown files"
              >
                <FileDown className="h-3.5 w-3.5 mr-1.5" />
                {exportZip.isPending ? "Zipping..." : "ZIP"}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => portfolioExport.mutate({ projectId: id })}
                disabled={portfolioExport.isPending}
                title="Generate a label-ready portfolio with all tracks, scores, artwork, and reviews"
              >
                <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                {portfolioExport.isPending ? "Building..." : "Portfolio"}
              </Button>
            </>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Project</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete <strong>{project.title}</strong> and all its tracks, reviews, and analysis data. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteProject.mutate({ id })}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete Project
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

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
      <div className="flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-center">
        <DropZone
          onFiles={(files) => handleFileUpload(files as any)}
          uploading={uploading}
          compact
          className="flex-1 max-w-xs"
        />
        <TemplateSelector value={selectedTemplateId} onChange={setSelectedTemplateId} />
        <ReviewLengthSelector value={reviewLength} onChange={setReviewLength} />
        <Button
          onClick={() => batchReviewAll.mutate({ projectId: id, reviewLength, ...(selectedTemplateId ? { templateId: selectedTemplateId } : {}) })}
          disabled={batchReviewAll.isPending || allReviewed}
        >
          <Zap className="h-4 w-4 mr-2" />
          {batchReviewAll.isPending ? "Queuing..." : allReviewed ? "All Reviewed" : "Review All Tracks"}
        </Button>
        {allReviewed && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={batchReReview.isPending}>
                <RotateCcw className="h-4 w-4 mr-2" />
                {batchReReview.isPending ? "Queuing..." : "Re-Review All"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Re-Review All Tracks</AlertDialogTitle>
                <AlertDialogDescription>
                  This will generate fresh reviews for all {tracks.filter(t => t.status === "reviewed").length} reviewed tracks using the latest critique format and your selected template/depth settings. Previous reviews are preserved in version history.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => batchReReview.mutate({
                    projectId: id,
                    reviewLength,
                    ...(selectedTemplateId ? { templateId: selectedTemplateId } : {}),
                  })}
                >
                  Re-Review All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        {project.type === "album" && allReviewed && (
          <Button variant="secondary" onClick={() => albumReview.mutate({ projectId: id })} disabled={albumReview.isPending}>
            <BookOpen className="h-4 w-4 mr-2" />
            Album Review
          </Button>
        )}
      </div>

      <Separator />

      {/* Smart Playlist Ordering */}
      {tracks.length > 1 && project.type === "album" && (
        <PlaylistSuggestion
          projectId={id}
          trackCount={tracks.length}
          onOrderApplied={() => utils.project.get.invalidate({ id })}
        />
      )}

      {/* Tracks List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
            Tracks ({tracks.length})
          </h2>
          <div className="flex items-center gap-2">
            {tracks.length > 1 && (
              <Button
                size="sm"
                variant={reorderMode ? "default" : "ghost"}
                onClick={() => setReorderMode(!reorderMode)}
                className="text-xs"
              >
                <GripVertical className="h-3.5 w-3.5 mr-1" />
                {reorderMode ? "Done" : "Reorder"}
              </Button>
            )}
            {tracks.length > 1 && !reorderMode && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (selectedTrackIds.size === tracks.length) setSelectedTrackIds(new Set());
                  else setSelectedTrackIds(new Set(tracks.map(t => t.id)));
                }}
                className="text-xs"
              >
                {selectedTrackIds.size === tracks.length ? "Deselect All" : "Select All"}
              </Button>
            )}
          </div>
        </div>
        <BatchActionsToolbar
          selectedIds={selectedTrackIds}
          tracks={tracks}
          projectId={id}
          reviewLength={reviewLength}
          templateId={selectedTemplateId ?? undefined}
          onClearSelection={() => setSelectedTrackIds(new Set())}
        />
        {tracks.length === 0 ? (
          <DropZone
            onFiles={(files) => handleFileUpload(files as any)}
            uploading={uploading}
          />
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
                      {reorderMode ? (
                        <div className="flex flex-col items-center gap-0.5 shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMoveTrack(track.id, "up"); }}
                            disabled={idx === 0 || reorderTracks.isPending}
                            className="p-0.5 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Move up"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <span className="text-xs font-mono text-muted-foreground w-5 text-center">{idx + 1}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMoveTrack(track.id, "down"); }}
                            disabled={idx === tracks.length - 1 || reorderTracks.isPending}
                            className="p-0.5 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Move down"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <input
                          type="checkbox"
                          checked={selectedTrackIds.has(track.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            const next = new Set(selectedTrackIds);
                            if (next.has(track.id)) next.delete(track.id);
                            else next.add(track.id);
                            setSelectedTrackIds(next);
                          }}
                          className="shrink-0 h-4 w-4 rounded border-border accent-primary cursor-pointer"
                        />
                      )}
                      <button
                        className="shrink-0 p-1 -m-1 rounded hover:bg-accent transition-colors"
                        onClick={(e) => { e.stopPropagation(); toggleFavorite.mutate({ trackId: track.id }); }}
                        title={favoriteIds?.includes(track.id) ? "Remove from favorites" : "Add to favorites"}
                      >
                        <Star className={`h-4 w-4 transition-colors ${favoriteIds?.includes(track.id) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40 hover:text-amber-400/60"}`} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="font-medium truncate cursor-pointer hover:text-primary transition-colors"
                            onClick={() => setLocation(`/tracks/${track.id}`)}
                            role="link"
                            tabIndex={0}
                            aria-label={`Open track: ${track.originalFilename}`}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLocation(`/tracks/${track.id}`); } }}
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
                          {track.detectedGenre && (
                            <span className="text-primary/70 italic">{track.detectedGenre}</span>
                          )}
                        </div>
                        {track.tags && (
                          <div className="mt-1">
                            <TrackTagsBadges tags={track.tags} />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {track.status === "uploaded" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => analyzeAndReview.mutate({ trackId: track.id, reviewLength, ...(selectedTemplateId ? { templateId: selectedTemplateId } : {}) })}
                              disabled={analyzeAndReview.isPending}
                            >
                              <Zap className="h-3.5 w-3.5 mr-1.5" />
                              Full Review
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => analyzeTrack.mutate({ trackId: track.id })}
                              disabled={analyzeTrack.isPending}
                            >
                              <Headphones className="h-3.5 w-3.5 mr-1.5" />
                              Analyze
                            </Button>
                          </>
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
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setLocation(`/reviews/${trackReviews[0].id}`)}
                            >
                              <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
                              View Review
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => analyzeAndReview.mutate({ trackId: track.id, reviewLength, ...(selectedTemplateId ? { templateId: selectedTemplateId } : {}) })}
                              disabled={analyzeAndReview.isPending}
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                              New Review
                            </Button>
                          </>
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
                        {track.status === "error" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const failedJob = jobs.find(j => j.trackId === track.id && j.status === "error");
                              if (failedJob) retryJob.mutate({ jobId: failedJob.id });
                              else analyzeAndReview.mutate({ trackId: track.id });
                            }}
                            disabled={retryJob.isPending || analyzeAndReview.isPending}
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                            Retry
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (!uploadTrack.isPending) {
                              setUploadingVersion(track.id);
                              versionInputRef.current?.click();
                            }
                          }}
                          title="Upload new version"
                          disabled={uploadTrack.isPending && uploadingVersion === track.id}
                        >
                          {(uploadTrack.isPending && uploadingVersion === track.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
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

      {/* Project Insights & Score Matrix */}
      {tracks.filter(t => t.status === "reviewed").length >= 2 && (
        <>
          <Separator />
          <ProjectInsightsCard projectId={id} reviewedTrackCount={tracks.filter(t => t.status === "reviewed").length} />
           <ScoreMatrix projectId={id} />
           <SentimentTimeline projectId={id} />
           <ProjectCompletionScore projectId={id} />
           <ProjectTimeline projectId={id} tracks={tracks} />
           {project.type === "album" && <ArtworkGallery projectId={id} />}
        </>
      )}

      {/* Collaboration Section */}
      <Separator />
      <CollaborationPanel projectId={id} isOwner={user?.id === data.project.userId} />

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
