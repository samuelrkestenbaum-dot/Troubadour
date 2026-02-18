/**
 * Feature 5: Artist DNA Identity Model
 * Visualizes the AI-generated artist identity profile with radar-style layout.
 */
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, Dna, Music, Mic2, Palette, Heart, Globe2, TrendingUp,
  Sparkles, RefreshCw, Clock
} from "lucide-react";
import { toast } from "sonner";

interface ArtistDNAProfile {
  artistArchetype: string;
  signatureDescription: string;
  harmonicTendencies: {
    preferredKeys: string[];
    chordComplexity: string;
    harmonicSignature: string;
  };
  melodicContour: {
    range: string;
    preferredMovement: string;
    contourSignature: string;
  };
  rhythmicProfile: {
    tempoRange: { min: number; max: number; preferred: number };
    grooveStyle: string;
    rhythmicSignature: string;
  };
  productionFingerprint: {
    preferredInstruments: string[];
    soundPalette: string;
    spatialPreference: string;
    dynamicRange: string;
    productionSignature: string;
  };
  emotionalPalette: {
    dominantEmotions: string[];
    emotionalRange: string;
    moodSignature: string;
  };
  genreMap: {
    primaryGenre: string;
    secondaryGenres: string[];
    uniqueBlend: string;
  };
  evolutionNotes: string;
  coreStrengths: string[];
  growthOpportunities: string[];
  trackCount: number;
  confidence: string;
}

interface DNAHistoryEntry {
  id: number;
  trackCount: number;
  generatedAt: Date;
  archetype: string;
  confidence: string;
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const colors: Record<string, string> = {
    high: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    low: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <Badge variant="outline" className={colors[confidence] ?? ""}>
      {confidence} confidence
    </Badge>
  );
}

