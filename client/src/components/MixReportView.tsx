import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Volume2, Radio, Gauge, ArrowUpDown, Download, FileDown } from "lucide-react";
import { Streamdown } from "streamdown";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState } from "react";

interface FreqBand {
  rating: string;
  notes: string;
}

interface MixReportData {
  reportMarkdown?: string;
  frequencyAnalysis?: {
    lowEnd?: FreqBand;
    midRange?: FreqBand;
    highEnd?: FreqBand;
    overallBalance?: string;
  } | null;
  dynamicsAnalysis?: {
    dynamicRange?: string;
    compression?: string;
    transients?: string;
    loudness?: string;
  } | null;
  stereoAnalysis?: {
    width?: string;
    balance?: string;
    monoCompatibility?: string;
    panningNotes?: string;
  } | null;
  loudnessData?: {
    estimatedLUFS?: number;
    targetLUFS?: number;
    genre?: string;
    recommendation?: string;
  } | null;
  dawSuggestions?: Array<{
    timestamp?: string;
    element?: string;
    issue?: string;
    suggestion?: string;
    priority?: "high" | "medium" | "low";
  }> | null;
}

const defaultBand: FreqBand = { rating: "adequate", notes: "No data available" };

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

function cleanReportMarkdown(md: string | undefined): string | undefined {
  if (!md) return md;
  // If the reportMarkdown is actually a JSON string (from old broken generation), extract the inner markdown
  const trimmed = md.trim();
  if (trimmed.startsWith('```json') || trimmed.startsWith('{')) {
    try {
      const cleaned = trimmed.replace(/^```json\n?/, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.reportMarkdown && typeof parsed.reportMarkdown === 'string') {
        return parsed.reportMarkdown;
      }
    } catch {
      // Not valid JSON, return as-is
    }
  }
  return md;
}

export function MixReportView({
  data,
  isGenerating,
  onGenerate,
  trackId,
}: {
  data: MixReportData | null;
  isGenerating: boolean;
  onGenerate: () => void;
  trackId?: number;
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

  const freq = data.frequencyAnalysis;
  const dynamics = data.dynamicsAnalysis;
  const stereo = data.stereoAnalysis;
  const loudness = data.loudnessData;
  const suggestions = data.dawSuggestions;
  const hasStructuredData = freq || dynamics || stereo || loudness;

  return (
    <div className="space-y-4">
      {/* Frequency Analysis */}
      {freq && (
        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" /> Frequency Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3">
              {[
                { label: "Low End (20–250Hz)", ...(freq.lowEnd || defaultBand) },
                { label: "Mid Range (250Hz–4kHz)", ...(freq.midRange || defaultBand) },
                { label: "High End (4kHz–20kHz)", ...(freq.highEnd || defaultBand) },
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
            {freq.overallBalance && (
              <p className="text-sm border-t border-border/40 pt-3 text-muted-foreground">
                <strong className="text-foreground">Overall:</strong> {freq.overallBalance}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dynamics & Loudness */}
      {(dynamics || loudness) && (
        <div className="grid md:grid-cols-2 gap-4">
          {dynamics && (
            <Card className="border-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-primary" /> Dynamics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {dynamics.dynamicRange && <div><span className="text-muted-foreground">Range:</span> <span className="capitalize font-medium">{dynamics.dynamicRange}</span></div>}
                {dynamics.compression && <div><span className="text-muted-foreground">Compression:</span> <span>{dynamics.compression}</span></div>}
                {dynamics.transients && <div><span className="text-muted-foreground">Transients:</span> <span>{dynamics.transients}</span></div>}
                {dynamics.loudness && <div><span className="text-muted-foreground">Loudness:</span> <span>{dynamics.loudness}</span></div>}
              </CardContent>
            </Card>
          )}

          {loudness && typeof loudness.estimatedLUFS === "number" && typeof loudness.targetLUFS === "number" && (
            <Card className="border-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-primary" /> Loudness Target
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LUFSMeter estimated={loudness.estimatedLUFS} target={loudness.targetLUFS} />
                {loudness.recommendation && <p className="text-xs text-muted-foreground mt-2">{loudness.recommendation}</p>}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Stereo Analysis */}
      {stereo && (
        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Stereo Image</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {stereo.width && <div><span className="text-muted-foreground text-xs block">Width</span><span className="capitalize font-medium">{stereo.width}</span></div>}
            {stereo.balance && <div><span className="text-muted-foreground text-xs block">Balance</span><span>{stereo.balance}</span></div>}
            {stereo.monoCompatibility && <div><span className="text-muted-foreground text-xs block">Mono Compat.</span><span className="capitalize">{stereo.monoCompatibility}</span></div>}
            {stereo.panningNotes && <div><span className="text-muted-foreground text-xs block">Panning</span><span>{stereo.panningNotes}</span></div>}
          </CardContent>
        </Card>
      )}

      {/* DAW Suggestions */}
      {suggestions && suggestions.length > 0 && (
        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" /> DAW Action Items ({suggestions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-muted/30 border border-border/20">
                  <PriorityBadge priority={s.priority || "medium"} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-mono text-muted-foreground">{s.timestamp || ""}</span>
                      <span className="text-sm font-medium">{s.element || ""}</span>
                    </div>
                    {s.issue && <p className="text-xs text-muted-foreground">{s.issue}</p>}
                    {s.suggestion && <p className="text-sm mt-0.5">{s.suggestion}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full Report Markdown - always show if reportMarkdown exists */}
      {data.reportMarkdown && (
        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              {hasStructuredData ? "Full Mix Report" : "Mix Report"}
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-invert prose-sm max-w-none">
            <Streamdown>{cleanReportMarkdown(data.reportMarkdown) || data.reportMarkdown}</Streamdown>
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      <div className="flex justify-center gap-3 pt-2">
        <Button variant="outline" size="sm" onClick={onGenerate} disabled={isGenerating} className="gap-2">
          {isGenerating ? <><Loader2 className="h-4 w-4 animate-spin" /> Regenerating…</> : "Regenerate Mix Report"}
        </Button>
        {trackId && <ExportPdfButton trackId={trackId} />}
      </div>
    </div>
  );
}

function ExportPdfButton({ trackId }: { trackId: number }) {
  const [exporting, setExporting] = useState(false);
  const utils = trpc.useUtils();

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await utils.mixReport.exportHtml.fetch({ trackId });
      // Open HTML in new window for print/save as PDF
      const blob = new Blob([result.html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (win) {
        win.onload = () => {
          setTimeout(() => {
            win.print();
          }, 500);
        };
      }
      toast.success("Mix report opened for printing", {
        description: "Use 'Save as PDF' in the print dialog to export",
      });
    } catch (err: any) {
      toast.error("Export failed", { description: err.message || "Could not generate export" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="gap-2">
      {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      Export PDF
    </Button>
  );
}
