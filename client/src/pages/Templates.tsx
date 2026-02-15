import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Trash2, Star, X } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

const SUGGESTED_FOCUS_AREAS = [
  "Mixing & Mastering", "Songwriting", "Vocal Performance", "Production Quality",
  "Arrangement", "Melody", "Harmony", "Rhythm & Groove", "Lyrics & Storytelling",
  "Sound Design", "Bass & Low End", "Stereo Imaging", "Dynamics",
  "Emotional Impact", "Commercial Viability", "Originality",
];

function TemplateForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: { name: string; description: string; focusAreas: string[]; isDefault: boolean };
  onSave: (data: { name: string; description: string; focusAreas: string[]; isDefault: boolean }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [focusAreas, setFocusAreas] = useState<string[]>(initial?.focusAreas || []);
  const [isDefault, setIsDefault] = useState(initial?.isDefault || false);
  const [customArea, setCustomArea] = useState("");

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
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Template Name</label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Mixing Deep Dive" className="mt-1" />
      </div>

      <div>
        <label className="text-sm font-medium">Description (optional)</label>
        <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="What this template focuses on..." className="mt-1" />
      </div>

      <div>
        <label className="text-sm font-medium">Focus Areas</label>
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

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="rounded" />
        <span className="text-sm">Set as default template</span>
      </label>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave({ name, description, focusAreas, isDefault })} disabled={saving || !name.trim() || focusAreas.length === 0}>
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
            <h1 className="text-2xl font-bold">Review Templates</h1>
            <p className="text-sm text-muted-foreground">Customize what the AI focuses on during reviews</p>
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
            <CardTitle className="text-lg">Create Template</CardTitle>
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
          {templates.map(template => (
            <Card key={template.id} className={template.isDefault ? "border-amber-500/50" : ""}>
              <CardContent className="p-4">
                {editingId === template.id ? (
                  <TemplateForm
                    initial={{
                      name: template.name,
                      description: template.description || "",
                      focusAreas: template.focusAreas as string[],
                      isDefault: template.isDefault,
                    }}
                    onSave={data => updateMutation.mutate({ id: template.id, ...data })}
                    onCancel={() => setEditingId(null)}
                    saving={updateMutation.isPending}
                  />
                ) : (
                  <div className="flex items-start justify-between gap-4">
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
          ))}
        </div>
      ) : !showCreate ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground mb-4">No templates yet. Create one to customize your AI reviews.</p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Your First Template
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
