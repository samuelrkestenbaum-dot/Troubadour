import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { Plus, FolderOpen, Music, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  pending: { label: "Pending", variant: "outline", icon: Clock },
  processing: { label: "Processing", variant: "secondary", icon: Loader2 },
  completed: { label: "Completed", variant: "default", icon: CheckCircle2 },
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
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <FolderOpen className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-1">No projects yet</h3>
            <p className="text-muted-foreground text-sm mb-6 text-center max-w-sm">
              Create your first project to start getting AI-powered feedback on your music.
            </p>
            <Button onClick={() => setLocation("/projects/new")}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Project
            </Button>
          </CardContent>
        </Card>
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
                      <span>{project.trackCount ?? 0} tracks</span>
                    </div>
                    <span className="text-border">|</span>
                    <span className="capitalize">{project.type}</span>
                  </div>
                  {project.genre && (
                    <div className="mt-2">
                      <Badge variant="outline" className="text-xs font-normal">{project.genre}</Badge>
                    </div>
                  )}
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
