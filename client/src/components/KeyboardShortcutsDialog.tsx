import { useState, useEffect } from "react";
import { X, Keyboard } from "lucide-react";

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; description: string }[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: "General",
    shortcuts: [
      { keys: ["Ctrl", "K"], description: "Open command palette" },
      { keys: ["?"], description: "Show keyboard shortcuts" },
      { keys: ["Esc"], description: "Close dialog / palette" },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["G", "then", "H"], description: "Go to Home" },
      { keys: ["G", "then", "D"], description: "Go to Dashboard" },
      { keys: ["G", "then", "A"], description: "Go to Analytics" },
      { keys: ["G", "then", "S"], description: "Go to Settings" },
      { keys: ["N"], description: "New Project" },
    ],
  },
  {
    title: "Command Palette",
    shortcuts: [
      { keys: ["\u2191"], description: "Move selection up" },
      { keys: ["\u2193"], description: "Move selection down" },
      { keys: ["\u21B5"], description: "Execute selected command" },
    ],
  },
  {
    title: "Review View",
    shortcuts: [
      { keys: ["C"], description: "Copy review as Markdown" },
      { keys: ["E"], description: "Export review" },
    ],
  },
];

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "?" || e.key === "/") {
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setOpen(false)}>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        className="relative w-full max-w-xl bg-card border border-border/50 rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
          <div className="flex items-center gap-2.5">
            <Keyboard className="h-4.5 w-4.5 text-primary" />
            <h2 className="text-base font-semibold text-foreground" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted/30"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-5 space-y-5">
          {shortcutGroups.map(group => (
            <div key={group.title}>
              <h3 className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-2.5">
                {group.title}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((shortcut, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/20 transition-colors">
                    <span className="text-sm text-foreground/80">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, j) => (
                        key === "then" ? (
                          <span key={j} className="text-[10px] text-muted-foreground/40 mx-0.5">then</span>
                        ) : (
                          <kbd
                            key={j}
                            className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-[11px] font-medium text-muted-foreground border border-border/40 rounded-md bg-muted/10 shadow-sm"
                          >
                            {key}
                          </kbd>
                        )
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border/30 bg-muted/5">
          <p className="text-[11px] text-muted-foreground/40 text-center">
            Press <kbd className="border border-border/30 rounded px-1 py-0.5 mx-0.5 text-[10px]">?</kbd> to toggle this dialog
          </p>
        </div>
      </div>
    </div>
  );
}