function DNASection({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function ArtistDNAView() {
  const latestQuery = trpc.artistDNA.latest.useQuery();
  const historyQuery = trpc.artistDNA.history.useQuery();
  const generateMutation = trpc.artistDNA.generate.useMutation({
    onSuccess: () => {
      latestQuery.refetch();
      historyQuery.refetch();
      toast.success("Artist DNA profile generated!");
    },
    onError: (err: any) => toast.error("Generation failed: " + (err?.message ?? "Unknown error")),
  });

  const dna = latestQuery.data as ArtistDNAProfile | null | undefined;
  const history = (historyQuery.data ?? []) as unknown as DNAHistoryEntry[];

  if (latestQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading Artist DNA...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Dna className="h-6 w-6 text-violet-500" />
            Artist DNA
          </h2>
          <p className="text-muted-foreground mt-1">Your unique musical identity, decoded by AI</p>
        </div>
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : dna ? (
            <RefreshCw className="h-4 w-4 mr-1" />
          ) : (
            <Sparkles className="h-4 w-4 mr-1" />
          )}
          {dna ? "Regenerate" : "Generate DNA"}
        </Button>
      </div>

      {!dna ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Dna className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No DNA Profile Yet</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Upload at least 3 tracks and generate reviews to build your Artist DNA profile.
              The more tracks you have, the more accurate your profile becomes.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Identity Card */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-primary">{dna.artistArchetype}</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{dna.signatureDescription}</p>
                </div>
                <div className="flex items-center gap-2">
                  <ConfidenceBadge confidence={dna.confidence} />
                  <Badge variant="outline">{dna.trackCount} tracks</Badge>
                </div>
              </div>

              {/* Genre Map */}
              <div className="flex items-center gap-2 mt-4 flex-wrap">
                <Badge className="bg-primary/20 text-primary border-primary/30">{dna.genreMap.primaryGenre}</Badge>
                {dna.genreMap.secondaryGenres.map((g: string) => (
                  <Badge key={g} variant="outline">{g}</Badge>
                ))}
              </div>
              {dna.genreMap.uniqueBlend && (
                <p className="text-xs text-muted-foreground mt-2 italic">{dna.genreMap.uniqueBlend}</p>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Harmonic Tendencies */}
            <DNASection icon={Music} title="Harmonic Tendencies">
              <div className="space-y-3">
                <div>
                  <span className="text-xs text-muted-foreground">Preferred Keys</span>
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    {dna.harmonicTendencies.preferredKeys.map((k: string) => (
                      <Badge key={k} variant="outline" className="text-xs">{k}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Chord Complexity</span>
                  <p className="text-sm font-medium capitalize">{dna.harmonicTendencies.chordComplexity}</p>
                </div>
                <p className="text-xs text-muted-foreground italic">{dna.harmonicTendencies.harmonicSignature}</p>
              </div>
            </DNASection>

            {/* Melodic Contour */}
            <DNASection icon={Mic2} title="Melodic Contour">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-muted-foreground">Range</span>
                    <p className="text-sm font-medium capitalize">{dna.melodicContour.range}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Movement</span>
                    <p className="text-sm font-medium capitalize">{dna.melodicContour.preferredMovement}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground italic">{dna.melodicContour.contourSignature}</p>
              </div>
            </DNASection>

            {/* Rhythmic Profile */}
            <DNASection icon={Music} title="Rhythmic Profile">
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <span className="text-xs text-muted-foreground">Min BPM</span>
                    <p className="text-sm font-mono">{dna.rhythmicProfile.tempoRange.min}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Preferred</span>
                    <p className="text-sm font-mono font-bold">{dna.rhythmicProfile.tempoRange.preferred}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Max BPM</span>
                    <p className="text-sm font-mono">{dna.rhythmicProfile.tempoRange.max}</p>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Groove Style</span>
                  <p className="text-sm font-medium">{dna.rhythmicProfile.grooveStyle}</p>
                </div>
                <p className="text-xs text-muted-foreground italic">{dna.rhythmicProfile.rhythmicSignature}</p>
              </div>
            </DNASection>

            {/* Production Fingerprint */}
            <DNASection icon={Palette} title="Production Fingerprint">
              <div className="space-y-3">
                <div>
                  <span className="text-xs text-muted-foreground">Instruments</span>
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    {dna.productionFingerprint.preferredInstruments.map((i: string) => (
                      <Badge key={i} variant="outline" className="text-xs">{i}</Badge>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-muted-foreground">Spatial</span>
                    <p className="text-sm font-medium capitalize">{dna.productionFingerprint.spatialPreference}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Dynamic Range</span>
                    <p className="text-sm font-medium capitalize">{dna.productionFingerprint.dynamicRange}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground italic">{dna.productionFingerprint.productionSignature}</p>
              </div>
            </DNASection>

            {/* Emotional Palette */}
            <DNASection icon={Heart} title="Emotional Palette">
              <div className="space-y-3">
                <div>
                  <span className="text-xs text-muted-foreground">Dominant Emotions</span>
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    {dna.emotionalPalette.dominantEmotions.map((e: string) => (
                      <Badge key={e} variant="outline" className="text-xs">{e}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Range</span>
                  <p className="text-sm font-medium capitalize">{dna.emotionalPalette.emotionalRange}</p>
                </div>
                <p className="text-xs text-muted-foreground italic">{dna.emotionalPalette.moodSignature}</p>
              </div>
            </DNASection>

            {/* Strengths & Growth */}
            <DNASection icon={TrendingUp} title="Strengths & Growth">
              <div className="space-y-4">
                <div>
                  <span className="text-xs text-muted-foreground font-medium">Core Strengths</span>
                  <ul className="mt-1 space-y-1">
                    {dna.coreStrengths.map((s: string, i: number) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-emerald-500 mt-0.5">+</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <Separator />
                <div>
                  <span className="text-xs text-muted-foreground font-medium">Growth Opportunities</span>
                  <ul className="mt-1 space-y-1">
                    {dna.growthOpportunities.map((g: string, i: number) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-amber-500 mt-0.5">→</span>
                        {g}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </DNASection>
          </div>

          {/* Evolution Notes */}
          {dna.evolutionNotes && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe2 className="h-4 w-4 text-primary" />
                  Evolution Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{dna.evolutionNotes}</p>
              </CardContent>
            </Card>
          )}

          {/* History */}
          {history.length > 1 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  DNA History ({history.length} profiles)
                </CardTitle>
                <CardDescription>Your identity evolves as you create more music</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {history.slice(0, 5).map((entry: DNAHistoryEntry, i: number) => (
                    <div key={entry.id} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                      <span className="text-xs text-muted-foreground font-mono w-24">
                        {new Date(entry.generatedAt).toLocaleDateString()}
                      </span>
                      <Badge variant={i === 0 ? "default" : "outline"} className="text-xs">
                        {entry.archetype ?? "Unknown"}
                      </Badge>
                      <span className="text-xs text-muted-foreground capitalize">{entry.confidence ?? ""}</span>
                      <span className="text-xs text-muted-foreground">{entry.trackCount} tracks</span>
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
