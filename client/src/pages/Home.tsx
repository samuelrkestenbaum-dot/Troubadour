import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import {
  Music, Headphones, BarChart3, GitCompare, FileText, Zap, ArrowRight,
  PenLine, Sliders, Layers, Mic, Briefcase, Star, Target, TrendingUp, MessageCircle, Sparkles
} from "lucide-react";
import { useEffect, useState } from "react";

const roles = [
  {
    id: "anr",
    label: "A&R & Labels",
    icon: Briefcase,
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
    gradientFrom: "from-violet-500/20",
    headline: "Is this a hit or a miss?",
    description: "Commercial potential, playlist readiness, sync opportunities, and market positioning. The internal A&R memo you'd write — but faster and backed by audio intelligence.",
    bullets: [
      "Skip test — first 7 seconds analysis",
      "Playlist & market positioning strategy",
      "Sync potential for film, TV, and ads",
      "Artist development & release strategy notes",
    ],
    featured: true,
  },
  {
    id: "songwriter",
    label: "Songwriters",
    icon: PenLine,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    gradientFrom: "from-amber-500/20",
    headline: "Is your hook strong enough?",
    description: "Get feedback on melody, lyric craft, emotional arc, and song structure. Know which lines land and which need a rewrite — before you play it for anyone else.",
    bullets: [
      "Melody & hook memorability scoring",
      "Lyric craft analysis — prosody, imagery, cliche detection",
      "Emotional arc mapping across sections",
      "Specific rewrite suggestions, not vague encouragement",
    ],
  },
  {
    id: "producer",
    label: "Producers",
    icon: Sliders,
    color: "text-sky-400",
    bg: "bg-sky-500/10 border-sky-500/20",
    gradientFrom: "from-sky-500/20",
    headline: "How does your mix stack up?",
    description: "Frequency balance, dynamic range, stereo image, vocal treatment — evaluated against professional standards in your genre.",
    bullets: [
      "Frequency distribution & masking analysis",
      "Dynamic range & loudness assessment",
      "Stereo width, depth, and mono compatibility",
      "Element-by-element mix notes with priority fixes",
    ],
  },
  {
    id: "arranger",
    label: "Arrangers",
    icon: Layers,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    gradientFrom: "from-emerald-500/20",
    headline: "Does your arrangement breathe?",
    description: "Layering, transitions, build and release, textural evolution — the architecture of your music evaluated section by section with timestamps.",
    bullets: [
      "Section-by-section arrangement density map",
      "Transition quality assessment between sections",
      "Build & release pattern analysis",
      "Instrumentation and layering recommendations",
    ],
  },
  {
    id: "artist",
    label: "Artists",
    icon: Mic,
    color: "text-rose-400",
    bg: "bg-rose-500/10 border-rose-500/20",
    gradientFrom: "from-rose-500/20",
    headline: "Does your performance connect?",
    description: "Vocal delivery, emotional authenticity, artistic identity, and stage-readiness. Know where you're connecting and where you're falling flat.",
    bullets: [
      "Vocal tone, pitch, and technique assessment",
      "Emotional authenticity evaluation",
      "Artistic identity & distinctiveness analysis",
      "Performance development roadmap",
    ],
  },
];

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [activeRole, setActiveRole] = useState(0);

  useEffect(() => {
    if (!loading && user) {
      setLocation("/dashboard");
    }
  }, [loading, user, setLocation]);

  // Auto-rotate roles
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveRole((prev) => (prev + 1) % roles.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const currentRole = roles[activeRole];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center shadow-sm">
              <Music className="h-4.5 w-4.5 text-primary" />
            </div>
            <span className="font-bold text-lg tracking-tight" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>FirstSpin.ai</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
            <Button onClick={() => { window.location.href = getLoginUrl(); }} variant="default" size="sm" className="shadow-md shadow-primary/20">
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-4 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-40 right-1/4 w-72 h-72 bg-violet-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-amber-500/3 rounded-full blur-3xl" />

        <div className="container max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium mb-8 shadow-sm shadow-primary/10">
            <Sparkles className="h-3.5 w-3.5" />
            AI-Powered Audio Intelligence
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
            The AI that actually{" "}
            <span className="bg-gradient-to-r from-primary via-amber-400 to-primary bg-clip-text text-transparent">listens</span>{" "}
            to your music
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Upload your tracks. Our engine analyzes the actual audio and writes the critique.
            Tailored feedback for songwriters, producers, arrangers, artists, and A&R — because each needs something different.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => { window.location.href = getLoginUrl(); }} className="text-base px-8 h-12 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all">
              Start Your First Review
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* User Stories — Role Carousel */}
      <section className="py-24 border-t border-border/30">
        <div className="container max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>Built for how you work</h2>
          <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
            Select your role. The engine adjusts what it listens for and what the critique focuses on.
          </p>

          {/* Role Selector Tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {roles.map((role, i) => {
              const Icon = role.icon;
              const isActive = i === activeRole;
              return (
                <button
                  key={role.id}
                  onClick={() => setActiveRole(i)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    isActive
                      ? `${role.bg} ${role.color} border-current shadow-lg`
                      : "border-border/40 text-muted-foreground hover:text-foreground hover:border-border/60 hover:bg-card/50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{role.label}</span>
                </button>
              );
            })}
          </div>

          {/* Active Role Content */}
          <div className={`rounded-2xl border-2 p-8 md:p-10 transition-all ${currentRole.bg}`}>
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <currentRole.icon className={`h-6 w-6 ${currentRole.color}`} />
                  <span className={`text-sm font-semibold uppercase tracking-wider ${currentRole.color}`}>
                    For {currentRole.label}
                  </span>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold mb-4" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>{currentRole.headline}</h3>
                <p className="text-muted-foreground leading-relaxed mb-6">{currentRole.description}</p>
                <Button onClick={() => { window.location.href = getLoginUrl(); }} className="group shadow-md shadow-primary/20">
                  Try it now
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </div>
              <div className="space-y-3">
                {currentRole.bullets.map((bullet, j) => (
                  <div key={j} className="flex items-start gap-3 p-3 rounded-xl bg-background/50 border border-border/30 backdrop-blur-sm">
                    <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${currentRole.bg}`}>
                      <Star className={`h-3 w-3 ${currentRole.color}`} />
                    </div>
                    <span className="text-sm text-foreground">{bullet}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 border-t border-border/30 relative overflow-hidden">
        <div className="absolute top-1/2 left-0 w-64 h-64 bg-primary/3 rounded-full blur-3xl -translate-y-1/2" />
        <div className="container max-w-5xl mx-auto relative">
          <h2 className="text-3xl font-bold text-center mb-4" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>How It Works</h2>
          <p className="text-muted-foreground text-center mb-16 max-w-xl mx-auto">
            Upload. Analyze. Critique. A seamless pipeline from audio to actionable feedback.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: "01", title: "Upload & Set Your Focus", description: "Drop your audio files and tell us who you are. Songwriter? Producer? A&R? The engine adapts to your needs.", icon: Music, gradient: "from-sky-500/15 to-sky-500/5", iconColor: "text-sky-400" },
              { step: "02", title: "Engine Listens", description: "Your audio is analyzed for tempo, key, sections, instrumentation, mix quality, energy curves — guided by your focus area.", icon: Headphones, gradient: "from-violet-500/15 to-violet-500/5", iconColor: "text-violet-400" },
              { step: "03", title: "Tailored Critique", description: "A detailed review grounded in what the engine heard, structured for your role. Scores, section notes, and a next-steps checklist.", icon: FileText, gradient: "from-emerald-500/15 to-emerald-500/5", iconColor: "text-emerald-400" },
            ].map((item) => (
              <div key={item.step} className="relative p-7 rounded-2xl border border-border/40 bg-card/80 hover:border-border/60 transition-all group">
                <div className="text-xs font-mono text-muted-foreground/50 mb-4">{item.step}</div>
                <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center mb-5 group-hover:scale-105 transition-transform`}>
                  <item.icon className={`h-6 w-6 ${item.iconColor}`} />
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* A&R Featured Callout */}
      <section className="py-16 border-t border-border/30">
        <div className="container max-w-5xl mx-auto">
          <div className="rounded-2xl border-2 border-violet-500/25 bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent p-8 md:p-10">
            <div className="grid md:grid-cols-[1fr_auto] gap-8 items-center">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Briefcase className="h-5 w-5 text-violet-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-violet-400">For A&R Professionals</span>
                </div>
                <h3 className="text-2xl font-bold mb-3" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>Your AI A&R desk</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Screen demos faster. Get an objective second opinion on commercial potential, playlist readiness, and sync opportunities. The critique you'd write — but in minutes, not hours.
                </p>
              </div>
              <Button size="lg" onClick={() => { window.location.href = getLoginUrl(); }} className="bg-violet-500 hover:bg-violet-600 text-white shrink-0 shadow-lg shadow-violet-500/25">
                Try A&R Mode
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 border-t border-border/30">
        <div className="container max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>Everything You Need</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: BarChart3, title: "Role-Aware Scoring", desc: "Scoring dimensions adapt to your role. Songwriters get melody & lyric scores. Producers get mix & frequency scores. A&R gets commercial potential." },
              { icon: GitCompare, title: "Version Comparison", desc: "Upload v2 of a track. Both versions compared side-by-side. See exactly what improved and what regressed." },
              { icon: FileText, title: "Album A&R Memos", desc: "Full album-level analysis: sequencing, singles picks, thematic cohesion, market positioning, and producer notes." },
              { icon: Music, title: "Section-by-Section", desc: "Every intro, verse, chorus, and bridge analyzed with timestamps, energy levels, and specific notes tailored to your focus." },
              { icon: Headphones, title: "Lyrics Integration", desc: "Paste lyrics or auto-transcribe. Songwriting craft evaluated alongside the audio for a complete picture." },
              { icon: Zap, title: "Export & Share", desc: "Download your reviews as formatted reports. Track your improvement across iterations." },
              { icon: Target, title: "Reference Comparison", desc: "Upload a reference track alongside yours. Get a side-by-side audio comparison showing exactly where your mix differs." },
              { icon: TrendingUp, title: "Progress Tracking", desc: "Visual score trajectory across versions. See which dimensions improved, which regressed, and what to focus on next." },
              { icon: MessageCircle, title: "Follow-Up Questions", desc: "Ask the engine to clarify any part of the review. 'What did you mean by the chorus not lifting?' — and get a grounded answer." },
            ].map((f) => (
              <div key={f.title} className="p-6 rounded-2xl border border-border/40 bg-card/50 hover:bg-card/80 hover:border-border/60 transition-all group">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 border-t border-border/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/3 to-transparent" />
        <div className="container max-w-2xl mx-auto text-center relative">
          <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>Ready for honest feedback?</h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Stop guessing. Get critique that's tailored to your role and grounded in what the engine actually heard.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <Button size="lg" onClick={() => { window.location.href = getLoginUrl(); }} className="text-base px-8 h-12 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all">
              Get Started Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <a href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4">
              View Pricing Plans
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border/30">
        <div className="container text-center text-sm text-muted-foreground">
          FirstSpin.ai — AI that actually listens to your music.
        </div>
      </footer>
    </div>
  );
}
