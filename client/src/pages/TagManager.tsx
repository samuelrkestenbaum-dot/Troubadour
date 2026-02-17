import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Tag, Pencil, Trash2, Merge, Search, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";

export default function TagManager() {
  const utils = trpc.useUtils();
  const { data: tags, isLoading } = trpc.tags.listAll.useQuery();
  const renameMut = trpc.tags.rename.useMutation({
    onSuccess: (data) => {
      toast.success(`Renamed tag across ${data.tracksUpdated} track(s)`);
      utils.tags.listAll.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const mergeMut = trpc.tags.merge.useMutation({
    onSuccess: (data) => {
      toast.success(`Merged tags across ${data.tracksUpdated} track(s)`);
      utils.tags.listAll.invalidate();
      setMergeSelected(new Set());
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMut = trpc.tags.deleteTag.useMutation({
    onSuccess: (data) => {
      toast.success(`Removed tag from ${data.tracksUpdated} track(s)`);
      utils.tags.listAll.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const [search, setSearch] = useState("");
  const [renameDialog, setRenameDialog] = useState<{ oldName: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [mergeSelected, setMergeSelected] = useState<Set<string>>(new Set());
  const [mergeDialog, setMergeDialog] = useState(false);
  const [mergeTarget, setMergeTarget] = useState("");

  const filtered = useMemo(() => {
    if (!tags) return [];
    if (!search.trim()) return tags;
    const q = search.toLowerCase();
    return tags.filter(t => t.name.toLowerCase().includes(q));
  }, [tags, search]);

  const handleRename = () => {
    if (!renameDialog || !renameValue.trim()) return;
    renameMut.mutate({ oldName: renameDialog.oldName, newName: renameValue.trim() });
    setRenameDialog(null);
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    deleteMut.mutate({ tagName: deleteConfirm });
    setDeleteConfirm(null);
  };

  const handleMerge = () => {
    if (mergeSelected.size < 2 || !mergeTarget.trim()) return;
    const sourceTags = Array.from(mergeSelected);
    mergeMut.mutate({ sourceTags, targetTag: mergeTarget.trim() });
    setMergeDialog(false);
    setMergeTarget("");
  };

  const toggleMergeSelect = (name: string) => {
    setMergeSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tag Manager</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Rename, merge, or delete tags across all your tracks
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {mergeSelected.size >= 2 && (
          <Button
            variant="outline"
            onClick={() => {
              setMergeTarget("");
              setMergeDialog(true);
            }}
          >
            <Merge className="h-4 w-4 mr-2" />
            Merge {mergeSelected.size} Tags
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : !tags || tags.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Tag className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-1">No tags yet</h3>
            <p className="text-sm text-muted-foreground">
              Add tags to your tracks to organize and categorize your music
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {tags.length} tag{tags.length !== 1 ? "s" : ""} across your library.
            Select multiple tags to merge them.
          </p>
          <div className="grid gap-2">
            {filtered.map((tag) => (
              <Card key={tag.name} className="border-border/50 hover:border-border transition-colors">
                <CardContent className="p-4 flex items-center gap-4">
                  <Checkbox
                    checked={mergeSelected.has(tag.name)}
                    onCheckedChange={() => toggleMergeSelect(tag.name)}
                    aria-label={`Select ${tag.name} for merge`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-sm font-medium">
                        {tag.name}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {tag.count} track{tag.count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setRenameValue(tag.name);
                        setRenameDialog({ oldName: tag.name });
                      }}
                      title="Rename tag"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteConfirm(tag.name)}
                      title="Delete tag"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Rename Dialog */}
      <Dialog open={!!renameDialog} onOpenChange={(open) => !open && setRenameDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Tag</DialogTitle>
            <DialogDescription>
              Rename "{renameDialog?.oldName}" across all tracks that use it.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="New tag name"
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialog(null)}>Cancel</Button>
            <Button
              onClick={handleRename}
              disabled={!renameValue.trim() || renameValue.trim() === renameDialog?.oldName || renameMut.isPending}
            >
              {renameMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Remove "{deleteConfirm}" from all tracks? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Merge Dialog */}
      <Dialog open={mergeDialog} onOpenChange={(open) => !open && setMergeDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge Tags</DialogTitle>
            <DialogDescription>
              Merge the following tags into a single tag. All selected tags will be replaced.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2 mb-4">
            {Array.from(mergeSelected).map((name) => (
              <Badge key={name} variant="secondary">{name}</Badge>
            ))}
          </div>
          <Input
            value={mergeTarget}
            onChange={(e) => setMergeTarget(e.target.value)}
            placeholder="Target tag name (e.g., 'rock')"
            onKeyDown={(e) => e.key === "Enter" && handleMerge()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialog(false)}>Cancel</Button>
            <Button
              onClick={handleMerge}
              disabled={!mergeTarget.trim() || mergeMut.isPending}
            >
              {mergeMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
