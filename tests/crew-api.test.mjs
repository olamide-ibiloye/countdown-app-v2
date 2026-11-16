import { test } from "node:test";
import assert from "node:assert/strict";

// Run against a local production/dev server with its own configured test Redis.
// Never point this test at a production event service.
const base = process.env.AEON_CREW_TEST_URL;
const snapshot = {
  output: { kind: "countdown" },
  timer: { name: "Opening", phase: "running", remainingMs: 1_200_000 },
  current: { name: "Opening", kind: "countdown", durationMs: 1_200_000 },
  next: { name: "Welcome graphic", kind: "image" },
};

test(
  "crew API separates viewer access, orders updates, revokes and bounds input",
  { skip: !base },
  async () => {
    assert(
      ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
      "Use a local test server",
    );
    const viewers = new Map();
    async function request(
      method,
      data,
      query = "",
      origin = new URL(base).origin,
    ) {
      const response = await fetch(`${base}/api/crew${query}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          ...(viewers.get(
            new URL(`${base}/api/crew${query}`).searchParams.get("code"),
          )
            ? {
                "X-Crew-Viewer": viewers.get(
                  new URL(`${base}/api/crew${query}`).searchParams.get("code"),
                ),
              }
            : {}),
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      });
      return {
        status: response.status,
        headers: response.headers,
        body: await response.json(),
      };
    }
    assert.equal(
      (await request("POST", snapshot, "", "https://other.example")).status,
      403,
    );
    assert.equal(
      (
        await request("POST", {
          ...snapshot,
          timer: { ...snapshot.timer, remainingMs: -1 },
        })
      ).status,
      400,
    );
    assert.equal(
      (await request("POST", { ...snapshot, garbage: "x".repeat(140000) }))
        .status,
      400,
    );
    assert.equal((await request("GET", undefined, "?code=bad")).status, 400);
    const created = await request("POST", snapshot);
    assert.equal(created.status, 201);
    const { code, token, expiresAt } = created.body;
    assert.match(code, /^[A-HJ-NP-Z2-9]{8}$/);
    assert.match(token, /^[a-f0-9]{64}$/);
    assert(Math.abs(expiresAt - Date.now() - 86_400_000) < 5000);
    try {
      assert.equal(
        (await fetch(`${base}/api/crew?code=${code}`)).status,
        401,
        "Snapshots require an admitted viewer",
      );
      const admission = await request("POST", { action: "join", code });
      assert.equal(admission.status, 200);
      viewers.set(code, admission.body.token);
      let view = await request("GET", undefined, `?code=${code}`);
      assert.equal(view.status, 200);
      assert.deepEqual(view.body.snapshot, snapshot);
      assert.match(view.headers.get("cache-control"), /no-store/);
      assert.equal(view.body.token, undefined);
      assert.equal(view.body.tokenHash, undefined);
      const badToken = "0".repeat(64);
      assert.equal(
        (await request("PUT", { code, token: badToken, sequence: 1, snapshot }))
          .status,
        403,
      );
      assert.equal(
        (await request("DELETE", { code, token: badToken })).status,
        403,
      );
      assert.equal(
        (await request("PUT", { code, sequence: 1, snapshot })).status,
        400,
      );
      const paused = {
        ...snapshot,
        timer: { ...snapshot.timer, phase: "paused", remainingMs: 900_000 },
      };
      assert.equal(
        (await request("PUT", { code, token, sequence: 2, snapshot: paused }))
          .status,
        200,
      );
      assert.equal(
        (await request("PUT", { code, token, sequence: 1, snapshot })).status,
        200,
      );
      view = await request("GET", undefined, `?code=${code}`);
      assert.deepEqual(
        view.body.snapshot,
        paused,
        "Delayed updates cannot overwrite newer state",
      );
      assert.equal(
        view.body.expiresAt,
        expiresAt,
        "Heartbeats must not extend event life",
      );
      for (const [index, output] of [
        {
          kind: "clock",
          twentyFourHours: false,
          timeMs: Date.now(),
          timeZone: "Europe/London",
        },
        {
          kind: "message",
          html: "<h2>Welcome</h2><p>Please take your seats.</p>",
        },
        { kind: "image", name: "Welcome graphic" },
        { kind: "standby" },
      ].entries()) {
        const next = { ...paused, output };
        assert.equal(
          (
            await request("PUT", {
              code,
              token,
              sequence: index + 3,
              snapshot: next,
            })
          ).status,
          200,
        );
        assert.deepEqual(
          (await request("GET", undefined, `?code=${code}`)).body.snapshot
            .output,
          output,
        );
      }
      assert.equal(
        (
          await request("PUT", {
            code,
            token,
            sequence: 10,
            snapshot: {
              ...snapshot,
              output: {
                kind: "clock",
                twentyFourHours: true,
                timeMs: Date.now(),
                timeZone: "not-a-zone",
              },
            },
          })
        ).status,
        400,
      );
      assert.equal((await request("DELETE", { code, token })).status, 200);
      assert.equal(
        (await request("GET", undefined, `?code=${code}`)).status,
        404,
      );
      assert.equal(
        (await request("PUT", { code, token, sequence: 3, snapshot })).status,
        404,
        "A late publication cannot revive a stopped event",
      );
      assert.equal(
        (await request("DELETE", { code, token })).status,
        200,
        "Cancellation retries are idempotent",
      );
    } finally {
      await request("DELETE", { code, token });
    }
  },
);

test(
  "event admission is atomic, limited to three viewer sessions and reusable after release",
  { skip: !base },
  async () => {
    assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
    const request = async (method, data, token, code) => {
      const response = await fetch(
        `${base}/api/crew${method === "GET" ? `?code=${code}` : ""}`,
        {
          method,
          headers: {
            "Content-Type": "application/json",
            Origin: new URL(base).origin,
            ...(token ? { "X-Crew-Viewer": token } : {}),
          },
          body: data ? JSON.stringify(data) : undefined,
        },
      );
      return { status: response.status, body: await response.json() };
    };
    const event = (await request("POST", snapshot)).body;
    try {
      const joins = await Promise.all(
        Array.from({ length: 8 }, () =>
          request("POST", { action: "join", code: event.code }),
        ),
      );
      const admitted = joins.filter((result) => result.status === 200);
      assert.equal(
        admitted.length,
        3,
        "Concurrent requests must never admit a fourth viewer",
      );
      assert.equal(joins.filter((result) => result.status === 409).length, 5);
      for (const viewer of admitted) {
        const view = await request(
          "GET",
          undefined,
          viewer.body.token,
          event.code,
        );
        assert.equal(view.status, 200);
        assert.deepEqual(view.body.snapshot, snapshot);
        assert.equal(view.body.viewers, undefined);
      }
      assert.equal(
        (await request("GET", undefined, "b".repeat(64), event.code)).status,
        410,
      );
      const released = admitted[0].body.token;
      assert.equal(
        (
          await request("DELETE", {
            action: "leave",
            code: event.code,
            token: released,
          })
        ).status,
        200,
      );
      assert.equal(
        (await request("GET", undefined, released, event.code)).status,
        410,
      );
      assert.equal(
        (await request("POST", { action: "join", code: event.code })).status,
        200,
      );
      assert.equal(
        (await request("POST", { action: "join", code: event.code })).status,
        409,
      );
      await request("PUT", {
        code: event.code,
        token: event.token,
        sequence: 1,
        snapshot,
      });
      assert.equal(
        (await request("POST", { action: "join", code: event.code })).status,
        409,
        "Publishing must preserve viewer reservations",
      );
    } finally {
      await request("DELETE", { code: event.code, token: event.token });
    }
  },
);
