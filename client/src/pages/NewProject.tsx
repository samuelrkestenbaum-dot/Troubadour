import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, UploadCloud, Music, X, FileAudio } from "lucide-react";
import { trackProjectCreated } from "@/lib/analytics";
import { DropZone } from "@/components/DropZone";

export default function NewProject() {
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const uploadTrack = trpc.track.upload.useMutation();

  const createProject = trpc.project.create.useMutation({
    onSuccess: async (projectData) => {
      trackProjectCreated(projectData.id, title.trim());

      if (files.length === 0) {
        toast.success("Project created");
        setLocation(`/projects/${projectData.id}`);
        setIsCreating(false);
        return;
      }

      toast.info(`Uploading ${files.length} ${files.length === 1 ? "track" : "tracks"}...`);

      let succeeded = 0;
      let failed = 0;

      const results = await Promise.allSettled(
        files.map(async (file) => {
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
            projectId: projectData.id,
            filename: file.name,
            mimeType: file.type,
            fileBase64: base64,
            fileSize: file.size,
          });
          return file.name;
        })
      );

      for (let i = 0; i < results.length; i++) {
        if (results[i].status === "fulfilled") {
          succeeded++;
        } else {
          const reason = (results[i] as PromiseRejectedResult).reason;
          toast.error(`Failed to upload ${files[i].name}: ${reason?.message || "Unknown error"}`);
          failed++;
        }
      }

      if (failed === 0) {
        toast.success(`Project created with ${succeeded} ${succeeded === 1 ? "track" : "tracks"}`);
      } else if (succeeded > 0) {
        toast.warning(`${succeeded} of ${files.length} tracks uploaded. ${failed} failed.`);
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
    setFiles(prev => [...prev, ...valid]);
  }, []);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Give your project a name");
      return;
    }
    setIsCreating(true);
    const projectType = files.length > 1 ? "album" : "single";
    createProject.mutate({
      title: title.trim(),
      type: projectType,
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

            {/* File List */}
            {files.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">
                    {files.length} {files.length === 1 ? "track" : "tracks"} ready
                    {files.length > 1 && <span className="text-muted-foreground ml-1">(album)</span>}
                    {files.length === 1 && <span className="text-muted-foreground ml-1">(single)</span>}
                  </Label>
                  {files.length > 1 && !isCreating && (
                    <Button type="button" variant="ghost" size="sm" className="text-xs h-7" onClick={() => setFiles([])}>
                      Clear all
                    </Button>
                  )}
                </div>
                <div className="border border-border/50 rounded-lg divide-y divide-border/30">
                  {files.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                      <FileAudio className="h-4 w-4 text-primary/60 shrink-0" />
                      <span className="truncate flex-1">{file.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{formatSize(file.size)}</span>
                      {!isCreating && (
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-0.5 rounded"
                          aria-label={`Remove ${file.name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                {files.length === 0
                  ? "You can also upload tracks after creating the project."
                  : "Genre, tempo, and key are detected automatically."}
              </p>
              <Button type="submit" disabled={isCreating} size="lg">
                {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {files.length > 0 ? "Create & Upload" : "Create Project"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
