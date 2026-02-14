import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Plus, Check, Trash2, Clock, X, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

interface Annotation {
  id: number;
  trackId: number;
  userId: number;
  userName: string | null;
  timestampMs: number;
  content: string;
  resolved: boolean;
  createdAt: Date;
}

function AnnotationItem({
  annotation,
  isOwner,
  onResolve,
  onDelete,
}: {
  annotation: Annotation;
  isOwner: boolean;
  onResolve: (id: number, resolved: boolean) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${annotation.resolved ? "border-emerald-500/20 bg-emerald-500/5 opacity-60" : "border-border/40 bg-card/50"}`}>
      <div className="shrink-0 mt-0.5">
        <Badge variant="outline" className="font-mono text-xs px-1.5">{formatTimestamp(annotation.timestampMs)}</Badge>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${annotation.resolved ? "line-through text-muted-foreground" : ""}`}>{annotation.content}</p>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {new Date(annotation.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </div>
      </div>
      {isOwner && (
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onResolve(annotation.id, !annotation.resolved)}
            title={annotation.resolved ? "Unresolve" : "Mark resolved"}
          >
            <Check className={`h-3.5 w-3.5 ${annotation.resolved ? "text-emerald-400" : "text-muted-foreground"}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(annotation.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

export function WaveformAnnotations({
  trackId,
  currentTimeMs,
}: {
  trackId: number;
  currentTimeMs?: number;
}) {
  const { user } = useAuth();
  const [isAdding, setIsAdding] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [customTimestamp, setCustomTimestamp] = useState("");

  const utils = trpc.useUtils();
  const { data: annotations = [], isLoading } = trpc.annotation.list.useQuery({ trackId });

  const createMutation = trpc.annotation.create.useMutation({
    onSuccess: () => {
      utils.annotation.list.invalidate({ trackId });
      setNewContent("");
      setIsAdding(false);
      toast.success("Annotation added");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.annotation.update.useMutation({
    onSuccess: () => {
      utils.annotation.list.invalidate({ trackId });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.annotation.delete.useMutation({
    onSuccess: () => {
      utils.annotation.list.invalidate({ trackId });
      toast.success("Annotation deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = () => {
    let timestampMs = currentTimeMs || 0;
    if (customTimestamp) {
      const parts = customTimestamp.split(":");
      if (parts.length === 2) {
        timestampMs = (parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)) * 1000;
      }
    }
    if (!newContent.trim()) {
      toast.error("Please enter a note");
      return;
    }
    createMutation.mutate({ trackId, timestampMs, content: newContent.trim() });
  };

  const sorted = [...annotations].sort((a: Annotation, b: Annotation) => a.timestampMs - b.timestampMs);
  const unresolvedCount = sorted.filter((a: Annotation) => !a.resolved).length;

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" /> Annotations
            {unresolvedCount > 0 && (
              <Badge variant="secondary" className="text-xs">{unresolvedCount} open</Badge>
            )}
          </CardTitle>
          {!isAdding && (
            <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => setIsAdding(true)}>
              <Plus className="h-3 w-3" /> Add Note
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Add form */}
        {isAdding && (
          <div className="mb-4 p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground shrink-0">Timestamp:</label>
              <input
                type="text"
                placeholder={currentTimeMs ? formatTimestamp(currentTimeMs) : "0:00"}
                value={customTimestamp}
                onChange={(e) => setCustomTimestamp(e.target.value)}
                className="w-16 text-xs bg-transparent border border-border/40 rounded px-2 py-1 font-mono"
              />
              {currentTimeMs !== undefined && currentTimeMs > 0 && (
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setCustomTimestamp(formatTimestamp(currentTimeMs))}>
                  Use current ({formatTimestamp(currentTimeMs)})
                </Button>
              )}
            </div>
            <Textarea
              placeholder="Add your note about this moment in the track..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={2}
              className="text-sm resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setIsAdding(false); setNewContent(""); setCustomTimestamp(""); }}>
                <X className="h-3 w-3 mr-1" /> Cancel
              </Button>
              <Button size="sm" className="h-7 text-xs gap-1" onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Add
              </Button>
            </div>
          </div>
        )}

        {/* Annotations list */}
        {isLoading ? (
          <div className="py-4 text-center">
            <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No annotations yet. Click "Add Note" to leave feedback at specific timestamps.
          </p>
        ) : (
          <div className="space-y-2">
            {sorted.map((a: Annotation) => (
              <AnnotationItem
                key={a.id}
                annotation={a}
                isOwner={user?.id === a.userId}
                onResolve={(id, resolved) => updateMutation.mutate({ id, resolved })}
                onDelete={(id) => deleteMutation.mutate({ id })}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
