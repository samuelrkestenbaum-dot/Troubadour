import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { ChevronDown, ChevronRight, ChevronsUpDown, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Streamdown } from "streamdown";

interface ReviewSection {
  header: string;
  content: string;
  level: number; // 2 for ##, 3 for ###
}

function parseReviewSections(markdown: string): { preamble: string; sections: ReviewSection[] } {
  const lines = markdown.split("\n");
  let preamble = "";
  const sections: ReviewSection[] = [];
  let currentSection: ReviewSection | null = null;
  let contentLines: string[] = [];
  let inPreamble = true;

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.+)$/);
    const h3Match = line.match(/^###\s+(.+)$/);
    const match = h2Match || h3Match;

    if (match) {
      // Save previous section
      if (currentSection) {
        currentSection.content = contentLines.join("\n").trim();
        sections.push(currentSection);
      } else if (inPreamble) {
        preamble = contentLines.join("\n").trim();
      }
      inPreamble = false;
      currentSection = {
        header: match[1].replace(/\*\*/g, "").trim(),
        content: "",
        level: h2Match ? 2 : 3,
      };
      contentLines = [];
    } else {
      contentLines.push(line);
    }
  }

  // Save last section
  if (currentSection) {
    currentSection.content = contentLines.join("\n").trim();
    sections.push(currentSection);
  } else if (inPreamble) {
    preamble = contentLines.join("\n").trim();
  }

  return { preamble, sections };
}

function CollapsibleSection({ section, isOpen, onToggle, isFocused, sectionRef }: {
  section: ReviewSection;
  isOpen: boolean;
  onToggle: () => void;
  isFocused: boolean;
  sectionRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={sectionRef}
      className={`border rounded-lg overflow-hidden transition-all ${
        isFocused
          ? "border-primary/60 ring-1 ring-primary/30 shadow-sm shadow-primary/10"
          : "border-border/40 hover:border-border/60"
      }`}
    >
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-2 px-4 py-3 text-left transition-colors ${
          isFocused ? "bg-primary/5" : "hover:bg-muted/30"
        }`}
        aria-expanded={isOpen}
        tabIndex={-1}
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-primary shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <span
          className="font-semibold text-sm uppercase tracking-wider text-primary"
          style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
        >
          {section.header}
        </span>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 border-t border-border/20">
          <div className="prose prose-sm prose-invert max-w-none pt-3">
            <Streamdown>{section.content}</Streamdown>
          </div>
        </div>
      )}
    </div>
  );
}

export function CollapsibleReview({ markdown }: { markdown: string }) {
  const { preamble, sections } = useMemo(() => parseReviewSections(markdown), [markdown]);
  const [openSections, setOpenSections] = useState<Set<number>>(() =>
    new Set(sections.map((_, i) => i))
  );
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [keyboardActive, setKeyboardActive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  const allOpen = openSections.size === sections.length;

  const toggleSection = useCallback((index: number) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (allOpen) {
      setOpenSections(new Set());
    } else {
      setOpenSections(new Set(sections.map((_, i) => i)));
    }
  }, [allOpen, sections]);

  const scrollToSection = useCallback((index: number) => {
    const el = sectionRefs.current[index];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, []);

  // Keyboard navigation handler
  useEffect(() => {
    if (sections.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only activate if not typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "j": {
          e.preventDefault();
          setKeyboardActive(true);
          setFocusedIndex(prev => {
            const next = prev === null ? 0 : Math.min(prev + 1, sections.length - 1);
            scrollToSection(next);
            return next;
          });
          break;
        }
        case "k": {
          e.preventDefault();
          setKeyboardActive(true);
          setFocusedIndex(prev => {
            const next = prev === null ? sections.length - 1 : Math.max(prev - 1, 0);
            scrollToSection(next);
            return next;
          });
          break;
        }
        case "e": {
          e.preventDefault();
          setOpenSections(new Set(sections.map((_, i) => i)));
          break;
        }
        case "c": {
          e.preventDefault();
          setOpenSections(new Set());
          break;
        }
        case "enter":
        case " ": {
          if (focusedIndex !== null) {
            e.preventDefault();
            toggleSection(focusedIndex);
          }
          break;
        }
        case "escape": {
          setFocusedIndex(null);
          setKeyboardActive(false);
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sections, focusedIndex, toggleSection, scrollToSection]);

  // If no sections found (no ## or ### headers), render as plain markdown
  if (sections.length === 0) {
    return (
      <div className="prose prose-sm prose-invert max-w-none">
        <Streamdown>{markdown}</Streamdown>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-3">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {keyboardActive && focusedIndex !== null && (
            <Badge variant="outline" className="text-xs text-muted-foreground animate-in fade-in">
              Section {focusedIndex + 1}/{sections.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 w-7 p-0 ${keyboardActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => {
                    setKeyboardActive(!keyboardActive);
                    if (!keyboardActive) setFocusedIndex(0);
                    else { setFocusedIndex(null); }
                  }}
                >
                  <Keyboard className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <div className="space-y-1">
                  <p className="font-medium">Keyboard Shortcuts</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
                    <span><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">J</kbd> Next section</span>
                    <span><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">K</kbd> Previous section</span>
                    <span><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">E</kbd> Expand all</span>
                    <span><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">C</kbd> Collapse all</span>
                    <span><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Enter</kbd> Toggle section</span>
                    <span><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Esc</kbd> Deactivate</span>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleAll}
            className="text-xs text-muted-foreground hover:text-foreground h-7 px-2"
          >
            <ChevronsUpDown className="h-3.5 w-3.5 mr-1" />
            {allOpen ? "Collapse All" : "Expand All"}
          </Button>
        </div>
      </div>

      {/* Preamble (if any content before first heading) */}
      {preamble && (
        <div className="prose prose-sm prose-invert max-w-none px-1">
          <Streamdown>{preamble}</Streamdown>
        </div>
      )}

      {/* Collapsible Sections */}
      {sections.map((section, i) => (
        <CollapsibleSection
          key={i}
          section={section}
          isOpen={openSections.has(i)}
          onToggle={() => toggleSection(i)}
          isFocused={keyboardActive && focusedIndex === i}
          sectionRef={(el) => { sectionRefs.current[i] = el; }}
        />
      ))}
    </div>
  );
}
