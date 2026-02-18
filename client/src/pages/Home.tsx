import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import {
  Music, Headphones, BarChart3, GitCompare, FileText, Zap, ArrowRight, Upload,
  PenLine, Sliders, Layers, Mic, TrendingUp, Star, Target, MessageCircle, Sparkles,
  GraduationCap, Swords, Rocket, Flame, Dna, Database, ChevronRight
} from "lucide-react";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, useInView } from "framer-motion";
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
            AI-Powered Music Intelligence
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
            Master Your Music.{" "}
            <span className="bg-gradient-to-r from-red-500 via-amber-400 to-red-500 bg-clip-text text-transparent">Grow</span>{" "}
            Your Sound.
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Troubadour delivers more than just feedback. Get actionable insights, track your artistic evolution, and make data-driven decisions for every release.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={handleGetStarted} className="text-base px-8 h-12 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all">
              {user ? "Create New Project" : "Get Your First AI Critique Free"}
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
          <h2 className="text-3xl font-bold text-center mb-4" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>Beyond Basic Feedback</h2>
          <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
            Our AI dives deep into every aspect of your track, giving you a comprehensive breakdown.
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
                { step: "01", title: "Upload Your Track", description: "Securely submit your audio file in seconds. We support all major formats.", icon: Upload, gradient: "from-amber-500/15 to-amber-500/5", iconColor: "text-amber-400" },
              { step: "02", title: "Instant AI Analysis", description: "Our AI processes your music, dissecting its core elements and potential.", icon: Headphones, gradient: "from-violet-500/15 to-violet-500/5", iconColor: "text-violet-400" },
              { step: "03", title: "Unlock Actionable Insights", description: "Receive a detailed report, skill tracking, and strategic intelligence for your next move.", icon: FileText, gradient: "from-emerald-500/15 to-emerald-500/5", iconColor: "text-emerald-400" },
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
                  <span className="text-xs font-semibold uppercase tracking-wider text-violet-400">AI Audio Reviews</span>
                </div>
                <h3 className="text-2xl font-bold mb-3" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>Your Personal A&R, On Demand</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Stop guessing. Troubadour provides comprehensive, unbiased critiques across songwriting, production, arrangement, performance, and commercial potential. Understand exactly what works and what needs refinement, so you can craft your best music yet.
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
          <h2 className="text-3xl font-bold text-center mb-16" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>What Troubadour Unlocks For You</h2>
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

      {/* ── Strategic Platform Features ── */}
      <StrategicFeaturesSection handleGetStarted={handleGetStarted} user={user} />



      {/* CTA */}
      <section className="py-24 border-t border-border/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/3 to-transparent" />
        <div className="container max-w-2xl mx-auto text-center relative">
          <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>Stop Guessing. Start Growing.</h2>
          <p className="text-muted-foreground mb-8 text-lg">
            The future of music feedback is here. Get the insights you need to refine your craft, understand your audience, and confidently release your best work.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
            <Button size="lg" onClick={handleGetStarted} className="text-base px-8 h-12 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all">
              {user ? "Create New Project" : "Get Your First AI Critique Free"}
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
                Your AI co-pilot for creative growth. Actionable insights, skill tracking, and strategic intelligence for every release.
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
              Your AI co-pilot for creative growth.
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


// ── Strategic Features Section with Animated Micro-Interactions ──

