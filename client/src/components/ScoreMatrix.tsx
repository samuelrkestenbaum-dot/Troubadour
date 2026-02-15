import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Grid3x3, ArrowUpDown } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { scoreColor } from "@/lib/scoreColor";

interface ScoreMatrixProps {
  projectId: number;
}

type SortConfig = { key: string; direction: "asc" | "desc" } | null;

export function ScoreMatrix({ projectId }: ScoreMatrixProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  const { data: matrix, isLoading } = trpc.matrix.get.useQuery({ projectId });

  // Collect all score dimension keys
  const scoreKeys = useMemo(() => {
    if (!matrix || matrix.length === 0) return [];
    const keys = new Set<string>();
    for (const row of matrix) {
      for (const k of Object.keys(row.scores)) {
        if (k !== "overall") keys.add(k);
      }
    }
    return Array.from(keys).sort();
  }, [matrix]);

  // Sort rows
  const sortedMatrix = useMemo(() => {
    if (!matrix) return [];
    if (!sortConfig) return matrix;
    return [...matrix].sort((a, b) => {
      const aVal = sortConfig.key === "overall" ? (a.overall ?? 0) : (a.scores[sortConfig.key] ?? 0);
      const bVal = sortConfig.key === "overall" ? (b.overall ?? 0) : (b.scores[sortConfig.key] ?? 0);
      return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [matrix, sortConfig]);

  // Find best/worst per dimension
  const dimensionStats = useMemo(() => {
    if (!matrix || matrix.length === 0) return {};
    const stats: Record<string, { best: number; worst: number; bestTrack: string; worstTrack: string }> = {};
    for (const key of [...scoreKeys, "overall"]) {
      let best = -Infinity, worst = Infinity, bestTrack = "", worstTrack = "";
      for (const row of matrix) {
        const val = key === "overall" ? (row.overall ?? 0) : (row.scores[key] ?? 0);
        if (val > best) { best = val; bestTrack = row.filename; }
        if (val < worst) { worst = val; worstTrack = row.filename; }
      }
      stats[key] = { best, worst, bestTrack, worstTrack };
    }
    return stats;
  }, [matrix, scoreKeys]);

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return prev.direction === "desc" ? { key, direction: "asc" } : null;
      }
      return { key, direction: "desc" };
    });
  };

  const formatLabel = (key: string) =>
    key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).trim();

  const getCellStyle = (value: number, key: string) => {
    const stats = dimensionStats[key];
    if (!stats) return {};
    const isBest = value === stats.best && matrix!.length > 1;
    const isWorst = value === stats.worst && matrix!.length > 1;
    return {
      fontWeight: isBest || isWorst ? 700 : 400,
      color: isBest ? "var(--color-emerald-400, #34d399)" : isWorst ? "var(--color-rose-400, #fb7185)" : undefined,
    };
  };

  const getHeatmapBg = (value: number) => {
    if (value >= 8) return "bg-emerald-500/15";
    if (value >= 6) return "bg-sky-500/10";
    if (value >= 4) return "bg-amber-500/10";
    return "bg-rose-500/10";
  };

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!matrix || matrix.length === 0) {
    return null;
  }

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Grid3x3 className="h-5 w-5 text-sky-400" />
          Score Matrix
          <Badge variant="outline" className="text-xs ml-2">
            {matrix.length} tracks
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-2 px-2 text-muted-foreground font-medium text-xs sticky left-0 bg-card z-10">
                  Track
                </th>
                <th
                  className="py-2 px-2 text-center text-muted-foreground font-medium text-xs cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("overall")}
                >
                  <span className="flex items-center justify-center gap-1">
                    Overall
                    <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
                {scoreKeys.map(key => (
                  <th
                    key={key}
                    className="py-2 px-2 text-center text-muted-foreground font-medium text-xs cursor-pointer hover:text-foreground transition-colors whitespace-nowrap"
                    onClick={() => handleSort(key)}
                  >
                    <span className="flex items-center justify-center gap-1">
                      {formatLabel(key)}
                      <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedMatrix.map((row) => (
                <tr key={row.trackId} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                  <td className="py-2 px-2 text-xs font-medium truncate max-w-[180px] sticky left-0 bg-card z-10" title={row.filename}>
                    {row.filename.replace(/\.[^/.]+$/, "")}
                  </td>
                  <td className={`py-2 px-2 text-center text-xs ${getHeatmapBg(row.overall ?? 0)} rounded-sm`}>
                    <span style={getCellStyle(row.overall ?? 0, "overall")} className={scoreColor(row.overall ?? 0)}>
                      {row.overall ?? "—"}
                    </span>
                  </td>
                  {scoreKeys.map(key => {
                    const val = row.scores[key];
                    return (
                      <td key={key} className={`py-2 px-2 text-center text-xs ${val != null ? getHeatmapBg(val) : ""} rounded-sm`}>
                        <span style={val != null ? getCellStyle(val, key) : {}}>
                          {val != null ? val : "—"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Click column headers to sort. <span className="text-emerald-400 font-medium">Green</span> = best in column, <span className="text-rose-400 font-medium">Red</span> = lowest.
        </p>
      </CardContent>
    </Card>
  );
}
