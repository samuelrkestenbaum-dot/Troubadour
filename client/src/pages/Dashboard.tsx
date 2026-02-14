import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { Plus, Music, Clock, CheckCircle2, AlertCircle, Loader2, Sliders, Sparkles, ArrowRight, UploadCloud, Search, Star, Users } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
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

  // Browser notification state
  const previousStatuses = useRef<Record<number, string>>({});
  const notifPermissionAsked = useRef(false);

  // Search/filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");

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

  // Browser notification: detect processing → reviewed transitions
  useEffect(() => {
    if (!projects || projects.length === 0) return;

    const currentStatuses: Record<number, string> = {};
    let hasProcessing = false;

    for (const project of projects) {
      currentStatuses[project.id] = project.status;
      if (project.status === "processing") hasProcessing = true;

      // Check for transition from processing → reviewed
      const prev = previousStatuses.current[project.id];
      if (prev === "processing" && project.status === "reviewed") {
        // Fire browser notification
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          try {
            const notif = new Notification("Troubadour: Review Complete", {
              body: `"${project.title}" — ${project.trackCount} track${project.trackCount !== 1 ? "s" : ""} reviewed`,
              icon: "/favicon.ico",
              tag: `project-reviewed-${project.id}`,
            });
            notif.onclick = () => {
              window.focus();
              setLocation(`/projects/${project.id}`);
            };
          } catch {
            // Notification API not available in this context
          }
        }
        // Also show in-app toast
        toast.success(`"${project.title}" review complete!`, {
          description: `All ${project.trackCount} tracks reviewed.`,
          action: {
            label: "View",
            onClick: () => setLocation(`/projects/${project.id}`),
          },
        });
      }
    }

    // Request notification permission when we first detect processing projects
    if (hasProcessing && !notifPermissionAsked.current && typeof Notification !== "undefined") {
      if (Notification.permission === "default") {
        notifPermissionAsked.current = true;
        Notification.requestPermission().then((perm) => {
          if (perm === "granted") {
            toast.success("Notifications enabled", {
              description: "We'll notify you when reviews are ready.",
              duration: 3000,
            });
          }
        });
      }
    }

    previousStatuses.current = currentStatuses;
  }, [projects, setLocation]);

  // Filtered and sorted projects
  const filteredProjects = useMemo(() => {
    if (!projects) return [];

    let result = [...projects];

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => p.title.toLowerCase().includes(term));
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter(p => p.status === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortOrder) {
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "name-asc":
          return a.title.localeCompare(b.title);
        case "name-desc":
          return b.title.localeCompare(a.title);
        case "newest":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return result;
  }, [projects, searchTerm, statusFilter, sortOrder]);

  const { data: favoritesList } = trpc.favorite.list.useQuery();
  const { data: sharedProjects } = trpc.collaboration.sharedProjects.useQuery();

  const showSearchBar = !isLoading && !error && projects && projects.length >= 2;

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

      {/* Search / Filter / Sort bar */}
      {showSearchBar && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="processing">In Progress</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="name-asc">Name A-Z</SelectItem>
              <SelectItem value="name-desc">Name Z-A</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

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
        <>
          {/* Favorites Section */}
          {favoritesList && favoritesList.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                Favorites
              </h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {favoritesList.map((fav) => (
                  <Card
                    key={fav.favoriteId}
                    className="cursor-pointer border-amber-500/20 hover:border-amber-500/40 transition-all duration-200 hover:shadow-lg hover:shadow-amber-500/5 group"
                    onClick={() => setLocation(`/tracks/${fav.trackId}`)}
                    role="link"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLocation(`/tracks/${fav.trackId}`); } }}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {fav.coverImageUrl ? (
                          <img src={fav.coverImageUrl} alt="" className="h-9 w-9 rounded-md object-cover shrink-0 border border-border" />
                        ) : (
                          <div className="h-9 w-9 rounded-md bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center shrink-0">
                            <Music className="h-4 w-4 text-amber-500/60" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate group-hover:text-amber-400 transition-colors">{fav.trackName}</p>
                          <p className="text-xs text-muted-foreground truncate">{fav.projectTitle}{fav.detectedGenre ? ` · ${fav.detectedGenre}` : ''}</p>
                        </div>
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Shared With Me Section */}
          {sharedProjects && sharedProjects.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-blue-400" />
                Shared With Me
              </h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {sharedProjects.map((sp: any) => {
                  const spStatus = statusConfig[sp.status] || statusConfig.pending;
                  const SpStatusIcon = spStatus.icon;
                  return (
                    <Card
                      key={sp.id}
                      className="cursor-pointer border-blue-500/20 hover:border-blue-500/40 transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/5 group"
                      onClick={() => setLocation(`/projects/${sp.id}`)}
                      role="link"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLocation(`/projects/${sp.id}`); } }}
                    >
                      <CardContent className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {sp.coverImageUrl ? (
                            <img src={sp.coverImageUrl} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0 border border-border" />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/5 flex items-center justify-center shrink-0">
                              <Music className="h-4 w-4 text-blue-500/60" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate group-hover:text-blue-400 transition-colors">{sp.title}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              by {sp.ownerName || 'Unknown'} · {sp.trackCount} track{sp.trackCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <Badge variant={spStatus.variant} className="shrink-0 text-xs">
                            <SpStatusIcon className={`h-3 w-3 mr-1 ${sp.status === 'processing' ? 'animate-spin' : ''}`} />
                            {spStatus.label}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Project grid */}
          {filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Search className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No projects match</h3>
              <p className="text-muted-foreground text-sm mb-4">Try adjusting your search or filters.</p>
              <Button variant="outline" onClick={() => { setSearchTerm(""); setStatusFilter("all"); setSortOrder("newest"); }}>
                Reset Filters
              </Button>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredProjects.map((project) => {
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
                        <div className="flex items-center gap-3 min-w-0">
                          {project.coverImageUrl ? (
                            <img src={project.coverImageUrl} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0 border border-border" />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 border border-border">
                              <Music className="h-4 w-4 text-primary/50" />
                            </div>
                          )}
                          <CardTitle className="text-base font-semibold leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                            {project.title}
                          </CardTitle>
                        </div>
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
        </>
      )}
    </div>
  );
}
