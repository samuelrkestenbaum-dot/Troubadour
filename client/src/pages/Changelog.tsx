import { Link } from "wouter";
import { ArrowLeft, Sparkles, Shield, Zap, Music, BarChart3, MessageSquare, FileText, Palette, CreditCard, Tag, Clock, Share2, Brain, Layers, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Release {
  version: string;
  date: string;
  title: string;
  type: "major" | "minor" | "patch";
  highlights: { icon: React.ReactNode; text: string }[];
}

const releases: Release[] = [
  {
    version: "3.6",
    date: "February 2026",
    title: "Help & Support Center",
    type: "minor",
    highlights: [
      { icon: <HelpCircle className="h-4 w-4" />, text: "Full Help & Support page with 13-question FAQ and contact form" },
      { icon: <BarChart3 className="h-4 w-4" />, text: "Live platform stats on the landing page with animated counters" },
      { icon: <Shield className="h-4 w-4" />, text: "Trust signals and social proof badges for new visitors" },
    ],
  },
  {
    version: "3.5",
    date: "February 2026",
    title: "Governance & Legal Compliance",
    type: "minor",
    highlights: [
      { icon: <FileText className="h-4 w-4" />, text: "Terms of Service and Privacy Policy pages" },
      { icon: <Shield className="h-4 w-4" />, text: "AI-generated content disclaimers on all reviews and exports" },
      { icon: <Sparkles className="h-4 w-4" />, text: "Comprehensive footer with legal links across all pages" },
    ],
  },
  {
    version: "3.4",
    date: "February 2026",
    title: "Action Mode Caching & PDF Export",
    type: "minor",
    highlights: [
      { icon: <Zap className="h-4 w-4" />, text: "Instant-load cached Action Modes — no repeat AI calls" },
      { icon: <FileText className="h-4 w-4" />, text: "Export any Action Mode as a branded PDF document" },
      { icon: <Layers className="h-4 w-4" />, text: "Bulk select and delete projects from the dashboard" },
    ],
  },
  {
    version: "3.3",
    date: "February 2026",
    title: "Action Modes — Reshape Your Reviews",
    type: "major",
    highlights: [
      { icon: <Brain className="h-4 w-4" />, text: "5 Action Modes: Session Prep, A&R Brief, Quick Pitch, Technical Deep-Dive, Full Picture" },
      { icon: <Sparkles className="h-4 w-4" />, text: "AI reshapes your review into role-specific formats on demand" },
      { icon: <Clock className="h-4 w-4" />, text: "Cached results for instant repeat access" },
    ],
  },
  {
    version: "3.2",
    date: "January 2026",
    title: "Templates & Quick Review",
    type: "major",
    highlights: [
      { icon: <FileText className="h-4 w-4" />, text: "Custom review templates with saved criteria and focus areas" },
      { icon: <Zap className="h-4 w-4" />, text: "Quick Review mode — get a focused critique in under 60 seconds" },
      { icon: <Layers className="h-4 w-4" />, text: "Template gallery with community-shared presets" },
    ],
  },
  {
    version: "3.1",
    date: "January 2026",
    title: "Collaboration & Sharing",
    type: "major",
    highlights: [
      { icon: <Share2 className="h-4 w-4" />, text: "Invite collaborators to projects with role-based permissions" },
      { icon: <MessageSquare className="h-4 w-4" />, text: "Review annotations — highlight and comment on specific sections" },
      { icon: <Music className="h-4 w-4" />, text: "A/B review comparison for side-by-side track evaluation" },
    ],
  },
  {
    version: "3.0",
    date: "January 2026",
    title: "Pro Tier & Stripe Payments",
    type: "major",
    highlights: [
      { icon: <CreditCard className="h-4 w-4" />, text: "Three-tier pricing: Free, Artist ($19/mo), and Pro ($49/mo)" },
      { icon: <Shield className="h-4 w-4" />, text: "Secure Stripe checkout with subscription management" },
      { icon: <Zap className="h-4 w-4" />, text: "Feature gating — unlock advanced tools as you upgrade" },
    ],
  },
  {
    version: "2.5",
    date: "January 2026",
    title: "Genre Benchmarks & Analytics",
    type: "minor",
    highlights: [
      { icon: <BarChart3 className="h-4 w-4" />, text: "Genre benchmark comparisons — see how your track stacks up" },
      { icon: <BarChart3 className="h-4 w-4" />, text: "Dashboard analytics with score distributions and trends" },
      { icon: <Tag className="h-4 w-4" />, text: "Tag system for organizing tracks (needs mixing, single candidate, etc.)" },
    ],
  },
  {
    version: "2.0",
    date: "January 2026",
    title: "Persistent AI Chat & Smart Re-Review",
    type: "major",
    highlights: [
      { icon: <MessageSquare className="h-4 w-4" />, text: "Context-aware AI chatbot sidebar on every project and track page" },
      { icon: <Brain className="h-4 w-4" />, text: "Smart re-review — AI remembers your previous critique and comments on changes" },
      { icon: <Clock className="h-4 w-4" />, text: "Review history timeline with version badges and score deltas" },
    ],
  },
  {
    version: "1.5",
    date: "December 2025",
    title: "Waveform Player & Batch Processing",
    type: "minor",
    highlights: [
      { icon: <Music className="h-4 w-4" />, text: "Interactive waveform visualization with click-to-seek playback" },
      { icon: <Zap className="h-4 w-4" />, text: "Batch review — queue all tracks in a project with one click" },
      { icon: <Share2 className="h-4 w-4" />, text: "Shareable review links with branded public pages" },
    ],
  },
  {
    version: "1.0",
    date: "December 2025",
    title: "Launch — AI-Powered Music Critique",
    type: "major",
    highlights: [
      { icon: <Music className="h-4 w-4" />, text: "Upload tracks and get multi-dimension AI critiques" },
      { icon: <Sparkles className="h-4 w-4" />, text: "5 review dimensions: Songwriting, Production, Arrangement, Performance, Commercial Potential" },
      { icon: <Palette className="h-4 w-4" />, text: "Role-based critique focus: Songwriter, Producer, Arranger, Artist, A&R" },
    ],
  },
];

function typeBadge(type: Release["type"]) {
  const map = {
    major: { label: "Major", className: "bg-primary/20 text-primary border-primary/30" },
    minor: { label: "Update", className: "bg-sky-500/20 text-sky-400 border-sky-500/30" },
    patch: { label: "Fix", className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  };
  const { label, className } = map[type];
  return <Badge variant="outline" className={`text-[10px] ${className}`}>{label}</Badge>;
}

export default function Changelog() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-3xl py-4 flex items-center gap-3">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold font-display">What's New</h1>
            <p className="text-sm text-muted-foreground">Release notes and feature updates</p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="container max-w-3xl py-8">
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border/50" />

          <div className="space-y-8">
            {releases.map((release, i) => (
              <div key={release.version} className="relative pl-12">
                {/* Dot on timeline */}
                <div className={`absolute left-[14px] top-1.5 h-[12px] w-[12px] rounded-full border-2 ${
                  i === 0
                    ? "bg-primary border-primary shadow-[0_0_8px_rgba(220,38,38,0.4)]"
                    : "bg-background border-muted-foreground/30"
                }`} />

                <div className="bg-card/50 border border-border/40 rounded-lg p-5 hover:border-border/70 transition-colors">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="font-mono text-sm font-semibold text-foreground">v{release.version}</span>
                    {typeBadge(release.type)}
                    <span className="text-xs text-muted-foreground ml-auto">{release.date}</span>
                  </div>
                  <h3 className="text-base font-semibold font-display mb-3">{release.title}</h3>
                  <ul className="space-y-2">
                    {release.highlights.map((h, j) => (
                      <li key={j} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                        <span className="text-foreground/60 mt-0.5 shrink-0">{h.icon}</span>
                        <span>{h.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>Troubadour is continuously improving. Have a feature request?</p>
          <Link href="/support" className="text-primary hover:underline">
            Let us know →
          </Link>
        </div>
      </div>
    </div>
  );
}
