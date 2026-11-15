import { crewCode, crewSnapshotSchema, type CrewSnapshot } from "@/lib/crew";
import { mutateCrew, rateLimit, redis, secretHash } from "@/lib/crew-server";
import { randomBytes, randomInt } from "node:crypto";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const DAY_SECONDS = 86_400;
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const credentials = z.object({
  code: crewCode,
  token: z.string().regex(/^[a-f0-9]{64}$/),
});
const publish = credentials.extend({
  snapshot: crewSnapshotSchema,
  sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});
interface StoredEvent {
  tokenHash: string;
  expiresAt: number;
  updatedAt: number;
  sequence: number;
  snapshot: CrewSnapshot;
}
function reply(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
function failure() {
  return reply(
    {
      error:
        process.env.UPSTASH_REDIS_REST_URL &&
        process.env.UPSTASH_REDIS_REST_TOKEN
          ? "Crew sharing is temporarily unavailable. Your local timer is unaffected."
          : "Crew sharing isn’t configured for this installation yet. Your local timer is unaffected.",
    },
    503,
  );
}
function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(request.url);
  expected.host = request.headers.get("host") || expected.host;
  const protocol = request.headers.get("x-forwarded-proto");
  if (protocol === "http" || protocol === "https") expected.protocol = protocol;
  return (
    (!origin || origin === expected.origin) &&
    request.headers.get("content-type")?.startsWith("application/json")
  );
}
async function body(request: Request) {
  // Bound streamed input as well as Content-Length before parsing it.
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 131_072) {
      await reader.cancel();
      throw new Error("Body too large");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function GET(request: Request) {
  const parsed = crewCode.safeParse(
    new URL(request.url).searchParams.get("code"),
  );
  if (!parsed.success)
    return reply({ error: "Enter an eight-character event code." }, 400);
  try {
    if (!(await rateLimit(request, "view", 200, 60)))
      return reply({ error: "Too many requests. Try again shortly." }, 429);
    const raw = await redis<string | null>("GET", `aeon:crew:${parsed.data}`);
    if (!raw)
      return reply(
        { error: "This event code has expired or sharing has ended." },
        404,
      );
    const event: StoredEvent = JSON.parse(raw);
    if (event.expiresAt <= Date.now())
      return reply({ error: "This event code has expired." }, 404);
    return reply({
      snapshot: event.snapshot,
      updatedAt: event.updatedAt,
      expiresAt: event.expiresAt,
      serverNow: Date.now(),
    });
  } catch {
    return failure();
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return reply({ error: "Invalid request origin." }, 403);
  let snapshot: CrewSnapshot;
  try {
    snapshot = crewSnapshotSchema.parse(await body(request));
  } catch {
    return reply({ error: "Invalid event snapshot." }, 400);
  }
  try {
    if (!(await rateLimit(request, "create", 20, 3600)))
      return reply(
        { error: "Too many sharing sessions. Try again later." },
        429,
      );
    for (let attempt = 0; attempt < 4; attempt++) {
      const code = Array.from(
        { length: 8 },
        () => alphabet[randomInt(alphabet.length)],
      ).join("");
      const token = randomBytes(32).toString("hex");
      const now = Date.now();
      const event: StoredEvent = {
        snapshot,
        tokenHash: secretHash(token),
        sequence: 0,
        updatedAt: now,
        expiresAt: now + DAY_SECONDS * 1000,
      };
      if (
        await redis(
          "SET",
          `aeon:crew:${code}`,
          JSON.stringify(event),
          "EX",
          DAY_SECONDS,
          "NX",
        )
      ) {
        return reply({ code, token, expiresAt: event.expiresAt }, 201);
      }
    }
    return failure();
  } catch {
    return failure();
  }
}

async function mutate(request: Request, remove: boolean) {
  if (!sameOrigin(request))
    return reply({ error: "Invalid request origin." }, 403);
  let data;
  try {
    data = (remove ? credentials : publish).parse(await body(request));
  } catch {
    return reply({ error: "Invalid sharing request." }, 400);
  }
  try {
    if (!(await rateLimit(request, "write", 180, 60)))
      return reply({ error: "Too many requests. Try again shortly." }, 429);
    const update = remove ? null : publish.parse(data);
    const result = await redis<number>(
      "EVAL",
      mutateCrew,
      1,
      `aeon:crew:${data.code}`,
      secretHash(data.token),
      remove ? "delete" : "update",
      update?.sequence || 0,
      JSON.stringify(update?.snapshot || null),
      Date.now(),
    );
    if (result === -1)
      return reply(
        { error: "This device cannot control that sharing session." },
        403,
      );
    if (result === 0 && !remove)
      return reply(
        { error: "Sharing has ended or expired. Start a new sharing session." },
        404,
      );
    return reply({ ok: true });
  } catch {
    return failure();
  }
}
export const PUT = (request: Request) => mutate(request, false);
export const DELETE = (request: Request) => mutate(request, true);
