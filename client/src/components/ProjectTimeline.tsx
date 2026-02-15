import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Upload, Star, RefreshCw, Tag, CheckCircle2, Music } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectTimelineProps {
  projectId: number;
  tracks?: any[];
}

interface TimelineEvent {
  id: string;
  date: Date;
  type: "upload" | "review" | "re-review" | "tagged" | "ready";
  trackName: string;
  trackId: number;
  detail?: string;
  score?: number;
}

export function ProjectTimeline({ projectId, tracks }: ProjectTimelineProps) {

  const events = useMemo(() => {
    if (!tracks) return [];
    const allEvents: TimelineEvent[] = [];

    for (const track of tracks) {
      // Upload event
      allEvents.push({
        id: `upload-${track.id}`,
        date: new Date(track.createdAt),
        type: "upload",
        trackName: track.originalFilename,
        trackId: track.id,
      });

      // Review event (if reviewed)
      if (track.status === "reviewed" && track.updatedAt) {
        allEvents.push({
          id: `review-${track.id}`,
          date: new Date(track.updatedAt),
          type: "review",
          trackName: track.originalFilename,
          trackId: track.id,
          score: track.overallScore ?? undefined,
        });
      }

      // Tag events
      if (track.tags) {
        try {
          const tags = JSON.parse(track.tags as string) as string[];
          if (tags.includes("ready") || tags.includes("mastered") || tags.includes("final")) {
            allEvents.push({
              id: `ready-${track.id}`,
              date: new Date(track.updatedAt || track.createdAt),
              type: "ready",
              trackName: track.originalFilename,
              trackId: track.id,
              detail: tags.filter(t => ["ready", "mastered", "final"].includes(t)).join(", "),
            });
          }
          const otherTags = tags.filter(t => !["ready", "mastered", "final"].includes(t));
          if (otherTags.length > 0) {
            allEvents.push({
              id: `tagged-${track.id}`,
              date: new Date(track.updatedAt || track.createdAt),
              type: "tagged",
              trackName: track.originalFilename,
              trackId: track.id,
              detail: otherTags.join(", "),
            });
          }
        } catch {}
      }
    }

    return allEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [tracks]);

  const EVENT_CONFIG = {
    upload: { icon: Upload, color: "bg-blue-500", label: "Uploaded" },
    review: { icon: Star, color: "bg-amber-500", label: "Reviewed" },
    "re-review": { icon: RefreshCw, color: "bg-purple-500", label: "Re-reviewed" },
    tagged: { icon: Tag, color: "bg-cyan-500", label: "Tagged" },
    ready: { icon: CheckCircle2, color: "bg-emerald-500", label: "Ready" },
  };

  // Group events by date
  const groupedByDate = useMemo(() => {
    const groups: Map<string, TimelineEvent[]> = new Map();
    for (const event of events) {
      const dateKey = event.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey)!.push(event);
    }
    return Array.from(groups.entries());
  }, [events]);

  if (!tracks || tracks.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Project Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Music className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Upload tracks to see your project timeline.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Summary stats
  const totalTracks = tracks.length;
  const reviewedTracks = tracks.filter((t: any) => t.status === "reviewed").length;
  const readyTracks = tracks.filter((t: any) => {
    try {
      const tags = JSON.parse((t.tags as string) || "[]") as string[];
      return tags.some(tag => ["ready", "mastered", "final"].includes(tag));
    } catch { return false; }
  }).length;

  const firstUpload = events.length > 0 ? events[0].date : null;
  const lastActivity = events.length > 0 ? events[events.length - 1].date : null;
  const daySpan = firstUpload && lastActivity
    ? Math.max(1, Math.ceil((lastActivity.getTime() - firstUpload.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Project Timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary bar */}
        <div className="grid grid-cols-4 gap-3 text-center">
          <div className="p-2 rounded-lg bg-muted/30">
            <div className="text-xl font-bold">{totalTracks}</div>
            <div className="text-xs text-muted-foreground">Tracks</div>
          </div>
          <div className="p-2 rounded-lg bg-muted/30">
            <div className="text-xl font-bold text-amber-500">{reviewedTracks}</div>
            <div className="text-xs text-muted-foreground">Reviewed</div>
          </div>
          <div className="p-2 rounded-lg bg-muted/30">
            <div className="text-xl font-bold text-emerald-500">{readyTracks}</div>
            <div className="text-xs text-muted-foreground">Ready</div>
          </div>
          <div className="p-2 rounded-lg bg-muted/30">
            <div className="text-xl font-bold">{daySpan}</div>
            <div className="text-xs text-muted-foreground">Days</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Album Progress</span>
            <span>{totalTracks > 0 ? Math.round((readyTracks / totalTracks) * 100) : 0}%</span>
          </div>
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden flex">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${totalTracks > 0 ? (readyTracks / totalTracks) * 100 : 0}%` }}
            />
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${totalTracks > 0 ? ((reviewedTracks - readyTracks) / totalTracks) * 100 : 0}%` }}
            />
            <div
              className="h-full bg-blue-500/50 transition-all"
              style={{ width: `${totalTracks > 0 ? ((totalTracks - reviewedTracks) / totalTracks) * 100 : 0}%` }}
            />
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Ready</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Reviewed</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500/50" /> Uploaded</span>
          </div>
        </div>

        {/* Timeline */}
        <div className="relative pl-6 space-y-4">
          {/* Vertical line */}
          <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />

          {groupedByDate.map(([dateLabel, dateEvents]) => (
            <div key={dateLabel} className="space-y-2">
              <div className="relative flex items-center gap-2">
                <div className="absolute -left-6 w-6 h-6 rounded-full bg-muted border-2 border-border flex items-center justify-center z-10">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-2">
                  {dateLabel}
                </span>
              </div>

              {dateEvents.map((event) => {
                const config = EVENT_CONFIG[event.type];
                const EventIcon = config.icon;

                return (
                  <div key={event.id} className="relative flex items-start gap-3 pl-2">
                    <div className={cn("absolute -left-6 w-6 h-6 rounded-full flex items-center justify-center z-10", config.color)}>
                      <EventIcon className="h-3 w-3 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{event.trackName}</span>
                        <Badge variant="outline" className="text-xs">
                          {config.label}
                        </Badge>
                        {event.score !== undefined && (
                          <Badge variant="secondary" className="text-xs">
                            {event.score}/10
                          </Badge>
                        )}
                        {event.detail && (
                          <span className="text-xs text-muted-foreground">{event.detail}</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {event.date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
