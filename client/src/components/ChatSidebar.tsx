import { useChat } from "@/contexts/ChatContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  X,
  Plus,
  Trash2,
  Send,
  Loader2,
  Sparkles,
  ChevronLeft,
  Music,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { Streamdown } from "streamdown";

export function ChatToggleButton() {
  const { toggle, isOpen } = useChat();
  return (
    <button
      onClick={toggle}
      className={cn(
        "fixed right-4 bottom-4 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all",
        isOpen
          ? "bg-muted text-muted-foreground hover:bg-muted/80"
          : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/30"
      )}
      aria-label="Toggle AI chat"
    >
      {isOpen ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
    </button>
  );
}

export function ChatSidebar() {
  const {
    isOpen,
    close,
    activeSessionId,
    setActiveSession,
    contextProjectId,
    contextTrackId,
  } = useChat();

  const [view, setView] = useState<"sessions" | "chat">("sessions");
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Queries
  const sessionsQuery = trpc.chat.listSessions.useQuery(
    {
      projectId: contextProjectId ?? undefined,
      trackId: contextTrackId ?? undefined,
    },
    { enabled: isOpen }
  );

  const messagesQuery = trpc.chat.getMessages.useQuery(
    { sessionId: activeSessionId! },
    { enabled: !!activeSessionId && view === "chat" }
  );

  const createSession = trpc.chat.createSession.useMutation({
    onSuccess: (data) => {
      setActiveSession(data.id);
      setView("chat");
      sessionsQuery.refetch();
    },
  });

  const sendMessage = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      messagesQuery.refetch();
    },
  });

  const deleteSession = trpc.chat.deleteSession.useMutation({
    onSuccess: () => {
      if (view === "chat") {
        setView("sessions");
        setActiveSession(null);
      }
      sessionsQuery.refetch();
    },
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current && view === "chat") {
      const viewport = scrollRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      ) as HTMLDivElement;
      if (viewport) {
        requestAnimationFrame(() => {
          viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
        });
      }
    }
  }, [messagesQuery.data, sendMessage.isPending, view]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || !activeSessionId || sendMessage.isPending) return;
    sendMessage.mutate({ sessionId: activeSessionId, message: trimmed });
    setInput("");
    textareaRef.current?.focus();
  }, [input, activeSessionId, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    createSession.mutate({
      projectId: contextProjectId ?? undefined,
      trackId: contextTrackId ?? undefined,
    });
  };

  const openSession = (sessionId: number) => {
    setActiveSession(sessionId);
    setView("chat");
  };

  const displayMessages = (messagesQuery.data || []).filter(
    (m) => m.role !== "system"
  );

  const suggestedPrompts = contextTrackId
    ? [
        "What are the strongest elements of this track?",
        "How can I improve the mix?",
        "Compare this to industry standards",
        "What should I focus on for the next version?",
      ]
    : contextProjectId
    ? [
        "Give me an overview of this project",
        "Which track is the strongest single?",
        "What's the overall production quality?",
        "How can I improve the album sequencing?",
      ]
    : [
        "How do I get the most out of Troubadour?",
        "What makes a great mix?",
        "Tips for improving my songwriting",
        "How should I prepare tracks for analysis?",
      ];

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed right-0 top-0 z-40 flex h-full w-[380px] flex-col border-l bg-card text-card-foreground shadow-2xl transition-transform duration-300",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          {view === "chat" && (
            <button
              onClick={() => {
                setView("sessions");
                setActiveSession(null);
              }}
              className="mr-1 rounded-md p-1 hover:bg-accent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">
            {view === "chat" ? "AI Advisor" : "Conversations"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {view === "sessions" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleNewChat}
              disabled={createSession.isPending}
            >
              {createSession.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={close}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Context indicator */}
      {(contextProjectId || contextTrackId) && (
        <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          <Music className="h-3 w-3" />
          <span>
            {contextTrackId
              ? "Chatting about this track"
              : "Chatting about this project"}
          </span>
        </div>
      )}

      {/* Sessions List View */}
      {view === "sessions" && (
        <div className="flex flex-1 flex-col">
          <ScrollArea className="flex-1">
            {sessionsQuery.isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !sessionsQuery.data?.length ? (
              <div className="flex flex-col items-center gap-4 p-8 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/30" />
                <div>
                  <p className="text-sm font-medium">No conversations yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Start a conversation to get AI-powered feedback on your music
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={handleNewChat}
                  disabled={createSession.isPending}
                >
                  {createSession.isPending ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-3 w-3" />
                  )}
                  New conversation
                </Button>
              </div>
            ) : (
              <div className="p-2">
                {sessionsQuery.data.map((session) => (
                  <div
                    key={session.id}
                    className="group flex items-center gap-2 rounded-lg px-3 py-2.5 hover:bg-accent cursor-pointer"
                    onClick={() => openSession(session.id)}
                  >
                    <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {session.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(session.lastActiveAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession.mutate({ sessionId: session.id });
                      }}
                      className="opacity-0 group-hover:opacity-100 rounded p-1 hover:bg-destructive/10 hover:text-destructive transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Chat View */}
      {view === "chat" && activeSessionId && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-hidden">
            {messagesQuery.isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : displayMessages.length === 0 ? (
              <div className="flex flex-col items-center gap-4 p-6 text-center">
                <Sparkles className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">
                  Ask anything about your music
                </p>
                <div className="flex flex-col gap-2 w-full">
                  {suggestedPrompts.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setInput(prompt);
                        textareaRef.current?.focus();
                      }}
                      className="rounded-lg border border-border bg-card px-3 py-2 text-left text-xs transition-colors hover:bg-accent"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="flex flex-col gap-3 p-4">
                  {displayMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex gap-2",
                        msg.role === "user"
                          ? "justify-end"
                          : "justify-start"
                      )}
                    >
                      {msg.role === "assistant" && (
                        <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <Sparkles className="h-3 w-3 text-primary" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        )}
                      >
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:text-sm [&_li]:text-sm">
                            <Streamdown>{msg.content}</Streamdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        )}
                      </div>
                    </div>
                  ))}

                  {sendMessage.isPending && (
                    <div className="flex items-start gap-2">
                      <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Sparkles className="h-3 w-3 text-primary" />
                      </div>
                      <div className="rounded-lg bg-muted px-3 py-2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2 border-t bg-background/50 p-3"
          >
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your music..."
              className="flex-1 max-h-24 resize-none min-h-9 text-sm"
              rows={1}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || sendMessage.isPending}
              className="shrink-0 h-9 w-9"
            >
              {sendMessage.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
