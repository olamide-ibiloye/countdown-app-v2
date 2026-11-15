export class CrewRequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function crewRequest<T>(
  method: string,
  data?: unknown,
  code?: string,
): Promise<T> {
  const response = await fetch(
    `/api/crew${code ? `?code=${encodeURIComponent(code)}` : ""}`,
    {
      method,
      cache: "no-store",
      headers: data ? { "Content-Type": "application/json" } : undefined,
      body: data ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(8_000),
    },
  );
  const result = await response.json();
  if (!response.ok)
    throw new CrewRequestError(
      result.error || "Crew sharing is unavailable.",
      response.status,
    );
  return result as T;
}
