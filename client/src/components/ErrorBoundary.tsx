import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw, Home, Copy, Check } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Optional fallback component */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  copied: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, copied: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });

    // Report to Sentry if available
    try {
      import("@/lib/sentry").then(({ captureError }) => {
        captureError(error, {
          componentStack: errorInfo.componentStack || "",
          url: window.location.href,
          timestamp: new Date().toISOString(),
        });
      }).catch(() => {
        // Sentry not available — that's fine
      });
    } catch {
      // Ignore
    }

    // Log to console for debugging
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
  }

  handleCopyError = () => {
    const errorText = [
      `Error: ${this.state.error?.message}`,
      `URL: ${window.location.href}`,
      `Time: ${new Date().toISOString()}`,
      `User Agent: ${navigator.userAgent}`,
      "",
      "Stack Trace:",
      this.state.error?.stack || "No stack trace available",
      "",
      "Component Stack:",
      this.state.errorInfo?.componentStack || "No component stack available",
    ].join("\n");

    navigator.clipboard.writeText(errorText).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background text-foreground">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
              <AlertTriangle
                size={32}
                className="text-destructive flex-shrink-0"
              />
            </div>

            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground text-center mb-6">
              An unexpected error occurred. This has been automatically reported to our team.
              You can try reloading the page or going back to the dashboard.
            </p>

            <div className="p-4 w-full rounded-lg bg-muted/50 border border-border overflow-auto mb-6 max-h-48">
              <p className="text-sm font-mono text-destructive mb-2">
                {this.state.error?.message || "Unknown error"}
              </p>
              <pre className="text-xs text-muted-foreground whitespace-break-spaces">
                {this.state.error?.stack?.split("\n").slice(1, 6).join("\n") || "No stack trace"}
              </pre>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg",
                  "bg-primary text-primary-foreground",
                  "hover:opacity-90 cursor-pointer transition-opacity"
                )}
              >
                <RotateCcw size={16} />
                Reload Page
              </button>

              <button
                onClick={() => { window.location.href = "/dashboard"; }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg",
                  "bg-muted text-foreground border border-border",
                  "hover:bg-muted/80 cursor-pointer transition-colors"
                )}
              >
                <Home size={16} />
                Dashboard
              </button>

              <button
                onClick={this.handleCopyError}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg",
                  "bg-muted text-foreground border border-border",
                  "hover:bg-muted/80 cursor-pointer transition-colors"
                )}
              >
                {this.state.copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                {this.state.copied ? "Copied" : "Copy Error"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
