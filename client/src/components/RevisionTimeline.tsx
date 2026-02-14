import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitBranch, TrendingUp, TrendingDown, Minus, Clock } from "lucide-react";

interface VersionEntry {
  trackId: number;
  versionNumber: number;
  originalFilename: string;
  createdAt: string;
  status: string;
  overallScore: number | null;
  scores: Record<string, number> | null;
}

function ScoreChange({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous;
  if (diff > 0) return <span className="text-emerald-400 text-xs flex items-center gap-0.5"><TrendingUp className="h-3 w-3" />+{diff.toFixed(1)}</span>;
  if (diff < 0) return <span className="text-red-400 text-xs flex items-center gap-0.5"><TrendingDown className="h-3 w-3" />{diff.toFixed(1)}</span>;
  return <span className="text-muted-foreground text-xs flex items-center gap-0.5"><Minus className="h-3 w-3" />0</span>;
}

function ScoreBar({ score, max = 10 }: { score: number; max?: number }) {
  const pct = (score / max) * 100;
  const color = score >= 8 ? "bg-emerald-500" : score >= 6 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono w-6 text-right">{score.toFixed(1)}</span>
    </div>
  );
}

export function RevisionTimeline({ versions }: { versions: VersionEntry[] }) {
  if (!versions || versions.length === 0) {
    return (
      <Card className="border-border/40">
        <CardContent className="py-8 text-center">
          <GitBranch className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No version history yet. Upload revisions to track your progress over time.</p>
        </CardContent>
      </Card>
    );
  }

  // Sort by version number ascending
  const sorted = [...versions].sort((a, b) => a.versionNumber - b.versionNumber);
  const scoredVersions = sorted.filter(v => v.overallScore !== null);

  // Collect all score keys across versions
  const allScoreKeys = new Set<string>();
  sorted.forEach(v => {
    if (v.scores) Object.keys(v.scores).forEach(k => allScoreKeys.add(k));
  });
  const scoreKeys = Array.from(allScoreKeys);

  return (
    <div className="space-y-4">
      {/* Progress summary */}
      {scoredVersions.length >= 2 && (
        <Card className="border-border/40 bg-gradient-to-r from-emerald-500/5 to-transparent">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              <div>
                <p className="text-sm font-medium">
                  Progress: v{scoredVersions[0].versionNumber} → v{scoredVersions[scoredVersions.length - 1].versionNumber}
                </p>
                <p className="text-xs text-muted-foreground">
                  Overall score went from {scoredVersions[0].overallScore!.toFixed(1)} to {scoredVersions[scoredVersions.length - 1].overallScore!.toFixed(1)}
                  {" "}
                  <ScoreChange current={scoredVersions[scoredVersions.length - 1].overallScore!} previous={scoredVersions[0].overallScore!} />
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Score comparison table */}
      {scoreKeys.length > 0 && scoredVersions.length >= 2 && (
        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Score Progression by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="text-left py-2 pr-4 text-xs text-muted-foreground font-medium">Category</th>
                    {scoredVersions.map(v => (
                      <th key={v.versionNumber} className="text-center py-2 px-2 text-xs text-muted-foreground font-medium">v{v.versionNumber}</th>
                    ))}
                    <th className="text-center py-2 pl-2 text-xs text-muted-foreground font-medium">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {scoreKeys.map(key => {
                    const first = scoredVersions[0].scores?.[key];
                    const last = scoredVersions[scoredVersions.length - 1].scores?.[key];
                    return (
                      <tr key={key} className="border-b border-border/20">
                        <td className="py-2 pr-4 text-xs capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</td>
                        {scoredVersions.map(v => (
                          <td key={v.versionNumber} className="text-center py-2 px-2 font-mono text-xs">
                            {v.scores?.[key]?.toFixed(1) ?? "—"}
                          </td>
                        ))}
                        <td className="text-center py-2 pl-2">
                          {first != null && last != null ? <ScoreChange current={last} previous={first} /> : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <Card className="border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" /> Version Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative pl-6 space-y-4">
            <div className="absolute left-2.5 top-2 bottom-2 w-px bg-border/60" />
            {sorted.map((v, i) => {
              const prev = i > 0 ? sorted[i - 1] : null;
              return (
                <div key={v.trackId} className="relative">
                  <div className={`absolute left-[-18px] top-1.5 w-3 h-3 rounded-full border-2 ${v.overallScore !== null ? "bg-primary border-primary" : "bg-muted border-border"}`} />
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">v{v.versionNumber}</Badge>
                        <span className="text-sm font-medium truncate">{v.originalFilename}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(v.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                    </div>
                    {v.overallScore !== null && (
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="w-24">
                          <ScoreBar score={v.overallScore} />
                        </div>
                        {prev?.overallScore !== null && prev?.overallScore !== undefined && (
                          <ScoreChange current={v.overallScore} previous={prev.overallScore} />
                        )}
                      </div>
                    )}
                    {v.overallScore === null && (
                      <Badge variant="secondary" className="text-xs shrink-0">{v.status}</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
