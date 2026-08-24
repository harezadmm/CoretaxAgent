/**
 * Call routing, escalation and shift rules for the Virtual Office simulation.
 *
 * Run with `node --test tests/js/`.
 *
 * Every test pins an explicit start timestamp instead of reading the clock, so
 * a run at 02:00 behaves the same as a run at noon.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { createDefaultLayout } from '../../app/static/office/tilemap.js';
import {
  createRandom,
  createSimulation,
  isOnShift,
  nextShiftStart,
  officeStartTime,
  queuedCases,
} from '../../app/static/office/sim.js';

const catalog = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../app/static/assets/office/catalog.json', import.meta.url)), 'utf8'),
);

// 24 August 2026 is a Monday; 22 August is the Saturday before it.
const at = (day, hour, minute = 0) => new Date(2026, 7, day, hour, minute).getTime();

function build(startTime, { speed = 60, seed = 7 } = {}) {
  return createSimulation({ layout: createDefaultLayout(), catalog, startTime, seed, speed });
}

/** Advance the world by `simSeconds` of simulated time in realistic frame steps. */
function run(sim, simSeconds) {
  const step = 0.05;
  const ticks = Math.ceil(simSeconds / (step * sim.state.speed));
  for (let i = 0; i < ticks; i += 1) sim.update(step);
}

// ── Shift rules ─────────────────────────────────────────────────────────────

test('operators are on duty during weekday office hours only', () => {
  assert.equal(isOnShift(at(24, 9)), true, 'Monday 09:00');
  assert.equal(isOnShift(at(24, 8)), true, 'the shift starts at 08:00 inclusive');
  assert.equal(isOnShift(at(24, 16, 59)), true, 'Monday 16:59');
  assert.equal(isOnShift(at(24, 17)), false, 'the shift ends at 17:00 exclusive');
  assert.equal(isOnShift(at(24, 7, 59)), false, 'Monday 07:59');
  assert.equal(isOnShift(at(24, 22)), false, 'Monday night');
  assert.equal(isOnShift(at(22, 9)), false, 'Saturday');
  assert.equal(isOnShift(at(23, 9)), false, 'Sunday');
});

test('the next shift skips the weekend', () => {
  assert.equal(nextShiftStart(at(24, 22)), at(25, 8), 'Monday night rolls to Tuesday morning');
  assert.equal(nextShiftStart(at(22, 12)), at(24, 8), 'Saturday noon rolls to Monday morning');
  assert.equal(nextShiftStart(at(24, 6)), at(24, 8), 'before the shift, it is the same day');
});

test('opening outside office hours starts the clock on a working morning', () => {
  const duringHours = at(24, 11, 20);
  assert.equal(officeStartTime(duringHours), duringHours, 'inside hours the real clock is kept');

  assert.equal(officeStartTime(at(24, 19)), at(25, 9, 30), 'Monday evening opens on Tuesday morning');
  assert.equal(officeStartTime(at(22, 10)), at(24, 9, 30), 'Saturday opens on Monday morning');
  assert.equal(officeStartTime(at(24, 5)), at(24, 9, 30), 'early Monday opens later the same day');

  for (const opened of [at(24, 19), at(22, 10), at(23, 3), at(24, 5)]) {
    assert.ok(isOnShift(officeStartTime(opened)), 'the shifted clock must land inside office hours');
  }
});

test('a simulation started outside hours opens with the escalation desks staffed', () => {
  const sim = build(officeStartTime(at(24, 21))); // opened Monday night
  run(sim, 60);

  const metrics = sim.metrics();
  assert.equal(metrics.onShift, true);
  assert.equal(metrics.staffOnDuty, 4, 'the office should not open onto empty escalation desks');
});

// ── Escalation queue ────────────────────────────────────────────────────────

test('cases raised outside office hours wait in the inbox', () => {
  const sim = build(at(24, 19)); // Monday evening
  // Stop short of midnight: the day counters reset there while the case list
  // carries over, and comparing the two across the boundary is meaningless.
  run(sim, 4 * 3600);

  const metrics = sim.metrics();
  assert.equal(metrics.onShift, false);
  assert.equal(metrics.staffOnDuty, 0, 'nobody should be at an escalation desk');
  assert.ok(metrics.escalated > 0, 'the AI should have escalated something overnight');
  assert.equal(metrics.casesResolved, 0, 'no case can be closed with nobody on duty');
  assert.equal(queuedCases(sim.state).length, metrics.escalated, 'every escalation is still queued');
});

test('the overnight backlog is drained after operators arrive', () => {
  const sim = build(at(24, 4)); // Monday, before the shift
  run(sim, 4 * 3600); // → 08:00

  const backlog = queuedCases(sim.state).length;
  assert.ok(backlog > 0, 'the night should leave a backlog to demonstrate');

  run(sim, 3 * 3600); // → 11:00

  const metrics = sim.metrics();
  assert.equal(metrics.onShift, true);
  assert.equal(metrics.staffOnDuty, 4, 'all four operators are back at their desks');
  assert.ok(metrics.casesResolved > 0, 'operators should be closing cases');
  assert.ok(
    queuedCases(sim.state).length < backlog,
    `queue should shrink after the shift starts (was ${backlog}, now ${queuedCases(sim.state).length})`,
  );
});

