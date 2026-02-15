import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  FolderOpen, Music, FileText, BarChart3, Search, Plus, Zap, Download,
  Settings, CreditCard, Star, Command, CornerDownLeft, ArrowUp, ArrowDown,
  Keyboard, Home, LayoutDashboard, BookOpen
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  action: () => void;
  category: string;
  keywords?: string[];
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch projects for search
  const { data: projectsData } = trpc.project.list.useQuery(undefined, {
    enabled: !!user,
  });

  const commands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      // Navigation
      { id: "nav-home", label: "Go to Home", icon: Home, action: () => setLocation("/"), category: "Navigation", keywords: ["landing", "home"] },
      { id: "nav-dashboard", label: "Go to Dashboard", icon: LayoutDashboard, action: () => setLocation("/dashboard"), category: "Navigation", keywords: ["dashboard", "projects"] },
      { id: "nav-analytics", label: "Go to Analytics", icon: BarChart3, action: () => setLocation("/analytics"), category: "Navigation", keywords: ["analytics", "stats", "scores"] },
      { id: "nav-templates", label: "Go to Templates", icon: BookOpen, action: () => setLocation("/templates"), category: "Navigation", keywords: ["templates", "presets"] },
      { id: "nav-benchmarks", label: "Go to Genre Benchmarks", icon: Star, action: () => setLocation("/benchmarks"), category: "Navigation", keywords: ["benchmarks", "genre", "compare"] },
      { id: "nav-usage", label: "Go to Usage", icon: Zap, action: () => setLocation("/usage"), category: "Navigation", keywords: ["usage", "minutes", "limit"] },
      { id: "nav-settings", label: "Go to Settings", icon: Settings, action: () => setLocation("/settings"), category: "Navigation", keywords: ["settings", "account", "profile"] },
      { id: "nav-pricing", label: "Go to Pricing", icon: CreditCard, action: () => setLocation("/pricing"), category: "Navigation", keywords: ["pricing", "plans", "upgrade"] },

      // Actions
      { id: "action-new", label: "New Project", description: "Create a new project and upload tracks", icon: Plus, action: () => setLocation("/projects/new"), category: "Actions", keywords: ["new", "create", "upload"] },
    ];

    // Add project navigation items
    if (projectsData) {
      for (const project of projectsData.slice(0, 10)) {
        items.push({
          id: `project-${project.id}`,
          label: project.title,
          description: `${project.trackCount ?? 0} track${(project.trackCount ?? 0) !== 1 ? "s" : ""} — ${project.status}`,
          icon: FolderOpen,
          action: () => setLocation(`/projects/${project.id}`),
          category: "Projects",
          keywords: [project.title.toLowerCase()],
        });
      }
    }

    return items;
  }, [projectsData, setLocation]);

  // Filter commands by query
  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(cmd =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.description?.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q) ||
      cmd.keywords?.some(k => k.includes(q))
    );
  }, [commands, query]);

  // Group by category
  const grouped = useMemo(() => {
    const groups = new Map<string, CommandItem[]>();
    for (const item of filtered) {
      if (!groups.has(item.category)) groups.set(item.category, []);
      groups.get(item.category)!.push(item);
    }
    return groups;
  }, [filtered]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard shortcut to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
        setOpen(false);
      }
    }
  }, [filtered, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selected?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!open) return null;

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Palette */}
      <div
        className="relative w-full max-w-lg bg-card border border-border/50 rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands, projects..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
          />
          <kbd className="text-[10px] text-muted-foreground/50 border border-border/30 rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No results found for "{query}"
            </div>
          ) : (
            Array.from(grouped.entries()).map(([category, items]) => (
              <div key={category}>
                <div className="px-4 py-1.5">
                  <span className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider">{category}</span>
                </div>
                {items.map(item => {
                  const currentIndex = flatIndex++;
                  const Icon = item.icon;
                  const isSelected = currentIndex === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      data-index={currentIndex}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        isSelected ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted/30"
                      }`}
                      onClick={() => {
                        item.action();
                        setOpen(false);
                      }}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${isSelected ? "text-primary" : ""}`} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{item.label}</span>
                        {item.description && (
                          <span className="text-xs text-muted-foreground/60 ml-2">{item.description}</span>
                        )}
                      </div>
                      {isSelected && <CornerDownLeft className="h-3 w-3 text-muted-foreground/40 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border/30 bg-muted/5">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/40">
            <ArrowUp className="h-3 w-3" /><ArrowDown className="h-3 w-3" /> navigate
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/40">
            <CornerDownLeft className="h-3 w-3" /> select
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/40">
            <span className="border border-border/30 rounded px-1">esc</span> close
          </div>
        </div>
      </div>
    </div>
  );
}

// Keyboard shortcut hint component for buttons
export function ShortcutHint({ shortcut, className }: { shortcut: string; className?: string }) {
  return (
    <kbd className={`hidden md:inline-flex items-center text-[10px] text-muted-foreground/40 border border-border/20 rounded px-1 py-0.5 ml-2 ${className ?? ""}`}>
      {shortcut}
    </kbd>
  );
}

// Hook to register keyboard shortcuts
export function useKeyboardShortcuts(shortcuts: Record<string, () => void>) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();
      if (shortcuts[key]) {
        e.preventDefault();
        shortcuts[key]();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts]);
}
