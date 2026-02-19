import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Mail, X, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Email Verification Banner
 * 
 * Shows a persistent banner at the top of the dashboard when the user's
 * email is not yet verified. Includes a "Send Verification Email" button
 * with rate limiting and success/error feedback.
 */
export function EmailVerificationBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [sent, setSent] = useState(false);

  const statusQuery = trpc.emailVerification.status.useQuery(undefined, {
    enabled: !!user,
  });

  const sendMutation = trpc.emailVerification.sendVerification.useMutation({
    onSuccess: (data) => {
      setSent(true);
      toast.success(data.message);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Don't show if: no user, already verified, dismissed, loading, or no email
  if (!user) return null;
  if (statusQuery.isLoading) return null;
  if (statusQuery.data?.emailVerified) return null;
  if (!statusQuery.data?.hasEmail) return null;
  if (dismissed) return null;

  const handleSend = () => {
    sendMutation.mutate({ origin: window.location.origin });
  };

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Mail className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="min-w-0">
            {sent ? (
              <p className="text-sm text-amber-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                Verification email sent to <strong className="truncate">{statusQuery.data?.email}</strong>. Check your inbox.
              </p>
            ) : (
              <p className="text-sm text-amber-200">
                <span className="hidden sm:inline">Please verify your email address to receive digests, notifications, and collaboration invites. </span>
                <span className="sm:hidden">Verify your email to unlock all features. </span>
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!sent && (
            <Button
              size="sm"
              onClick={handleSend}
              disabled={sendMutation.isPending}
              className="bg-amber-500 hover:bg-amber-600 text-black font-medium text-xs h-8 min-h-[44px] sm:min-h-0"
            >
              {sendMutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : null}
              Verify Email
            </Button>
          )}
          <button
            onClick={() => setDismissed(true)}
            className="text-amber-400/60 hover:text-amber-400 p-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
