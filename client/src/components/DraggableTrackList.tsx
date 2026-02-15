import { useState, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Music } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface Track {
  id: number;
  originalFilename: string;
  status: string;
  trackOrder: number;
}

interface DraggableTrackListProps {
  tracks: Track[];
  projectId: number;
  onReorderComplete?: () => void;
  renderTrackContent: (track: Track, index: number) => React.ReactNode;
}

export function DraggableTrackList({
  tracks,
  projectId,
  onReorderComplete,
  renderTrackContent,
}: DraggableTrackListProps) {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [localTracks, setLocalTracks] = useState<Track[]>(tracks);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);

  const reorderMutation = trpc.reorder.update.useMutation({
    onSuccess: () => {
      onReorderComplete?.();
    },
    onError: (err) => {
      toast.error("Failed to save track order");
      setLocalTracks(tracks); // revert
    },
  });

  // Sync when parent tracks change
  if (tracks.length !== localTracks.length || tracks.some((t, i) => t.id !== localTracks[i]?.id)) {
    setLocalTracks(tracks);
  }

  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
    // Make the drag ghost slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      dragNodeRef.current = e.currentTarget as HTMLDivElement;
      setTimeout(() => {
        if (dragNodeRef.current) dragNodeRef.current.style.opacity = "0.4";
      }, 0);
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragNodeRef.current) dragNodeRef.current.style.opacity = "1";
    setDraggedIdx(null);
    setOverIdx(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIdx(idx);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === dropIdx) {
      handleDragEnd();
      return;
    }

    const newTracks = [...localTracks];
    const [moved] = newTracks.splice(draggedIdx, 1);
    newTracks.splice(dropIdx, 0, moved);
    setLocalTracks(newTracks);

    // Persist the new order
    const orderedTrackIds = newTracks.map(t => t.id);
    reorderMutation.mutate({ projectId, orderedTrackIds });

    handleDragEnd();
  }, [draggedIdx, localTracks, projectId, reorderMutation, handleDragEnd]);

  return (
    <div className="space-y-1">
      {localTracks.map((track, idx) => {
        const isOver = overIdx === idx && draggedIdx !== null && draggedIdx !== idx;
        const isDragged = draggedIdx === idx;

        return (
          <div
            key={track.id}
            draggable
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={(e) => handleDrop(e, idx)}
            className={`transition-all duration-150 ${
              isOver ? "border-t-2 border-primary pt-1" : ""
            } ${isDragged ? "opacity-40" : ""}`}
          >
            <div className="flex items-center gap-0">
              <div
                className="flex items-center justify-center w-8 h-10 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground/80 transition-colors shrink-0"
                title="Drag to reorder"
              >
                <GripVertical className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2 min-w-0 shrink-0">
                <span className="text-xs text-muted-foreground/50 font-mono w-5 text-right">
                  {idx + 1}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                {renderTrackContent(track, idx)}
              </div>
            </div>
          </div>
        );
      })}
      {reorderMutation.isPending && (
        <p className="text-xs text-muted-foreground text-center py-1 animate-pulse">
          Saving new order...
        </p>
      )}
    </div>
  );
}
