import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { X, Plus, Tag } from "lucide-react";
import { toast } from "sonner";

const PRESET_TAGS = [
  "Needs Mixing",
  "Ready for Mastering",
  "Single Candidate",
  "Album Cut",
  "Demo",
  "Work in Progress",
  "Final Mix",
  "Needs Vocals",
  "Instrumental",
  "Needs Lyrics",
  "Reference Mix",
  "Radio Edit",
  "Extended Mix",
  "Acoustic Version",
  "Live Recording",
];

const TAG_COLORS: Record<string, string> = {
  "Single Candidate": "bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25",
  "Ready for Mastering": "bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/25",
  "Needs Mixing": "bg-orange-500/15 text-orange-400 border-orange-500/30 hover:bg-orange-500/25",
  "Final Mix": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25",
  "Work in Progress": "bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/25",
  "Demo": "bg-purple-500/15 text-purple-400 border-purple-500/30 hover:bg-purple-500/25",
  "Album Cut": "bg-indigo-500/15 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/25",
};

function getTagColor(tag: string): string {
  return TAG_COLORS[tag] || "bg-muted/50 text-muted-foreground border-border hover:bg-muted";
}

export function TrackTags({ trackId, compact = false }: { trackId: number; compact?: boolean }) {
  const utils = trpc.useUtils();
  const [showInput, setShowInput] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: tags = [], isLoading } = trpc.tags.get.useQuery({ trackId });

  const addTag = trpc.tags.addTag.useMutation({
    onSuccess: () => {
      utils.tags.get.invalidate({ trackId });
      utils.track.get.invalidate({ id: trackId });
      setInputValue("");
      setShowSuggestions(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const removeTag = trpc.tags.removeTag.useMutation({
    onSuccess: () => {
      utils.tags.get.invalidate({ trackId });
      utils.track.get.invalidate({ id: trackId });
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showInput]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        if (!inputValue.trim()) setShowInput(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [inputValue]);

  const filteredSuggestions = PRESET_TAGS.filter(
    (t) => !tags.includes(t) && t.toLowerCase().includes(inputValue.toLowerCase())
  );

  const handleAddTag = (tag: string) => {
    if (tag.trim() && !tags.includes(tag.trim())) {
      addTag.mutate({ trackId, tag: tag.trim() });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      handleAddTag(inputValue.trim());
    } else if (e.key === "Escape") {
      setShowInput(false);
      setShowSuggestions(false);
      setInputValue("");
    }
  };

  if (isLoading) return null;

  // Compact mode: just show tags inline
  if (compact) {
    return (
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <Badge key={tag} variant="outline" className={`text-xs ${getTagColor(tag)}`}>
            {tag}
          </Badge>
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="outline"
            className={`text-xs pr-1 ${getTagColor(tag)} transition-colors`}
          >
            <span>{tag}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeTag.mutate({ trackId, tag });
              }}
              className="ml-1 rounded-full p-0.5 hover:bg-white/10 transition-colors"
              disabled={removeTag.isPending}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}

        {showInput ? (
          <div className="relative">
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
              placeholder="Add tag..."
              className="h-6 w-32 rounded-md border border-input bg-background px-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />

            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-48 max-h-48 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md z-50">
                {filteredSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleAddTag(suggestion)}
                    className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <Tag className="h-3 w-3 inline mr-1.5 opacity-50" />
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowInput(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            {tags.length === 0 ? "Add tags" : "Add"}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Read-only tag display for project view track lists */
export function TrackTagsBadges({ tags }: { tags: string }) {
  if (!tags) return null;
  const tagList = tags.split(",").filter(Boolean).map(t => t.trim());
  if (tagList.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {tagList.map((tag) => (
        <Badge key={tag} variant="outline" className={`text-[10px] py-0 ${getTagColor(tag)}`}>
          {tag}
        </Badge>
      ))}
    </div>
  );
}
