import { useState, useCallback, useRef } from "react";
import { Upload, Music, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  uploading?: boolean;
  accept?: string;
  maxSizeMB?: number;
  className?: string;
  compact?: boolean;
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
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

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

  const validateAndEmit = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    const valid: File[] = [];
    for (const file of files) {
      if (!file.type.startsWith("audio/")) continue;
      if (file.size > maxSizeMB * 1024 * 1024) continue;
      valid.push(file);
    }
    if (valid.length > 0) {
      onFiles(valid);
    }
  }, [onFiles, maxSizeMB]);

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
          onClick={handleClick}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed cursor-pointer transition-all",
            isDragOver
              ? "border-primary bg-primary/10 scale-[1.02]"
              : "border-border/50 hover:border-primary/50 hover:bg-muted/30",
            (disabled || uploading) && "opacity-50 cursor-not-allowed",
            className,
          )}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <Upload className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm text-muted-foreground">
            {uploading ? "Uploading..." : isDragOver ? "Drop here" : "Drop audio or click to upload"}
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
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200",
          compact ? "py-6" : "py-12",
          isDragOver
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
            <p className="text-xs text-muted-foreground">
              or click to browse — MP3, WAV, FLAC, M4A up to {maxSizeMB}MB
            </p>
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
