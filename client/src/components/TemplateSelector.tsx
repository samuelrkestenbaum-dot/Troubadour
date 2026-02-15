import { trpc } from "@/lib/trpc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Star } from "lucide-react";
import { getIconComponent } from "@/pages/Templates";

interface TemplateSelectorProps {
  value: number | null;
  onChange: (templateId: number | null) => void;
  className?: string;
}

export function TemplateSelector({ value, onChange, className }: TemplateSelectorProps) {
  const { data: templates, isLoading } = trpc.template.list.useQuery();

  if (isLoading || !templates || templates.length === 0) {
    return null; // Don't show selector if no templates exist
  }

  return (
    <Select
      value={value?.toString() ?? "default"}
      onValueChange={(v) => onChange(v === "default" ? null : Number(v))}
    >
      <SelectTrigger className={`w-[200px] h-9 text-sm ${className ?? ""}`}>
        <FileText className="h-3.5 w-3.5 mr-1.5 shrink-0 text-muted-foreground" />
        <SelectValue placeholder="Review Template" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="default">Default Review</SelectItem>
        {templates.map((t) => {
          const Icon = getIconComponent(t.icon);
          return (
            <SelectItem key={t.id} value={t.id.toString()}>
              <span className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {t.name}
                {t.isDefault && <Star className="h-3 w-3 text-amber-400 shrink-0" />}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
