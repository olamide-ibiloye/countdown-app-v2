import "server-only";
import { createHash } from "node:crypto";

export function secretHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function redis<T = unknown>(
  ...command: (string | number)[]
): Promise<T> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Sharing storage is not configured");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error("Sharing storage is unavailable");
  const body = await response.json();
  if (body.error) throw new Error("Sharing storage command failed");
  return body.result as T;
}

export async function rateLimit(
  request: Request,
  bucket: string,
  limit: number,
  seconds: number,
) {
  const address =
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    "local";
  const key = `aeon:crew:rate:${bucket}:${secretHash(address)}`;
  const count = await redis<number>(
    "EVAL",
    `
    local count = redis.call('INCR', KEYS[1])
    if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
    return count
  `,
    1,
    key,
    seconds,
  );
  return count <= limit;
}

// Authentication, sequence checking and mutation happen atomically. Delayed writes
// cannot overwrite newer snapshots or recreate a session after it is deleted.
export const mutateCrew = `
  local raw = redis.call('GET', KEYS[1])
  if not raw then return 0 end
  local event = cjson.decode(raw)
  if event.tokenHash ~= ARGV[1] then return -1 end
  if ARGV[2] == 'delete' then redis.call('DEL', KEYS[1]); return 1 end
  if tonumber(ARGV[3]) <= event.sequence then return 1 end
  event.sequence = tonumber(ARGV[3])
  event.snapshot = cjson.decode(ARGV[4])
  event.updatedAt = tonumber(ARGV[5])
  redis.call('SET', KEYS[1], cjson.encode(event), 'KEEPTTL')
  return 1
`;
