import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { ReleaseReadinessView } from "@/components/ReleaseReadinessView";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Rocket, Loader2 } from "lucide-react";

export default function ReleaseReadiness() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);

  const projectsQuery = trpc.project.list.useQuery();
  const projects = (projectsQuery.data ?? []) as Array<{ id: number; title: string; trackCount: number }>;

  const projectQuery = trpc.project.get.useQuery(
    { id: selectedProjectId! },
    { enabled: !!selectedProjectId }
  );
  const tracks = useMemo(() => {
    const data = projectQuery.data as { tracks?: Array<{ id: number; title: string }> } | undefined;
    return data?.tracks ?? [];
  }, [projectQuery.data]);

  return (
    <div className="container py-6 max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Rocket className="h-6 w-6 text-emerald-500" />
          Release Readiness
        </h2>
        <p className="text-muted-foreground mt-1">Evaluate whether a track is ready for release</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">1. Select a project</label>
            {projectsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading projects...
              </div>
            ) : projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects found. Create a project and upload tracks first.</p>
            ) : (
              <Select
                value={selectedProjectId ? String(selectedProjectId) : ""}
                onValueChange={(v) => {
                  setSelectedProjectId(parseInt(v, 10));
                  setSelectedTrackId(null);
                }}
              >
                <SelectTrigger className="max-w-md">
                  <SelectValue placeholder="Choose a project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.title} ({p.trackCount} tracks)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedProjectId && (
            <div>
              <label className="text-sm font-medium mb-2 block">2. Select a track</label>
              {projectQuery.isLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading tracks...
                </div>
              ) : tracks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tracks in this project.</p>
              ) : (
                <Select
                  value={selectedTrackId ? String(selectedTrackId) : ""}
                  onValueChange={(v) => setSelectedTrackId(parseInt(v, 10))}
                >
                  <SelectTrigger className="max-w-md">
                    <SelectValue placeholder="Choose a track..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tracks.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedTrackId && <ReleaseReadinessView trackId={selectedTrackId} />}
    </div>
  );
}
