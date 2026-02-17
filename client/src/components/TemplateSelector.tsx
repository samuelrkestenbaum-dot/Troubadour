import { trpc } from "@/lib/trpc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, Star, Info } from "lucide-react";
import { getIconComponent } from "@/pages/Templates";
import { useState } from "react";

interface TemplateSelectorProps {
  value: number | null;
  onChange: (templateId: number | null) => void;
  className?: string;
  showPreview?: boolean;
}

export function TemplateSelector({ value, onChange, className, showPreview = true }: TemplateSelectorProps) {
  const { data: templates, isLoading } = trpc.template.list.useQuery();
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  if (isLoading || !templates || templates.length === 0) {
    return null; // Don't show selector if no templates exist
  }

  const selectedTemplate = value ? templates.find(t => t.id === value) : null;

  return (
    <div className="flex flex-col gap-1.5">
      <Select
        value={value?.toString() ?? "default"}
        onValueChange={(v) => onChange(v === "default" ? null : Number(v))}
      >
        <SelectTrigger className={`w-[220px] h-9 text-sm ${className ?? ""}`}>
          <FileText className="h-3.5 w-3.5 mr-1.5 shrink-0 text-muted-foreground" />
          <SelectValue placeholder="Review Template" />
        </SelectTrigger>
        <SelectContent className="max-w-[320px]">
          <SelectItem value="default">
            <span className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              Default Review
            </span>
          </SelectItem>
          {templates.map((t) => {
            const Icon = getIconComponent(t.icon);
            const focusAreas = (t.focusAreas as string[]) || [];
            return (
              <SelectItem
                key={t.id}
                value={t.id.toString()}
                onMouseEnter={() => setHoveredId(t.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div className="flex flex-col gap-0.5 py-0.5">
                  <span className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {t.name}
                    {t.isDefault && <Star className="h-3 w-3 text-amber-400 shrink-0" />}
                  </span>
                  {focusAreas.length > 0 && (
                    <span className="flex flex-wrap gap-1 ml-5">
                      {focusAreas.slice(0, 3).map((area) => (
                        <Badge key={area} variant="outline" className="text-[10px] px-1 py-0 h-4 font-normal text-muted-foreground">
                          {area}
                        </Badge>
                      ))}
                      {focusAreas.length > 3 && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 font-normal text-muted-foreground">
                          +{focusAreas.length - 3}
                        </Badge>
                      )}
                    </span>
                  )}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {/* Preview of selected template */}
      {showPreview && selectedTemplate && (
        <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-md bg-muted/50 border border-border/50 text-xs text-muted-foreground">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          <div className="flex flex-col gap-0.5">
            {selectedTemplate.description && (
              <span className="line-clamp-2">{selectedTemplate.description}</span>
            )}
            {(selectedTemplate.focusAreas as string[])?.length > 0 && (
              <span className="flex flex-wrap gap-1 mt-0.5">
                {(selectedTemplate.focusAreas as string[]).map((area) => (
                  <Badge key={area} variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                    {area}
                  </Badge>
                ))}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
