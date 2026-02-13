import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface ChatContextState {
  isOpen: boolean;
  activeSessionId: number | null;
  contextProjectId: number | null;
  contextTrackId: number | null;
  toggle: () => void;
  open: (opts?: { projectId?: number; trackId?: number }) => void;
  close: () => void;
  setActiveSession: (id: number | null) => void;
  setContext: (opts: { projectId?: number | null; trackId?: number | null }) => void;
}

const ChatContext = createContext<ChatContextState | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [contextProjectId, setContextProjectId] = useState<number | null>(null);
  const [contextTrackId, setContextTrackId] = useState<number | null>(null);

  const toggle = useCallback(() => setIsOpen(prev => !prev), []);
  const close = useCallback(() => setIsOpen(false), []);

  const open = useCallback((opts?: { projectId?: number; trackId?: number }) => {
    if (opts?.projectId) setContextProjectId(opts.projectId);
    if (opts?.trackId) setContextTrackId(opts.trackId);
    setIsOpen(true);
  }, []);

  const setContext = useCallback((opts: { projectId?: number | null; trackId?: number | null }) => {
    if (opts.projectId !== undefined) setContextProjectId(opts.projectId);
    if (opts.trackId !== undefined) setContextTrackId(opts.trackId);
  }, []);

  return (
    <ChatContext.Provider value={{
      isOpen,
      activeSessionId,
      contextProjectId,
      contextTrackId,
      toggle,
      open,
      close,
      setActiveSession: setActiveSessionId,
      setContext,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within a ChatProvider");
  return ctx;
}
