import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Music, Mic2, Layers, UserCircle, TrendingUp, Sparkles,
  ArrowLeft, Eye, Plus, Star, ChevronRight, Zap
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { getIconComponent } from "./Templates";

// ── Review Sections — every review covers all of these ──
const REVIEW_SECTIONS = [
  {
    id: "songwriting",
    label: "Songwriting & Melody",
    icon: Music,
    color: "from-violet-500/20 to-purple-500/20",
    borderColor: "border-violet-500/30",
    accentColor: "text-violet-400",
    tagColor: "bg-violet-500/10 text-violet-300 border-violet-500/20",
    description: "Lyrics, melody, hooks, song structure, and emotional arc",
    focusAreas: ["Melody & Hooks", "Lyric Craft", "Song Structure", "Emotional Arc", "Chorus Lift", "Harmonic Movement"],
    sampleExcerpt: `### Songwriting & Melody

The melodic architecture here shows real sophistication. The verse melody sits in a comfortable mid-range that lets the lyrics breathe, then the pre-chorus lifts by a fourth to create genuine anticipation. When the chorus arrives, the leap to the upper register feels earned rather than forced.

Where the writing stumbles is in the bridge. After building such strong melodic momentum, the bridge retreats to a near-monotone delivery that deflates the energy. Consider rewriting the bridge melody to explore the highest register of the song.

**Top Changes:**
- **Rewrite the bridge melody** — push into unexplored melodic territory
- **Tighten the second verse lyrics** — lines 3-4 repeat the sentiment of verse one
- **Consider a post-chorus tag** — the chorus ends cleanly but a melodic tag could make it stickier`,
  },
  {
    id: "production",
    label: "Production & Mix",
    icon: Layers,
    color: "from-sky-500/20 to-cyan-500/20",
    borderColor: "border-sky-500/30",
    accentColor: "text-sky-400",
    tagColor: "bg-sky-500/10 text-sky-300 border-sky-500/20",
    description: "Mix quality, frequency balance, dynamics, spatial imaging, and production choices",
    focusAreas: ["Mix Balance", "Frequency Spectrum", "Dynamics & Compression", "Stereo Width", "Production Choices", "Arrangement Density"],
    sampleExcerpt: `### Production & Mix

The frequency balance across this mix is genuinely impressive. The kick-bass relationship is clean — the kick punches through around 60Hz while the bass fills the 80-120Hz range without masking. That separation doesn't happen by accident.

The vocal chain is doing most of the heavy lifting here. However, the 2-4kHz presence range feels slightly scooped, which pushes the vocal behind the guitars during the chorus. A gentle 1.5dB shelf at 3kHz would bring the vocal forward.

**Top Changes:**
- **Boost vocal presence at 3kHz** — a gentle 1.5dB shelf will cut through the chorus guitars
- **Check mono compatibility** — the wide reverb tails are causing phase cancellation below 200Hz
- **Tame the hi-hat bleed** — there's some 8kHz buildup from cymbal bleed in the vocal mic`,
  },
  {
    id: "arrangement",
    label: "Arrangement & Structure",
    icon: Sparkles,
    color: "from-emerald-500/20 to-teal-500/20",
    borderColor: "border-emerald-500/30",
    accentColor: "text-emerald-400",
    tagColor: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    description: "Musical architecture, instrumentation, layering, transitions, and sonic journey",
    focusAreas: ["Arrangement Arc", "Instrumentation", "Layering & Density", "Transitions", "Intro/Outro Design", "Dynamic Contrast"],
    sampleExcerpt: `### Arrangement & Structure

This arrangement understands the fundamental principle of contrast — the verse-to-chorus energy delta is substantial and satisfying. The verse strips down to acoustic guitar and vocal, then the pre-chorus layers in bass and a filtered synth, and the chorus explodes with full drums, electric guitars, and backing vocals.

The problem is the second verse. After the energy of the first chorus, the second verse needs to strip back even further to re-establish tension.

**Top Changes:**
- **Strip the second verse further** — remove bass, use only a sustained pad to rebuild tension
- **Replace the fade-out with a hard ending** — the final chord should ring and decay naturally
- **Add a counter-melody in the final chorus** — a simple horn or synth line would elevate the climax`,
  },
  {
    id: "performance",
    label: "Performance & Delivery",
    icon: UserCircle,
    color: "from-rose-500/20 to-pink-500/20",
    borderColor: "border-rose-500/30",
    accentColor: "text-rose-400",
    tagColor: "bg-rose-500/10 text-rose-300 border-rose-500/20",
    description: "Vocal delivery, performance energy, emotional authenticity, and artistic identity",
    focusAreas: ["Vocal Performance", "Emotional Authenticity", "Artistic Identity", "Performance Energy", "Phrasing & Delivery", "Growth Potential"],
    sampleExcerpt: `### Performance & Delivery

The most compelling thing about this performance is the contrast between the verse and chorus delivery. In the verses, there's a breathy, almost whispered quality that draws the listener in. Then the chorus opens up into a full-throated belt that's technically clean but emotionally different.

My instinct says the chorus would be more powerful at about 70% of the current intensity. The verse delivery is so intimate and distinctive that it's become this artist's signature sound.

**Top Changes:**
- **Pull back the chorus belt to 70%** — maintain the breathy signature even at higher intensity
- **Lean into the ad-lib style** — the outro ad-libs show the most personality; bring that energy earlier
- **Work on breath control in the bridge** — there are two audible gasps that break the flow`,
  },
  {
    id: "commercial",
    label: "Commercial Potential",
    icon: TrendingUp,
    color: "from-amber-500/20 to-orange-500/20",
    borderColor: "border-amber-500/30",
    accentColor: "text-amber-400",
    tagColor: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    description: "Market positioning, playlist strategy, audience development, and release timing",
    focusAreas: ["Commercial Viability", "Playlist Readiness", "Market Positioning", "Audience Appeal", "Release Timing", "Brand Potential"],
    sampleExcerpt: `### Commercial Potential

From a market positioning standpoint, this track sits in a sweet spot between bedroom pop and indie pop that's currently underserved on streaming platforms. The lo-fi production aesthetic is on-trend, but the songwriting sophistication elevates it above the typical bedroom pop release.

The challenge is differentiation. There are thousands of tracks in this sonic space, and the first 15 seconds need to immediately signal "this is different."

**Targeting & Strategy:**
- Position for New Music Friday consideration in the indie/alternative category
- Comparable artist profile: Clairo × beabadoobee × men i trust
- Target playlists: Indie Pop, Bedroom Pop, Chill Vibes, New Indie Mix
- Release timing: Tuesday drop with a 4-week pre-save campaign`,
  },
];

