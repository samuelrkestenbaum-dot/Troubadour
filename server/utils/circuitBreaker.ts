/**
 * Circuit Breaker Pattern
 * 
 * Prevents cascading failures when external services (Claude, Gemini, Postmark) are down.
 * Three states: CLOSED (normal), OPEN (blocking calls), HALF_OPEN (testing recovery).
 * 
 * Usage:
 *   const breaker = new CircuitBreaker("claude", { failureThreshold: 5, resetTimeoutMs: 60000 });
 *   const result = await breaker.execute(() => callClaude(prompt));
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit */
  failureThreshold: number;
  /** Time in ms to wait before transitioning from OPEN to HALF_OPEN */
  resetTimeoutMs: number;
  /** Optional: number of successes in HALF_OPEN needed to close the circuit */
  halfOpenSuccessThreshold?: number;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeoutMs: 60_000, // 1 minute
  halfOpenSuccessThreshold: 2,
};

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private halfOpenSuccessCount = 0;
  private lastFailureTime = 0;
  private readonly name: string;
  private readonly options: Required<CircuitBreakerOptions>;

  constructor(name: string, options?: Partial<CircuitBreakerOptions>) {
    this.name = name;
    this.options = { ...DEFAULT_OPTIONS, ...options } as Required<CircuitBreakerOptions>;
  }

  getState(): CircuitState {
    if (this.state === "OPEN") {
      // Check if enough time has passed to transition to HALF_OPEN
      if (Date.now() - this.lastFailureTime >= this.options.resetTimeoutMs) {
        this.state = "HALF_OPEN";
        this.halfOpenSuccessCount = 0;
        console.log(`[CircuitBreaker:${this.name}] Transitioning from OPEN → HALF_OPEN`);
      }
    }
    return this.state;
  }

  /**
   * Execute a function through the circuit breaker.
   * Throws CircuitOpenError if the circuit is open.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === "OPEN") {
      const retryIn = Math.max(0, this.options.resetTimeoutMs - (Date.now() - this.lastFailureTime));
      throw new CircuitOpenError(
        `[CircuitBreaker:${this.name}] Circuit is OPEN. Service unavailable. Retry in ${Math.round(retryIn / 1000)}s.`,
        this.name,
        retryIn,
      );
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === "HALF_OPEN") {
      this.halfOpenSuccessCount++;
      if (this.halfOpenSuccessCount >= this.options.halfOpenSuccessThreshold) {
        this.state = "CLOSED";
        this.failureCount = 0;
        this.halfOpenSuccessCount = 0;
        console.log(`[CircuitBreaker:${this.name}] Circuit CLOSED after ${this.options.halfOpenSuccessThreshold} successful calls`);
      }
    } else {
      // Reset failure count on success in CLOSED state
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === "HALF_OPEN") {
      // Any failure in HALF_OPEN immediately reopens
      this.state = "OPEN";
      console.warn(`[CircuitBreaker:${this.name}] HALF_OPEN → OPEN after failure`);
    } else if (this.failureCount >= this.options.failureThreshold) {
      this.state = "OPEN";
      console.warn(`[CircuitBreaker:${this.name}] CLOSED → OPEN after ${this.failureCount} failures`);
    }
  }

  /** Reset the circuit breaker to CLOSED state (for admin/testing) */
  reset(): void {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.halfOpenSuccessCount = 0;
    this.lastFailureTime = 0;
    console.log(`[CircuitBreaker:${this.name}] Manually reset to CLOSED`);
  }

  /** Get diagnostic info */
  getInfo(): { name: string; state: CircuitState; failureCount: number; lastFailureTime: number } {
    return {
      name: this.name,
      state: this.getState(),
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

/**
 * Error thrown when the circuit is open and calls are blocked.
 */
export class CircuitOpenError extends Error {
  readonly serviceName: string;
  readonly retryInMs: number;

  constructor(message: string, serviceName: string, retryInMs: number) {
    super(message);
    this.name = "CircuitOpenError";
    this.serviceName = serviceName;
    this.retryInMs = retryInMs;
  }
}

// ── Singleton circuit breakers for each external service ──

export const claudeCircuitBreaker = new CircuitBreaker("claude", {
  failureThreshold: 5,
  resetTimeoutMs: 60_000,
  halfOpenSuccessThreshold: 2,
});

export const geminiCircuitBreaker = new CircuitBreaker("gemini", {
  failureThreshold: 5,
  resetTimeoutMs: 60_000,
  halfOpenSuccessThreshold: 2,
});

export const postmarkCircuitBreaker = new CircuitBreaker("postmark", {
  failureThreshold: 3,
  resetTimeoutMs: 120_000, // 2 minutes — email can wait longer
  halfOpenSuccessThreshold: 1,
});
