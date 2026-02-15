import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Bell, Check, CheckCheck, Music, Users, Info, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocation } from "wouter";

const typeIcons: Record<string, React.ElementType> = {
  review_complete: Music,
  collaboration_invite: Users,
  collaboration_accepted: Users,
  system: Info,
};

const typeColors: Record<string, string> = {
  review_complete: "text-emerald-500",
  collaboration_invite: "text-amber-500",
  collaboration_accepted: "text-sky-500",
  system: "text-muted-foreground",
};

function timeAgo(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();

  const { data } = trpc.notification.list.useQuery(undefined, {
    refetchInterval: 15000, // Poll every 15s
  });
  const unreadCount = data?.unreadCount || 0;
  const items = data?.items || [];

  const markRead = trpc.notification.markRead.useMutation({
    onSuccess: () => utils.notification.list.invalidate(),
  });
  const markAllRead = trpc.notification.markAllRead.useMutation({
    onSuccess: () => utils.notification.list.invalidate(),
  });
  const utils = trpc.useUtils();

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative h-9 w-9 rounded-lg flex items-center justify-center hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className="h-4.5 w-4.5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4.5 min-w-[18px] rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl border bg-popover text-popover-foreground shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <h3 className="text-sm font-semibold" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
              Notifications
            </h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </Button>
            )}
          </div>

          <ScrollArea className="max-h-[400px]">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>No notifications yet</p>
                <p className="text-xs mt-1">You'll be notified when reviews complete</p>
              </div>
            ) : (
              <div className="divide-y">
                {items.map((item) => {
                  const Icon = typeIcons[item.type] || Info;
                  const color = typeColors[item.type] || "text-muted-foreground";
                  return (
                    <button
                      key={item.id}
                      className={`w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors flex gap-3 ${
                        !item.isRead ? "bg-primary/5" : ""
                      }`}
                      onClick={() => {
                        if (!item.isRead) {
                          markRead.mutate({ notificationId: item.id });
                        }
                        if (item.link) {
                          setLocation(item.link);
                          setOpen(false);
                        }
                      }}
                    >
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                        !item.isRead ? "bg-primary/10" : "bg-muted"
                      }`}>
                        <Icon className={`h-4 w-4 ${!item.isRead ? color : "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium truncate ${!item.isRead ? "" : "text-muted-foreground"}`}>
                            {item.title}
                          </span>
                          {!item.isRead && (
                            <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {item.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground/70">
                            {timeAgo(item.createdAt)}
                          </span>
                          {item.link && (
                            <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/50" />
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
