import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, Music, Loader2, ClipboardPaste } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  uploading?: boolean;
  accept?: string;
  maxSizeMB?: number;
  className?: string;
  compact?: boolean;
}

// Audio MIME types we accept — includes video/mp4 for WhatsApp voice notes
// and video/webm for some messaging apps that wrap audio in video containers
const AUDIO_MIME_TYPES = new Set([
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/wave", "audio/x-wav",
  "audio/flac", "audio/x-flac", "audio/aac", "audio/mp4", "audio/m4a",
  "audio/x-m4a", "audio/ogg", "audio/webm", "audio/opus",
  "video/mp4",   // WhatsApp voice notes & audio messages
  "video/webm",  // Some messaging apps wrap audio in webm video
]);

function isAudioFile(file: File): boolean {
  // Check explicit MIME type first
  if (AUDIO_MIME_TYPES.has(file.type)) return true;
  // Fallback: check if MIME starts with audio/
  if (file.type.startsWith("audio/")) return true;
  // Fallback: check file extension for clipboard items that may lack MIME
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext && ["mp3", "wav", "flac", "m4a", "aac", "ogg", "opus", "webm", "mp4", "wma"].includes(ext)) return true;
  return false;
}

export function DropZone({
  onFiles,
  disabled = false,
  uploading = false,
  accept = "audio/*",
  maxSizeMB = 50,
  className,
  compact = false,
}: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPasteActive, setIsPasteActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const validateAndEmit = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    const valid: File[] = [];
    const rejected: string[] = [];

    for (const file of files) {
      if (!isAudioFile(file)) {
        rejected.push(`${file.name}: not an audio file`);
        continue;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        rejected.push(`${file.name}: exceeds ${maxSizeMB}MB limit`);
        continue;
      }
      valid.push(file);
    }

    if (rejected.length > 0 && valid.length === 0) {
      toast.error(rejected.length === 1
        ? rejected[0]
        : `${rejected.length} files rejected — only audio files under ${maxSizeMB}MB accepted`
      );
    }

    if (valid.length > 0) {
      onFiles(valid);
    }
  }, [onFiles, maxSizeMB]);

  // ── Clipboard paste handler ──
  // Handles Ctrl+V / Cmd+V with audio files from WhatsApp, Telegram, etc.
  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (disabled || uploading) return;

    const items = e.clipboardData?.items;
    if (!items || items.length === 0) return;

    const audioFiles: File[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind !== "file") continue;

      const file = item.getAsFile();
      if (!file) continue;

      // Check if it's an audio file (or video container that might hold audio)
      if (isAudioFile(file)) {
        // WhatsApp/Telegram clipboard items often have generic names like "audio.ogg" or "image.png"
        // Rename if the name is too generic
        const betterName = file.name === "audio" || file.name === "file"
          ? `pasted-audio-${Date.now()}.${file.type.split("/")[1] || "mp3"}`
          : file.name;

        if (betterName !== file.name) {
          audioFiles.push(new File([file], betterName, { type: file.type }));
        } else {
          audioFiles.push(file);
        }
      }
    }

    if (audioFiles.length > 0) {
      e.preventDefault();
      // Flash the paste indicator
      setIsPasteActive(true);
      setTimeout(() => setIsPasteActive(false), 1500);
      toast.success(`Pasted ${audioFiles.length} audio file${audioFiles.length > 1 ? "s" : ""}`);
      validateAndEmit(audioFiles);
    }
  }, [disabled, uploading, validateAndEmit]);

  // Register global paste listener when the component is mounted
  // We use document-level listener so paste works when the page is focused
  // (not just when the drop zone itself is focused)
  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCounter.current = 0;
    if (disabled || uploading) return;
    validateAndEmit(e.dataTransfer.files);
  }, [disabled, uploading, validateAndEmit]);

  const handleClick = useCallback(() => {
    if (disabled || uploading) return;
    inputRef.current?.click();
  }, [disabled, uploading]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      validateAndEmit(e.target.files);
      e.target.value = "";
    }
  }, [validateAndEmit]);

  if (compact) {
    return (
      <>
        <div
          ref={containerRef}
          role="button"
          tabIndex={0}
          aria-label={uploading ? "Uploading audio files" : "Drop audio files, click to upload, or paste from clipboard"}
          aria-disabled={disabled || uploading}
          onClick={handleClick}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed cursor-pointer transition-all min-h-[44px]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            isPasteActive
              ? "border-emerald-500 bg-emerald-500/10 scale-[1.02]"
              : isDragOver
                ? "border-primary bg-primary/10 scale-[1.02]"
                : "border-border/50 hover:border-primary/50 hover:bg-muted/30",
            (disabled || uploading) && "opacity-50 cursor-not-allowed",
            className,
          )}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : isPasteActive ? (
            <ClipboardPaste className="h-4 w-4 text-emerald-500" />
          ) : (
            <Upload className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm text-muted-foreground">
            {uploading ? "Uploading..." : isPasteActive ? "Pasted!" : isDragOver ? "Drop here" : "Drop, click, or paste audio"}
          </span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
      </>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        role="button"
        tabIndex={0}
        aria-label={uploading ? "Uploading audio files" : "Drop audio files, click to upload, or paste from clipboard"}
        aria-disabled={disabled || uploading}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          compact ? "py-6" : "py-12",
          isPasteActive
            ? "border-emerald-500 bg-emerald-500/10 scale-[1.01] shadow-lg shadow-emerald-500/10"
            : isDragOver
              ? "border-primary bg-primary/10 scale-[1.01] shadow-lg shadow-primary/10"
              : "border-border/50 hover:border-primary/50 hover:bg-muted/20",
          (disabled || uploading) && "opacity-50 cursor-not-allowed",
          className,
        )}
      >
        {uploading ? (
          <>
            <Loader2 className="h-10 w-10 text-primary animate-spin mb-3" />
            <p className="text-sm font-medium text-primary">Uploading your tracks...</p>
          </>
        ) : isPasteActive ? (
          <>
            <ClipboardPaste className="h-10 w-10 text-emerald-500 mb-3" />
            <p className="text-sm font-medium text-emerald-500">Audio pasted from clipboard!</p>
          </>
        ) : isDragOver ? (
          <>
            <Music className="h-10 w-10 text-primary animate-bounce mb-3" />
            <p className="text-sm font-medium text-primary">Drop your audio files here</p>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-primary/15 to-primary/5 mb-4">
              <Upload className="h-6 w-6 text-primary/60" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              Drag & drop audio files here
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              or click to browse — MP3, WAV, FLAC, M4A up to {maxSizeMB}MB
            </p>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/40 border border-border/30">
              <ClipboardPaste className="h-3 w-3 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">
                <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Ctrl</kbd>
                {" + "}
                <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">V</kbd>
                {" to paste from WhatsApp, Telegram, etc."}
              </span>
            </div>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={handleInputChange}
      />
    </>
  );
}
