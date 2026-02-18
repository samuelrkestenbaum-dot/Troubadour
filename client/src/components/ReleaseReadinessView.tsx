/**
 * Feature 3: Release Readiness Scoring
 * Traffic light system (green/yellow/red) for release readiness.
 */
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface DimensionSignal {
  signal: string;
  score: number;
  reason: string;
}

interface Blocker {
  dimension: string;
  severity: "critical" | "major" | "minor";
  description: string;
  fix: string;
}

interface Strength {
  dimension: string;
  description: string;
}

interface ReleaseReadinessData {
  overallSignal: "green" | "yellow" | "red";
  overallScore: number;
  dimensionSignals: Record<string, DimensionSignal>;
  blockers: Blocker[];
  strengths: Strength[];
  readinessStatement: string;
  estimatedEffort: string;
}

interface ReleaseReadinessViewProps {
  trackId: number;
}

export function ReleaseReadinessView({ trackId }: ReleaseReadinessViewProps) {
  const [expandedDimensions, setExpandedDimensions] = useState<Set<string>>(new Set());

  const evaluate = trpc.releaseReadiness.evaluate.useMutation({
    onError: (err: any) => toast.error("Evaluation failed: " + (err?.message ?? "Unknown error")),
  });

  const toggleDimension = (dim: string) => {
    setExpandedDimensions(prev => {
      const next = new Set(prev);
      if (next.has(dim)) next.delete(dim); else next.add(dim);
      return next;
    });
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "green": return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case "yellow": return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case "red": return <XCircle className="h-5 w-5 text-red-500" />;
      default: return null;
    }
  };

  const statusBg = (status: string) => {
    switch (status) {
      case "green": return "bg-emerald-500/10 border-emerald-500/30";
      case "yellow": return "bg-amber-500/10 border-amber-500/30";
      case "red": return "bg-red-500/10 border-red-500/30";
      default: return "";
    }
  };

  const statusText = (status: string) => {
    switch (status) {
      case "green": return "Release Ready";
      case "yellow": return "Needs Attention";
      case "red": return "Not Ready";
      default: return "Unknown";
    }
  };

  const severityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "major": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "minor": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      default: return "";
    }
  };

  const result = evaluate.data as ReleaseReadinessData | undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Release Readiness
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Evaluate if this track is ready for release</p>
        </div>
        <Button
          onClick={() => evaluate.mutate({ trackId })}
          disabled={evaluate.isPending}
        >
          {evaluate.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Shield className="h-4 w-4 mr-1" />}
          Evaluate Readiness
        </Button>
      </div>

      {result && (
        <>
          {/* Overall Score */}
          <Card className={`border-2 ${statusBg(result.overallSignal)}`}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20">
                  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
                    <circle
                      cx="50" cy="50" r="42" fill="none" strokeWidth="8"
                      strokeDasharray={`${(result.overallScore / 100) * 264} 264`}
                      strokeLinecap="round"
                      stroke={result.overallSignal === "green" ? "#10b981" : result.overallSignal === "yellow" ? "#f59e0b" : "#ef4444"}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold">{result.overallScore}</span>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {statusIcon(result.overallSignal)}
                    <h3 className="text-lg font-semibold">{statusText(result.overallSignal)}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{result.readinessStatement}</p>
                  {result.estimatedEffort && (
                    <p className="text-xs text-muted-foreground mt-2">
                      <span className="font-medium">Estimated effort:</span> {result.estimatedEffort}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dimension Signals */}
          {Object.keys(result.dimensionSignals).length > 0 && (
            <div className="space-y-3">
              {Object.entries(result.dimensionSignals).map(([dimKey, dim]: [string, DimensionSignal]) => (
                <Card
                  key={dimKey}
                  className={`${statusBg(dim.signal)} cursor-pointer transition-all hover:shadow-md`}
                  onClick={() => toggleDimension(dimKey)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {statusIcon(dim.signal)}
                        <div>
                          <CardTitle className="text-sm capitalize">{dimKey.replace(/([A-Z])/g, " $1").trim()}</CardTitle>
                          <CardDescription className="text-xs">{dim.score}/100</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs capitalize">{dim.signal}</Badge>
                        {expandedDimensions.has(dimKey) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>
                  </CardHeader>
                  {expandedDimensions.has(dimKey) && (
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground mt-1">{dim.reason}</p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}

          {/* Strengths */}
          {result.strengths && result.strengths.length > 0 && (
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.strengths.map((s: Strength, i: number) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium capitalize">{s.dimension}: </span>
                        <span className="text-muted-foreground">{s.description}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Blockers */}
          {result.blockers && result.blockers.length > 0 && (
            <Card className="border-red-500/30 bg-red-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-red-400 flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Release Blockers ({result.blockers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {result.blockers.map((b: Blocker, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-background/50 rounded-lg border border-border/30">
                      <Badge variant="outline" className={`text-[10px] shrink-0 uppercase ${severityColor(b.severity)}`}>
                        {b.severity}
                      </Badge>
                      <div className="flex-1">
                        <p className="text-sm font-medium capitalize">{b.dimension}</p>
                        <p className="text-sm text-muted-foreground">{b.description}</p>
                        <p className="text-xs text-primary mt-1">Fix: {b.fix}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
