import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  CheckSquare, Square, X, Play, Tag, Trash2, Download,
  Loader2, AlertTriangle
} from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

interface Track {
  id: number;
  originalFilename: string;
  status: string;
  tags?: string | null;
}

interface BatchActionsToolbarProps {
  tracks: Track[];
  projectId: number;
  selectedIds: Set<number>;
  onToggle?: (id: number) => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onClearSelection?: () => void;
  reviewLength?: string;
  templateId?: number;
}

export function BatchActionsToolbar({
  tracks,
  projectId,
  selectedIds,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onClearSelection,
  reviewLength = "standard",
  templateId,
}: BatchActionsToolbarProps) {
  const utils = trpc.useUtils();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const analyzeAndReview = trpc.job.analyzeAndReview.useMutation({
    onSuccess: () => {
      utils.project.get.invalidate({ id: projectId });
    },
  });

  const addTag = trpc.tags.addTag.useMutation({
    onSuccess: () => {
      utils.project.get.invalidate({ id: projectId });
    },
  });

  const deleteTrack = trpc.tags.delete.useMutation({
    onSuccess: () => {
      utils.project.get.invalidate({ id: projectId });
    },
  });

  const selectedCount = selectedIds.size;
  const allSelected = selectedCount === tracks.length && tracks.length > 0;

  const handleBatchReview = async () => {
    const eligible = tracks.filter(
      (t) => selectedIds.has(t.id) && (t.status === "uploaded" || t.status === "analyzed" || t.status === "reviewed")
    );
    if (eligible.length === 0) {
      toast.error("No eligible tracks selected for review");
      return;
    }
    let queued = 0;
    for (const track of eligible) {
      try {
        await analyzeAndReview.mutateAsync({
          trackId: track.id,
          reviewLength: reviewLength as "brief" | "standard" | "detailed",
          ...(templateId ? { templateId } : {}),
        });
        queued++;
      } catch {
        // Skip tracks that fail (e.g., already processing)
      }
    }
    toast.success(`Queued ${queued} track${queued !== 1 ? "s" : ""} for review`);
    onDeselectAll?.();
    onClearSelection?.();
  };

  const handleBatchTag = async () => {
    if (!tagInput.trim()) return;
    const tag = tagInput.trim();
    let tagged = 0;
    for (const id of Array.from(selectedIds)) {
      try {
        await addTag.mutateAsync({ trackId: id, tag });
        tagged++;
      } catch {
        // Skip failures
      }
    }
    toast.success(`Tagged ${tagged} track${tagged !== 1 ? "s" : ""} with "${tag}"`);
    setTagInput("");
    setShowTagDialog(false);
    onDeselectAll?.();
    onClearSelection?.();
  };

  const handleBatchDelete = async () => {
    setIsDeleting(true);
    let deleted = 0;
    for (const id of Array.from(selectedIds)) {
      try {
        await deleteTrack.mutateAsync({ id });
        deleted++;
      } catch {
        // Skip failures
      }
    }
    setIsDeleting(false);
    setShowDeleteConfirm(false);
    toast.success(`Deleted ${deleted} track${deleted !== 1 ? "s" : ""}`);
    onDeselectAll?.();
    onClearSelection?.();
  };

  if (selectedCount === 0) {
    return (
      <div className="flex items-center gap-2 mb-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground h-7"
          onClick={onSelectAll}
        >
          <CheckSquare className="h-3.5 w-3.5 mr-1" />
          Select All
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Floating Action Bar */}
      <div className="sticky top-0 z-20 bg-primary/10 backdrop-blur-sm border border-primary/20 rounded-lg p-3 mb-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={allSelected ? onDeselectAll : onSelectAll}
          >
            {allSelected ? (
              <><X className="h-3.5 w-3.5 mr-1" /> Deselect All</>
            ) : (
              <><CheckSquare className="h-3.5 w-3.5 mr-1" /> Select All</>
            )}
          </Button>
          <Badge variant="secondary" className="text-xs">
            {selectedCount} selected
          </Badge>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Review Selected */}
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={handleBatchReview}
            disabled={analyzeAndReview.isPending}
          >
            {analyzeAndReview.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5 mr-1" />
            )}
            Review Selected
          </Button>

          {/* Tag Selected */}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowTagDialog(true)}
          >
            <Tag className="h-3.5 w-3.5 mr-1" />
            Tag
          </Button>

          {/* Export Selected */}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              const selectedTracks = tracks.filter(t => selectedIds.has(t.id));
              const reviewedCount = selectedTracks.filter(t => t.status === "reviewed").length;
              if (reviewedCount === 0) {
                toast.error("No reviewed tracks in selection to export");
                return;
              }
              toast.info(`Export ${reviewedCount} reviewed track${reviewedCount !== 1 ? "s" : ""} — use the project Export All button`, {
                description: "Batch export uses the project-level export feature",
              });
            }}
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Export
          </Button>

          {/* Delete Selected */}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs text-destructive hover:bg-destructive/10"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Delete
          </Button>

          {/* Close Selection */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onDeselectAll}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tag Dialog */}
      <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Tag {selectedCount} Track{selectedCount !== 1 ? "s" : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Enter tag name..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleBatchTag(); }}
              autoFocus
            />
            <div className="flex flex-wrap gap-1.5">
              {["needs mixing", "ready for mastering", "single candidate", "album track", "demo", "final"].map(tag => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent text-xs"
                  onClick={() => setTagInput(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTagDialog(false)}>Cancel</Button>
            <Button onClick={handleBatchTag} disabled={!tagInput.trim() || addTag.isPending}>
              {addTag.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Apply Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete {selectedCount} Track{selectedCount !== 1 ? "s" : ""}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete the selected tracks and all their reviews, annotations, and analysis data. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBatchDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Delete {selectedCount} Track{selectedCount !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Track Selection Checkbox ──
export function TrackSelectCheckbox({
  trackId,
  selected,
  onToggle,
}: {
  trackId: number;
  selected: boolean;
  onToggle: (id: number) => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(trackId); }}
      className="p-0.5 rounded hover:bg-accent/50 transition-colors"
      aria-label={selected ? "Deselect track" : "Select track"}
    >
      {selected ? (
        <CheckSquare className="h-4 w-4 text-primary" />
      ) : (
        <Square className="h-4 w-4 text-muted-foreground/40 hover:text-muted-foreground" />
      )}
    </button>
  );
}
