const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function statusOf(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  const value = error as { status?: unknown; statusCode?: unknown };
  const status = value.status ?? value.statusCode;
  return typeof status === "number" ? status : undefined;
}

function isRetryable(error: unknown) {
  const status = statusOf(error);
  if (status !== undefined) return RETRYABLE_STATUS.has(status);
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError" || /timed out|timeout|network|fetch failed|socket/i.test(error.message));
}

export async function withRetry<T>(operation: () => Promise<T>, attempts = 2): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= attempts || !isRetryable(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}
