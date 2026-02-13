import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { Music, Headphones, BarChart3, GitCompare, FileText, Zap, ArrowRight } from "lucide-react";
import { useEffect } from "react";

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && user) {
      setLocation("/dashboard");
    }
  }, [loading, user, setLocation]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Music className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold text-lg tracking-tight">FirstSpin.ai</span>
          </div>
          <Button onClick={() => { window.location.href = getLoginUrl(); }} variant="default" size="sm">
            Get Started
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="container max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium mb-8">
            <Zap className="h-3.5 w-3.5" />
            AI-Powered Audio Intelligence
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            The AI that actually{" "}
            <span className="text-primary">listens</span>{" "}
            to your music
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Upload your tracks. Our engine analyzes the audio and writes the critique.
            Get production notes, A&R memos, and actionable feedback that proves the AI heard every bar.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => { window.location.href = getLoginUrl(); }} className="text-base px-8 h-12">
              Start Your First Review
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 border-t border-border/50">
        <div className="container max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">How It Works</h2>
          <p className="text-muted-foreground text-center mb-16 max-w-xl mx-auto">
            Upload. Analyze. Critique. A seamless pipeline from audio to actionable feedback.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Upload", description: "Drop your audio files \u2014 singles or full albums. MP3, WAV, M4A supported. Add lyrics and context if you want.", icon: Music },
              { step: "02", title: "AI Listens", description: "Our audio engine processes your actual audio \u2014 tempo, key, sections, instrumentation, mix quality, energy curves. No guessing.", icon: Headphones },
              { step: "03", title: "AI Critiques", description: "A detailed review grounded in what the engine heard. Scores, section notes, A&R recommendations, and a next-iteration checklist.", icon: FileText },
            ].map((item) => (
              <div key={item.step} className="relative p-6 rounded-xl border border-border bg-card">
                <div className="text-xs font-mono text-primary/60 mb-4">{item.step}</div>
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 border-t border-border/50">
        <div className="container max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16">Everything You Need</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: BarChart3, title: "Multi-Dimension Scoring", desc: "Production, songwriting, melody, performance, originality, and commercial potential \u2014 each scored 1-10 with justification." },
              { icon: GitCompare, title: "Version Comparison", desc: "Upload v2 of a track. Both versions compared side-by-side. See exactly what improved and what regressed." },
              { icon: FileText, title: "Album A&R Memos", desc: "Full album-level analysis: sequencing, singles picks, thematic cohesion, market positioning, and producer notes." },
              { icon: Music, title: "Section-by-Section", desc: "Every intro, verse, chorus, and bridge analyzed with timestamps, energy levels, and specific production notes." },
              { icon: Headphones, title: "Lyrics Integration", desc: "Paste lyrics or auto-transcribe. Songwriting craft evaluated alongside the audio for a complete picture." },
              { icon: Zap, title: "Export & Share", desc: "Download your reviews as formatted reports. Track your improvement across iterations." },
            ].map((f) => (
              <div key={f.title} className="p-5 rounded-xl border border-border/60 bg-card/50 hover:bg-card transition-colors">
                <f.icon className="h-5 w-5 text-primary mb-3" />
                <h3 className="font-semibold mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-border/50">
        <div className="container max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready for honest feedback?</h2>
          <p className="text-muted-foreground mb-8">
            Stop guessing. Get AI-powered critique that references actual moments in your music.
          </p>
          <Button size="lg" onClick={() => { window.location.href = getLoginUrl(); }} className="text-base px-8 h-12">
            Get Started Free
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border/50">
        <div className="container text-center text-sm text-muted-foreground">
          FirstSpin.ai — AI that actually listens to your music.
        </div>
      </footer>
    </div>
  );
}