export default function TemplatesGallery() {
  const [, navigate] = useLocation();
  const { data: userTemplates, isLoading: loadingUserTemplates } = trpc.template.list.useQuery();
  const [previewSection, setPreviewSection] = useState<typeof REVIEW_SECTIONS[0] | null>(null);

  return (
    <div className="container max-w-5xl py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-heading">What's in a Review</h1>
            <p className="text-sm text-muted-foreground">
              Every review covers all of these dimensions — no need to choose
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate("/templates")}>
          <Plus className="h-4 w-4 mr-1.5" />
          Custom Templates
        </Button>
      </div>

      {/* Comprehensive Review Explainer */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10 shrink-0">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Comprehensive Reviews by Default</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Every review Troubadour writes covers <strong className="text-foreground">all five dimensions</strong> below — songwriting, production, arrangement, performance, and commercial potential. No need to pick a persona or filter. You get the full picture every time, organized into clear sections you can navigate.
              </p>
              <Button size="sm" className="mt-2" onClick={() => navigate("/projects/new")}>
                Start a Review
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Review Sections Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Mic2 className="h-5 w-5 text-primary" />
          Review Sections
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {REVIEW_SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <Card
                key={section.id}
                className={`group cursor-pointer hover:shadow-lg transition-all duration-300 ${section.borderColor} hover:border-primary/40`}
                onClick={() => setPreviewSection(section)}
              >
                <CardContent className="p-5 space-y-3">
                  {/* Icon + Title */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl bg-gradient-to-br ${section.color}`}>
                        <Icon className={`h-5 w-5 ${section.accentColor}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-base">{section.label}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                          {section.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Focus Areas */}
                  <div className="flex flex-wrap gap-1.5">
                    {section.focusAreas.slice(0, 4).map((area) => (
                      <Badge key={area} variant="outline" className={`text-[10px] px-1.5 py-0 ${section.tagColor}`}>
                        {area}
                      </Badge>
                    ))}
                    {section.focusAreas.length > 4 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                        +{section.focusAreas.length - 4}
                      </Badge>
                    )}
                  </div>

                  {/* Preview Button */}
                  <div className="pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={(e) => { e.stopPropagation(); setPreviewSection(section); }}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      See Sample
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
        <p className="text-sm text-muted-foreground mb-4">
          Custom templates let you fine-tune <em>additional</em> focus areas or add a custom system prompt — the comprehensive review still runs, but with extra emphasis where you want it.
        </p>
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
                Create custom templates to add extra focus areas or a custom system prompt to your reviews.
              </p>
              <Button variant="outline" size="sm" onClick={() => navigate("/templates")}>
                <Plus className="h-4 w-4 mr-1" />
                Create Template
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Preview Modal */}
      <Dialog open={!!previewSection} onOpenChange={(open) => { if (!open) setPreviewSection(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {previewSection && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${previewSection.color}`}>
                    <previewSection.icon className={`h-5 w-5 ${previewSection.accentColor}`} />
                  </div>
                  {previewSection.label} — Sample Review Section
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                {/* Focus Areas */}
                <div>
                  <h3 className="text-sm font-medium mb-2">What This Section Covers</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {previewSection.focusAreas.map((area) => (
                      <Badge key={area} variant="outline" className={`text-xs ${previewSection.tagColor}`}>
                        {area}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Sample Review Excerpt */}
                <div>
                  <h3 className="text-sm font-medium mb-2">Sample Review Excerpt</h3>
                  <div className="bg-muted/30 rounded-lg p-4 border border-border/50 prose prose-sm prose-invert max-w-none">
                    {previewSection.sampleExcerpt.split("\n").map((line, i) => {
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
                      if (line.startsWith("**")) {
                        return <p key={i} className="text-sm font-medium text-foreground mt-3 mb-1">{line.replace(/\*\*/g, "")}</p>;
                      }
                      if (line.trim() === "") return <div key={i} className="h-2" />;
                      return <p key={i} className="text-sm text-foreground/80 leading-relaxed my-1">{line}</p>;
                    })}
                  </div>
                </div>

                {/* CTA */}
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={() => {
                      setPreviewSection(null);
                      navigate("/projects/new");
                    }}
                  >
                    Start a Review
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