const strategicCards = [
  {
    icon: GraduationCap,
    title: "Skill Progression",
    subtitle: "Longitudinal Tracking",
    desc: "Watch your craft evolve. See how your songwriting, production, and arrangement skills improve over time with clear, per-dimension trend analysis.",
    cta: "Track your growth",
    color: "amber",
    borderClass: "border-amber-500/20 hover:border-amber-500/40",
    bgClass: "from-amber-500/10 via-amber-500/5 to-transparent",
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-400",
    ctaColor: "text-amber-400",
    glowColor: "group-hover:shadow-amber-500/10",
    miniChart: "skill", // animated mini-chart type
  },
  {
    icon: Swords,
    title: "Competitive Benchmarking",
    subtitle: "Genre Percentiles",
    desc: 'Position yourself strategically. Understand where your track stands against genre percentiles — "Your chorus energy is in the 82nd percentile of indie rock."',
    cta: "See your percentiles",
    color: "sky",
    borderClass: "border-sky-500/20 hover:border-sky-500/40",
    bgClass: "from-sky-500/10 via-sky-500/5 to-transparent",
    iconBg: "bg-sky-500/15",
    iconColor: "text-sky-400",
    ctaColor: "text-sky-400",
    glowColor: "group-hover:shadow-sky-500/10",
    miniChart: "gauge",
  },
  {
    icon: Rocket,
    title: "Release Readiness",
    subtitle: "Go / No-Go Scoring",
    desc: "Release with confidence, not anxiety. Get a clear go/no-go assessment (green, yellow, red) for your track, highlighting specific blockers before you launch.",
    cta: "Check release readiness",
    color: "emerald",
    borderClass: "border-emerald-500/20 hover:border-emerald-500/40",
    bgClass: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-400",
    ctaColor: "text-emerald-400",
    glowColor: "group-hover:shadow-emerald-500/10",
    miniChart: "traffic",
  },
  {
    icon: Flame,
    title: "Creative Streaks",
    subtitle: "Retention Engine",
    desc: "Build unstoppable momentum. Gamify your creative process with daily upload streaks, weekly goals, and milestones that keep you consistently creating.",
    cta: "Build your streak",
    color: "orange",
    borderClass: "border-orange-500/20 hover:border-orange-500/40",
    bgClass: "from-orange-500/10 via-orange-500/5 to-transparent",
    iconBg: "bg-orange-500/15",
    iconColor: "text-orange-400",
    ctaColor: "text-orange-400",
    glowColor: "group-hover:shadow-orange-500/10",
    miniChart: "streak",
  },
  {
    icon: Dna,
    title: "Artist DNA",
    subtitle: "Identity Fingerprint",
    desc: "Discover your unique sonic fingerprint. Troubadour maps your harmonic tendencies, melodic contour, rhythmic density, and emotional arc to define your evolving artistic identity.",
    cta: "Discover your DNA",
    color: "violet",
    borderClass: "border-violet-500/20 hover:border-violet-500/40",
    bgClass: "from-violet-500/10 via-violet-500/5 to-transparent",
    iconBg: "bg-violet-500/15",
    iconColor: "text-violet-400",
    ctaColor: "text-violet-400",
    glowColor: "group-hover:shadow-violet-500/10",
    miniChart: "radar",
  },
  {
    icon: Database,
    title: "Genre Intelligence",
    subtitle: "Data Flywheel",
    desc: "Navigate the musical landscape. See exactly where you fit within your genre, uncover your archetype, and compare your sound against established norms.",
    cta: "Explore the landscape",
    color: "rose",
    borderClass: "border-rose-500/20 hover:border-rose-500/40",
    bgClass: "from-rose-500/10 via-rose-500/5 to-transparent",
    iconBg: "bg-rose-500/15",
    iconColor: "text-rose-400",
    ctaColor: "text-rose-400",
    glowColor: "group-hover:shadow-rose-500/10",
    miniChart: "cluster",
  },
];

