import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Music, Mic2, Layers, UserCircle, TrendingUp, Sparkles,
  ArrowLeft, Eye, Plus, Star, ChevronRight
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { getIconComponent } from "./Templates";

// ── Built-in Reviewer Personas ──
const BUILT_IN_PERSONAS = [
  {
    id: "songwriter",
    label: "Songwriter",
    icon: Music,
    color: "from-violet-500/20 to-purple-500/20",
    borderColor: "border-violet-500/30",
    accentColor: "text-violet-400",
    tagColor: "bg-violet-500/10 text-violet-300 border-violet-500/20",
    description: "Focus on lyrics, melody, hooks, song structure, and emotional arc",
    focusAreas: ["Melody & Hooks", "Lyric Craft", "Song Structure", "Emotional Arc", "Chorus Lift", "Harmonic Movement"],
    scoringDimensions: ["Melody & Hooks", "Lyric Quality", "Song Structure", "Emotional Arc", "Chorus Impact", "Harmonic Interest", "Overall"],
    sampleQuickTake: "Strong melodic instinct — the chorus hook lands immediately and the verse melody has genuine forward motion. Lyric craft is solid in the verses but the bridge feels underwritten. The pre-chorus builds tension effectively but resolves too predictably. This is a song that knows what it wants to be.",
    sampleExcerpt: `### Core Analysis

The melodic architecture here shows real sophistication. The verse melody sits in a comfortable mid-range that lets the lyrics breathe, then the pre-chorus lifts by a fourth to create genuine anticipation. When the chorus arrives, the leap to the upper register feels earned rather than forced. That's harder to pull off than it sounds.

Where the writing stumbles is in the bridge. After building such strong melodic momentum through verse-chorus-verse-chorus, the bridge retreats to a near-monotone delivery that deflates the energy. Consider rewriting the bridge melody to explore the highest register of the song — give the listener somewhere they haven't been yet before the final chorus.

### Top Changes
- **Rewrite the bridge melody** — push into unexplored melodic territory to maintain momentum
- **Tighten the second verse lyrics** — lines 3-4 repeat the sentiment of verse one without adding new information
- **Consider a post-chorus tag** — the chorus ends cleanly but a melodic tag could make it stickier`,
  },
  {
    id: "producer",
    label: "Producer",
    icon: Layers,
    color: "from-sky-500/20 to-cyan-500/20",
    borderColor: "border-sky-500/30",
    accentColor: "text-sky-400",
    tagColor: "bg-sky-500/10 text-sky-300 border-sky-500/20",
    description: "Focus on mix quality, frequency balance, dynamics, spatial imaging, and production choices",
    focusAreas: ["Mix Balance", "Frequency Spectrum", "Dynamics & Compression", "Stereo Width", "Production Choices", "Arrangement Density"],
    scoringDimensions: ["Mix Balance", "Low End", "Vocal Treatment", "Spatial Imaging", "Dynamic Range", "Production Polish", "Overall"],
    sampleQuickTake: "The low end is well-controlled with a clean sub-bass roll-off around 35Hz. Vocal sits nicely in the mix but could use 1-2dB more presence around 3kHz. The stereo image is wide but the reverb tails are creating some phase issues in mono. Overall production quality is radio-ready with minor tweaks needed.",
    sampleExcerpt: `### Core Analysis

The frequency balance across this mix is genuinely impressive for what appears to be a home studio production. The kick-bass relationship is clean — the kick punches through around 60Hz while the bass fills the 80-120Hz range without masking. That separation doesn't happen by accident.

The vocal chain is doing most of the heavy lifting here. There's tasteful compression keeping the dynamics in check, and the de-esser is working without creating lisping artifacts. However, the 2-4kHz presence range feels slightly scooped, which pushes the vocal behind the guitars during the chorus. A gentle 1.5dB shelf at 3kHz would bring the vocal forward without making it harsh.

### Top Changes
- **Boost vocal presence at 3kHz** — a gentle 1.5dB shelf will cut through the chorus guitars
- **Check mono compatibility** — the wide reverb tails are causing phase cancellation below 200Hz
- **Tame the hi-hat bleed** — there's some 8kHz buildup from cymbal bleed in the vocal mic`,
  },
  {
    id: "arranger",
    label: "Arranger",
    icon: Sparkles,
    color: "from-emerald-500/20 to-teal-500/20",
    borderColor: "border-emerald-500/30",
    accentColor: "text-emerald-400",
    tagColor: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    description: "Focus on musical architecture, instrumentation, layering, transitions, and sonic journey",
    focusAreas: ["Arrangement Arc", "Instrumentation", "Layering & Density", "Transitions", "Intro/Outro Design", "Contrast & Dynamics"],
    scoringDimensions: ["Arrangement Arc", "Instrumentation", "Layering", "Transitions", "Intro Effectiveness", "Dynamic Contrast", "Overall"],
    sampleQuickTake: "The arrangement builds beautifully from the sparse verse to the full chorus, but the second verse doesn't strip back enough — it needs more contrast. The bridge introduces a synth pad that's the best moment in the track. The outro fades when it should have a definitive ending. Strong bones, needs sculpting.",
    sampleExcerpt: `### Core Analysis

This arrangement understands the fundamental principle of contrast — the verse-to-chorus energy delta is substantial and satisfying. The verse strips down to acoustic guitar and vocal, then the pre-chorus layers in bass and a filtered synth, and the chorus explodes with full drums, electric guitars, and backing vocals. That's textbook arrangement craft.

The problem is the second verse. After the energy of the first chorus, the second verse needs to strip back even further than the first to re-establish tension. Instead, it keeps the bass and a light drum pattern, which means the second chorus doesn't hit as hard as the first. Consider pulling the bass entirely from the second verse and using just a single sustained pad underneath the vocal.

### Top Changes
- **Strip the second verse further** — remove bass, use only a sustained pad to rebuild tension
- **Replace the fade-out with a hard ending** — the final chord should ring and decay naturally
- **Add a counter-melody in the final chorus** — a simple horn or synth line would elevate the climax`,
  },
  {
    id: "artist",
    label: "Artist Dev",
    icon: UserCircle,
    color: "from-rose-500/20 to-pink-500/20",
    borderColor: "border-rose-500/30",
    accentColor: "text-rose-400",
    tagColor: "bg-rose-500/10 text-rose-300 border-rose-500/20",
    description: "Focus on vocal delivery, performance energy, emotional authenticity, and artistic identity",
    focusAreas: ["Vocal Performance", "Emotional Authenticity", "Artistic Identity", "Stage Presence", "Growth Trajectory", "Phrasing & Delivery"],
    scoringDimensions: ["Vocal Delivery", "Emotional Authenticity", "Artistic Identity", "Performance Energy", "Phrasing", "Growth Potential", "Overall"],
    sampleQuickTake: "There's a genuine voice here — the phrasing in the verses has a conversational quality that feels authentic rather than performed. The chorus vocal pushes into a belt that's technically impressive but loses some of the intimacy. The ad-libs in the outro show real personality. This artist has a signature sound forming.",
    sampleExcerpt: `### Core Analysis

The most compelling thing about this performance is the contrast between the verse and chorus delivery. In the verses, there's a breathy, almost whispered quality that draws the listener in — it feels like a confession. Then the chorus opens up into a full-throated belt that's technically clean but emotionally different. The question is whether that shift serves the song or breaks the spell.

My instinct says the chorus would be more powerful at about 70% of the current intensity. The verse delivery is so intimate and distinctive that it's become this artist's signature sound. Pushing to full belt in the chorus abandons that signature in favor of a more generic power vocal. Consider keeping the breathy quality even as the pitch rises — that tension between soft delivery and high notes is where this artist's identity lives.

### Top Changes
- **Pull back the chorus belt to 70%** — maintain the breathy signature even at higher intensity
- **Lean into the ad-lib style** — the outro ad-libs show the most personality; bring that energy earlier
- **Work on breath control in the bridge** — there are two audible gasps that break the flow`,
  },
  {
    id: "anr",
    label: "A&R Executive",
    icon: TrendingUp,
    color: "from-amber-500/20 to-orange-500/20",
    borderColor: "border-amber-500/30",
    accentColor: "text-amber-400",
    tagColor: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    description: "Focus on commercial viability, market positioning, playlist strategy, and audience development",
    focusAreas: ["Commercial Potential", "Market Positioning", "Playlist Fit", "Audience Development", "Release Strategy", "Feature Potential"],
    scoringDimensions: ["Commercial Viability", "Playlist Readiness", "Market Positioning", "Audience Appeal", "Release Timing", "Brand Potential", "Overall"],
    sampleQuickTake: "This has genuine playlist potential in the indie-pop/bedroom-pop space. The hook is sticky enough for casual listening but the production needs one more polish pass to compete with the Spotify editorial tier. Think Clairo meets beabadoobee. The artist's visual brand and social presence will matter as much as the music for this release.",
    sampleExcerpt: `### Core Analysis

From a market positioning standpoint, this track sits in a sweet spot between bedroom pop and indie pop that's currently underserved on streaming platforms. The lo-fi production aesthetic is on-trend, but the songwriting sophistication elevates it above the typical bedroom pop release. This is the kind of track that could cross over from algorithmic playlists into editorial consideration.

The challenge is differentiation. There are thousands of tracks in this sonic space, and the first 15 seconds need to immediately signal "this is different." Currently, the intro is a standard guitar-and-vocal opening that could belong to any of those thousands of tracks. Consider leading with the most distinctive element — that filtered vocal chop that appears in the chorus — to create an immediate sonic signature.

### Targeting & Strategy
Position for New Music Friday consideration in the indie/alternative category. The comparable artist profile is Clairo × beabadoobee × men i trust. Target playlists: Indie Pop, Bedroom Pop, Chill Vibes, and New Indie Mix. Release timing: Tuesday drop with a 4-week pre-save campaign. The visual brand should lean into the DIY aesthetic that matches the production style.`,
  },
];

