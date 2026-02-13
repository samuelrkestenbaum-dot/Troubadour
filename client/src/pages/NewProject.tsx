import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function NewProject() {
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"single" | "album">("single");
  const [genre, setGenre] = useState("");
  const [description, setDescription] = useState("");
  const [intentNotes, setIntentNotes] = useState("");
  const [referenceArtists, setReferenceArtists] = useState("");

  const createProject = trpc.project.create.useMutation({
    onSuccess: (data) => {
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
      genre: genre.trim() || undefined,
      description: description.trim() || undefined,
      intentNotes: intentNotes.trim() || undefined,
      referenceArtists: referenceArtists.trim() || undefined,
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Project</h1>
          <p className="text-muted-foreground text-sm">Set up your music project for AI review</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>
              Tell us about your project. The more context you provide, the more tailored the critique.
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

            <div className="grid grid-cols-2 gap-4">
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="genre">Genre</Label>
                <Input
                  id="genre"
                  placeholder="e.g., Hip-Hop, Pop, Rock"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                />
              </div>
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
              <Label htmlFor="intent">Artist Intent / Goals</Label>
              <Textarea
                id="intent"
                placeholder="What are you trying to achieve with this project? What kind of feedback are you looking for?"
                value={intentNotes}
                onChange={(e) => setIntentNotes(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                This helps tailor the critique to your artistic vision and goals.
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
                Comma-separated. Helps the AI understand your target sound and audience.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={createProject.isPending}>
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
