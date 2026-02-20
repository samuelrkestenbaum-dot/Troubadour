import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { AlertTriangle, MessageSquare } from "lucide-react";

const CANCELLATION_REASONS = [
  { value: "too_expensive", label: "Too expensive for my needs" },
  { value: "missing_features", label: "Missing features I need" },
  { value: "found_alternative", label: "Found a better alternative" },
  { value: "not_using_enough", label: "Not using it enough to justify the cost" },
  { value: "quality_issues", label: "Quality of reviews didn't meet expectations" },
  { value: "temporary_break", label: "Taking a temporary break" },
  { value: "other", label: "Other reason" },
] as const;

interface CancellationSurveyProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProceedToCancel: () => void;
}

export default function CancellationSurvey({ open, onOpenChange, onProceedToCancel }: CancellationSurveyProps) {
  const [reason, setReason] = useState<string>("");
  const [feedbackText, setFeedbackText] = useState("");
  const [step, setStep] = useState<"survey" | "discount" | "confirm">("survey");
  const submitSurvey = trpc.subscription.submitCancellationSurvey.useMutation({
    onSuccess: (data) => {
      if (data.offerDiscount) {
        setStep("discount");
      } else {
        setStep("confirm");
      }
    },
    onError: () => {
      toast.error("Failed to submit feedback. You can still proceed with cancellation.");
      setStep("confirm");
    },
  });

  const acceptDiscount = trpc.subscription.acceptRetentionDiscount.useMutation({
    onSuccess: () => {
      toast.success("Discount applied! Your next billing cycle will be 30% off.");
      onOpenChange(false);
      resetState();
    },
    onError: () => {
      toast.error("Failed to apply discount. Please contact support.");
    },
  });

  const resetState = () => {
    setReason("");
    setFeedbackText("");
    setStep("survey");
  };

  const handleSubmitSurvey = () => {
    if (!reason) {
      toast.error("Please select a reason to continue.");
      return;
    }
    submitSurvey.mutate({ reason, feedbackText: feedbackText || undefined });
  };

  const handleAcceptDiscount = () => {
    acceptDiscount.mutate();
  };

  const handleDeclineAndCancel = () => {
    onProceedToCancel();
    onOpenChange(false);
    resetState();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        {step === "survey" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-amber-500" />
                Before you go...
              </DialogTitle>
              <DialogDescription>
                We'd love to understand why you're considering cancellation. Your feedback helps us improve Troubadour for all artists.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <RadioGroup value={reason} onValueChange={setReason}>
                {CANCELLATION_REASONS.map((r) => (
                  <div key={r.value} className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors">
                    <RadioGroupItem value={r.value} id={r.value} />
                    <Label htmlFor={r.value} className="flex-1 cursor-pointer text-sm">
                      {r.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              <div className="space-y-2">
                <Label htmlFor="feedback" className="text-sm text-muted-foreground">
                  Anything else you'd like to share? (optional)
                </Label>
                <Textarea
                  id="feedback"
                  placeholder="Tell us more about your experience..."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  rows={3}
                  maxLength={1000}
                />
              </div>
            </div>

            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Never mind
              </Button>
              <Button
                variant="destructive"
                onClick={handleSubmitSurvey}
                disabled={submitSurvey.isPending}
              >
                {submitSurvey.isPending ? "Submitting..." : "Continue with cancellation"}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "discount" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Wait — we have an offer for you
              </DialogTitle>
              <DialogDescription>
                We don't want to lose you! How about a <strong className="text-foreground">30% discount</strong> on your next billing cycle?
              </DialogDescription>
            </DialogHeader>

            <div className="py-6 text-center space-y-3">
              <div className="text-4xl font-bold text-primary">30% OFF</div>
              <p className="text-sm text-muted-foreground">
                Your next billing cycle at a reduced rate. No strings attached.
              </p>
            </div>

            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button
                variant="ghost"
                onClick={handleDeclineAndCancel}
              >
                No thanks, cancel anyway
              </Button>
              <Button
                onClick={handleAcceptDiscount}
                disabled={acceptDiscount.isPending}
              >
                {acceptDiscount.isPending ? "Applying..." : "Accept discount & stay"}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle>Thank you for your feedback</DialogTitle>
              <DialogDescription>
                Your response has been recorded. Click below to proceed to the Stripe billing portal where you can finalize the cancellation.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => { onOpenChange(false); resetState(); }}>
                Changed my mind
              </Button>
              <Button variant="destructive" onClick={handleDeclineAndCancel}>
                Proceed to cancellation
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
