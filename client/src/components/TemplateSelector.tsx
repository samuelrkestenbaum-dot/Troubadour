import { trpc } from "@/lib/trpc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText } from "lucide-react";

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
      <SelectTrigger className={`w-[180px] h-9 text-sm ${className ?? ""}`}>
        <FileText className="h-3.5 w-3.5 mr-1.5 shrink-0 text-muted-foreground" />
        <SelectValue placeholder="Review Template" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="default">Default Review</SelectItem>
        {templates.map((t) => (
          <SelectItem key={t.id} value={t.id.toString()}>
            {t.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