// Mini animated chart SVGs for each card type
function MiniChartAnimation({ type, color }: { type: string; color: string }) {
  const colorMap: Record<string, string> = {
    amber: "#f59e0b", sky: "#38bdf8", emerald: "#34d399",
    orange: "#fb923c", violet: "#a78bfa", rose: "#fb7185",
  };
  const c = colorMap[color] || "#888";

  if (type === "skill") {
    // Animated rising line chart
    return (
      <svg className="w-full h-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" viewBox="0 0 120 40" fill="none">
        <motion.path
          d="M5 35 L20 28 L35 30 L50 22 L65 18 L80 14 L95 10 L115 5"
          stroke={c}
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
        {[5, 20, 35, 50, 65, 80, 95, 115].map((x, i) => (
          <motion.circle
            key={i}
            cx={x}
            cy={[35, 28, 30, 22, 18, 14, 10, 5][i]}
            r="2"
            fill={c}
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            transition={{ delay: 0.15 * i, duration: 0.3 }}
          />
        ))}
      </svg>
    );
  }

  if (type === "gauge") {
    // Animated percentile gauge arc
    return (
      <svg className="w-full h-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" viewBox="0 0 120 40" fill="none">
        <path d="M15 35 A45 45 0 0 1 105 35" stroke={c} strokeWidth="3" strokeLinecap="round" opacity="0.15" />
        <motion.path
          d="M15 35 A45 45 0 0 1 105 35"
          stroke={c}
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 0.82 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
        <motion.text
          x="60"
          y="32"
          textAnchor="middle"
          fill={c}
          fontSize="11"
          fontWeight="bold"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
        >
          82nd
        </motion.text>
      </svg>
    );
  }

  if (type === "traffic") {
    // Animated traffic light
    return (
      <div className="flex items-center justify-center gap-3 h-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        {[
          { fill: "#ef4444", delay: 0.2 },
          { fill: "#eab308", delay: 0.5 },
          { fill: "#22c55e", delay: 0.8 },
        ].map((light, i) => (
          <motion.div
            key={i}
            className="w-6 h-6 rounded-full"
            style={{ backgroundColor: light.fill }}
            initial={{ scale: 0, opacity: 0 }}
            whileInView={{ scale: 1, opacity: i === 2 ? 1 : 0.25 }}
            transition={{ delay: light.delay, duration: 0.4, type: "spring" }}
          />
        ))}
      </div>
    );
  }

  if (type === "streak") {
    // Animated flame counter
    return (
      <div className="flex items-center justify-center gap-1.5 h-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        {[1, 2, 3, 4, 5, 6, 7].map((day) => (
          <motion.div
            key={day}
            className="w-3 rounded-sm"
            style={{ backgroundColor: c }}
            initial={{ height: 0, opacity: 0 }}
            whileInView={{ height: day <= 5 ? 8 + day * 4 : 8, opacity: day <= 5 ? 1 : 0.2 }}
            transition={{ delay: 0.1 * day, duration: 0.4, type: "spring" }}
          />
        ))}
      </div>
    );
  }

  if (type === "radar") {
    // Animated radar/spider chart
    return (
      <svg className="w-full h-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" viewBox="0 0 120 40" fill="none">
        <motion.polygon
          points="60,5 95,15 90,35 30,35 25,15"
          stroke={c}
          strokeWidth="1.5"
          fill={c}
          fillOpacity="0.1"
          initial={{ scale: 0, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ transformOrigin: "60px 20px" }}
        />
        {[
          [60, 5], [95, 15], [90, 35], [30, 35], [25, 15],
        ].map(([cx, cy], i) => (
          <motion.circle
            key={i}
            cx={cx}
            cy={cy}
            r="2.5"
            fill={c}
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            transition={{ delay: 0.8 + 0.1 * i, duration: 0.3 }}
          />
        ))}
      </svg>
    );
  }

  if (type === "cluster") {
    // Animated scatter cluster
    const dots = [
      [20, 12], [28, 18], [35, 10], [42, 22], [25, 25],
      [70, 15], [78, 20], [85, 12], [75, 28], [82, 25],
      [55, 32], [60, 28], [50, 35],
    ];
    return (
      <svg className="w-full h-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" viewBox="0 0 120 40" fill="none">
        {dots.map(([cx, cy], i) => (
          <motion.circle
            key={i}
            cx={cx}
            cy={cy}
            r={i < 5 ? 3 : i < 10 ? 3 : 2.5}
            fill={i < 5 ? c : i < 10 ? `${c}88` : `${c}55`}
            initial={{ scale: 0, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.05 * i, duration: 0.4, type: "spring" }}
          />
        ))}
      </svg>
    );
  }

  return null;
}

