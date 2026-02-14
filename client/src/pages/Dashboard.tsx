import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useLocation } from "wouter";
import { Plus, Music, Clock, CheckCircle2, AlertCircle, Loader2, Sliders, Sparkles, ArrowRight, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType; glow?: string }> = {
  draft: { label: "Draft", variant: "outline", icon: Clock },
  pending: { label: "Pending", variant: "outline", icon: Clock },
  processing: { label: "In Progress", variant: "secondary", icon: Loader2, glow: "shadow-amber-500/20" },
  reviewed: { label: "Reviewed", variant: "default", icon: CheckCircle2, glow: "shadow-emerald-500/20" },
  completed: { label: "Completed", variant: "default", icon: CheckCircle2, glow: "shadow-emerald-500/20" },
  error: { label: "Error", variant: "destructive", icon: AlertCircle },
  failed: { label: "Failed", variant: "destructive", icon: AlertCircle },
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: projects, isLoading, error } = trpc.project.list.useQuery(undefined, {
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d) return false;
      const hasProcessing = d.some((p: any) => p.status === "processing");
      return hasProcessing ? 5000 : false;
    },
  });
  const shownUpgradeToast = useRef(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  // Global drag listeners for quick-upload overlay
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
        const audioFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("audio/"));
        if (audioFiles.length > 0) {
          window.__troubadourPendingFiles = audioFiles;
          setLocation("/projects/new");
        } else {
          toast.error("No audio files detected. Please drop MP3, WAV, or FLAC files.");
        }
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
  }, [setLocation]);

  useEffect(() => {
    if (shownUpgradeToast.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgraded") === "true") {
      shownUpgradeToast.current = true;
      toast.success("Welcome to your new plan!", {
        description: "Your subscription is now active. It may take a moment for your tier to update.",
        duration: 6000,
      });
      window.history.replaceState({}, "", "/dashboard");
    }
  }, []);

  return (
    <div className="space-y-8">
      {/* Quick-Upload Drag Overlay */}
      {isDragOver && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-4 p-12 rounded-3xl border-4 border-dashed border-primary/60 bg-primary/10">
            <UploadCloud className="h-20 w-20 text-primary animate-pulse" />
            <p className="text-2xl font-bold text-white">Drop to create new project</p>
            <p className="text-base text-gray-300">Audio files only (MP3, WAV, FLAC, etc.)</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground text-sm mt-1">Your music projects and album reviews</p>
        </div>
        <Button onClick={() => setLocation("/projects/new")} className="shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">Failed to load projects</h3>
          <p className="text-muted-foreground text-sm mb-4">Something went wrong. Please try refreshing the page.</p>
          <Button variant="outline" onClick={() => window.location.reload()}>Refresh</Button>
        </div>
      ) : isLoading ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="gradient-card">
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-4 w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !projects?.length ? (
        <div className="space-y-8">
          {/* Welcome Hero */}
          <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent p-10 glow-primary">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center mb-5 shadow-lg shadow-primary/20">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-bold text-2xl mb-3">Welcome to Troubadour</h3>
              <p className="text-muted-foreground text-base mb-8 max-w-md leading-relaxed">
                Get honest, detailed critiques of your music from an AI that actually listens.
                Upload a track and receive a full review in minutes.
              </p>
              <Button size="lg" onClick={() => setLocation("/projects/new")} className="shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Project
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* How It Works */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">How it works</h2>
            <div className="grid gap-5 md:grid-cols-3">
              {[
                { step: "01", icon: Music, color: "from-blue-500/20 to-blue-500/5", iconColor: "text-sky-400", title: "Upload your track", desc: "Drag & drop MP3, WAV, or FLAC files. We support tracks up to 50MB." },
                { step: "02", icon: Sliders, color: "from-violet-500/20 to-violet-500/5", iconColor: "text-violet-400", title: "AI listens & analyzes", desc: "Troubadour detects genre, tempo, key, structure, and production qualities automatically." },
                { step: "03", icon: CheckCircle2, color: "from-emerald-500/20 to-emerald-500/5", iconColor: "text-emerald-400", title: "Get your critique", desc: "A detailed, honest review with scores, timestamps, and actionable feedback — in minutes." },
              ].map((item) => (
                <Card key={item.step} className="border-border/40 bg-gradient-to-br hover:border-border/60 transition-all group">
                  <CardContent className="pt-6">
                    <div className="text-xs font-mono text-muted-foreground/60 mb-3">{item.step}</div>
                    <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4 group-hover:scale-105 transition-transform`}>
                      <item.icon className={`h-5 w-5 ${item.iconColor}`} />
                    </div>
                    <h4 className="font-semibold mb-1.5">{item.title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const status = statusConfig[project.status] || statusConfig.pending;
            const StatusIcon = status.icon;
            const isProcessing = project.status === "processing";
            const progress = project.trackCount > 0 ? (project.reviewedCount / project.trackCount) * 100 : 0;

            return (
              <Card
                key={project.id}
                className={cn(
                  "cursor-pointer border-border/40 hover:border-primary/40 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 group relative overflow-hidden",
                  isProcessing && "animate-pulse-border-glow"
                )}
                onClick={() => setLocation(`/projects/${project.id}`)}
                role="link"
                tabIndex={0}
                aria-label={`Open project: ${project.title}`}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLocation(`/projects/${project.id}`); } }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base font-semibold leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                      {project.title}
                    </CardTitle>
                    <Badge variant={status.variant} className="ml-2 shrink-0 text-xs">
                      <StatusIcon className={`h-3 w-3 mr-1 ${isProcessing ? "animate-spin" : ""}`} />
                      {status.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Music className="h-3.5 w-3.5 text-primary/60" />
                      <span>{project.trackCount ?? 0} {(project.trackCount ?? 0) === 1 ? 'track' : 'tracks'}</span>
                    </div>
                    {isProcessing && project.trackCount > 0 ? (
                      <>
                        <span className="text-border">|</span>
                        <span className="text-amber-400">{project.reviewedCount} of {project.trackCount} reviewed</span>
                      </>
                    ) : (
                      <>
                        <span className="text-border">|</span>
                        <span className="capitalize">{project.type}</span>
                      </>
                    )}
                  </div>
                  {project.genre && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      <Badge variant="outline" className="text-xs font-normal border-primary/20 text-primary/80">{project.genre}</Badge>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-3">
                    {formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}
                  </p>
                  {/* Processing progress bar at bottom of card */}
                  {isProcessing && project.trackCount > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1">
                      <div className="h-full w-full bg-amber-500/10">
                        <div
                          className="h-full bg-amber-500 transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
