import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, PenLine, Sliders, Layers, Mic, Briefcase, Star } from "lucide-react";
import { trackProjectCreated } from "@/lib/analytics";

type ReviewFocus = "songwriter" | "producer" | "arranger" | "artist" | "anr" | "full";

const focusOptions: Array<{
  value: ReviewFocus;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}> = [
  {
    value: "songwriter",
    label: "Songwriter",
    description: "Melody, lyrics, hooks, song structure, and emotional arc",
    icon: PenLine,
    color: "text-amber-400 border-amber-400/30 bg-amber-400/5",
  },
  {
    value: "producer",
    label: "Producer / Mix Engineer",
    description: "Mix quality, frequency balance, dynamics, spatial characteristics",
    icon: Sliders,
    color: "text-sky-400 border-sky-400/30 bg-sky-400/5",
  },
  {
    value: "arranger",
    label: "Arranger",
    description: "Instrumentation, layering, transitions, musical architecture",
    icon: Layers,
    color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/5",
  },
  {
    value: "artist",
    label: "Artist / Performer",
    description: "Vocal delivery, performance energy, emotional authenticity",
    icon: Mic,
    color: "text-rose-400 border-rose-400/30 bg-rose-400/5",
  },
  {
    value: "anr",
    label: "A&R / Label",
    description: "Commercial potential, market positioning, singles picks, strategy",
    icon: Briefcase,
    color: "text-violet-400 border-violet-400/30 bg-violet-400/5",
  },
  {
    value: "full",
    label: "Full Review",
    description: "Comprehensive critique covering all dimensions",
    icon: Star,
    color: "text-primary border-primary/30 bg-primary/5",
  },
];

export default function NewProject() {
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"single" | "album">("single");
  const [description, setDescription] = useState("");
  const [intentNotes, setIntentNotes] = useState("");
  const [referenceArtists, setReferenceArtists] = useState("");
  const [reviewFocus, setReviewFocus] = useState<ReviewFocus>("full");

  const createProject = trpc.project.create.useMutation({
    onSuccess: (data) => {
      trackProjectCreated(data.id, title.trim());
      toast.success("Project created");
      setLocation(`/projects/${data.id}`);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Project title is required");
      return;
    }
    createProject.mutate({
      title: title.trim(),
      type,
      description: description.trim() || undefined,
      intentNotes: intentNotes.trim() || undefined,
      referenceArtists: referenceArtists.trim() || undefined,
      reviewFocus,
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>New Project</h1>
          <p className="text-muted-foreground text-sm">Set up your music project for AI-powered feedback</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Who are you? */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What kind of feedback do you need?</CardTitle>
            <CardDescription>
              This guides what the engine listens for in your audio and what the critique focuses on.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {focusOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = reviewFocus === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setReviewFocus(opt.value)}
                    className={`relative flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all hover:shadow-md ${
                      isSelected
                        ? `${opt.color} border-current shadow-md ring-1 ring-current/20`
                        : "border-border/50 hover:border-border"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`h-5 w-5 ${isSelected ? "" : "text-muted-foreground"}`} />
                      <span className={`font-semibold text-sm ${isSelected ? "" : "text-foreground"}`}>
                        {opt.label}
                      </span>
                    </div>
                    <p className={`text-xs leading-relaxed ${isSelected ? "text-foreground/80" : "text-muted-foreground"}`}>
                      {opt.description}
                    </p>
                    {isSelected && (
                      <Badge variant="outline" className="absolute top-2 right-2 text-[10px] px-1.5 py-0">
                        Selected
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Project Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Project Details</CardTitle>
            <CardDescription>
              The more context you provide, the more tailored the critique.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">Project Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Midnight Sessions EP"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Project Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as "single" | "album")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single / Track</SelectItem>
                  <SelectItem value="album">Album / EP</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Genre is automatically detected when we listen to your audio.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of the project..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="intent">
                {reviewFocus === "songwriter" ? "What are you trying to say with this song?" :
                 reviewFocus === "producer" ? "What's the sonic vision? Any mix references?" :
                 reviewFocus === "arranger" ? "What's the arrangement concept? Any structural goals?" :
                 reviewFocus === "artist" ? "What emotion are you going for? What's the performance intent?" :
                 reviewFocus === "anr" ? "What's the release strategy? Target audience?" :
                 "Artist Intent / Goals"}
              </Label>
              <Textarea
                id="intent"
                placeholder={
                  reviewFocus === "songwriter" ? "What's the emotional core? What story are you telling? What do you want the listener to feel?" :
                  reviewFocus === "producer" ? "What's the sonic reference? What vibe are you going for in the mix? Any specific production goals?" :
                  reviewFocus === "arranger" ? "What's the arrangement vision? Are you going for sparse or dense? Any structural experiments?" :
                  reviewFocus === "artist" ? "What emotion are you channeling? What's the performance approach? Raw or polished?" :
                  reviewFocus === "anr" ? "Who's the target listener? What playlists are you aiming for? What's the release timeline?" :
                  "What are you trying to achieve with this project? What kind of feedback are you looking for?"
                }
                value={intentNotes}
                onChange={(e) => setIntentNotes(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                This shapes the critique to match your specific needs as a {focusOptions.find(f => f.value === reviewFocus)?.label?.toLowerCase() || "creator"}.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="references">Reference Artists</Label>
              <Input
                id="references"
                placeholder="e.g., Frank Ocean, Radiohead, Tyler the Creator"
                value={referenceArtists}
                onChange={(e) => setReferenceArtists(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated. Helps understand your target sound and audience.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={createProject.isPending} size="lg">
                {createProject.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Project
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
