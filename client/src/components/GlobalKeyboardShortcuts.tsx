import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

/**
 * Global keyboard shortcuts for navigation.
 * Supports two-key sequences (G then H for Home, etc.) and single-key shortcuts.
 * Must be rendered once at the app root level.
 */
export function GlobalKeyboardShortcuts() {
  const [, setLocation] = useLocation();
  const pendingPrefix = useRef<string | null>(null);
  const prefixTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      // Handle second key of a two-key sequence
      if (pendingPrefix.current === "g") {
        pendingPrefix.current = null;
        if (prefixTimer.current) clearTimeout(prefixTimer.current);

        switch (key) {
          case "h":
            e.preventDefault();
            setLocation("/");
            return;
          case "d":
            e.preventDefault();
            setLocation("/dashboard");
            return;
          case "a":
            e.preventDefault();
            setLocation("/insights");
            return;
          case "s":
            e.preventDefault();
            setLocation("/settings");
            return;
          case "t":
            e.preventDefault();
            setLocation("/templates");
            return;
          case "b":
            e.preventDefault();
            setLocation("/benchmarks");
            return;
          case "i":
            e.preventDefault();
            setLocation("/insights");
            return;
          case "p":
            e.preventDefault();
            setLocation("/pricing");
            return;
        }
        return;
      }

      // Start a two-key sequence with "g"
      if (key === "g") {
        pendingPrefix.current = "g";
        // Auto-clear after 800ms if no second key
        prefixTimer.current = setTimeout(() => {
          pendingPrefix.current = null;
        }, 800);
        return;
      }

      // Single-key shortcuts
      if (key === "n") {
        e.preventDefault();
        setLocation("/projects/new");
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (prefixTimer.current) clearTimeout(prefixTimer.current);
    };
  }, [setLocation]);

  return null;
}
