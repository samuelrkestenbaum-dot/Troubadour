import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { StickyNote, Plus, Pin, PinOff, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

function NoteCard({ note, onUpdate, onDelete }: {
  note: any;
  onUpdate: (noteId: number, data: { content?: string; pinned?: boolean }) => void;
  onDelete: (noteId: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(note.content);

  const handleSave = () => {
    if (!editContent.trim()) return;
    onUpdate(note.id, { content: editContent.trim() });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(note.content);
    setIsEditing(false);
  };

  const timeAgo = (date: string | Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className={`group relative rounded-lg border p-3 transition-colors ${
      note.pinned ? "border-amber-500/30 bg-amber-500/5" : "border-border/50 bg-card/50 hover:border-border"
    }`}>
      {note.pinned && (
        <Pin className="absolute top-2 right-2 h-3 w-3 text-amber-500 fill-amber-500" />
      )}

      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="min-h-[80px] text-sm resize-none"
            autoFocus
          />
          <div className="flex gap-1.5 justify-end">
            <Button size="sm" variant="ghost" onClick={handleCancel} className="h-7 px-2">
              <X className="h-3 w-3 mr-1" /> Cancel
            </Button>
            <Button size="sm" onClick={handleSave} className="h-7 px-2">
              <Check className="h-3 w-3 mr-1" /> Save
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm whitespace-pre-wrap pr-6">{note.content}</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-muted-foreground">{timeAgo(note.createdAt)}</span>
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => onUpdate(note.id, { pinned: !note.pinned })}
                title={note.pinned ? "Unpin" : "Pin"}
              >
                {note.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setIsEditing(true)}
                title="Edit"
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                onClick={() => onDelete(note.id)}
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function TrackNotes({ trackId }: { trackId: number }) {
  const [newNote, setNewNote] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const utils = trpc.useUtils();

  const notesQuery = trpc.trackNote.list.useQuery({ trackId });
  const notes = notesQuery.data || [];

  const createMutation = trpc.trackNote.create.useMutation({
    onSuccess: () => {
      utils.trackNote.list.invalidate({ trackId });
      setNewNote("");
      setIsAdding(false);
      toast.success("Note saved");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.trackNote.update.useMutation({
    onSuccess: () => {
      utils.trackNote.list.invalidate({ trackId });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.trackNote.delete.useMutation({
    onSuccess: () => {
      utils.trackNote.list.invalidate({ trackId });
      toast.success("Note deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = () => {
    if (!newNote.trim()) return;
    createMutation.mutate({ trackId, content: newNote.trim() });
  };

  return (
    <Card className="border-muted-foreground/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-amber-400" />
            Session Notes
            {notes.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5">{notes.length}</Badge>
            )}
          </CardTitle>
          {!isAdding && (
            <Button variant="ghost" size="sm" onClick={() => setIsAdding(true)} className="h-7 text-xs">
              <Plus className="h-3 w-3 mr-1" /> Add Note
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isAdding && (
          <div className="space-y-2">
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Jot down session notes, ideas, or to-dos for this track..."
              className="min-h-[80px] text-sm resize-none"
              autoFocus
            />
            <div className="flex gap-1.5 justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setIsAdding(false); setNewNote(""); }}
                className="h-7 px-2"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={!newNote.trim() || createMutation.isPending}
                className="h-7 px-2"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Check className="h-3 w-3 mr-1" />
                )}
                Save
              </Button>
            </div>
          </div>
        )}

        {notes.length === 0 && !isAdding && (
          <div className="text-center py-6 text-muted-foreground">
            <StickyNote className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No notes yet</p>
            <p className="text-xs mt-1">Add session notes, ideas, or to-dos for this track</p>
          </div>
        )}

        {notes.map((note: any) => (
          <NoteCard
            key={note.id}
            note={note}
            onUpdate={(noteId, data) => updateMutation.mutate({ noteId, ...data })}
            onDelete={(noteId) => deleteMutation.mutate({ noteId })}
          />
        ))}
      </CardContent>
    </Card>
  );
}
