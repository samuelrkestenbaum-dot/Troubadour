import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileDown, Loader2, Copy, Check, Music, Clock, Hash } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface DAWSessionNotes {
  title: string;
  generatedAt: string;
  trackInfo: {
    title: string;
    genre: string;
    tempo: number;
    key: string;
    duration: string;
  };
  sections: Array<{
    name: string;
    timeRange: string;
    notes: string[];
  }>;
  mixNotes: string[];
  arrangementNotes: string[];
  priorityActions: Array<{
    priority: number;
    action: string;
    section: string;
  }>;
}

function formatNotesAsText(notes: DAWSessionNotes): string {
  let text = `═══════════════════════════════════════\n`;
  text += `  ${notes.title}\n`;
  text += `  Generated: ${new Date(notes.generatedAt).toLocaleDateString()}\n`;
  text += `═══════════════════════════════════════\n\n`;
  text += `TRACK INFO\n`;
  text += `──────────\n`;
  text += `  Genre: ${notes.trackInfo.genre}\n`;
  text += `  Tempo: ${notes.trackInfo.tempo} BPM\n`;
  text += `  Key: ${notes.trackInfo.key}\n`;
  text += `  Duration: ${notes.trackInfo.duration}\n\n`;

  if (notes.priorityActions.length > 0) {
    text += `PRIORITY ACTIONS\n`;
    text += `────────────────\n`;
    notes.priorityActions.forEach(a => {
      text += `  [${a.priority}] ${a.action} (${a.section})\n`;
    });
    text += `\n`;
  }

  if (notes.sections.length > 0) {
    text += `SECTION NOTES\n`;
    text += `─────────────\n`;
    notes.sections.forEach(s => {
      text += `\n  ▸ ${s.name} (${s.timeRange})\n`;
      s.notes.forEach(n => {
        text += `    • ${n}\n`;
      });
    });
    text += `\n`;
  }

  if (notes.mixNotes.length > 0) {
    text += `MIX NOTES\n`;
    text += `─────────\n`;
    notes.mixNotes.forEach(n => {
      text += `  • ${n}\n`;
    });
    text += `\n`;
  }

  if (notes.arrangementNotes.length > 0) {
    text += `ARRANGEMENT NOTES\n`;
    text += `─────────────────\n`;
    notes.arrangementNotes.forEach(n => {
      text += `  • ${n}\n`;
    });
  }

  return text;
}

function NotesPreview({ notes }: { notes: DAWSessionNotes }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(formatNotesAsText(notes));
    setCopied(true);
    toast.success("Session notes copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([formatNotesAsText(notes)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${notes.title.replace(/[^a-zA-Z0-9]/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Session notes downloaded");
  };

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
      {/* Track info header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Badge variant="outline" className="gap-1"><Music className="h-3 w-3" />{notes.trackInfo.genre}</Badge>
        <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{notes.trackInfo.tempo} BPM</Badge>
        <Badge variant="outline" className="gap-1"><Hash className="h-3 w-3" />{notes.trackInfo.key}</Badge>
        <Badge variant="outline">{notes.trackInfo.duration}</Badge>
      </div>

      {/* Priority actions */}
      {notes.priorityActions.length > 0 && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="py-3">
            <p className="text-xs font-medium text-red-300 mb-2">Priority Actions</p>
            <div className="space-y-1.5">
              {notes.priorityActions.map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-xs font-mono text-red-400 bg-red-500/20 rounded px-1.5 py-0.5 shrink-0">#{a.priority}</span>
                  <span>{a.action}</span>
                  <span className="text-xs text-muted-foreground shrink-0">({a.section})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section notes */}
      {notes.sections.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Section Notes</p>
          {notes.sections.map((s, i) => (
            <Card key={i} className="border-border/40">
              <CardContent className="py-2.5 px-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-medium">{s.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">{s.timeRange}</span>
                </div>
                <ul className="space-y-0.5">
                  {s.notes.map((n, j) => (
                    <li key={j} className="text-xs text-muted-foreground pl-3 relative before:content-['•'] before:absolute before:left-0">{n}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Mix & Arrangement notes */}
      <div className="grid md:grid-cols-2 gap-3">
        {notes.mixNotes.length > 0 && (
          <Card className="border-border/40">
            <CardContent className="py-2.5 px-3">
              <p className="text-xs font-medium mb-1.5">Mix Notes</p>
              <ul className="space-y-0.5">
                {notes.mixNotes.map((n, i) => (
                  <li key={i} className="text-xs text-muted-foreground pl-3 relative before:content-['•'] before:absolute before:left-0">{n}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
        {notes.arrangementNotes.length > 0 && (
          <Card className="border-border/40">
            <CardContent className="py-2.5 px-3">
              <p className="text-xs font-medium mb-1.5">Arrangement Notes</p>
              <ul className="space-y-0.5">
                {notes.arrangementNotes.map((n, i) => (
                  <li key={i} className="text-xs text-muted-foreground pl-3 relative before:content-['•'] before:absolute before:left-0">{n}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-2 border-t border-border/40">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopy}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy to Clipboard"}
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownload}>
          <FileDown className="h-3.5 w-3.5" /> Download .txt
        </Button>
      </div>
    </div>
  );
}

export function DAWExportButton({ trackId }: { trackId: number }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<DAWSessionNotes | null>(null);

  const generateMutation = trpc.dawExport.generate.useMutation({
    onSuccess: (data) => {
      setNotes(data);
      toast.success("Session notes generated");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    setNotes(null);
    generateMutation.mutate({ trackId });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FileDown className="h-3.5 w-3.5" /> DAW Notes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-primary" /> DAW Session Notes
          </DialogTitle>
        </DialogHeader>
        {notes ? (
          <NotesPreview notes={notes} />
        ) : (
          <div className="py-8 text-center">
            <FileDown className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-2">Export Session Notes</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Generate a structured text file with section-by-section notes, mix suggestions, and priority actions you can reference alongside your DAW.
            </p>
            <Button onClick={handleGenerate} disabled={generateMutation.isPending} className="gap-2">
              {generateMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating Notes…</> : "Generate Session Notes"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