test('operators leave at the end of the shift and stop taking cases', () => {
  const sim = build(at(24, 16, 30));
  run(sim, 2 * 3600); // → 18:30

  const metrics = sim.metrics();
  assert.equal(metrics.onShift, false);
  assert.equal(metrics.staffOnDuty, 0, 'the floor empties after 17:00');
  assert.equal(metrics.handling, 0, 'no case is left mid-handling');
  for (const person of sim.state.staff) assert.equal(person.caseRef, null);
});

test('an escalated case carries the reason and caller through to the operator', () => {
  const sim = build(at(24, 9));
  run(sim, 3 * 3600);

  const cases = sim.state.cases;
  assert.ok(cases.length > 0);
  for (const record of cases) {
    assert.match(record.id, /^CX-\d{4}$/);
    assert.match(record.caller, /^08••• \d{4}$/);
    assert.ok(record.topic.length > 0);
    assert.ok(record.reason.length > 0);
    assert.ok(['HIGH', 'MED', 'LOW'].includes(record.priority));
    assert.match(record.raisedBy, /^AI-\d{2}$/);
    assert.ok(['queued', 'handling', 'resolved'].includes(record.status));
  }
});

// ── Call handling ───────────────────────────────────────────────────────────

test('the AI closes most calls itself, and the rest become escalations', () => {
  const sim = build(at(24, 10));
  run(sim, 6 * 3600);

  const metrics = sim.metrics();
  assert.ok(metrics.calls > 100, `expected a busy day, got ${metrics.calls} calls`);
  assert.equal(metrics.resolvedByAi + metrics.escalated > 0, true);
  assert.ok(
    metrics.containment > 0.85 && metrics.containment < 0.99,
    `containment ${metrics.containment} should sit near the configured 92.7%`,
  );
});

test('handle time measures the call, not the wait in the queue', () => {
  const sim = build(at(24, 10));
  run(sim, 4 * 3600);

  const metrics = sim.metrics();
  // Phases total 36-93 simulated seconds; anything far outside means queue time
  // has leaked into the average.
  assert.ok(
    metrics.avgHandleSec > 30 && metrics.avgHandleSec < 120,
    `average handle time ${metrics.avgHandleSec}s is outside the phase bounds`,
  );
});

test('work is spread across the floor rather than pinned to the first desk', () => {
  const sim = build(at(24, 10));
  run(sim, 6 * 3600);

  const handled = sim.state.agents.map((agent) => agent.handled);
  const busiest = Math.max(...handled);
  const quietest = Math.min(...handled);
  assert.ok(quietest > 0, 'every desk should take at least one call');
  assert.ok(busiest / quietest < 4, `desk load is lopsided: ${handled.join('/')}`);
});

test('counters reset when the simulated day rolls over', () => {
  const sim = build(at(24, 22));
  run(sim, 1800);
  assert.ok(sim.metrics().calls > 0);

  run(sim, 3 * 3600); // past midnight
  assert.ok(sim.metrics().calls < 40, 'the day counter should have restarted');
  assert.ok(sim.state.cases.length > 0, 'open cases must survive the rollover');
});

// ── Invariants ──────────────────────────────────────────────────────────────

for (const speed of [1, 15, 60, 300]) {
  test(`the floor stays consistent at ${speed}x`, () => {
    const sim = build(at(24, 10), { speed });
    run(sim, 2 * 3600);

    const { layout } = sim.state;
    for (const character of [...sim.state.agents, ...sim.state.staff]) {
      assert.ok(
        character.col >= 0 && character.col < layout.cols && character.row >= 0 && character.row < layout.rows,
        `${character.label} walked off the map`,
      );
      assert.ok(Number.isFinite(character.x) && Number.isFinite(character.y));
    }

    const metrics = sim.metrics();
    assert.ok(metrics.waiting < 60, `queue ran away at ${speed}x: ${metrics.waiting} calls waiting`);
    assert.ok(metrics.avgHandleSec < 150, `handle time inflated at ${speed}x: ${metrics.avgHandleSec}s`);
  });
}

test('no case is ever handed to two operators at once', () => {
  const sim = build(at(24, 8));
  run(sim, 6 * 3600);

  const assigned = sim.state.staff.filter((person) => person.caseRef).map((person) => person.caseRef.id);
  assert.equal(new Set(assigned).size, assigned.length, 'a case is being worked twice');

  for (const record of sim.state.cases) {
    if (record.status === 'resolved') assert.ok(record.resolvedAt >= record.raisedAt);
  }
});

test('the same seed replays the same day', () => {
  const a = build(at(24, 9), { seed: 1234 });
  const b = build(at(24, 9), { seed: 1234 });
  run(a, 3600);
  run(b, 3600);

  assert.deepEqual(a.metrics(), b.metrics());
  assert.deepEqual(
    a.state.cases.map((record) => record.id),
    b.state.cases.map((record) => record.id),
  );
});

test('the seeded generator is uniform enough to drive arrival gaps', () => {
  const random = createRandom(99);
  const buckets = new Array(10).fill(0);
  for (let i = 0; i < 10000; i += 1) {
    const value = random();
    assert.ok(value >= 0 && value < 1);
    buckets[Math.floor(value * 10)] += 1;
  }
  for (const count of buckets) assert.ok(count > 800 && count < 1200, `uneven distribution: ${buckets.join(',')}`);
});
