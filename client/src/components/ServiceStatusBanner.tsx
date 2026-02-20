import { useState, useEffect } from "react";
import { AlertTriangle, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

/**
 * ServiceStatusBanner — shows a dismissible banner when AI services
 * (Claude, Gemini) are experiencing issues. Checks circuit breaker
 * status from the server.
 */
export function ServiceStatusBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { data, refetch } = trpc.system.serviceHealth.useQuery(undefined, {
    refetchInterval: 60_000, // Check every minute
    retry: false,
  });

  if (dismissed || !data) return null;

  const degraded = data.services.some((s: { status: string }) => s.status !== "healthy");
  if (!degraded) return null;

  const unhealthy = data.services.filter((s: { status: string }) => s.status !== "healthy");

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 mb-4 flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-200">
          Some AI services are experiencing issues
        </p>
        <p className="text-xs text-amber-200/70 mt-1">
          {unhealthy.map((s: { name: string; status: string }) =>
            `${s.name}: ${s.status === "degraded" ? "slow responses" : "temporarily unavailable"}`
          ).join(". ")}
          . Reviews may take longer than usual or need to be retried.
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-amber-400 hover:text-amber-300"
          onClick={() => refetch()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-amber-400 hover:text-amber-300"
          onClick={() => setDismissed(true)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default ServiceStatusBanner;