function StrategicFeaturesSection({ handleGetStarted, user }: { handleGetStarted: () => void; user: any }) {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  return (
    <section ref={sectionRef} className="py-24 border-t border-border/30 relative overflow-hidden">
      <div className="absolute top-1/3 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 left-0 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl" />
      <div className="container max-w-5xl mx-auto relative">
        {/* Section Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm font-medium mb-6 shadow-sm">
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </motion.div>
            Strategic Intelligence Suite
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
            Know Where You Stand.{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-sky-400 bg-clip-text text-transparent">Know Where You're Going.</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">
            Move beyond isolated feedback. Troubadour's intelligence suite gives you the strategic advantage to truly understand your music and career trajectory.
          </p>
        </motion.div>

        {/* Feature Showcase Cards — top 4 */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {strategicCards.slice(0, 4).map((card, i) => (
            <motion.div
              key={card.title}
              className={`group p-7 rounded-2xl border-2 ${card.borderClass} bg-gradient-to-br ${card.bgClass} transition-all duration-300 hover:shadow-xl ${card.glowColor} cursor-pointer`}
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.15 * i, duration: 0.6, ease: "easeOut" }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
            >
              <div className="flex items-center gap-3 mb-4">
                <motion.div
                  className={`h-11 w-11 rounded-xl ${card.iconBg} flex items-center justify-center`}
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                </motion.div>
                <div>
                  <h3 className="font-semibold text-lg" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>{card.title}</h3>
                  <span className={`text-xs ${card.ctaColor} font-medium`}>{card.subtitle}</span>
                </div>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-3">
                {card.desc}
              </p>
              {/* Animated mini-chart on hover */}
              <MiniChartAnimation type={card.miniChart} color={card.color} />
              <div className={`flex items-center gap-2 text-sm ${card.ctaColor} font-medium group-hover:gap-3 transition-all mt-2`}>
                <span>{card.cta}</span>
                <motion.div whileHover={{ x: 4 }} transition={{ type: "spring", stiffness: 400 }}>
                  <ChevronRight className="h-4 w-4" />
                </motion.div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom row: Artist DNA + Data Flywheel */}
        <div className="grid md:grid-cols-2 gap-6">
          {strategicCards.slice(4).map((card, i) => (
            <motion.div
              key={card.title}
              className={`group p-7 rounded-2xl border-2 ${card.borderClass} bg-gradient-to-br ${card.bgClass} transition-all duration-300 hover:shadow-xl ${card.glowColor} cursor-pointer`}
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.15 * (i + 4), duration: 0.6, ease: "easeOut" }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
            >
              <div className="flex items-center gap-3 mb-4">
                <motion.div
                  className={`h-11 w-11 rounded-xl ${card.iconBg} flex items-center justify-center`}
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                </motion.div>
                <div>
                  <h3 className="font-semibold text-lg" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>{card.title}</h3>
                  <span className={`text-xs ${card.ctaColor} font-medium`}>{card.subtitle}</span>
                </div>
              </div>
              <p className="text-muted-foreground leading-relaxed mb-3">
                {card.desc}
              </p>
              <MiniChartAnimation type={card.miniChart} color={card.color} />
              <div className={`flex items-center gap-2 text-sm ${card.ctaColor} font-medium group-hover:gap-3 transition-all mt-2`}>
                <span>{card.cta}</span>
                <motion.div whileHover={{ x: 4 }} transition={{ type: "spring", stiffness: 400 }}>
                  <ChevronRight className="h-4 w-4" />
                </motion.div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
