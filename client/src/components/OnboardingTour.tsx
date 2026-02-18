import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import {
  X, ArrowRight, ArrowLeft, Music, Upload, BarChart3,
  Sparkles, CheckCircle2, Compass, Brain, Flame, Dna, TrendingUp
} from "lucide-react";

const TOUR_STORAGE_KEY = "troubadour-onboarding-complete";

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  targetSelector?: string;
  route?: string;
  position?: "top" | "bottom" | "left" | "right" | "center";
}

const tourSteps: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Troubadour",
    description: "Your AI-powered music review platform. Let's take a quick tour of the key features to help you get started.",
    icon: <Music className="h-6 w-6 text-primary" />,
    position: "center",
  },
  {
    id: "dashboard",
    title: "Your Dashboard",
    description: "This is your home base. You'll see all your projects, recent reviews, and quick stats at a glance. The sidebar gives you access to all features.",
    icon: <BarChart3 className="h-6 w-6 text-sky-400" />,
    route: "/",
    position: "center",
  },
  {
    id: "create-project",
    title: "Create a Project",
    description: "Start by creating a project — either a single track or a full album. Add details like genre, reference artists, and what you want the AI to focus on.",
    icon: <Sparkles className="h-6 w-6 text-amber-400" />,
    route: "/projects/new",
    position: "center",
  },
  {
    id: "upload-tracks",
    title: "Upload Your Tracks",
    description: "Drag and drop audio files into your project. Troubadour supports MP3, WAV, FLAC, and more. You can upload multiple tracks at once for album projects.",
    icon: <Upload className="h-6 w-6 text-emerald-400" />,
    position: "center",
  },
  {
    id: "review-results",
    title: "Get AI Reviews",
    description: "Click 'Review All' to get detailed AI critiques. Choose from different reviewer personas (Producer, A&R, Songwriter) and review lengths (Brief, Standard, Detailed).",
    icon: <BarChart3 className="h-6 w-6 text-violet-400" />,
    position: "center",
  },
  {
    id: "intelligence-suite",
    title: "Intelligence Suite",
    description: "Six powerful tools beyond reviews: track your Skill Progression over time, benchmark against your genre, check Release Readiness with traffic-light scoring, maintain Creative Streaks, discover your Artist DNA fingerprint, and explore Genre Intelligence. Find them all in the sidebar.",
    icon: <Brain className="h-6 w-6 text-cyan-400" />,
    position: "center",
  },
  {
    id: "explore",
    title: "Explore More Features",
    description: "Discover the Score Matrix, Project Insights, Sentiment Timeline, and more. Use Ctrl+K to open the Command Palette for quick navigation. Check the Digest page for weekly summaries.",
    icon: <Compass className="h-6 w-6 text-rose-400" />,
    position: "center",
  },
  {
    id: "complete",
    title: "You're All Set!",
    description: "You're ready to start getting AI-powered feedback on your music. Create your first project and upload a track to begin. You can replay this tour anytime from the sidebar.",
    icon: <CheckCircle2 className="h-6 w-6 text-emerald-400" />,
    position: "center",
  },
];

interface OnboardingTourProps {
  forceShow?: boolean;
  onComplete?: () => void;
}

export function OnboardingTour({ forceShow = false, onComplete }: OnboardingTourProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (forceShow) {
      setIsActive(true);
      setCurrentStep(0);
      return;
    }
    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!completed) {
      // Auto-start for new users after a short delay
      const timer = setTimeout(() => setIsActive(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [forceShow]);

  const completeTour = useCallback(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
    setIsActive(false);
    onComplete?.();
  }, [onComplete]);

  const nextStep = useCallback(() => {
    if (currentStep < tourSteps.length - 1) {
      const next = tourSteps[currentStep + 1];
      if (next.route) {
        setLocation(next.route);
      }
      setCurrentStep(currentStep + 1);
    } else {
      completeTour();
    }
  }, [currentStep, completeTour, setLocation]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      const prev = tourSteps[currentStep - 1];
      if (prev.route) {
        setLocation(prev.route);
      }
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep, setLocation]);

  const skipTour = useCallback(() => {
    completeTour();
  }, [completeTour]);

  if (!isActive) return null;

  const step = tourSteps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === tourSteps.length - 1;
  const progress = ((currentStep + 1) / tourSteps.length) * 100;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={skipTour}
      />

      {/* Tour Card */}
      <Card className="relative z-10 w-full max-w-md mx-4 shadow-2xl border-primary/20 animate-in fade-in zoom-in-95 duration-300">
        <CardContent className="pt-6 pb-4">
          {/* Close button */}
          <button
            onClick={skipTour}
            className="absolute top-3 right-3 text-muted-foreground/60 hover:text-foreground transition-colors"
            aria-label="Skip tour"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Progress bar */}
          <div className="w-full h-1 bg-muted rounded-full mb-6 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Step content */}
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                {step.icon}
              </div>
            </div>

            <div>
              <h3
                className="text-lg font-bold"
                style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
              >
                {step.title}
              </h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                {step.description}
              </p>
            </div>

            {/* Step indicator */}
            <div className="flex justify-center gap-1.5 py-2">
              {tourSteps.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentStep
                      ? "w-6 bg-primary"
                      : idx < currentStep
                        ? "w-1.5 bg-primary/40"
                        : "w-1.5 bg-muted-foreground/20"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
            <div>
              {!isFirst && (
                <Button variant="ghost" size="sm" onClick={prevStep}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
              {isFirst && (
                <Button variant="ghost" size="sm" onClick={skipTour} className="text-muted-foreground">
                  Skip Tour
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground/60">
              {currentStep + 1} of {tourSteps.length}
            </p>

            <Button size="sm" onClick={nextStep}>
              {isLast ? (
                <>
                  Get Started
                  <CheckCircle2 className="h-4 w-4 ml-1" />
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Hook for checking if tour is complete
export function useTourComplete() {
  const [complete, setComplete] = useState(() =>
    localStorage.getItem(TOUR_STORAGE_KEY) === "true"
  );

  const resetTour = useCallback(() => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    setComplete(false);
  }, []);

  return { complete, resetTour };
}
