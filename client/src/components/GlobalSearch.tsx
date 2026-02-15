import { useState, useCallback, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Search, X, Folder, Music, FileText, Star } from "lucide-react";

type FilterType = "all" | "projects" | "tracks" | "reviews";

const FILTERS: { value: FilterType; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: "All", icon: <Search className="w-3 h-3" /> },
  { value: "projects", label: "Projects", icon: <Folder className="w-3 h-3" /> },
  { value: "tracks", label: "Tracks", icon: <Music className="w-3 h-3" /> },
  { value: "reviews", label: "Reviews", icon: <FileText className="w-3 h-3" /> },
];

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [isOpen, setIsOpen] = useState(false);
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isLoading } = trpc.search.global.useQuery(
    { query: debouncedQuery, filter, limit: 20 },
    { enabled: debouncedQuery.length > 0 }
  );

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelect = useCallback((url: string) => {
    setIsOpen(false);
    setQuery("");
    navigate(url);
  }, [navigate]);

  const typeIcon = (type: string) => {
    switch (type) {
      case "project": return <Folder className="w-4 h-4 text-blue-400" />;
      case "track": return <Music className="w-4 h-4 text-emerald-400" />;
      case "review": return <FileText className="w-4 h-4 text-amber-400" />;
      default: return <Search className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search projects, tracks, reviews..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.length > 0) setIsOpen(true);
          }}
          onFocus={() => {
            if (query.length > 0) setIsOpen(true);
          }}
          className="w-full pl-9 pr-8 py-2 text-sm bg-muted/50 border border-border rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50
                     placeholder:text-muted-foreground/60 transition-all"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setIsOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && query.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Filter Tabs */}
          <div className="flex gap-1 p-2 border-b border-border bg-muted/30">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors
                  ${filter === f.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
              >
                {f.icon}
                {f.label}
              </button>
            ))}
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Searching...
              </div>
            ) : !results || results.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No results for "{debouncedQuery}"
              </div>
            ) : (
              <div className="py-1">
                {results.map((result) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSelect(result.url)}
                    className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="mt-0.5">{typeIcon(result.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{result.title}</span>
                        {result.score !== undefined && (
                          <span className="flex items-center gap-0.5 text-xs text-amber-500">
                            <Star className="w-3 h-3 fill-current" />
                            {result.score}/10
                          </span>
                        )}
                      </div>
                      {result.subtitle && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {result.subtitle}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mt-1">
                      {result.type}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {results && results.length > 0 && (
            <div className="px-3 py-2 border-t border-border bg-muted/20 text-xs text-muted-foreground">
              {results.length} result{results.length !== 1 ? "s" : ""} found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
