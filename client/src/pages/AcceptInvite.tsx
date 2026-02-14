import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const acceptMutation = trpc.collaboration.accept.useMutation({
    onSuccess: (data) => {
      setAccepted(true);
      setProjectId(data.projectId);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  useEffect(() => {
    if (user && token && !accepted && !error && !acceptMutation.isPending) {
      acceptMutation.mutate({ token });
    }
  }, [user, token]);

  if (authLoading) {
    return (
      <div className="container max-w-md py-20 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container max-w-md py-20">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <h2 className="text-xl font-bold">You've been invited!</h2>
            <p className="text-muted-foreground">Sign in to accept this collaboration invite and view the project.</p>
            <Button onClick={() => window.location.href = getLoginUrl()}>
              Sign In to Accept
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (acceptMutation.isPending) {
    return (
      <div className="container max-w-md py-20 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Accepting invite...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-md py-20">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="text-xl font-bold">Invite Error</h2>
            <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted && projectId) {
    return (
      <div className="container max-w-md py-20">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <Check className="h-10 w-10 text-emerald-400 mx-auto" />
            <h2 className="text-xl font-bold">Invite Accepted!</h2>
            <p className="text-muted-foreground">You now have read-only access to this project.</p>
            <Button onClick={() => navigate(`/projects/${projectId}`)}>View Project</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
