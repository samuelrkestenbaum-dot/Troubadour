import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Music, Mic2, Sliders, Palette, Briefcase, Sparkles } from "lucide-react";
import { toast } from "sonner";

const ONBOARDING_DISMISSED_KEY = "persona-onboarding-dismissed";

const personas = [
  {
    id: "songwriter" as const,
    label: "Songwriter",
    description: "Focus on lyrics, melody, song structure, and emotional impact",
    icon: Music,
    gradient: "from-amber-500/20 to-orange-500/20",
    border: "border-amber-500/30",
    accent: "text-amber-400",
  },
  {
    id: "producer" as const,
    label: "Producer",
    description: "Focus on mix quality, sound design, arrangement, and sonic texture",
    icon: Sliders,
    gradient: "from-blue-500/20 to-cyan-500/20",
    border: "border-blue-500/30",
    accent: "text-blue-400",
  },
  {
    id: "artist" as const,
    label: "Artist",
    description: "Focus on artistic vision, identity, vocal performance, and branding",
    icon: Mic2,
    gradient: "from-purple-500/20 to-pink-500/20",
    border: "border-purple-500/30",
    accent: "text-purple-400",
  },
  {
    id: "arranger" as const,
    label: "Arranger",
    description: "Focus on instrumentation, harmonic choices, and musical dynamics",
    icon: Palette,
    gradient: "from-emerald-500/20 to-teal-500/20",
    border: "border-emerald-500/30",
    accent: "text-emerald-400",
  },
  {
    id: "anr" as const,
    label: "A&R Executive",
    description: "Focus on commercial viability, market fit, and release strategy",
    icon: Briefcase,
    gradient: "from-rose-500/20 to-red-500/20",
    border: "border-rose-500/30",
    accent: "text-rose-400",
  },
  {
    id: "full" as const,
    label: "Full Review",
    description: "Comprehensive analysis covering all aspects — great for general feedback",
    icon: Sparkles,
    gradient: "from-indigo-500/20 to-violet-500/20",
    border: "border-indigo-500/30",
    accent: "text-indigo-400",
  },
];

export function PersonaOnboarding() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const updatePreference = trpc.persona.updatePreference.useMutation({
    onSuccess: (data) => {
      const label = personas.find((p) => p.id === data.persona)?.label || data.persona;
      toast.success(`Persona set to ${label}`, {
        description: "You can change this anytime in Settings.",
      });
      localStorage.setItem(ONBOARDING_DISMISSED_KEY, "true");
      setOpen(false);
    },
    onError: () => {
      toast.error("Failed to save persona preference");
    },
  });

  useEffect(() => {
    if (!user) return;
    // Only show if user hasn't dismissed and still has the default persona
    const dismissed = localStorage.getItem(ONBOARDING_DISMISSED_KEY);
    if (dismissed === "true") return;
    // Check if user has the default "full" persona (never explicitly chose)
    if (user.preferredPersona && user.preferredPersona !== "full") return;
    // Small delay so it doesn't flash immediately on page load
    const timer = setTimeout(() => setOpen(true), 1500);
    return () => clearTimeout(timer);
  }, [user]);

  const handleSkip = () => {
    localStorage.setItem(ONBOARDING_DISMISSED_KEY, "true");
    setOpen(false);
  };

  const handleConfirm = () => {
    if (!selected) return;
    updatePreference.mutate({ persona: selected as any });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleSkip(); }}>
      <DialogContent className="sm:max-w-lg border-border/50 bg-background/95 backdrop-blur-xl">
        <DialogHeader className="text-center pb-2">
          <DialogTitle className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
            What's your role?
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm max-w-sm mx-auto">
            Choose your primary perspective. This personalizes your AI reviews to focus on what matters most to you.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-4">
          {personas.map((persona) => {
            const Icon = persona.icon;
            const isSelected = selected === persona.id;
            return (
              <button
                key={persona.id}
                onClick={() => setSelected(persona.id)}
                className={cn(
                  "relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all duration-200",
                  "hover:bg-accent/5 hover:border-accent/30",
                  isSelected
                    ? `bg-gradient-to-br ${persona.gradient} ${persona.border} border-2 shadow-sm`
                    : "border-border/40 bg-card/50"
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", isSelected ? persona.accent : "text-muted-foreground")} />
                  <span className={cn("text-sm font-semibold", isSelected ? "text-foreground" : "text-foreground/80")}>
                    {persona.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {persona.description}
                </p>
                {isSelected && (
                  <div className={cn("absolute top-2 right-2 h-2 w-2 rounded-full", persona.accent.replace("text-", "bg-"))} />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground text-xs">
            Skip for now
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selected || updatePreference.isPending}
            size="sm"
            className="px-6"
          >
            {updatePreference.isPending ? "Saving..." : "Continue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
