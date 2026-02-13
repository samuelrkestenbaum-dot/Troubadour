import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { Plus, FolderOpen, Music, Clock, CheckCircle2, AlertCircle, Loader2, PenLine, Sliders, Layers, Mic, Briefcase } from "lucide-react";

const focusLabels: Record<string, { label: string; icon: React.ElementType }> = {
  songwriter: { label: "Songwriter", icon: PenLine },
  producer: { label: "Producer", icon: Sliders },
  arranger: { label: "Arranger", icon: Layers },
  artist: { label: "Artist", icon: Mic },
  anr: { label: "A&R", icon: Briefcase },
};
import { formatDistanceToNow } from "date-fns";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  draft: { label: "Draft", variant: "outline", icon: Clock },
  pending: { label: "Pending", variant: "outline", icon: Clock },
  processing: { label: "In Progress", variant: "secondary", icon: Loader2 },
  reviewed: { label: "Reviewed", variant: "default", icon: CheckCircle2 },
  completed: { label: "Completed", variant: "default", icon: CheckCircle2 },
  error: { label: "Error", variant: "destructive", icon: AlertCircle },
  failed: { label: "Failed", variant: "destructive", icon: AlertCircle },
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: projects, isLoading } = trpc.project.list.useQuery();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground text-sm mt-1">Your music projects and album reviews</p>
        </div>
        <Button onClick={() => setLocation("/projects/new")}>
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
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
          <Card className="border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Music className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-semibold text-xl mb-2">Welcome to FirstSpin.ai</h3>
              <p className="text-muted-foreground text-sm mb-6 text-center max-w-md">
                Get honest, detailed critiques of your music from an AI that actually listens.
                Upload a track and receive a full review in minutes.
              </p>
              <Button size="lg" onClick={() => setLocation("/projects/new")}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Project
              </Button>
            </CardContent>
          </Card>

          {/* How It Works */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">How it works</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="bg-muted/20">
                <CardContent className="pt-6">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
                    <Music className="h-5 w-5 text-blue-400" />
                  </div>
                  <h4 className="font-medium mb-1">1. Upload your track</h4>
                  <p className="text-sm text-muted-foreground">
                    Drag & drop MP3, WAV, or FLAC files. We support tracks up to 50MB.
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-muted/20">
                <CardContent className="pt-6">
                  <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3">
                    <Sliders className="h-5 w-5 text-purple-400" />
                  </div>
                  <h4 className="font-medium mb-1">2. AI listens & analyzes</h4>
                  <p className="text-sm text-muted-foreground">
                    Gemini detects genre, tempo, key, structure, and production qualities automatically.
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-muted/20">
                <CardContent className="pt-6">
                  <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center mb-3">
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  </div>
                  <h4 className="font-medium mb-1">3. Get your critique</h4>
                  <p className="text-sm text-muted-foreground">
                    Claude 4.5 writes a detailed, honest review with scores, timestamps, and actionable feedback.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const status = statusConfig[project.status] || statusConfig.pending;
            const StatusIcon = status.icon;
            return (
              <Card
                key={project.id}
                className="cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => setLocation(`/projects/${project.id}`)}
                role="link"
                tabIndex={0}
                aria-label={`Open project: ${project.title}`}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLocation(`/projects/${project.id}`); } }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base font-semibold leading-tight line-clamp-1">
                      {project.title}
                    </CardTitle>
                    <Badge variant={status.variant} className="ml-2 shrink-0 text-xs">
                      <StatusIcon className={`h-3 w-3 mr-1 ${project.status === "processing" ? "animate-spin" : ""}`} />
                      {status.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Music className="h-3.5 w-3.5" />
                      <span>{project.trackCount ?? 0} {(project.trackCount ?? 0) === 1 ? 'track' : 'tracks'}</span>
                    </div>
                    <span className="text-border">|</span>
                    <span className="capitalize">{project.type}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {project.genre && (
                      <Badge variant="outline" className="text-xs font-normal">{project.genre}</Badge>
                    )}
                    {(project as any).reviewFocus && (project as any).reviewFocus !== "full" && (() => {
                      const fl = focusLabels[(project as any).reviewFocus];
                      if (!fl) return null;
                      const FocusIcon = fl.icon;
                      return (
                        <Badge variant="secondary" className="text-xs font-normal">
                          <FocusIcon className="h-3 w-3 mr-1" />
                          {fl.label}
                        </Badge>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    {formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