export default function TemplatesGallery() {
  const [, navigate] = useLocation();
  const { data: userTemplates, isLoading: loadingUserTemplates } = trpc.template.list.useQuery();
  const [previewPersona, setPreviewPersona] = useState<typeof BUILT_IN_PERSONAS[0] | null>(null);

  return (
    <div className="container max-w-5xl py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-heading">Reviewer Personas</h1>
            <p className="text-sm text-muted-foreground">
              Choose how Troubadour listens to your music — each persona brings a different ear
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate("/templates")}>
          <Plus className="h-4 w-4 mr-1.5" />
          Custom Templates
        </Button>
      </div>

      {/* Built-in Personas Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Mic2 className="h-5 w-5 text-primary" />
          Built-in Personas
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {BUILT_IN_PERSONAS.map((persona) => {
            const Icon = persona.icon;
            return (
              <Card
                key={persona.id}
                className={`group cursor-pointer hover:shadow-lg transition-all duration-300 ${persona.borderColor} hover:border-primary/40`}
              >
                <CardContent className="p-5 space-y-3">
                  {/* Icon + Title */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl bg-gradient-to-br ${persona.color}`}>
                        <Icon className={`h-5 w-5 ${persona.accentColor}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-base">{persona.label}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                          {persona.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Focus Areas */}
                  <div className="flex flex-wrap gap-1.5">
                    {persona.focusAreas.slice(0, 4).map((area) => (
                      <Badge key={area} variant="outline" className={`text-[10px] px-1.5 py-0 ${persona.tagColor}`}>
                        {area}
                      </Badge>
                    ))}
                    {persona.focusAreas.length > 4 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                        +{persona.focusAreas.length - 4}
                      </Badge>
                    )}
                  </div>

                  {/* Sample Quick Take */}
                  <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Sample Quick Take</p>
                    <p className="text-xs text-foreground/80 leading-relaxed line-clamp-3">
                      {persona.sampleQuickTake}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={(e) => { e.stopPropagation(); setPreviewPersona(persona); }}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        toast.success(`${persona.label} persona selected`, {
                          description: "Creating a new project with this persona",
                        });
                        navigate(`/projects/new?persona=${persona.id}`);
                      }}
                    >
                      Use This
                      <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* User Custom Templates */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-400" />
          Your Custom Templates
        </h2>
        {loadingUserTemplates ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2].map(i => <div key={i} className="h-28 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : userTemplates && userTemplates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {userTemplates.map((template) => {
              const IconComp = getIconComponent(template.icon);
              return (
              <Card key={template.id} className={`hover:border-primary/30 transition-colors ${template.isDefault ? "border-amber-500/30" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                      <IconComp className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">{template.name}</h3>
                        {template.isDefault && (
                          <Badge variant="secondary" className="text-amber-400 text-[10px] gap-0.5">
                            <Star className="h-2.5 w-2.5" /> Default
                          </Badge>
                        )}
                      </div>
                      {template.description && (
                        <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(template.focusAreas as string[]).slice(0, 4).map(area => (
                          <Badge key={area} variant="outline" className="text-[10px] px-1.5 py-0">{area}</Badge>
                        ))}
                        {(template.focusAreas as string[]).length > 4 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                            +{(template.focusAreas as string[]).length - 4}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs shrink-0" onClick={() => navigate("/templates")}>
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                Create custom templates to fine-tune what the AI focuses on during reviews.
              </p>
              <Button variant="outline" size="sm" onClick={() => navigate("/templates")}>
                <Plus className="h-4 w-4 mr-1" />
                Create Template
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Scoring Dimensions Reference */}
      <div className="bg-muted/20 rounded-xl border border-border/50 p-6">
        <h2 className="text-lg font-semibold mb-3">How Personas Shape Reviews</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          Each persona changes three things about how Troubadour reviews your music:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <h3 className="text-sm font-medium">What It Listens For</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The audio analysis engine receives persona-specific instructions about what to pay attention to in your audio.
            </p>
          </div>
          <div className="space-y-1.5">
            <h3 className="text-sm font-medium">How It Scores</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Each persona uses different scoring dimensions. A Producer scores Mix Balance; a Songwriter scores Melody & Hooks.
            </p>
          </div>
          <div className="space-y-1.5">
            <h3 className="text-sm font-medium">What It Writes</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The review structure and language adapt to the persona's expertise. Technical terms match the reviewer's domain.
            </p>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      <Dialog open={!!previewPersona} onOpenChange={(open) => { if (!open) setPreviewPersona(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {previewPersona && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${previewPersona.color}`}>
                    <previewPersona.icon className={`h-5 w-5 ${previewPersona.accentColor}`} />
                  </div>
                  {previewPersona.label} — Sample Review
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                {/* Scoring Dimensions */}
                <div>
                  <h3 className="text-sm font-medium mb-2">Scoring Dimensions</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {previewPersona.scoringDimensions.map((dim) => (
                      <Badge key={dim} variant="outline" className={`text-xs ${previewPersona.tagColor}`}>
                        {dim}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Quick Take */}
                <div>
                  <h3 className="text-sm font-medium mb-2">Quick Take</h3>
                  <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                    <p className="text-sm text-foreground/90 leading-relaxed">
                      {previewPersona.sampleQuickTake}
                    </p>
                  </div>
                </div>

                {/* Sample Review Excerpt */}
                <div>
                  <h3 className="text-sm font-medium mb-2">Review Excerpt</h3>
                  <div className="bg-muted/30 rounded-lg p-4 border border-border/50 prose prose-sm prose-invert max-w-none">
                    {previewPersona.sampleExcerpt.split("\n").map((line, i) => {
                      if (line.startsWith("### ")) {
                        return <h4 key={i} className="text-sm font-semibold mt-3 mb-1 text-foreground">{line.replace("### ", "")}</h4>;
                      }
                      if (line.startsWith("- **")) {
                        const match = line.match(/- \*\*(.+?)\*\* — (.+)/);
                        if (match) {
                          return (
                            <p key={i} className="text-sm text-foreground/80 ml-4 my-1">
                              <span className="font-medium text-foreground">{match[1]}</span>
                              <span className="text-muted-foreground"> — {match[2]}</span>
                            </p>
                          );
                        }
                      }
                      if (line.trim() === "") return <div key={i} className="h-2" />;
                      return <p key={i} className="text-sm text-foreground/80 leading-relaxed my-1">{line}</p>;
                    })}
                  </div>
                </div>

                {/* Use Button */}
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={() => {
                      setPreviewPersona(null);
                      toast.success(`${previewPersona.label} persona selected`, {
                        description: "Navigate to a project to use this persona for reviews",
                      });
                      navigate("/dashboard");
                    }}
                  >
                    Use {previewPersona.label} Persona
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
