import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, LayoutList, Star, AlertTriangle, CheckCircle } from "lucide-react";

interface SectionData {
  name: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  percentOfTotal: number;
  energy: number;
  role: string;
}

interface StructureData {
  sections: SectionData[];
  structureScore: number;
  genreExpectations: {
    genre: string;
    typicalStructure: string;
    expectedChorusArrival: string;
    expectedSongLength: string;
    structureNotes: string;
  };
  suggestions: Array<{
    section: string;
    issue: string;
    suggestion: string;
    impact: "high" | "medium" | "low";
  }>;
}

function ScoreRing({ score }: { score: number }) {
  const pct = (score / 10) * 100;
  const color = score >= 8 ? "text-emerald-400" : score >= 6 ? "text-amber-400" : "text-red-400";
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <div className="relative w-24 h-24">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/30" />
        <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="4" className={color} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-xl font-bold ${color}`}>{score}</span>
        <span className="text-[10px] text-muted-foreground">/10</span>
      </div>
    </div>
  );
}

function SectionTimeline({ sections }: { sections: SectionData[] }) {
  if (!sections || sections.length === 0) return null;
  const totalPct = sections.reduce((s, sec) => s + (sec.percentOfTotal || 0), 0) || 100;
  const sectionColors: Record<string, string> = {
    intro: "bg-sky-500",
    verse: "bg-emerald-500",
    "pre-chorus": "bg-amber-500",
    chorus: "bg-red-500",
    bridge: "bg-purple-500",
    outro: "bg-slate-500",
    instrumental: "bg-indigo-500",
    breakdown: "bg-orange-500",
    build: "bg-yellow-500",
    drop: "bg-pink-500",
    solo: "bg-teal-500",
    interlude: "bg-cyan-500",
  };
  const getColor = (name: string) => {
    const lower = name.toLowerCase();
    for (const [key, val] of Object.entries(sectionColors)) {
      if (lower.includes(key)) return val;
    }
    return "bg-muted-foreground";
  };

  return (
    <div className="space-y-3">
      <div className="flex h-10 rounded-lg overflow-hidden gap-px">
        {sections.map((s, i) => (
          <div
            key={i}
            className={`${getColor(s.name)} flex items-center justify-center text-[10px] font-medium text-white px-1`}
            style={{ width: `${(s.percentOfTotal / totalPct) * 100}%`, minWidth: "24px" }}
            title={`${s.name}: ${s.startTime}–${s.endTime} (${s.percentOfTotal}%)`}
          >
            <span className="truncate">{s.name}</span>
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        {sections.map((s, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${getColor(s.name)}`} />
            <span className="font-medium w-24 shrink-0">{s.name}</span>
            <span className="text-xs text-muted-foreground font-mono w-28 shrink-0">{s.startTime} – {s.endTime}</span>
            <span className="text-xs text-muted-foreground w-10 shrink-0">{s.percentOfTotal}%</span>
            <span className="text-xs text-muted-foreground truncate">{s.role}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StructureAnalysisView({
  data,
  isGenerating,
  onGenerate,
}: {
  data: StructureData | null;
  isGenerating: boolean;
  onGenerate: () => void;
}) {
  if (!data) {
    return (
      <Card className="border-border/40">
        <CardContent className="py-12 text-center">
          <LayoutList className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-2">Songwriting Structure Analysis</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Analyze your song's structure against genre conventions. Get feedback on section timing, chorus placement, and arrangement effectiveness.
          </p>
          <Button onClick={onGenerate} disabled={isGenerating} className="gap-2">
            {isGenerating ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing Structure…</> : "Analyze Structure"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Score + Genre Expectations */}
      <div className="grid md:grid-cols-[auto_1fr] gap-4">
        <Card className="border-border/40">
          <CardContent className="py-4 flex flex-col items-center">
            <p className="text-xs text-muted-foreground mb-2">Structure Score</p>
            <ScoreRing score={data.structureScore} />
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Genre Expectations — {data.genreExpectations.genre}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Typical Structure:</span> <span>{data.genreExpectations.typicalStructure}</span></div>
            <div><span className="text-muted-foreground">Expected Chorus Arrival:</span> <span>{data.genreExpectations.expectedChorusArrival}</span></div>
            <div><span className="text-muted-foreground">Expected Song Length:</span> <span>{data.genreExpectations.expectedSongLength}</span></div>
            <p className="text-muted-foreground border-t border-border/40 pt-2">{data.genreExpectations.structureNotes}</p>
          </CardContent>
        </Card>
      </div>

      {/* Section Timeline */}
      <Card className="border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Section Map</CardTitle>
        </CardHeader>
        <CardContent>
          <SectionTimeline sections={data.sections} />
        </CardContent>
      </Card>

      {/* Suggestions */}
      {data.suggestions && data.suggestions.length > 0 && (
        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" /> Structural Suggestions ({data.suggestions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.suggestions.map((s, i) => {
              const impactColor = s.impact === "high" ? "border-red-500/30 bg-red-500/5" : s.impact === "medium" ? "border-amber-500/30 bg-amber-500/5" : "border-sky-500/30 bg-sky-500/5";
              return (
                <div key={i} className={`p-3 rounded-lg border ${impactColor}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px] capitalize">{s.impact}</Badge>
                    <span className="text-sm font-medium">{s.section}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">{s.issue}</p>
                  <p className="text-sm flex items-start gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    {s.suggestion}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
