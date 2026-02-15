import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
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

function CollapsibleSection({ section, isOpen, onToggle }: {
  section: ReviewSection;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-border/40 rounded-lg overflow-hidden transition-colors hover:border-border/60">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        aria-expanded={isOpen}
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

  const allOpen = openSections.size === sections.length;

  const toggleSection = (index: number) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (allOpen) {
      setOpenSections(new Set());
    } else {
      setOpenSections(new Set(sections.map((_, i) => i)));
    }
  };

  // If no sections found (no ## or ### headers), render as plain markdown
  if (sections.length === 0) {
    return (
      <div className="prose prose-sm prose-invert max-w-none">
        <Streamdown>{markdown}</Streamdown>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center justify-end">
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
        />
      ))}
    </div>
  );
}
