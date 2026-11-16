import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const compiled = mkdtempSync(join(tmpdir(), "aeon-presenter-test-"));
after(() => rmSync(compiled, { recursive: true, force: true }));
const build = spawnSync(
  process.execPath,
  [
    "node_modules/typescript/bin/tsc",
    "lib/presenter.ts",
    "--module",
    "commonjs",
    "--target",
    "es2022",
    "--outDir",
    compiled,
    "--skipLibCheck",
  ],
  { encoding: "utf8" },
);
assert.equal(build.status, 0, build.stdout + build.stderr);
const { updateEvent, readPresenterEvent, remainingTime } = createRequire(
  import.meta.url,
)(join(compiled, "presenter.js"));
const now = 1_800_000_000_000;
const session = { id: "opening", name: "Opening", durationMs: 1_200_000 };
const event = {
  queue: [session],
  timer: { ...session, phase: "running", deadline: now + 1_200_000 },
  output: { kind: "countdown" },
  revision: 1,
};

for (const output of [
  { kind: "countdown" },
  { kind: "clock", twentyFourHours: false },
  { kind: "message", html: "<p>Welcome</p>" },
  {
    kind: "image",
    imageId: "graphic",
    name: "Welcome graphic",
    fit: "fill",
    queueItemId: "graphic-queue-item",
  },
]) {
  test(`blackout restores ${output.kind} after reload and preserves its timer state`, () => {
    const live = updateEvent(event, { type: "output", output }, now);
    const black = updateEvent(live, { type: "blackout" }, now);
    assert.equal(black.output.kind, "standby");
    assert.deepEqual(black.timer, live.timer);
    assert.equal(updateEvent(black, { type: "blackout" }, now + 1000), black);
    const reloaded = readPresenterEvent(JSON.stringify(black));
    const extended = updateEvent(
      reloaded,
      { type: "extend", durationMs: 60_000 },
      now + 90_000,
    );
    const restored = updateEvent(extended, { type: "restore" }, now + 120_000);
    assert.deepEqual(restored.output, output);
    if (output.kind === "countdown")
      assert.equal(remainingTime(restored.timer, now + 120_000), 1_140_000);
    else assert.equal(restored.timer, null);
    assert.equal(restored.blackoutOutput, undefined);
    assert.deepEqual(restored.queue, event.queue);
  });
}

test("ending an event removes blackout recovery and keeps the queue", () => {
  const black = updateEvent(event, { type: "blackout" }, now);
  const ended = updateEvent(black, { type: "end" }, now);
  assert.equal(ended.timer, null);
  assert.equal(ended.blackoutOutput, undefined);
  assert.equal(ended.output.kind, "standby");
  assert.deepEqual(ended.queue, event.queue);
  assert.equal(updateEvent(ended, { type: "restore" }, now), ended);
});

test("showing another output or cueing a ready countdown clears the old blackout recovery", () => {
  const black = updateEvent(event, { type: "blackout" }, now);
  const clock = updateEvent(
    black,
    { type: "output", output: { kind: "clock", twentyFourHours: true } },
    now,
  );
  assert.equal(clock.blackoutOutput, undefined);
  assert.equal(updateEvent(clock, { type: "restore" }, now), clock);
  const ready = updateEvent(black, { type: "cue", session }, now);
  assert.equal(ready.timer.phase, "ready");
  assert.equal(ready.blackoutOutput, undefined);
});

test("legacy events still load, and invalid optional recovery metadata cannot discard the live timer", () => {
  assert.deepEqual(readPresenterEvent(JSON.stringify(event)), event);
  const invalid = readPresenterEvent(
    JSON.stringify({
      ...event,
      blackoutOutput: { kind: "image", fit: "crop" },
    }),
  );
  assert.deepEqual(invalid, event);
});

for (const output of [
  { kind: "clock", twentyFourHours: true },
  { kind: "message", html: "<p>Welcome</p>" },
  { kind: "image", imageId: "graphic", name: "Graphic", fit: "fit" },
]) {
  test(`showing ${output.kind} stops and clears ready, running and paused countdowns`, () => {
    for (const timer of [
      event.timer,
      { ...session, phase: "ready" },
      { ...session, phase: "paused", remainingMs: 900_000 },
    ]) {
      const result = updateEvent(
        { ...event, timer },
        { type: "output", output },
        now,
      );
      assert.equal(result.timer, null);
      assert.deepEqual(result.output, output);
      assert.deepEqual(result.queue, event.queue);
    }
  });
}

test("legacy hidden countdowns are discarded while blackout countdowns remain restorable", () => {
  const legacy = readPresenterEvent(
    JSON.stringify({
      ...event,
      output: { kind: "clock", twentyFourHours: true },
    }),
  );
  assert.equal(legacy.timer, null);
  const black = updateEvent(event, { type: "blackout" }, now);
  assert.deepEqual(
    readPresenterEvent(JSON.stringify(black)).timer,
    event.timer,
  );
});
