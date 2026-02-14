import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useLocation } from "wouter";
import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Music, X, FileAudio, CheckCircle2, XCircle } from "lucide-react";
import { trackProjectCreated } from "@/lib/analytics";
import { DropZone } from "@/components/DropZone";

type UploadStatus = "waiting" | "reading" | "uploading" | "done" | "error";

interface TrackedFile {
  file: File;
  id: string;
  status: UploadStatus;
  progress: number;
}

const generateFileId = (file: File, index: number) =>
  `${file.name}-${file.size}-${file.lastModified}-${index}`;

export default function NewProject() {
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState("");
  const [trackedFiles, setTrackedFiles] = useState<TrackedFile[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const uploadTrack = trpc.track.upload.useMutation();
  const analyzeAndReview = trpc.job.analyzeAndReview.useMutation();

  // Pick up files passed from Dashboard quick-upload
  useEffect(() => {
    if (window.__troubadourPendingFiles && window.__troubadourPendingFiles.length > 0) {
      handleFilesSelected(window.__troubadourPendingFiles);
      window.__troubadourPendingFiles = undefined;
    }
  }, []);

  const updateFileStatus = (id: string, status: UploadStatus, progress?: number) => {
    setTrackedFiles(prev =>
      prev.map(tf => tf.id === id ? { ...tf, status, progress: progress ?? tf.progress } : tf)
    );
  };

  const createProject = trpc.project.create.useMutation({
    onSuccess: async (projectData) => {
      trackProjectCreated(projectData.id, title.trim());

      if (trackedFiles.length === 0) {
        toast.success("Project created");
        setLocation(`/projects/${projectData.id}`);
        setIsCreating(false);
        return;
      }

      // Upload all files with per-file progress tracking
      const trackIds: number[] = [];
      let succeeded = 0;
      let failed = 0;

      const results = await Promise.allSettled(
        trackedFiles.map(async (tf) => {
          updateFileStatus(tf.id, "reading", 0);

          try {
            // Read file to base64
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onprogress = (e) => {
                if (e.lengthComputable) {
                  updateFileStatus(tf.id, "reading", Math.round((e.loaded / e.total) * 100));
                }
              };
              reader.onload = () => {
                const result = reader.result as string;
                resolve(result.split(",")[1]);
              };
              reader.onerror = () => reject(new Error("Failed to read file"));
              reader.readAsDataURL(tf.file);
            });

            updateFileStatus(tf.id, "uploading", 50);

            const uploadResult = await uploadTrack.mutateAsync({
              projectId: projectData.id,
              filename: tf.file.name,
              mimeType: tf.file.type,
              fileBase64: base64,
              fileSize: tf.file.size,
            });

            updateFileStatus(tf.id, "done", 100);
            succeeded++;
            trackIds.push(uploadResult.trackId);
            return uploadResult.trackId;
          } catch (error: any) {
            updateFileStatus(tf.id, "error", 0);
            failed++;
            toast.error(`Failed: ${tf.file.name} — ${error?.message || "Unknown error"}`);
            throw error;
          }
        })
      );

      // Auto-start analysis for all successfully uploaded tracks
      if (trackIds.length > 0) {
        const analysisResults = await Promise.allSettled(
          trackIds.map(trackId =>
            analyzeAndReview.mutateAsync({ trackId }).catch(err => {
              console.error(`Analysis start failed for track ${trackId}:`, err);
            })
          )
        );
        const analysisStarted = analysisResults.filter(r => r.status === "fulfilled").length;

        if (failed === 0) {
          toast.success(
            `Project created with ${succeeded} ${succeeded === 1 ? "track" : "tracks"}. Analysis & review started!`,
            { duration: 5000 }
          );
        } else if (succeeded > 0) {
          toast.warning(
            `${succeeded} of ${trackedFiles.length} tracks uploaded. ${failed} failed. Analysis started for ${analysisStarted} tracks.`,
            { duration: 5000 }
          );
        }
      } else {
        toast.error("Project created, but all track uploads failed.");
      }

      setLocation(`/projects/${projectData.id}`);
      setIsCreating(false);
    },
    onError: (err) => {
      setIsCreating(false);
      toast.error(err.message);
    },
  });

  const handleFilesSelected = useCallback((newFiles: File[]) => {
    const audioFiles = newFiles.filter(f => f.type.startsWith("audio/"));
    const rejected = newFiles.length - audioFiles.length;
    if (rejected > 0) {
      toast.warning(`${rejected} non-audio ${rejected === 1 ? "file was" : "files were"} ignored`);
    }
    const oversized = audioFiles.filter(f => f.size > 50 * 1024 * 1024);
    if (oversized.length > 0) {
      toast.error(`${oversized.length} ${oversized.length === 1 ? "file exceeds" : "files exceed"} the 50MB limit`);
    }
    const valid = audioFiles.filter(f => f.size <= 50 * 1024 * 1024);
    setTrackedFiles(prev => {
      const existingIds = new Set(prev.map(tf => tf.id));
      const newTracked = valid
        .map((file, i) => ({
          file,
          id: generateFileId(file, prev.length + i),
          status: "waiting" as UploadStatus,
          progress: 0,
        }))
        .filter(tf => !existingIds.has(tf.id));
      return [...prev, ...newTracked];
    });
  }, []);

  const removeFile = (id: string) => {
    setTrackedFiles(prev => prev.filter(tf => tf.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Give your project a name");
      return;
    }
    setIsCreating(true);
    const projectType = trackedFiles.length > 1 ? "album" : "single";
    createProject.mutate({
      title: title.trim(),
      type: projectType,
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusIcon = (status: UploadStatus) => {
    switch (status) {
      case "done":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
      case "error":
        return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
      case "reading":
      case "uploading":
        return <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />;
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />;
    }
  };

  const getStatusLabel = (status: UploadStatus) => {
    switch (status) {
      case "waiting": return "Queued";
      case "reading": return "Reading...";
      case "uploading": return "Uploading...";
      case "done": return "Done";
      case "error": return "Failed";
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")} aria-label="Back to dashboard">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>New Project</h1>
          <p className="text-muted-foreground text-sm">Name it, drop your audio, and go.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Music className="h-5 w-5 text-primary" />
              Upload & Review
            </CardTitle>
            <CardDescription>
              Drop your tracks below. We'll detect the genre, analyze the audio, and write your critique automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Project Name */}
            <div className="space-y-2">
              <Label htmlFor="title">Project Name</Label>
              <Input
                id="title"
                placeholder="e.g., Midnight Sessions EP"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isCreating}
                autoFocus
              />
            </div>

            {/* File Upload */}
            {!isCreating && (
              <div className="space-y-2">
                <Label>Audio Files</Label>
                <DropZone
                  onFiles={(f) => handleFilesSelected(f as File[])}
                  disabled={isCreating}
                  uploading={isCreating}
                  accept="audio/*"
                  maxSizeMB={50}
                />
              </div>
            )}

            {/* File List with Progress */}
            {trackedFiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">
                    {trackedFiles.length} {trackedFiles.length === 1 ? "track" : "tracks"}
                    {!isCreating && " ready"}
                    {trackedFiles.length > 1 && !isCreating && <span className="text-muted-foreground ml-1">(album)</span>}
                    {trackedFiles.length === 1 && !isCreating && <span className="text-muted-foreground ml-1">(single)</span>}
                  </Label>
                  {trackedFiles.length > 1 && !isCreating && (
                    <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={() => setTrackedFiles([])}>
                      Clear all
                    </Button>
                  )}
                </div>
                <div className="border border-border/50 rounded-lg divide-y divide-border/30">
                  {trackedFiles.map((tf) => (
                    <div key={tf.id} className="px-3 py-2.5">
                      <div className="flex items-center gap-3 text-sm">
                        {isCreating ? getStatusIcon(tf.status) : (
                          <FileAudio className="h-4 w-4 text-primary/60 shrink-0" />
                        )}
                        <span className="truncate flex-1">{tf.file.name}</span>
                        {isCreating ? (
                          <span className={`text-xs shrink-0 ${tf.status === "done" ? "text-emerald-500" : tf.status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                            {getStatusLabel(tf.status)}
                          </span>
                        ) : (
                          <>
                            <span className="text-xs text-muted-foreground shrink-0">{formatSize(tf.file.size)}</span>
                            <button
                              type="button"
                              onClick={() => removeFile(tf.id)}
                              className="text-muted-foreground hover:text-destructive transition-colors p-0.5 rounded"
                              aria-label={`Remove ${tf.file.name}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                      {isCreating && (tf.status === "reading" || tf.status === "uploading") && (
                        <Progress
                          value={tf.status === "reading" ? tf.progress : 100}
                          className="h-1 mt-2"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                {isCreating
                  ? "Creating project and uploading tracks..."
                  : trackedFiles.length === 0
                    ? "You can also upload tracks after creating the project."
                    : "Genre, tempo, and key are detected automatically."}
              </p>
              <Button type="submit" disabled={isCreating || createProject.isPending} size="lg">
                {(isCreating || createProject.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isCreating ? "Working..." : trackedFiles.length > 0 ? "Create & Upload" : "Create Project"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
