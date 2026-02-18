import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import {
  Layers, Minimize2, Radio, Film, Mic, Cpu,
  Loader2, Music2, Sparkles, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle2, Lightbulb, ArrowRight, Wand2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ── Icon mapping for target states ──
const TARGET_ICONS: Record<string, any> = {
  layers: Layers,
  minimize: Minimize2,
  radio: Radio,
  film: Film,
  mic: Mic,
  cpu: Cpu,
};

// ── Priority colors ──
const PRIORITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  essential: { bg: "bg-red-500/15 border-red-500/30", text: "text-red-400", label: "Essential" },
  recommended: { bg: "bg-amber-500/15 border-amber-500/30", text: "text-amber-400", label: "Recommended" },
  optional: { bg: "bg-sky-500/15 border-sky-500/30", text: "text-sky-400", label: "Optional" },
};

// ── Section colors (matching StructureAnalysisView) ──
const SECTION_COLORS: Record<string, string> = {
  intro: "from-sky-500/20 to-sky-500/5",
  verse: "from-emerald-500/20 to-emerald-500/5",
  "pre-chorus": "from-amber-500/20 to-amber-500/5",
  chorus: "from-red-500/20 to-red-500/5",
  bridge: "from-purple-500/20 to-purple-500/5",
  outro: "from-slate-500/20 to-slate-500/5",
  instrumental: "from-indigo-500/20 to-indigo-500/5",
  breakdown: "from-orange-500/20 to-orange-500/5",
  build: "from-yellow-500/20 to-yellow-500/5",
  drop: "from-pink-500/20 to-pink-500/5",
  solo: "from-teal-500/20 to-teal-500/5",
  interlude: "from-cyan-500/20 to-cyan-500/5",
};

const SECTION_DOT_COLORS: Record<string, string> = {
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

function getSectionGradient(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, val] of Object.entries(SECTION_COLORS)) {
    if (lower.includes(key)) return val;
  }
  return "from-muted/20 to-muted/5";
}

function getSectionDot(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, val] of Object.entries(SECTION_DOT_COLORS)) {
    if (lower.includes(key)) return val;
  }
  return "bg-muted-foreground";
}

// ── Types ──
interface InstrumentSuggestion {
  instrument: string;
  partType: string;
  role: string;
  priority: "essential" | "recommended" | "optional";
  reasoning: string;
  technique?: string;
}

interface SectionAdvice {
  sectionName: string;
  startTime: string;
  endTime: string;
  energy: number;
  currentInstruments: string[];
  suggestions: InstrumentSuggestion[];
  removalSuggestions: string[];
  arrangementNote: string;
}

interface InstrumentationAdvice {
  trackTitle: string;
  genre: string;
  targetState: string;
  targetLabel: string;
  overallStrategy: string;
  sections: SectionAdvice[];
  globalSuggestions: InstrumentSuggestion[];
  arrangementArc: string;
  keyTakeaway: string;
}

