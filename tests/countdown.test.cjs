const assert = require("node:assert/strict");
const test = require("node:test");
const {
  BREAK_MS,
  getRemaining,
  getWakeDelay,
  getWarning,
  initialTimer,
  updateTimer,
} = require("../lib/countdown.ts");
const { getFormattedTime } = require("../utils/functions.ts");

const initialState = { timer: initialTimer, now: 0, draftMs: null };
const send = (state, now, type) => updateTimer(state, { now, type });
const configure = (durationMs) =>
  updateTimer(initialState, { type: "countdown", durationMs, now: 0 });
const program = (...sessions) =>
  updateTimer(initialState, { type: "program", sessions, now: 0 });

test("a late tick catches up and the last second stays visible until the deadline", () => {
  const started = send(configure(10_000), 100, "toggle");
  const late = send(started, 7_450, "sync");
  assert.equal(late.timer, started.timer);
  assert.equal(getRemaining(late.timer, late.now), 2_650);
  assert.equal(getWakeDelay(late.timer, late.now), 650);

  const finalMillisecond = send(late, 10_099, "sync");
  assert.equal(finalMillisecond.timer.run.phase, "running");
  assert.equal(
    getFormattedTime(
      getRemaining(finalMillisecond.timer, finalMillisecond.now),
    ),
    ":01",
  );
  assert.equal(
    send(finalMillisecond, 10_100, "sync").timer.run.phase,
    "finished",
  );
});

test("pause and resume preserve sub-second remaining time", () => {
  const running = send(configure(2_000), 0, "toggle");
  const paused = send(running, 750, "toggle");
  assert.equal(getRemaining(paused.timer, 40_000), 1_250);
  const resumed = send(paused, 40_000, "toggle");
  assert.equal(resumed.timer.run.deadline, 41_250);
});

test("Auto Pilot catches up through several sessions and breaks", () => {
  const running = send(program(2_000, 3_000, 4_000), 100, "toggle");
  const late = send(running, 26_100, "sync");
  assert.deepEqual(late.timer.run, {
    phase: "running",
    step: 2,
    deadline: 29_100,
  });
  const finished = send(late, 29_100, "sync");
  assert.deepEqual(finished.timer.run, { phase: "finished", step: 2 });
  const reset = send(finished, 30_000, "reset");
  assert.deepEqual(reset.timer.run, { phase: "ready", step: 0 });
  assert.deepEqual(reset.timer.sessions, [2_000, 3_000, 4_000]);
  assert.equal(getRemaining(reset.timer, 30_000), 2_000);
});

test("skipping a break starts the next session immediately", () => {
  const running = send(program(2_000, 3_000), 0, "toggle");
  const onBreak = send(running, 2_000, "sync");
  assert.equal(getRemaining(onBreak.timer, 2_000), BREAK_MS);
  const skipped = send(onBreak, 2_500, "skip");
  assert.deepEqual(skipped.timer.run, {
    phase: "running",
    step: 1,
    deadline: 5_500,
  });
});

test("a pending clock update after reset cannot modify the configured time", () => {
  const running = send(configure(8_000), 0, "toggle");
  const reset = send(running, 700, "reset");
  const pendingTick = send(reset, 1_000, "sync");
  assert.equal(pendingTick.timer, reset.timer);
  assert.equal(getRemaining(pendingTick.timer, 1_000), 8_000);
});

test("warnings appear only during their window and below-threshold starts skip them", () => {
  const timer = send(configure(360_000), 0, "toggle").timer;
  for (const [remainingMs, expected] of [
    [300_001, undefined],
    [300_000, 5],
    [297_000, 5],
    [295_000, undefined],
    [120_000, 2],
    [115_000, undefined],
  ]) {
    assert.equal(getWarning(timer, remainingMs), expected);
  }
  const short = send(configure(118_000), 0, "toggle").timer;
  assert.equal(getWarning(short, 117_000), undefined);
});
