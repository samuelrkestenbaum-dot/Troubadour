import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Users, UserPlus, Mail, Check, Clock, Trash2, Eye, MessageSquare, Loader2 } from "lucide-react";
import { useState } from "react";

export function CollaborationPanel({ projectId, isOwner }: { projectId: number; isOwner: boolean }) {
  const utils = trpc.useUtils();
  const { data: collaborators, isLoading } = trpc.collaboration.list.useQuery({ projectId });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "commenter">("viewer");
  const [showInvite, setShowInvite] = useState(false);

  const inviteMutation = trpc.collaboration.invite.useMutation({
    onSuccess: (data) => {
      utils.collaboration.list.invalidate({ projectId });
      setEmail("");
      setRole("viewer");
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
    inviteMutation.mutate({ projectId, email: email.trim(), role });
  };

  const roleIcon = (r: string) => r === "commenter"
    ? <MessageSquare className="h-2.5 w-2.5" />
    : <Eye className="h-2.5 w-2.5" />;

  const roleLabel = (r: string) => r === "commenter" ? "Commenter" : "Viewer";

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
                  Invite someone to access this project. Choose their permission level.
                </p>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="colleague@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleInvite(); }}
                      className="flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground shrink-0">Access level:</span>
                    <Select value={role} onValueChange={(v) => setRole(v as "viewer" | "commenter")}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">
                          <span className="flex items-center gap-2">
                            <Eye className="h-3.5 w-3.5" /> Viewer
                          </span>
                        </SelectItem>
                        <SelectItem value="commenter">
                          <span className="flex items-center gap-2">
                            <MessageSquare className="h-3.5 w-3.5" /> Commenter
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2.5 space-y-1">
                    {role === "viewer" ? (
                      <>
                        <p className="font-medium">Viewer access:</p>
                        <p>Can view all tracks, reviews, and analysis. Cannot leave comments or make changes.</p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium">Commenter access:</p>
                        <p>Can view all tracks, reviews, and analysis. Can leave comments and replies on reviews.</p>
                      </>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleInvite} disabled={inviteMutation.isPending || !email.trim()}>
                    {inviteMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</>
                    ) : "Send Invite"}
                  </Button>
                </DialogFooter>
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
                <Badge variant="outline" className="text-xs gap-1">
                  {roleIcon(collab.role)}
                  {roleLabel(collab.role)}
                </Badge>
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
