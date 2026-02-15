import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Palette, Trash2, Image, Sparkles, Download } from "lucide-react";
import { toast } from "sonner";

interface ArtworkGalleryProps {
  projectId: number;
}

export function ArtworkGallery({ projectId }: ArtworkGalleryProps) {
  const [style, setStyle] = useState("");
  const [generating, setGenerating] = useState(false);

  const { data: concepts, refetch } = trpc.artwork.list.useQuery({ projectId });
  const generateMut = trpc.artwork.generate.useMutation({
    onSuccess: () => {
      refetch();
      setGenerating(false);
      toast.success("Artwork concept generated");
    },
    onError: (err) => {
      setGenerating(false);
      toast.error("Generation failed: " + err.message);
    },
  });
  const deleteMut = trpc.artwork.delete.useMutation({
    onSuccess: () => refetch(),
  });

  const handleGenerate = () => {
    setGenerating(true);
    generateMut.mutate({ projectId, style: style || undefined });
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          Album Artwork Concepts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Style hint (e.g., 'retro vinyl', 'dark minimal')..."
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleGenerate} disabled={generating} size="sm">
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-1" />
                Generate Concept
              </>
            )}
          </Button>
        </div>

        {concepts && concepts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {concepts.map((concept) => (
              <div key={concept.id} className="border border-border/50 rounded-lg overflow-hidden bg-card">
                {concept.imageUrl ? (
                  <div className="relative group">
                    <img
                      src={concept.imageUrl}
                      alt="Album artwork concept"
                      className="w-full aspect-square object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <a
                        href={concept.imageUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                      >
                        <Download className="h-5 w-5 text-white" />
                      </a>
                      <button
                        onClick={() => deleteMut.mutate({ id: concept.id })}
                        className="p-2 bg-red-500/50 rounded-full hover:bg-red-500/70 transition-colors"
                      >
                        <Trash2 className="h-5 w-5 text-white" />
                      </button>
                    </div>
                  </div>
                ) : concept.status === "generating" ? (
                  <div className="w-full aspect-square flex items-center justify-center bg-muted/30">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="w-full aspect-square flex items-center justify-center bg-muted/30">
                    <Image className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}

                <div className="p-3 space-y-2">
                  {concept.visualStyle && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {concept.visualStyle}
                    </span>
                  )}
                  {concept.moodDescription && (
                    <p className="text-sm text-muted-foreground">{concept.moodDescription}</p>
                  )}
                  {concept.colorPalette && (
                    <div className="flex gap-1">
                      {(concept.colorPalette as string[]).map((color, i) => (
                        <div
                          key={i}
                          className="w-6 h-6 rounded-full border border-border/50"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Image className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No artwork concepts yet. Generate one to get started.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
