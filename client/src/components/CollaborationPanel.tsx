import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Users, UserPlus, Mail, Check, Clock, Trash2, Copy, Link } from "lucide-react";
import { useState } from "react";

export function CollaborationPanel({ projectId, isOwner }: { projectId: number; isOwner: boolean }) {
  const utils = trpc.useUtils();
  const { data: collaborators, isLoading } = trpc.collaboration.list.useQuery({ projectId });
  const [email, setEmail] = useState("");
  const [showInvite, setShowInvite] = useState(false);

  const inviteMutation = trpc.collaboration.invite.useMutation({
    onSuccess: (data) => {
      utils.collaboration.list.invalidate({ projectId });
      setEmail("");
      setShowInvite(false);
      if (data.autoAccepted) {
        toast.success("Collaborator added — they already have an account");
      } else {
        toast.success("Invite sent! Share the invite link with them.");
      }
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const removeMutation = trpc.collaboration.remove.useMutation({
    onSuccess: () => {
      utils.collaboration.list.invalidate({ projectId });
      toast.success("Collaborator removed");
    },
  });

  const handleInvite = () => {
    if (!email.trim()) return;
    inviteMutation.mutate({ projectId, email: email.trim() });
  };

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(link);
    toast.success("Invite link copied to clipboard");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Collaborators
          </CardTitle>
          {isOwner && (
            <Dialog open={showInvite} onOpenChange={setShowInvite}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <UserPlus className="h-3.5 w-3.5 mr-1" />
                  Invite
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Collaborator</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  Invite someone to view this project's reviews. They'll get read-only access.
                </p>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="colleague@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleInvite(); }}
                  />
                  <Button onClick={handleInvite} disabled={inviteMutation.isPending || !email.trim()}>
                    {inviteMutation.isPending ? "Sending..." : "Invite"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
          </div>
        ) : collaborators && collaborators.length > 0 ? (
          collaborators.map(collab => (
            <div key={collab.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm truncate">{collab.userName || collab.invitedEmail}</span>
                {collab.status === "accepted" ? (
                  <Badge variant="secondary" className="text-xs gap-1 text-emerald-400">
                    <Check className="h-2.5 w-2.5" /> Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs gap-1 text-amber-400">
                    <Clock className="h-2.5 w-2.5" /> Pending
                  </Badge>
                )}
              </div>
              {isOwner && (
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                    onClick={() => removeMutation.mutate({ id: collab.id, projectId })}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">
            {isOwner ? "No collaborators yet. Invite someone to share this project." : "No other collaborators."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