// ── Suggestion Card ──
function SuggestionCard({ suggestion }: { suggestion: InstrumentSuggestion }) {
  const style = PRIORITY_STYLES[suggestion.priority] || PRIORITY_STYLES.optional;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-lg border ${style.bg} p-3 space-y-2`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Music2 className={`h-4 w-4 shrink-0 ${style.text}`} />
          <span className="font-medium text-sm truncate">{suggestion.instrument}</span>
        </div>
        <Badge variant="outline" className={`shrink-0 text-[10px] ${style.text} border-current`}>
          {style.label}
        </Badge>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="px-1.5 py-0.5 rounded bg-muted/50 font-mono">{suggestion.partType}</span>
        <ArrowRight className="h-3 w-3 shrink-0" />
        <span className="truncate">{suggestion.role}</span>
      </div>
      {(suggestion.reasoning || suggestion.technique) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Less" : "Details"}
        </button>
      )}
      {expanded && (
        <div className="text-xs text-muted-foreground space-y-1 pl-1 border-l-2 border-border/50 ml-1">
          {suggestion.reasoning && <p>{suggestion.reasoning}</p>}
          {suggestion.technique && (
            <p className="italic text-muted-foreground/80">
              Technique: {suggestion.technique}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Section Panel ──
function SectionPanel({ section }: { section: SectionAdvice }) {
  const [expanded, setExpanded] = useState(true);
  const gradient = getSectionGradient(section.sectionName);
  const dotColor = getSectionDot(section.sectionName);

  return (
    <Card className={`border-border/40 bg-gradient-to-br ${gradient} overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${dotColor}`} />
              <CardTitle className="text-base">{section.sectionName}</CardTitle>
              <span className="text-xs text-muted-foreground font-mono">
                {section.startTime} – {section.endTime}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                Energy {section.energy}/10
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                {section.suggestions.length} suggestion{section.suggestions.length !== 1 ? "s" : ""}
              </Badge>
              {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
        </CardHeader>
      </button>

      {expanded && (
        <CardContent className="space-y-4 pt-0">
          {/* Current instruments */}
          {section.currentInstruments?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Currently Present</p>
              <div className="flex flex-wrap gap-1.5">
                {section.currentInstruments.map((inst, i) => (
                  <Badge key={i} variant="outline" className="text-xs bg-muted/30">
                    {inst}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Arrangement note */}
          {section.arrangementNote && (
            <p className="text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-3">
              {section.arrangementNote}
            </p>
          )}

          {/* Instrument suggestions */}
          {section.suggestions?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" /> Suggested Additions
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {section.suggestions.map((s, i) => (
                  <SuggestionCard key={i} suggestion={s} />
                ))}
              </div>
            </div>
          )}

          {/* Removal suggestions */}
          {section.removalSuggestions?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3" /> Consider Removing
              </p>
              <div className="flex flex-wrap gap-1.5">
                {section.removalSuggestions.map((r, i) => (
                  <Badge key={i} variant="outline" className="text-xs text-red-400 border-red-500/30 bg-red-500/10">
                    {r}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ── Main Component ──
export function InstrumentationAdvisorView({ trackId }: { trackId: number }) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [artistNotes, setArtistNotes] = useState("");
  const [advice, setAdvice] = useState<InstrumentationAdvice | null>(null);
  const [showNotes, setShowNotes] = useState(false);

  const { data: targetStates } = trpc.instrumentation.targetStates.useQuery();

  const generateMutation = trpc.instrumentation.generate.useMutation({
    onSuccess: (data: any) => {
      setAdvice(data);
      toast.success("Instrumentation advice generated!");
    },
    onError: (err: any) => {
      toast.error(err.message);
    },
  });

  const handleGenerate = () => {
    if (!selectedTarget) {
      toast.error("Select a target arrangement state first");
      return;
    }
    generateMutation.mutate({
      trackId,
      targetState: selectedTarget as any,
      artistNotes: artistNotes.trim() || undefined,
    });
  };

  // ── Empty state: target selection ──
  if (!advice) {
    return (
      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wand2 className="h-5 w-5 text-primary" />
            Instrumentation Advisor
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            AI analyzes what instruments and parts are in each section of your song, then suggests specific additions, modifications, or removals to reach your target arrangement.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Target state selection */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Choose your target arrangement:</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {targetStates?.map((t) => {
                const Icon = TARGET_ICONS[t.icon] || Layers;
                const isSelected = selectedTarget === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setSelectedTarget(t.key)}
                    className={`text-left p-3 rounded-lg border transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : "border-border/40 hover:border-border hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`text-sm font-medium ${isSelected ? "text-primary" : ""}`}>
                        {t.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {t.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional artist notes */}
          <div className="space-y-2">
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {showNotes ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              Add notes for the advisor (optional)
            </button>
            {showNotes && (
              <Textarea
                placeholder="E.g., 'I want to keep the acoustic guitar prominent' or 'Looking for a more 80s synth-pop vibe' or 'The bridge needs more tension before the final chorus'"
                value={artistNotes}
                onChange={(e) => setArtistNotes(e.target.value)}
                className="h-20 text-sm"
                maxLength={1000}
              />
            )}
          </div>

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={!selectedTarget || generateMutation.isPending}
            className="w-full"
            size="lg"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Analyzing instrumentation with Claude 4.5...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Generate Instrumentation Advice
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Results view ──
  return (
    <div className="space-y-4">
      {/* Header with regenerate */}
      <Card className="border-border/40">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wand2 className="h-5 w-5 text-primary" />
                Instrumentation Advisor
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">{advice.genre}</Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <Badge className="text-xs bg-primary/15 text-primary border-primary/30">{advice.targetLabel}</Badge>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAdvice(null)}
            >
              New Analysis
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {/* Overall strategy */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-amber-400" /> Overall Strategy
            </p>
            <p className="text-sm leading-relaxed">{advice.overallStrategy}</p>
          </div>

          {/* Key takeaway */}
          {advice.keyTakeaway && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-primary uppercase tracking-wider mb-1">Start Here</p>
                <p className="text-sm">{advice.keyTakeaway}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Global suggestions */}
      {advice.globalSuggestions?.length > 0 && (
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              Global Suggestions
              <span className="text-xs text-muted-foreground font-normal">(apply across multiple sections)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {advice.globalSuggestions.map((s, i) => (
                <SuggestionCard key={i} suggestion={s} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Arrangement arc */}
      {advice.arrangementArc && (
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="h-4 w-4 text-violet-400" />
              Arrangement Arc
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">{advice.arrangementArc}</p>
          </CardContent>
        </Card>
      )}

      <Separator className="opacity-40" />

      {/* Section-by-section advice */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Section-by-Section Breakdown
        </h3>
        {advice.sections?.map((section, i) => (
          <SectionPanel key={i} section={section} />
        ))}
      </div>
    </div>
  );
}
