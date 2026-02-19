import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { CheckCircle2, XCircle, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Email Verification Page
 * 
 * Handles the token-based verification flow when users click the email link.
 * URL: /verify-email?token=<token>
 */
export default function VerifyEmail() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState("");

  const verifyMutation = trpc.emailVerification.verify.useMutation({
    onSuccess: (data) => {
      setStatus("success");
      setMessage(data.message);
      setVerifiedEmail(data.email);
    },
    onError: (err) => {
      setStatus("error");
      setMessage(err.message || "Verification failed. Please try again.");
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      verifyMutation.mutate({ token });
    } else {
      setStatus("error");
      setMessage("No verification token found in the URL.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a1a] via-[#111128] to-[#0a0a1a] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-[#16162a]/80 backdrop-blur-sm border border-purple-500/10 rounded-2xl p-8 text-center">
          {/* Logo */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-purple-400">Troubadour</h1>
            <p className="text-sm text-gray-500 mt-1">AI-Powered Music Critique</p>
          </div>

          {status === "verifying" && (
            <div className="space-y-4">
              <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto" />
              <p className="text-gray-300 text-lg">Verifying your email...</p>
              <p className="text-gray-500 text-sm">This should only take a moment.</p>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10 text-green-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Email Verified!</h2>
              <p className="text-gray-400">{message}</p>
              {verifiedEmail && (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500 bg-white/5 rounded-lg py-2 px-4 mx-auto w-fit">
                  <Mail className="w-4 h-4" />
                  <span>{verifiedEmail}</span>
                </div>
              )}
              <p className="text-gray-500 text-sm">
                You'll now receive email digests, review notifications, and collaboration invites.
              </p>
              <div className="pt-2 flex gap-3 justify-center">
                <Button
                  onClick={() => navigate("/dashboard")}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Go to Dashboard
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/settings")}
                  className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
                >
                  Settings
                </Button>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
                <XCircle className="w-10 h-10 text-red-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Verification Failed</h2>
              <p className="text-gray-400">{message}</p>
              <div className="pt-2 flex gap-3 justify-center">
                <Button
                  onClick={() => navigate("/settings")}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Request New Link
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/")}
                  className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
                >
                  Home
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
