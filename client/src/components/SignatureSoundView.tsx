import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect } from "react";
import {
  Loader2, Sparkles, ChevronDown, ChevronUp, Download,
  Fingerprint, Music2, ArrowRight, Gauge, History, Clock,
  Lightbulb, CheckCircle2, AlertTriangle, Shuffle, ListMusic,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ── Category styling ──
const CATEGORY_STYLES: Record<string, { icon: any; color: string; bg: string }> = {
  texture: { icon: Music2, color: "text-purple-400", bg: "bg-purple-500/15 border-purple-500/30" },
  effect: { icon: Sparkles, color: "text-sky-400", bg: "bg-sky-500/15 border-sky-500/30" },
  rhythm: { icon: Shuffle, color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/30" },
  harmonic: { icon: ListMusic, color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30" },
  timbral: { icon: Fingerprint, color: "text-red-400", bg: "bg-red-500/15 border-red-500/30" },
  spatial: { icon: Gauge, color: "text-indigo-400", bg: "bg-indigo-500/15 border-indigo-500/30" },
};

const SUBTLETY_LABELS: Record<string, { label: string; color: string }> = {
  very_subtle: { label: "Very Subtle", color: "text-sky-400" },
  subtle: { label: "Subtle", color: "text-emerald-400" },
  moderate: { label: "Moderate", color: "text-amber-400" },
  prominent: { label: "Prominent", color: "text-red-400" },
};

const PRIORITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  essential: { bg: "bg-red-500/15 border-red-500/30", text: "text-red-400", label: "Essential" },
  recommended: { bg: "bg-amber-500/15 border-amber-500/30", text: "text-amber-400", label: "Recommended" },
  optional: { bg: "bg-sky-500/15 border-sky-500/30", text: "text-sky-400", label: "Optional" },
};

// ── Types ──
interface TrackNote {
  trackName: string;
  application: string;
}

interface SignatureElement {
  element: string;
  category: string;
  description: string;
  howToApply: string;
  trackSpecificNotes: TrackNote[];
  subtlety: string;
  priority: string;
}

interface SignatureSoundAdvice {
  currentCohesion: {
    score: number;
    strengths: string[];
    gaps: string[];
  };
  signatureElements: SignatureElement[];
  transitionStrategy: string;
  sequencingNotes: string;
  overallVision: string;
  keyTakeaway: string;
}

// ── Element Card ──
function ElementCard({ element, index }: { element: SignatureElement; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const cat = CATEGORY_STYLES[element.category] || CATEGORY_STYLES.texture;
  const sub = SUBTLETY_LABELS[element.subtlety] || SUBTLETY_LABELS.subtle;
  const pri = PRIORITY_STYLES[element.priority] || PRIORITY_STYLES.recommended;
  const Icon = cat.icon;

  return (
    <Card className={`border-border/40 overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className={`mt-0.5 p-2 rounded-lg ${cat.bg} border`}>
                <Icon className={`h-4 w-4 ${cat.color}`} />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-sm">
                  {index + 1}. {element.element}
                </CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className={`text-[10px] capitalize ${cat.color} border-current`}>
                    {element.category}
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] ${sub.color} border-current`}>
                    {sub.label}
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] ${pri.text} border-current`}>
                    {pri.label}
                  </Badge>
                </div>
              </div>
            </div>
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
          </div>
        </CardHeader>
      </button>

      <CardContent className="pt-0 space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed">{element.description}</p>

        {expanded && (
          <>
            {/* How to apply */}
            <div className="bg-muted/30 rounded-lg p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">How to Apply</p>
              <p className="text-sm leading-relaxed">{element.howToApply}</p>
            </div>

            {/* Track-specific notes */}
            {element.trackSpecificNotes?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Per-Track Application</p>
                <div className="space-y-1.5">
                  {element.trackSpecificNotes.map((note, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">
                        {note.trackName}
                      </Badge>
                      <span className="text-muted-foreground">{note.application}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Cohesion Score Ring ──
function CohesionScore({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 40;
  const progress = (score / 10) * circumference;
  const color = score >= 7 ? "text-emerald-400" : score >= 5 ? "text-amber-400" : "text-red-400";
  const strokeColor = score >= 7 ? "#34d399" : score >= 5 ? "#fbbf24" : "#f87171";

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
          <circle
            cx="50" cy="50" r="40" fill="none" stroke={strokeColor} strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold ${color}`}>{score}</span>
          <span className="text-[10px] text-muted-foreground">/10</span>
        </div>
      </div>
      <div>
        <p className="text-sm font-medium">Album Cohesion</p>
        <p className="text-xs text-muted-foreground">
          {score >= 8 ? "Excellent — tracks feel unified" :
           score >= 6 ? "Good — some unifying threads present" :
           score >= 4 ? "Moderate — noticeable gaps in cohesion" :
           "Needs work — tracks feel disconnected"}
        </p>
      </div>
    </div>
  );
}

// ── Main Component ──
export function SignatureSoundView({ projectId }: { projectId: number }) {
  const [advice, setAdvice] = useState<SignatureSoundAdvice | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const { data: existing, isLoading: loadingExisting } = trpc.signatureSound.get.useQuery(
    { projectId }
  );

  // Load existing advice when query resolves
  useEffect(() => {
    if (existing && !advice) {
      setAdvice(existing.adviceJson as unknown as SignatureSoundAdvice);
    }
  }, [existing]);

  const { data: history, refetch: refetchHistory } = trpc.signatureSound.history.useQuery({ projectId });

  const generateMutation = trpc.signatureSound.generate.useMutation({
    onSuccess: (data: any) => {
      setAdvice(data as SignatureSoundAdvice);
      refetchHistory();
      toast.success("Signature sound analysis generated & saved!");
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  const handleExport = () => {
    const url = `/api/trpc/signatureSound.exportMarkdown?input=${encodeURIComponent(JSON.stringify({ projectId }))}`;
    window.open(url, "_blank");
    toast.success("Opening signature sound report...");
  };

  const loadFromHistory = (entry: any) => {
    setAdvice(entry.adviceJson as SignatureSoundAdvice);
    setShowHistory(false);
    toast.success(`Loaded analysis from ${new Date(entry.createdAt).toLocaleDateString()}`);
  };

  // ── Empty state ──
  if (!advice && !loadingExisting) {
    return (
      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Fingerprint className="h-5 w-5 text-primary" />
            Signature Sound Advisor
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Analyze all tracks in this album and discover recurring sonic elements that will
            create cohesion across your full body of work — like a sonic fingerprint.
          </p>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => generateMutation.mutate({ projectId })}
            disabled={generateMutation.isPending}
            className="w-full"
            size="lg"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Analyzing album cohesion with Claude 4.5...
              </>
            ) : (
              <>
                <Fingerprint className="h-4 w-4 mr-2" />
                Generate Signature Sound Analysis
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loadingExisting && !advice) {
    return (
      <Card className="border-border/40">
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!advice) return null;

  // ── Results view ──
  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-border/40">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Fingerprint className="h-5 w-5 text-primary" />
                Signature Sound
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {existing && (
                <Button variant="outline" size="sm" onClick={handleExport} title="Export as Markdown">
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Export
                </Button>
              )}
              {history && history.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHistory(!showHistory)}
                  title="View history"
                >
                  <History className="h-3.5 w-3.5 mr-1" />
                  History ({history.length})
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateMutation.mutate({ projectId })}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Regenerate"
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {/* Cohesion score */}
          <CohesionScore score={advice.currentCohesion?.score || 0} />

          {/* Vision */}
          {advice.overallVision && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-primary uppercase tracking-wider mb-1">Sonic Vision</p>
                <p className="text-sm leading-relaxed">{advice.overallVision}</p>
              </div>
            </div>
          )}

          {/* Strengths & Gaps */}
          <div className="grid gap-3 sm:grid-cols-2">
            {advice.currentCohesion?.strengths?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Existing Strengths
                </p>
                <div className="space-y-1">
                  {advice.currentCohesion.strengths.map((s, i) => (
                    <p key={i} className="text-sm text-muted-foreground pl-3 border-l-2 border-emerald-500/30">{s}</p>
                  ))}
                </div>
              </div>
            )}
            {advice.currentCohesion?.gaps?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 text-amber-400" /> Cohesion Gaps
                </p>
                <div className="space-y-1">
                  {advice.currentCohesion.gaps.map((g, i) => (
                    <p key={i} className="text-sm text-muted-foreground pl-3 border-l-2 border-amber-500/30">{g}</p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Key takeaway */}
          {advice.keyTakeaway && (
            <div className="bg-muted/30 rounded-lg p-4 flex items-start gap-3">
              <ArrowRight className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Start Here</p>
                <p className="text-sm">{advice.keyTakeaway}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History panel */}
      {showHistory && history && history.length > 0 && (
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Previous Analyses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map((entry: any) => (
                <button
                  key={entry.id}
                  onClick={() => loadFromHistory(entry)}
                  className="w-full text-left p-3 rounded-lg border border-border/40 hover:border-border hover:bg-muted/30 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Signature Sound Analysis</span>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Separator className="opacity-40" />

      {/* Signature Elements */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Signature Elements ({advice.signatureElements?.length || 0})
        </h3>
        {advice.signatureElements?.map((el, i) => (
          <ElementCard key={i} element={el} index={i} />
        ))}
      </div>

      {/* Transition Strategy */}
      {advice.transitionStrategy && (
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shuffle className="h-4 w-4 text-violet-400" />
              Transition Strategy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">{advice.transitionStrategy}</p>
          </CardContent>
        </Card>
      )}

      {/* Sequencing Notes */}
      {advice.sequencingNotes && (
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ListMusic className="h-4 w-4 text-teal-400" />
              Sequencing Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">{advice.sequencingNotes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
