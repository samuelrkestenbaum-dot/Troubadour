import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MessageSquare, Send, Trash2, Edit2, Check, X, Reply } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";

interface ReviewCommentsProps {
  reviewId: number;
  canComment: boolean;
}

export function ReviewComments({ reviewId, canComment }: ReviewCommentsProps) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: comments, isLoading } = trpc.comment.list.useQuery({ reviewId });
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [expanded, setExpanded] = useState(false);

  const createMutation = trpc.comment.create.useMutation({
    onSuccess: () => {
      utils.comment.list.invalidate({ reviewId });
      setNewComment("");
      setReplyTo(null);
      toast.success("Comment added");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.comment.update.useMutation({
    onSuccess: () => {
      utils.comment.list.invalidate({ reviewId });
      setEditingId(null);
      setEditContent("");
      toast.success("Comment updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.comment.delete.useMutation({
    onSuccess: () => {
      utils.comment.list.invalidate({ reviewId });
      toast.success("Comment deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    createMutation.mutate({
      reviewId,
      content: newComment.trim(),
      parentId: replyTo ?? undefined,
    });
  };

  const topLevel = comments?.filter(c => !c.parentId) || [];
  const replies = comments?.filter(c => c.parentId) || [];
  const getReplies = (parentId: number) => replies.filter(r => r.parentId === parentId);

  const commentCount = comments?.length || 0;

  return (
    <div className="space-y-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <MessageSquare className="h-4 w-4" />
        Comments
        {commentCount > 0 && (
          <Badge variant="secondary" className="text-xs">{commentCount}</Badge>
        )}
        <span className="text-xs">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className="space-y-3 pl-1 animate-in fade-in slide-in-from-top-1 duration-200">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <div key={i} className="h-16 bg-muted rounded animate-pulse" />)}
            </div>
          ) : topLevel.length > 0 ? (
            <div className="space-y-3">
              {topLevel.map(comment => (
                <div key={comment.id} className="space-y-2">
                  <CommentItem
                    comment={comment}
                    isOwn={user?.id === comment.userId}
                    editingId={editingId}
                    editContent={editContent}
                    onEdit={(id, content) => { setEditingId(id); setEditContent(content); }}
                    onCancelEdit={() => { setEditingId(null); setEditContent(""); }}
                    onSaveEdit={(id) => updateMutation.mutate({ id, content: editContent })}
                    onDelete={(id) => deleteMutation.mutate({ id })}
                    onReply={(id) => setReplyTo(id)}
                    setEditContent={setEditContent}
                    canComment={canComment}
                  />
                  {/* Replies */}
                  {getReplies(comment.id).length > 0 && (
                    <div className="ml-6 space-y-2 border-l-2 border-border/50 pl-3">
                      {getReplies(comment.id).map(reply => (
                        <CommentItem
                          key={reply.id}
                          comment={reply}
                          isOwn={user?.id === reply.userId}
                          editingId={editingId}
                          editContent={editContent}
                          onEdit={(id, content) => { setEditingId(id); setEditContent(content); }}
                          onCancelEdit={() => { setEditingId(null); setEditContent(""); }}
                          onSaveEdit={(id) => updateMutation.mutate({ id, content: editContent })}
                          onDelete={(id) => deleteMutation.mutate({ id })}
                          onReply={(id) => setReplyTo(id)}
                          setEditContent={setEditContent}
                          canComment={canComment}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-3">
              No comments yet. {canComment ? "Be the first to share your thoughts." : ""}
            </p>
          )}

          {/* New comment input */}
          {canComment && (
            <div className="space-y-2">
              {replyTo && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Reply className="h-3 w-3" />
                  Replying to comment
                  <button onClick={() => setReplyTo(null)} className="text-destructive hover:underline">Cancel</button>
                </div>
              )}
              <div className="flex gap-2">
                <Textarea
                  placeholder={replyTo ? "Write a reply..." : "Add a comment..."}
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
                  }}
                  className="min-h-[60px] text-sm resize-none"
                  rows={2}
                />
                <Button
                  size="icon"
                  onClick={handleSubmit}
                  disabled={!newComment.trim() || createMutation.isPending}
                  className="shrink-0 self-end"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Press Cmd+Enter to send</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CommentItem({
  comment,
  isOwn,
  editingId,
  editContent,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onReply,
  setEditContent,
  canComment,
}: {
  comment: { id: number; userName: string | null; content: string; createdAt: Date; userId: number };
  isOwn: boolean;
  editingId: number | null;
  editContent: string;
  onEdit: (id: number, content: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onReply: (id: number) => void;
  setEditContent: (s: string) => void;
  canComment: boolean;
}) {
  const isEditing = editingId === comment.id;

  return (
    <div className="rounded-lg bg-muted/30 p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{comment.userName || "Anonymous"}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {canComment && !isEditing && (
            <button
              onClick={() => onReply(comment.id)}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Reply"
            >
              <Reply className="h-3 w-3" />
            </button>
          )}
          {isOwn && !isEditing && (
            <>
              <button
                onClick={() => onEdit(comment.id, comment.content)}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="Edit"
              >
                <Edit2 className="h-3 w-3" />
              </button>
              <button
                onClick={() => onDelete(comment.id)}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-destructive transition-colors"
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      </div>
      {isEditing ? (
        <div className="flex gap-2">
          <Textarea
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            className="min-h-[40px] text-sm resize-none"
            rows={2}
          />
          <div className="flex flex-col gap-1 shrink-0">
            <button
              onClick={() => onSaveEdit(comment.id)}
              className="p-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              onClick={onCancelEdit}
              className="p-1.5 rounded bg-muted hover:bg-accent"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-foreground/80 whitespace-pre-wrap">{comment.content}</p>
      )}
    </div>
  );
}
