/**
 * Feature 6: Data Flywheel Foundations
 * Shows artist archetype classification and platform-wide stats.
 */
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Database, Users, Music, Sparkles, RefreshCw, BarChart3
} from "lucide-react";
import { toast } from "sonner";

interface ArtistArchetypeProfile {
  clusterLabel: string;
  description: string;
  traits: string[];
  similarArtists: string[];
  developmentPath: string;
  confidence: number;
}

interface PlatformStats {
  totalGenreClusters: number;
  totalBenchmarkedGenres: number;
  genres: string[];
  topClusters: Array<{ genre: string; subgenre: string | null; sampleSize: number }>;
}

export function DataFlywheelView() {
  const archetypeQuery = trpc.flywheel.archetype.useQuery();
  const platformStatsQuery = trpc.flywheel.platformStats.useQuery();
  const classifyMutation = trpc.flywheel.classify.useMutation({
    onSuccess: () => {
      archetypeQuery.refetch();
      toast.success("Archetype classification complete!");
    },
    onError: (err: any) => toast.error("Classification failed: " + (err?.message ?? "Unknown error")),
  });

  const archetype = archetypeQuery.data as ArtistArchetypeProfile | null | undefined;
  const stats = platformStatsQuery.data as PlatformStats | undefined;

  if (archetypeQuery.isLoading && platformStatsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading flywheel data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6 text-cyan-500" />
            Data Flywheel
          </h2>
          <p className="text-muted-foreground mt-1">
            Platform intelligence that improves as more artists contribute
          </p>
        </div>
        <Button
          onClick={() => classifyMutation.mutate()}
          disabled={classifyMutation.isPending}
        >
          {classifyMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : archetype ? (
            <RefreshCw className="h-4 w-4 mr-1" />
          ) : (
            <Sparkles className="h-4 w-4 mr-1" />
          )}
          {archetype ? "Reclassify" : "Classify My Archetype"}
        </Button>
      </div>

      {/* Archetype Card */}
      {archetype ? (
        <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-cyan-400">{archetype.clusterLabel}</h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{archetype.description}</p>
              </div>
              <Badge variant="outline" className="text-cyan-400 border-cyan-500/30">
                {archetype.confidence}% confidence
              </Badge>
            </div>

            {/* Traits */}
            <div className="mt-4">
              <span className="text-xs text-muted-foreground font-medium">Defining Traits</span>
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                {archetype.traits.map((t: string) => (
                  <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                ))}
              </div>
            </div>

            {/* Similar Artists */}
            <div className="mt-4">
              <span className="text-xs text-muted-foreground font-medium">Similar Artists</span>
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                {archetype.similarArtists.map((a: string) => (
                  <Badge key={a} className="bg-muted text-muted-foreground text-xs">{a}</Badge>
                ))}
              </div>
            </div>

            {/* Development Path */}
            <div className="mt-4 p-3 bg-background/50 rounded-lg border border-border/30">
              <span className="text-xs text-muted-foreground font-medium">Suggested Development Path</span>
              <p className="text-sm mt-1">{archetype.developmentPath}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Archetype Yet</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Upload at least 3 tracks to be classified into an artist archetype.
              This helps you understand your creative identity and find your niche.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Platform Stats */}
      {stats && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            Platform Intelligence
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <Database className="h-8 w-8 text-cyan-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats.totalGenreClusters}</p>
                <p className="text-sm text-muted-foreground">Genre Clusters</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Music className="h-8 w-8 text-violet-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats.totalBenchmarkedGenres}</p>
                <p className="text-sm text-muted-foreground">Benchmarked Genres</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Users className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats.genres.length}</p>
                <p className="text-sm text-muted-foreground">Active Genres</p>
              </CardContent>
            </Card>
          </div>

          {/* Top Clusters */}
          {stats.topClusters.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Top Genre Clusters</CardTitle>
                <CardDescription>Most active genres on the platform</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.topClusters.map((c, i: number) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs capitalize">{c.genre}</Badge>
                        {c.subgenre && <Badge variant="outline" className="text-[10px]">{c.subgenre}</Badge>}
                      </div>
                      <span className="text-sm text-muted-foreground">{c.sampleSize} artists</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active Genres */}
          {stats.genres.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Active Genres</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-1.5 flex-wrap">
                  {stats.genres.map((g: string) => (
                    <Badge key={g} variant="outline" className="text-xs capitalize">{g}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
