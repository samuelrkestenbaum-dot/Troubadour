import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Volume2, Radio, Gauge, ArrowUpDown, Download } from "lucide-react";
import { Streamdown } from "streamdown";

interface FreqBand {
  rating: string;
  notes: string;
}

interface MixReportData {
  reportMarkdown: string;
  frequencyAnalysis: {
    lowEnd: FreqBand;
    midRange: FreqBand;
    highEnd: FreqBand;
    overallBalance: string;
  };
  dynamicsAnalysis: {
    dynamicRange: string;
    compression: string;
    transients: string;
    loudness: string;
  };
  stereoAnalysis: {
    width: string;
    balance: string;
    monoCompatibility: string;
    panningNotes: string;
  };
  loudnessData: {
    estimatedLUFS: number;
    targetLUFS: number;
    genre: string;
    recommendation: string;
  };
  dawSuggestions: Array<{
    timestamp: string;
    element: string;
    issue: string;
    suggestion: string;
    priority: "high" | "medium" | "low";
  }>;
}

function RatingBadge({ rating }: { rating: string }) {
  const colors: Record<string, string> = {
    excellent: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    good: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    adequate: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    weak: "bg-red-500/20 text-red-300 border-red-500/30",
  };
  return (
    <Badge variant="outline" className={`text-xs capitalize ${colors[rating] || ""}`}>
      {rating}
    </Badge>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    high: "bg-red-500/20 text-red-300 border-red-500/30",
    medium: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    low: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  };
  return (
    <Badge variant="outline" className={`text-[10px] capitalize ${colors[priority] || ""}`}>
      {priority}
    </Badge>
  );
}

function LUFSMeter({ estimated, target }: { estimated: number; target: number }) {
  const diff = estimated - target;
  const diffLabel = diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);
  const color = Math.abs(diff) <= 1 ? "text-emerald-400" : Math.abs(diff) <= 3 ? "text-amber-400" : "text-red-400";
  return (
    <div className="flex items-center gap-6">
      <div className="text-center">
        <p className="text-2xl font-mono font-bold">{estimated}</p>
        <p className="text-xs text-muted-foreground">Estimated LUFS</p>
      </div>
      <div className="text-center">
        <p className={`text-lg font-mono font-semibold ${color}`}>{diffLabel}</p>
        <p className="text-xs text-muted-foreground">vs Target</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-mono font-bold">{target}</p>
        <p className="text-xs text-muted-foreground">Target LUFS</p>
      </div>
    </div>
  );
}

export function MixReportView({
  data,
  isGenerating,
  onGenerate,
}: {
  data: MixReportData | null;
  isGenerating: boolean;
  onGenerate: () => void;
}) {
  if (!data) {
    return (
      <Card className="border-border/40">
        <CardContent className="py-12 text-center">
          <Volume2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-2">Mix Feedback Report</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Get detailed technical analysis of your mix including frequency balance, dynamics, stereo image, loudness targets, and specific DAW suggestions.
          </p>
          <Button onClick={onGenerate} disabled={isGenerating} className="gap-2">
            {isGenerating ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing Mix…</> : "Generate Mix Report"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Frequency Analysis */}
      <Card className="border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" /> Frequency Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3">
            {[
              { label: "Low End (20–250Hz)", ...data.frequencyAnalysis.lowEnd },
              { label: "Mid Range (250Hz–4kHz)", ...data.frequencyAnalysis.midRange },
              { label: "High End (4kHz–20kHz)", ...data.frequencyAnalysis.highEnd },
            ].map((band) => (
              <div key={band.label} className="flex items-start gap-3">
                <div className="w-40 shrink-0">
                  <p className="text-sm font-medium">{band.label}</p>
                  <RatingBadge rating={band.rating} />
                </div>
                <p className="text-sm text-muted-foreground">{band.notes}</p>
              </div>
            ))}
          </div>
          <p className="text-sm border-t border-border/40 pt-3 text-muted-foreground">
            <strong className="text-foreground">Overall:</strong> {data.frequencyAnalysis.overallBalance}
          </p>
        </CardContent>
      </Card>

      {/* Dynamics & Loudness */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-primary" /> Dynamics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Range:</span> <span className="capitalize font-medium">{data.dynamicsAnalysis.dynamicRange}</span></div>
            <div><span className="text-muted-foreground">Compression:</span> <span>{data.dynamicsAnalysis.compression}</span></div>
            <div><span className="text-muted-foreground">Transients:</span> <span>{data.dynamicsAnalysis.transients}</span></div>
            <div><span className="text-muted-foreground">Loudness:</span> <span>{data.dynamicsAnalysis.loudness}</span></div>
          </CardContent>
        </Card>

        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Gauge className="h-4 w-4 text-primary" /> Loudness Target
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LUFSMeter estimated={data.loudnessData.estimatedLUFS} target={data.loudnessData.targetLUFS} />
            <p className="text-xs text-muted-foreground mt-2">{data.loudnessData.recommendation}</p>
          </CardContent>
        </Card>
      </div>

      {/* Stereo Analysis */}
      <Card className="border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Stereo Image</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-muted-foreground text-xs block">Width</span><span className="capitalize font-medium">{data.stereoAnalysis.width}</span></div>
          <div><span className="text-muted-foreground text-xs block">Balance</span><span>{data.stereoAnalysis.balance}</span></div>
          <div><span className="text-muted-foreground text-xs block">Mono Compat.</span><span className="capitalize">{data.stereoAnalysis.monoCompatibility}</span></div>
          <div><span className="text-muted-foreground text-xs block">Panning</span><span>{data.stereoAnalysis.panningNotes}</span></div>
        </CardContent>
      </Card>

      {/* DAW Suggestions */}
      {data.dawSuggestions && data.dawSuggestions.length > 0 && (
        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" /> DAW Action Items ({data.dawSuggestions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.dawSuggestions.map((s, i) => (
                <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-muted/30 border border-border/20">
                  <PriorityBadge priority={s.priority} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-mono text-muted-foreground">{s.timestamp}</span>
                      <span className="text-sm font-medium">{s.element}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{s.issue}</p>
                    <p className="text-sm mt-0.5">{s.suggestion}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full Report Markdown */}
      <Card className="border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Full Mix Report</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-invert prose-sm max-w-none">
          <Streamdown>{data.reportMarkdown}</Streamdown>
        </CardContent>
      </Card>
    </div>
  );
}
