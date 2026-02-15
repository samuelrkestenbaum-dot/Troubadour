import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Zap, BookOpen } from "lucide-react";

export type ReviewLength = "brief" | "standard" | "detailed";

interface ReviewLengthSelectorProps {
  value: ReviewLength;
  onChange: (value: ReviewLength) => void;
  disabled?: boolean;
}

const OPTIONS: { value: ReviewLength; label: string; description: string; icon: React.ReactNode }[] = [
  { value: "brief", label: "Brief", description: "400-600 words", icon: <Zap className="h-3.5 w-3.5" /> },
  { value: "standard", label: "Standard", description: "800-1200 words", icon: <FileText className="h-3.5 w-3.5" /> },
  { value: "detailed", label: "Detailed", description: "1500-2000 words", icon: <BookOpen className="h-3.5 w-3.5" /> },
];

export function ReviewLengthSelector({ value, onChange, disabled }: ReviewLengthSelectorProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ReviewLength)} disabled={disabled}>
      <SelectTrigger className="w-[160px] h-9">
        <SelectValue placeholder="Review length" />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            <span className="flex items-center gap-2">
              {opt.icon}
              <span>{opt.label}</span>
              <span className="text-xs text-muted-foreground">({opt.description})</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
