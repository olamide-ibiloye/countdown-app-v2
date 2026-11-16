export class CrewRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryAfterMs = 0,
  ) {
    super(message);
  }
}
export async function crewRequest<T>(
  method: string,
  data?: unknown,
  code?: string,
  viewerToken?: string,
): Promise<T> {
  const response = await fetch(
    `/api/crew${code ? `?code=${encodeURIComponent(code)}` : ""}`,
    {
      method,
      cache: "no-store",
      headers: {
        ...(data ? { "Content-Type": "application/json" } : {}),
        ...(viewerToken ? { "X-Crew-Viewer": viewerToken } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(8_000),
    },
  );
  const result = await response.json().catch(() => ({}));
  const retry = response.headers.get("retry-after");
  const retryAfterMs = retry
    ? /^\d+$/.test(retry)
      ? Number(retry) * 1000
      : Math.max(0, Date.parse(retry) - Date.now())
    : 0;
  if (!response.ok)
    throw new CrewRequestError(
      result.error || "Crew sharing is unavailable.",
      response.status,
      Number.isFinite(retryAfterMs) ? retryAfterMs : 0,
    );
  return result as T;
}

export function crewRetryDelay(failures: number, cause: unknown) {
  const delay = Math.min(60_000, 10_000 * 2 ** Math.min(failures, 3));
  return Math.max(
    delay + Math.floor(Math.random() * 1000),
    cause instanceof CrewRequestError ? cause.retryAfterMs : 0,
  );
}
