import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarDays } from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getCellColor(count: number, maxCount: number) {
  if (count === 0) return "bg-muted/20";
  const intensity = count / Math.max(maxCount, 1);
  if (intensity > 0.75) return "bg-emerald-500";
  if (intensity > 0.5) return "bg-emerald-400/80";
  if (intensity > 0.25) return "bg-emerald-400/50";
  return "bg-emerald-400/25";
}

interface HeatmapData {
  day: number;
  hour: number;
  count: number;
}

export function ActivityHeatmap({ data }: { data: HeatmapData[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const grid = new Map<string, number>();
  for (const d of data) {
    grid.set(`${d.day}-${d.hour}`, d.count);
  }

  const formatHour = (h: number) => {
    if (h === 0) return "12a";
    if (h < 12) return `${h}a`;
    if (h === 12) return "12p";
    return `${h - 12}p`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          Activity Heatmap
        </CardTitle>
        <p className="text-xs text-muted-foreground">Review activity over the last 90 days</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Hour labels */}
            <div className="flex mb-1">
              <div className="w-10 shrink-0" />
              {HOURS.filter((_, i) => i % 3 === 0).map(h => (
                <div key={h} className="text-[10px] text-muted-foreground/60 text-center" style={{ width: `${(3 / 24) * 100}%` }}>
                  {formatHour(h)}
                </div>
              ))}
            </div>
            {/* Grid rows */}
            <TooltipProvider delayDuration={100}>
              {DAYS.map((dayLabel, dayIdx) => (
                <div key={dayIdx} className="flex items-center gap-1 mb-[2px]">
                  <span className="text-[10px] text-muted-foreground w-10 text-right pr-2 shrink-0">{dayLabel}</span>
                  <div className="flex-1 flex gap-[2px]">
                    {HOURS.map(h => {
                      const count = grid.get(`${dayIdx}-${h}`) ?? 0;
                      return (
                        <Tooltip key={h}>
                          <TooltipTrigger asChild>
                            <div
                              className={`flex-1 h-4 rounded-[2px] transition-colors ${getCellColor(count, maxCount)}`}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {dayLabel} {formatHour(h)}: {count} review{count !== 1 ? "s" : ""}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              ))}
            </TooltipProvider>
            {/* Legend */}
            <div className="flex items-center justify-end gap-1 mt-3">
              <span className="text-[10px] text-muted-foreground mr-1">Less</span>
              <div className="w-3 h-3 rounded-[2px] bg-muted/20" />
              <div className="w-3 h-3 rounded-[2px] bg-emerald-400/25" />
              <div className="w-3 h-3 rounded-[2px] bg-emerald-400/50" />
              <div className="w-3 h-3 rounded-[2px] bg-emerald-400/80" />
              <div className="w-3 h-3 rounded-[2px] bg-emerald-500" />
              <span className="text-[10px] text-muted-foreground ml-1">More</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
