import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import {
  Music, Headphones, BarChart3, GitCompare, FileText, Zap, ArrowRight,
  PenLine, Sliders, Layers, Mic, TrendingUp, Star, Target, MessageCircle, Sparkles
} from "lucide-react";
import { useEffect, useState, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";

// ── Review Dimensions — every review covers all of these ──
const dimensions = [
  {
    id: "songwriting",
    label: "Songwriting & Melody",
    icon: PenLine,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    gradientFrom: "from-amber-500/20",
    headline: "Is your hook strong enough?",
    description: "Melody, lyric craft, emotional arc, and song structure — every review tells you which lines land and which need a rewrite.",
    bullets: [
      "Melody & hook memorability scoring",
      "Lyric craft analysis — prosody, imagery, cliche detection",
      "Emotional arc mapping across sections",
      "Specific rewrite suggestions, not vague encouragement",
    ],
  },
  {
    id: "production",
    label: "Production & Mix",
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
    id: "arrangement",
    label: "Arrangement & Structure",
    icon: Layers,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    gradientFrom: "from-emerald-500/20",
    headline: "Does your arrangement breathe?",
    description: "Layering, transitions, build and release, textural evolution — the architecture of your music evaluated section by section.",
    bullets: [
      "Section-by-section arrangement density map",
      "Transition quality assessment between sections",
      "Build & release pattern analysis",
      "Instrumentation and layering recommendations",
    ],
  },
  {
    id: "performance",
    label: "Performance & Delivery",
    icon: Mic,
    color: "text-rose-400",
    bg: "bg-rose-500/10 border-rose-500/20",
    gradientFrom: "from-rose-500/20",
    headline: "Does your performance connect?",
    description: "Vocal delivery, emotional authenticity, artistic identity, and presence. Know where you're connecting and where you're falling flat.",
    bullets: [
      "Vocal tone, pitch, and technique assessment",
      "Emotional authenticity evaluation",
      "Artistic identity & distinctiveness analysis",
      "Performance development roadmap",
    ],
  },
  {
    id: "commercial",
    label: "Commercial Potential",
    icon: TrendingUp,
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
    gradientFrom: "from-violet-500/20",
    headline: "Is this a hit or a miss?",
    description: "Commercial potential, playlist readiness, sync opportunities, and market positioning — the A&R memo you'd write, but faster.",
    bullets: [
      "Skip test — first 7 seconds analysis",
      "Playlist & market positioning strategy",
      "Sync potential for film, TV, and ads",
      "Artist development & release strategy notes",
    ],
  },
];

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [activeDim, setActiveDim] = useState(0);

  // Auto-rotate dimensions — reset timer when user clicks
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveDim((prev) => (prev + 1) % dimensions.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [activeDim]);

  const currentDim = dimensions[activeDim];

  /** Navigate logged-in users to /projects/new, others to login */
  const handleGetStarted = useCallback(() => {
    if (user) {
      setLocation("/projects/new");
    } else {
      window.location.href = getLoginUrl();
    }
  }, [user, setLocation]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center shadow-sm">
              <Music className="h-4.5 w-4.5 text-primary" />
            </div>
            <span className="font-bold text-lg tracking-tight" style={{ fontFamily: "'UnifrakturMaguntia', 'Space Grotesk', system-ui, sans-serif" }}>Troubadour</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
            {user ? (
              <Button onClick={() => setLocation("/dashboard")} variant="default" size="sm" className="shadow-md shadow-primary/20">
                Go to Dashboard
              </Button>
            ) : (
              <Button onClick={() => { window.location.href = getLoginUrl(); }} variant="default" size="sm" className="shadow-md shadow-primary/20">
                Get Started
              </Button>
            )}
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
            <span className="bg-gradient-to-r from-red-500 via-amber-400 to-red-500 bg-clip-text text-transparent">listens</span>{" "}
            to your music
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Upload your tracks. Get a comprehensive critique covering songwriting, production, arrangement, performance, and commercial potential — all in one review.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={handleGetStarted} className="text-base px-8 h-12 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all">
              {user ? "Create New Project" : "Start Your First Review"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Social Proof Stats Bar */}
      <SocialProofBar />

      {/* What Your Review Covers — Dimension Carousel */}
      <section className="py-24 border-t border-border/30">
        <div className="container max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>Every review covers everything</h2>
          <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
            No need to choose a focus. Every critique covers all five dimensions — so nothing gets missed.
          </p>

          {/* Dimension Selector Tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-10" role="tablist" aria-label="Review dimensions">
            {dimensions.map((dim, i) => {
              const Icon = dim.icon;
              const isActive = i === activeDim;
              return (
                <button
                  key={dim.id}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`dim-panel-${dim.id}`}
                  id={`dim-tab-${dim.id}`}
                  onClick={() => setActiveDim(i)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    isActive
                      ? `${dim.bg} ${dim.color} border-current shadow-lg`
                      : "border-border/40 text-muted-foreground hover:text-foreground hover:border-border/60 hover:bg-card/50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{dim.label}</span>
                </button>
              );
            })}
          </div>

          {/* Active Dimension Content */}
          <div
            role="tabpanel"
            id={`dim-panel-${currentDim.id}`}
            aria-labelledby={`dim-tab-${currentDim.id}`}
            className={`rounded-2xl border-2 p-8 md:p-10 transition-all ${currentDim.bg}`}
          >
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <currentDim.icon className={`h-6 w-6 ${currentDim.color}`} />
                  <span className={`text-sm font-semibold uppercase tracking-wider ${currentDim.color}`}>
                    {currentDim.label}
                  </span>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold mb-4" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>{currentDim.headline}</h3>
                <p className="text-muted-foreground leading-relaxed mb-6">{currentDim.description}</p>
                <Button onClick={handleGetStarted} className="group shadow-md shadow-primary/20">
                  {user ? "Create New Project" : "Try it now"}
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </div>
              <div className="space-y-3">
                {currentDim.bullets.map((bullet, j) => (
                  <div key={j} className="flex items-start gap-3 p-3 rounded-xl bg-background/50 border border-border/30 backdrop-blur-sm">
                    <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${currentDim.bg}`}>
                      <Star className={`h-3 w-3 ${currentDim.color}`} />
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
              { step: "01", title: "Upload Your Audio", description: "Drop your tracks — singles or full albums. Add context like genre, reference artists, and what you're going for.", icon: Music, gradient: "from-sky-500/15 to-sky-500/5", iconColor: "text-sky-400" },
              { step: "02", title: "Engine Listens", description: "Your audio is analyzed for tempo, key, sections, instrumentation, mix quality, energy curves, and more.", icon: Headphones, gradient: "from-violet-500/15 to-violet-500/5", iconColor: "text-violet-400" },
              { step: "03", title: "Comprehensive Critique", description: "A detailed review covering every dimension — songwriting, production, arrangement, performance, and commercial potential.", icon: FileText, gradient: "from-emerald-500/15 to-emerald-500/5", iconColor: "text-emerald-400" },
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

      {/* Deep Analysis Callout */}
      <section className="py-16 border-t border-border/30">
        <div className="container max-w-5xl mx-auto">
          <div className="rounded-2xl border-2 border-violet-500/25 bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent p-8 md:p-10">
            <div className="grid md:grid-cols-[1fr_auto] gap-8 items-center">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-5 w-5 text-violet-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-violet-400">Album-Level Intelligence</span>
                </div>
                <h3 className="text-2xl font-bold mb-3" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>Full album analysis, not just tracks</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Upload an entire album and get track-by-track reviews plus album-level analysis — sequencing, singles picks, thematic cohesion, and a comprehensive A&R memo. The critique you'd write, but in minutes.
                </p>
              </div>
              <Button size="lg" onClick={handleGetStarted} className="bg-violet-500 hover:bg-violet-600 text-white shrink-0 shadow-lg shadow-violet-500/25">
                {user ? "Create New Project" : "Try It Free"}
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
              { icon: BarChart3, title: "Multi-Dimensional Scoring", desc: "Every review scores across songwriting, production, arrangement, performance, and commercial potential — the full picture in one critique." },
              { icon: GitCompare, title: "Version Comparison", desc: "Upload v2 of a track. Both versions compared side-by-side. See exactly what improved and what regressed." },
              { icon: FileText, title: "Album A&R Memos", desc: "Full album-level analysis: sequencing, singles picks, thematic cohesion, market positioning, and producer notes." },
              { icon: Music, title: "Section-by-Section", desc: "Every intro, verse, chorus, and bridge analyzed with timestamps, energy levels, and specific notes." },
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
            Stop guessing. Get a comprehensive critique grounded in what the engine actually heard.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
            <Button size="lg" onClick={handleGetStarted} className="text-base px-8 h-12 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all">
              {user ? "Create New Project" : "Get Started Free"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <a href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4">
              View Pricing Plans
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border/30">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <Music className="h-5 w-5 text-primary" />
                <span className="text-lg font-bold" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>Troubadour</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                AI-powered music critique for artists who want honest, actionable feedback. Every review is generated by AI — use it as a creative tool alongside your own musical instincts.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-sm font-semibold mb-3" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</a></li>
                <li><a href="/support" className="hover:text-foreground transition-colors">Support</a></li>
                <li><a href="/changelog" className="hover:text-foreground transition-colors">What's New</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-sm font-semibold mb-3" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/terms" className="hover:text-foreground transition-colors">Terms of Service</a></li>
                <li><a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
                <li><a href="/support" className="hover:text-foreground transition-colors">Help & Support</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border/20 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} Troubadour. All reviews are AI-generated.
            </p>
            <p className="text-xs text-muted-foreground/60">
              Built for musicians, by music lovers.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Animated counter for social proof stats */
function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target <= 0) return;
    const duration = 1500;
    const steps = 40;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [target]);

  const formatted = count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
  return <span>{formatted}{suffix}</span>;
}

/** Social proof bar showing platform stats */
function SocialProofBar() {
  const { data: stats } = trpc.platform.stats.useQuery(undefined, {
    staleTime: 60_000, // Cache for 1 minute
    refetchOnWindowFocus: false,
  });

  // Only show if there's meaningful data
  const hasData = stats && (stats.totalReviews > 0 || stats.totalTracks > 0);

  // Minimum display values for social proof (show real data or reasonable minimums)
  const displayReviews = Math.max(stats?.totalReviews ?? 0, 0);
  const displayTracks = Math.max(stats?.totalTracks ?? 0, 0);
  const displayProjects = Math.max(stats?.totalProjects ?? 0, 0);

  return (
    <section className="py-8 border-t border-b border-border/20 bg-muted/20">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <p className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
              {hasData ? <AnimatedCounter target={displayReviews} /> : <span className="text-muted-foreground/40">&mdash;</span>}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Reviews Generated</p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
              {hasData ? <AnimatedCounter target={displayTracks} /> : <span className="text-muted-foreground/40">&mdash;</span>}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Tracks Analyzed</p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
              {hasData ? <AnimatedCounter target={displayProjects} /> : <span className="text-muted-foreground/40">&mdash;</span>}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Projects Created</p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
              5
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Review Dimensions</p>
          </div>
        </div>

        {/* Trust signals */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 mt-6 pt-6 border-t border-border/10">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Secure & Private
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            Stripe Payments
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
            Free Tier Available
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            AI-Powered Analysis
          </div>
        </div>
      </div>
    </section>
  );
}
