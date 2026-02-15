import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Music, BarChart3, Zap, GitCompare, Brain, Keyboard, TrendingUp, FileSpreadsheet, Lightbulb, X } from "lucide-react";

const CHANGELOG_VERSION = "42";
const STORAGE_KEY = "troubadour-changelog-seen";

interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  highlights: { icon: React.ElementType; text: string; tag?: string }[];
}

const changelog: ChangelogEntry[] = [
  {
    version: "42",
    date: "Feb 2026",
    title: "Notification Center & Quality Indicators",
    highlights: [
      { icon: Sparkles, text: "In-app notification center with bell icon and unread badges", tag: "new" },
      { icon: BarChart3, text: "Review quality indicators — word count, freshness, and confidence scores", tag: "new" },
      { icon: Lightbulb, text: "What's New changelog — you're looking at it!", tag: "new" },
    ],
  },
  {
    version: "41",
    date: "Feb 2026",
    title: "Analytics Overhaul & Command Palette",
    highlights: [
      { icon: TrendingUp, text: "Score trend chart — track your improvement over weeks", tag: "new" },
      { icon: BarChart3, text: "Activity heatmap — see when you're most productive", tag: "new" },
      { icon: Brain, text: "Sentiment timeline — emotional arc across your project's reviews", tag: "new" },
      { icon: Keyboard, text: "Command palette — press Ctrl+K to navigate instantly", tag: "new" },
    ],
  },
  {
    version: "40",
    date: "Feb 2026",
    title: "Project Insights & Score Matrix",
    highlights: [
      { icon: Lightbulb, text: "AI-generated project insights — strengths, weaknesses, recommendations", tag: "new" },
      { icon: BarChart3, text: "Track score matrix — color-coded heatmap of all scores", tag: "new" },
      { icon: FileSpreadsheet, text: "CSV export — download all scores as a spreadsheet", tag: "new" },
    ],
  },
  {
    version: "39",
    date: "Feb 2026",
    title: "Review Length Toggle & Comparison",
    highlights: [
      { icon: Zap, text: "Review length toggle — Brief, Standard, or Detailed reviews", tag: "new" },
      { icon: GitCompare, text: "Side-by-side review comparison with score deltas", tag: "new" },
    ],
  },
  {
    version: "37-38",
    date: "Feb 2026",
    title: "Eight Major Features & Prompt Tightening",
    highlights: [
      { icon: Music, text: "Reference track comparison — compare your mix to a reference", tag: "new" },
      { icon: BarChart3, text: "AI Mix Feedback Report — technical mix notes with DAW actions", tag: "new" },
      { icon: Brain, text: "Song structure analysis — detect intro, verse, chorus, bridge", tag: "new" },
      { icon: TrendingUp, text: "Mood/energy curve visualization", tag: "new" },
      { icon: Music, text: "Waveform annotations — timestamped comments on the waveform", tag: "new" },
      { icon: BarChart3, text: "Genre benchmarking dashboard", tag: "new" },
      { icon: Zap, text: "Tighter, more focused review prompts (800-1200 words)", tag: "improved" },
    ],
  },
];

function getSeenVersion(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || "0";
  } catch {
    return "0";
  }
}

function markSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, CHANGELOG_VERSION);
  } catch { /* ignore */ }
}

export function useHasNewChangelog(): boolean {
  const [hasNew, setHasNew] = useState(false);
  useEffect(() => {
    const seen = getSeenVersion();
    setHasNew(seen !== CHANGELOG_VERSION);
  }, []);
  return hasNew;
}

export function WhatsNewModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  useEffect(() => {
    if (open) {
      markSeen();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
                  What's New
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Recent updates to Troubadour</p>
              </div>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="px-6 py-4 space-y-6">
            {changelog.map((entry) => (
              <div key={entry.version} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-mono">
                    v{entry.version}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{entry.date}</span>
                </div>
                <h3 className="text-sm font-semibold" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
                  {entry.title}
                </h3>
                <ul className="space-y-2">
                  {entry.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <h.icon className="h-4 w-4 shrink-0 mt-0.5 text-primary/70" />
                      <span className="flex-1">{h.text}</span>
                      {h.tag && (
                        <Badge
                          variant="secondary"
                          className={`text-[10px] px-1.5 py-0 shrink-0 ${
                            h.tag === "new" ? "bg-emerald-500/10 text-emerald-500" :
                            h.tag === "improved" ? "bg-sky-500/10 text-sky-500" :
                            ""
                          }`}
                        >
                          {h.tag}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
                {entry !== changelog[changelog.length - 1] && (
                  <div className="border-b pt-2" />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="px-6 py-4 border-t bg-muted/30">
          <Button onClick={() => onOpenChange(false)} className="w-full" size="sm">
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
