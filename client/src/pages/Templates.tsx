import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Pencil, Trash2, Star, X,
  Music, Mic2, Layers, UserCircle, TrendingUp, Sparkles,
  Headphones, Radio, Guitar, Drum, Piano, Wand2,
  MessageSquare, Eye, Zap, BookOpen, Palette, Target,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

const SUGGESTED_FOCUS_AREAS = [
  "Mixing & Mastering", "Songwriting", "Vocal Performance", "Production Quality",
  "Arrangement", "Melody", "Harmony", "Rhythm & Groove", "Lyrics & Storytelling",
  "Sound Design", "Bass & Low End", "Stereo Imaging", "Dynamics",
  "Emotional Impact", "Commercial Viability", "Originality",
];

const ICON_OPTIONS = [
  { name: "music", icon: Music, label: "Music" },
  { name: "mic", icon: Mic2, label: "Mic" },
  { name: "layers", icon: Layers, label: "Layers" },
  { name: "user", icon: UserCircle, label: "User" },
  { name: "trending", icon: TrendingUp, label: "Trending" },
  { name: "sparkles", icon: Sparkles, label: "Sparkles" },
  { name: "headphones", icon: Headphones, label: "Headphones" },
  { name: "radio", icon: Radio, label: "Radio" },
  { name: "guitar", icon: Guitar, label: "Guitar" },
  { name: "drum", icon: Drum, label: "Drum" },
  { name: "piano", icon: Piano, label: "Piano" },
  { name: "wand", icon: Wand2, label: "Wand" },
  { name: "chat", icon: MessageSquare, label: "Chat" },
  { name: "eye", icon: Eye, label: "Eye" },
  { name: "zap", icon: Zap, label: "Zap" },
  { name: "book", icon: BookOpen, label: "Book" },
  { name: "palette", icon: Palette, label: "Palette" },
  { name: "target", icon: Target, label: "Target" },
];

export function getIconComponent(iconName: string | null | undefined) {
  const found = ICON_OPTIONS.find(o => o.name === iconName);
  return found?.icon || Music;
}

const PROMPT_EXAMPLES = [
  "You are a veteran mastering engineer with 20+ years of experience. Focus on loudness, dynamics, frequency balance, and how the mix translates across different playback systems. Reference industry standards and comparable releases.",
  "You are a Nashville songwriter who has written for major country artists. Focus on lyric craft, story arc, melodic hooks, and commercial appeal. Evaluate whether the song could work on country radio.",
  "You are a hip-hop producer known for innovative beats. Focus on drum patterns, 808s, sample selection, vocal processing, and how the production serves the artist's delivery style.",
];

function TemplateForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: { name: string; description: string; focusAreas: string[]; systemPrompt: string; icon: string; isDefault: boolean };
  onSave: (data: { name: string; description: string; focusAreas: string[]; systemPrompt?: string; icon?: string; isDefault: boolean }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [focusAreas, setFocusAreas] = useState<string[]>(initial?.focusAreas || []);
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt || "");
  const [selectedIcon, setSelectedIcon] = useState(initial?.icon || "music");
  const [isDefault, setIsDefault] = useState(initial?.isDefault || false);
  const [customArea, setCustomArea] = useState("");
  const [showPromptHelp, setShowPromptHelp] = useState(false);

  const addArea = (area: string) => {
    if (area && !focusAreas.includes(area)) {
      setFocusAreas([...focusAreas, area]);
    }
  };

  const removeArea = (area: string) => {
    setFocusAreas(focusAreas.filter(a => a !== area));
  };

  const addCustomArea = () => {
    if (customArea.trim()) {
      addArea(customArea.trim());
      setCustomArea("");
    }
  };

  return (
    <div className="space-y-5">
      {/* Name + Icon Row */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium">Template Name</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Mastering Engineer" className="mt-1" />
        </div>
      </div>

      {/* Icon Picker */}
      <div>
        <label className="text-sm font-medium">Icon</label>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {ICON_OPTIONS.map(opt => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.name}
                type="button"
                onClick={() => setSelectedIcon(opt.name)}
                className={`p-2 rounded-lg border transition-all ${
                  selectedIcon === opt.name
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
                title={opt.label}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="text-sm font-medium">Description (optional)</label>
        <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="What this template focuses on..." className="mt-1" />
      </div>

      {/* Focus Areas */}
      <div>
        <label className="text-sm font-medium">Focus Areas</label>
        <p className="text-xs text-muted-foreground mt-0.5">These guide what the AI pays attention to during reviews</p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {focusAreas.map(area => (
            <Badge key={area} variant="default" className="gap-1 cursor-pointer" onClick={() => removeArea(area)}>
              {area}
              <X className="h-3 w-3" />
            </Badge>
          ))}
        </div>

        <div className="flex gap-2 mt-2">
          <Input value={customArea} onChange={e => setCustomArea(e.target.value)} placeholder="Add custom focus area..."
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomArea(); } }} className="flex-1" />
          <Button variant="outline" size="sm" onClick={addCustomArea} disabled={!customArea.trim()}>Add</Button>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-3">
          {SUGGESTED_FOCUS_AREAS.filter(a => !focusAreas.includes(a)).map(area => (
            <Badge key={area} variant="outline" className="cursor-pointer hover:bg-accent transition-colors" onClick={() => addArea(area)}>
              + {area}
            </Badge>
          ))}
        </div>
      </div>

      {/* System Prompt */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Custom Persona Prompt (optional)</label>
          <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => setShowPromptHelp(!showPromptHelp)}>
            {showPromptHelp ? "Hide Examples" : "Show Examples"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Define a custom personality for the AI reviewer. This shapes the tone, expertise, and perspective of reviews.
        </p>
        <Textarea
          value={systemPrompt}
          onChange={e => setSystemPrompt(e.target.value)}
          placeholder="e.g., You are a veteran mastering engineer with 20+ years of experience..."
          className="mt-2 min-h-[100px] resize-y"
          maxLength={5000}
        />
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-muted-foreground">
            Leave empty to use the default AI reviewer persona
          </span>
          <span className="text-[10px] text-muted-foreground">{systemPrompt.length}/5000</span>
        </div>

        {showPromptHelp && (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Example prompts (click to use):</p>
            {PROMPT_EXAMPLES.map((example, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSystemPrompt(example)}
                className="w-full text-left p-3 rounded-lg border border-border/40 bg-muted/20 hover:bg-muted/40 transition-colors text-xs text-foreground/80 leading-relaxed"
              >
                {example}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Default checkbox */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="rounded" />
        <span className="text-sm">Set as default template</span>
      </label>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave({ name, description, focusAreas, systemPrompt: systemPrompt || undefined, icon: selectedIcon, isDefault })} disabled={saving || !name.trim() || focusAreas.length === 0}>
          {saving ? "Saving..." : "Save Template"}
        </Button>
      </div>
    </div>
  );
}

export default function Templates() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: templates, isLoading } = trpc.template.list.useQuery();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const createMutation = trpc.template.create.useMutation({
    onSuccess: () => {
      utils.template.list.invalidate();
      setShowCreate(false);
      toast.success("Template created");
    },
  });

  const updateMutation = trpc.template.update.useMutation({
    onSuccess: () => {
      utils.template.list.invalidate();
      setEditingId(null);
      toast.success("Template updated");
    },
  });

  const deleteMutation = trpc.template.delete.useMutation({
    onSuccess: () => {
      utils.template.list.invalidate();
      setDeleteId(null);
      toast.success("Template deleted");
    },
  });

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-heading">Review Templates</h1>
            <p className="text-sm text-muted-foreground">Create custom AI reviewer personas with unique expertise and focus</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/templates/gallery")}>
            Browse Gallery
          </Button>
          <Button onClick={() => setShowCreate(true)} disabled={showCreate}>
            <Plus className="h-4 w-4 mr-1" />
            New Template
          </Button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Create Custom Persona</CardTitle>
          </CardHeader>
          <CardContent>
            <TemplateForm
              onSave={data => createMutation.mutate(data)}
              onCancel={() => setShowCreate(false)}
              saving={createMutation.isPending}
            />
          </CardContent>
        </Card>
      )}

      {/* Templates list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted rounded animate-pulse" />)}
        </div>
      ) : templates && templates.length > 0 ? (
        <div className="space-y-3">
          {templates.map(template => {
            const IconComp = getIconComponent(template.icon);
            return (
              <Card key={template.id} className={template.isDefault ? "border-amber-500/50" : ""}>
                <CardContent className="p-4">
                  {editingId === template.id ? (
                    <TemplateForm
                      initial={{
                        name: template.name,
                        description: template.description || "",
                        focusAreas: template.focusAreas as string[],
                        systemPrompt: template.systemPrompt || "",
                        icon: template.icon || "music",
                        isDefault: template.isDefault,
                      }}
                      onSave={data => updateMutation.mutate({ id: template.id, ...data })}
                      onCancel={() => setEditingId(null)}
                      saving={updateMutation.isPending}
                    />
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="p-2 rounded-lg bg-primary/10 shrink-0 mt-0.5">
                          <IconComp className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{template.name}</h3>
                            {template.isDefault && (
                              <Badge variant="secondary" className="text-amber-400 gap-1">
                                <Star className="h-3 w-3" /> Default
                              </Badge>
                            )}
                          </div>
                          {template.description && (
                            <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                          )}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {(template.focusAreas as string[]).map(area => (
                              <Badge key={area} variant="outline" className="text-xs">{area}</Badge>
                            ))}
                          </div>
                          {template.systemPrompt && (
                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2 italic">
                              "{template.systemPrompt}"
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingId(template.id)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(template.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : !showCreate ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Wand2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold text-lg mb-2">Create Your First Custom Persona</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto text-sm">
              Define a unique AI reviewer with custom expertise, focus areas, and personality. Your persona will shape how Troubadour listens to and critiques your music.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Custom Persona
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteId !== null} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
