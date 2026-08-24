/**
 * The call-centre simulation that drives the office.
 *
 * Pure: no DOM, no canvas, no `Date.now()` — the caller supplies the starting
 * timestamp and advances the world with `update(realDeltaSeconds)`. That keeps
 * the routing and shift rules testable under `node --test` and keeps the render
 * loop free to redraw without side effects.
 *
 * Two clocks run at once, on purpose:
 *
 *   - **Task and shift time** is scaled by `speed`, so an operator can watch a
 *     whole working day go by in a few minutes.
 *   - **Walking and animation** use unscaled real time, so characters never
 *     teleport across the floor when the speed is turned up.
 *
 * Anything that finishes by *arriving somewhere* (an escalation hand-off, staff
 * coming on shift) therefore completes on arrival rather than on a timer, which
 * keeps the two clocks from contradicting each other.
 */

import { DIR, TILE_SIZE, buildBlockedGrid, findPath } from './tilemap.js';

// ── Tuning ──────────────────────────────────────────────────────────────────

export const SPEEDS = [1, 15, 60, 300];
export const DEFAULT_SPEED = 15;

const WALK_SPEED_PX_PER_SEC = 34;
const WALK_FRAME_SEC = 0.16;
const WORK_FRAME_SEC = 0.4;

/**
 * How much faster characters walk as the simulation speed rises.
 *
 * Walking is deliberately measured in real time so it stays watchable, but that
 * pulls against task timers, which are measured in simulated time. Left alone,
 * a hand-off that takes ten real seconds would block a desk for twenty simulated
 * minutes at 120x and jam the whole floor. Scaling the walk partway back —
 * never past 8x, or characters teleport — keeps both clocks tolerable.
 */
function walkSpeedFactor(speed) {
  return Math.min(8, Math.max(1, speed / DEFAULT_SPEED));
}

/** Office hours, in local time. Cases raised outside these hours wait in the inbox. */
export const SHIFT = { startHour: 8, endHour: 17, workdays: [1, 2, 3, 4, 5] };

/** Share of calls the AI closes without a human. Matches the dashboard's 92.7%. */
const CONTAINMENT_RATE = 0.927;

/** Task durations in simulated seconds, sampled uniformly between the bounds. */
const PHASE_SECONDS = {
  listening: [12, 30],
  searching: [6, 16],
  answering: [15, 40],
  wrapup: [3, 7],
};

/** Simulated minutes a human operator spends on one escalated case. */
const CASE_MINUTES = [3, 9];

/**
 * Relative call volume by hour of day. Shaped like the dashboard's daily chart:
 * quiet overnight, a mid-morning peak, a dip over lunch, a smaller afternoon peak.
 */
const HOURLY_WEIGHT = [
  0.04, 0.03, 0.02, 0.02, 0.03, 0.06, 0.16, 0.42, 0.78, 0.95, 1.0, 0.92, 0.55,
  0.74, 0.88, 0.81, 0.6, 0.34, 0.2, 0.14, 0.11, 0.09, 0.07, 0.05,
];

/**
 * Calls per hour at the busiest point of the day.
 *
 * Sized against the eight AI desks rather than against a real DJP call volume:
 * at this rate roughly half the floor is on a call during the morning peak, so
 * the office reads as busy without every desk being permanently occupied.
 */
const PEAK_CALLS_PER_HOUR = 260;

const TOPICS = [
  { name: 'Aktivasi akun Coretax', weight: 32, short: 'Aktivasi akun' },
  { name: 'Kode otorisasi DJP', weight: 24, short: 'Kode otorisasi' },
  { name: 'Pembuatan kode billing', weight: 18, short: 'Kode billing' },
  { name: 'Pelaporan SPT tahunan', weight: 14, short: 'Pelaporan SPT' },
  { name: 'Login Coretax', weight: 12, short: 'Login Coretax' },
];

const ESCALATION_REASONS = [
  { reason: 'Foto identitas gagal divalidasi', priority: 'HIGH' },
  { reason: 'Tidak ditemukan pada knowledge base', priority: 'MED' },
  { reason: 'Memerlukan pengecekan data personal', priority: 'HIGH' },
  { reason: 'Pengguna meminta keputusan pajak', priority: 'MED' },
  { reason: 'Perlu verifikasi dokumen pendukung', priority: 'LOW' },
];

/** Two or three lines per topic, enough for the detail panel to show a real exchange. */
const TRANSCRIPTS = {
  'Aktivasi akun Coretax': [
    ['caller', 'Saya mau aktivasi akun Coretax, tapi foto saya selalu gagal.'],
    ['ai', 'Baik, saya cek panduan aktivasi akun yang sesuai.'],
    ['ai', 'Pastikan ukuran foto di bawah 2 MB dan wajah terlihat penuh.'],
  ],
  'Kode otorisasi DJP': [
    ['caller', 'Kode otorisasi saya tidak muncul di menu.'],
    ['ai', 'Kode otorisasi terbit setelah profil wajib pajak lengkap.'],
    ['ai', 'Silakan cek menu Portal Saya lalu bagian Informasi Umum.'],
  ],
  'Pembuatan kode billing': [
    ['caller', 'Bagaimana cara membuat kode billing sendiri?'],
    ['ai', 'Kode billing dibuat lewat menu Pembayaran lalu Buat Kode Billing.'],
    ['ai', 'Masa aktif kode billing tersebut 30 hari sejak diterbitkan.'],
  ],
  'Pelaporan SPT tahunan': [
    ['caller', 'SPT tahunan saya statusnya masih konsep.'],
    ['ai', 'Konsep berarti SPT belum diposting dan belum dibayar.'],
    ['ai', 'Saya bantu jelaskan langkah posting dan pembayarannya.'],
  ],
  'Login Coretax': [
    ['caller', 'Saya tidak bisa login, katanya kata sandi salah.'],
    ['ai', 'Silakan gunakan menu Lupa Kata Sandi pada halaman login.'],
    ['ai', 'Tautan atur ulang dikirim ke email terdaftar Anda.'],
  ],
};

// ── Random ──────────────────────────────────────────────────────────────────

/** mulberry32 — small, fast, and seeded so a run can be reproduced in a test. */
export function createRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function between(random, [min, max]) {
  return min + random() * (max - min);
}

function pick(random, items) {
  return items[Math.floor(random() * items.length) % items.length];
}

function pickWeighted(random, items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

// ── Shift ───────────────────────────────────────────────────────────────────

/**
 * Whether human operators are on duty at `timestamp`, in local time.
 *
 * This is the rule the whole escalation story hangs on: outside these hours the
 * AI still answers calls, but anything it hands over sits in the inbox until the
 * next working morning.
 */
export function isOnShift(timestamp, shift = SHIFT) {
  const date = new Date(timestamp);
  if (!shift.workdays.includes(date.getDay())) return false;
  const hour = date.getHours() + date.getMinutes() / 60;
  return hour >= shift.startHour && hour < shift.endHour;
}

/**
 * Where the office clock should start when the view is opened.
 *
 * During office hours this is simply now. Outside them — evenings, weekends —
 * starting at the real time would open onto a half-dead floor with every
 * escalation desk empty, which reads as a broken screen rather than as a closed
 * shift. Instead the clock jumps to mid-morning on the next working day, so the
 * office is busy on arrival. The HUD labels this, because a clock that silently
 * disagrees with the wall is worse than an empty room.
 */
export function officeStartTime(now, shift = SHIFT) {
  if (isOnShift(now, shift)) return now;
  return nextShiftStart(now, shift) + 90 * 60 * 1000;
}

/** Timestamp of the next moment operators come on duty, at or after `timestamp`. */
export function nextShiftStart(timestamp, shift = SHIFT) {
  const date = new Date(timestamp);
  date.setSeconds(0, 0);
  for (let day = 0; day <= 8; day += 1) {
    const candidate = new Date(date);
    candidate.setDate(date.getDate() + day);
    candidate.setHours(shift.startHour, 0, 0, 0);
    if (candidate.getTime() > timestamp && shift.workdays.includes(candidate.getDay())) {
      return candidate.getTime();
    }
  }
  return timestamp;
}

// ── Entities ────────────────────────────────────────────────────────────────

function tileCentre(col, row) {
  return { x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 };
}

/** Counters reset at midnight, so the strip always reads "today". */
function emptyCounters() {
  return {
    calls: 0,
    picked: 0,
    resolvedByAi: 0,
    escalated: 0,
    casesResolved: 0,
    handleSecTotal: 0,
    waitSecTotal: 0,
  };
}

function createCharacter(seat, palette, present) {
  const centre = tileCentre(seat.col, seat.row);
  return {
    seatId: seat.id,
    kind: seat.kind,
    label: seat.label,
    palette,
    present,
    x: centre.x,
    y: centre.y,
    col: seat.col,
    row: seat.row,
    dir: seat.dir ?? DIR.UP,
    /** 'sit' while working at the desk, 'walk' while following a path. */
    motion: 'sit',
    /** Which animation set the renderer should use. */
    pose: 'typing',
    path: [],
    stepProgress: 0,
    frame: 0,
    frameTimer: 0,
    bubble: null,
  };
}

// ── Simulation ──────────────────────────────────────────────────────────────

/**
 * @param {object} options
 * @param {object} options.layout   Office layout from tilemap.js
 * @param {object} options.catalog  Sprite catalog, for furniture footprints
 * @param {number} options.startTime  Simulated wall-clock start, in ms
 * @param {number} [options.seed]
 * @param {number} [options.speed]  Simulated seconds per real second
 */
export function createSimulation({ layout, catalog, startTime, seed = 20260824, speed = DEFAULT_SPEED }) {
  const random = createRandom(seed);
  const blocked = buildBlockedGrid(layout, catalog);

  const aiSeats = layout.seats.filter((seat) => seat.kind === 'ai');
  const humanSeats = layout.seats.filter((seat) => seat.kind === 'human');

  const onShiftAtStart = isOnShift(startTime);

  const agents = aiSeats.map((seat, index) => ({
    ...createCharacter(seat, index % 6, true),
    seat,
    /** 'idle' | 'listening' | 'searching' | 'answering' | 'wrapup' | 'handover' | 'returning' */
    task: 'idle',
    taskTimer: 0,
    call: null,
    carryingCase: null,
    handled: 0,
    /** When this desk last picked up a call, so work spreads across the floor. */
    lastCallAt: 0,
  }));

  const staff = humanSeats.map((seat, index) => ({
    ...createCharacter(seat, (index + 2) % 6, onShiftAtStart),
    seat,
    /** 'off' | 'arriving' | 'idle' | 'handling' | 'leaving' */
    task: onShiftAtStart ? 'idle' : 'off',
    taskTimer: 0,
    caseRef: null,
    handled: 0,
  }));

  const state = {
    layout,
    blocked,
    clock: startTime,
    speed,
    agents,
    staff,
    /** Calls that arrived while every AI desk was busy. */
    waiting: [],
    /** Escalated cases, newest last. */
    cases: [],
    onShift: onShiftAtStart,
    nextCallIn: 0,
    counters: emptyCounters(),
    dayKey: new Date(startTime).toDateString(),
    caseSeq: 180,
    log: [],
  };

  scheduleNextCall(state, random);

  return {
    state,
    update: (realDelta) => update(state, random, realDelta),
    setSpeed: (value) => {
      state.speed = value;
    },
    metrics: () => metrics(state),
  };
}

function scheduleNextCall(state, random) {
  const hour = new Date(state.clock).getHours();
  const weight = HOURLY_WEIGHT[hour] ?? 0.1;
  const perHour = Math.max(1, PEAK_CALLS_PER_HOUR * weight);
  const meanGap = 3600 / perHour;
  // Exponential gaps give the clustered, bursty arrivals a real queue has.
  state.nextCallIn = -Math.log(1 - random()) * meanGap;
}

function maskedNumber(random) {
  const digits = String(Math.floor(random() * 9000) + 1000);
  return `08••• ${digits}`;
}

function newCall(state, random) {
  const topic = pickWeighted(random, TOPICS);
  state.counters.calls += 1;
  return {
    id: `CALL-${7400 + state.counters.calls}`,
    caller: maskedNumber(random),
    topic: topic.name,
    topicShort: topic.short,
    /** When the caller rang in. */
    queuedAt: state.clock,
    /** When a desk picked up. Handle time is measured from here, not from
     *  `queuedAt`, so a busy queue does not inflate the average. */
    startedAt: state.clock,
    transcript: TRANSCRIPTS[topic.name] ?? [],
    phase: 'listening',
  };
}

function logEvent(state, kind, text) {
  state.log.unshift({ at: state.clock, kind, text });
  if (state.log.length > 40) state.log.length = 40;
}

// ── Movement ────────────────────────────────────────────────────────────────

function walkTo(state, character, target) {
  const path = findPath(state.layout, state.blocked, { col: character.col, row: character.row }, target);
  if (path.length === 0) {
    // Already there, or genuinely unreachable — either way, do not strand the
    // character mid-floor waiting for a step that will never come.
    character.path = [];
    character.motion = 'sit';
    return false;
  }
  character.path = path;
  character.stepProgress = 0;
  character.motion = 'walk';
  return true;
}

function advanceMovement(character, realDelta, speedFactor = 1) {
  if (character.motion !== 'walk' || character.path.length === 0) return false;

  const next = character.path[0];
  const from = tileCentre(character.col, character.row);
  const to = tileCentre(next.col, next.row);
  const distance = Math.hypot(to.x - from.x, to.y - from.y) || TILE_SIZE;

  character.stepProgress += (WALK_SPEED_PX_PER_SEC * speedFactor * realDelta) / distance;

  if (next.col > character.col) character.dir = DIR.RIGHT;
  else if (next.col < character.col) character.dir = DIR.LEFT;
  else if (next.row > character.row) character.dir = DIR.DOWN;
  else if (next.row < character.row) character.dir = DIR.UP;

  if (character.stepProgress >= 1) {
    character.col = next.col;
    character.row = next.row;
    character.stepProgress = 0;
    character.path.shift();
    const centre = tileCentre(character.col, character.row);
    character.x = centre.x;
    character.y = centre.y;
    if (character.path.length === 0) {
      character.motion = 'sit';
      return true; // arrived
    }
    return false;
  }

  character.x = from.x + (to.x - from.x) * character.stepProgress;
  character.y = from.y + (to.y - from.y) * character.stepProgress;
  return false;
}

function advanceAnimation(character, realDelta) {
  const frameDuration = character.motion === 'walk' ? WALK_FRAME_SEC : WORK_FRAME_SEC;
  character.frameTimer += realDelta;
  if (character.frameTimer >= frameDuration) {
    character.frameTimer -= frameDuration;
    character.frame = (character.frame + 1) % 4;
  }
}

// ── Tick ────────────────────────────────────────────────────────────────────

function update(state, random, realDeltaRaw) {
  // A backgrounded tab can hand back a delta of several seconds; clamping keeps
  // one long frame from fast-forwarding the office.
  const realDelta = Math.min(Math.max(realDeltaRaw, 0), 0.25);
  const simDelta = realDelta * state.speed;

  state.clock += simDelta * 1000;

  const dayKey = new Date(state.clock).toDateString();
  if (dayKey !== state.dayKey) {
    state.dayKey = dayKey;
    state.counters = emptyCounters();
  }

  const speedFactor = walkSpeedFactor(state.speed);
  updateShift(state);
  spawnCalls(state, random, simDelta);
  updateAgents(state, random, simDelta, realDelta, speedFactor);
  updateStaff(state, random, simDelta, realDelta, speedFactor);

  return state;
}

function updateShift(state) {
  const onShift = isOnShift(state.clock);
  if (onShift === state.onShift) return;
  state.onShift = onShift;

  if (onShift) {
    logEvent(state, 'shift', 'Petugas mulai bertugas, antrean eskalasi diproses.');
    const door = state.layout.landmarks.door;
    for (const person of state.staff) {
      person.present = true;
      person.col = door.col;
      person.row = door.row;
      const centre = tileCentre(door.col, door.row);
      person.x = centre.x;
      person.y = centre.y;
      person.task = 'arriving';
      person.bubble = null;
      walkTo(state, person, { col: person.seat.col, row: person.seat.row });
    }
  } else {
    logEvent(state, 'shift', 'Jam kerja berakhir, sisa kasus menunggu hari kerja berikutnya.');
    for (const person of state.staff) {
      if (!person.present) continue;
      // Finish the case in hand first; releasing it here would lose the work.
      if (person.task === 'handling' && person.caseRef) releaseCase(state, person, false);
      person.task = 'leaving';
      person.bubble = null;
      walkTo(state, person, state.layout.landmarks.door);
    }
  }
}

function spawnCalls(state, random, simDelta) {
  state.nextCallIn -= simDelta;
  while (state.nextCallIn <= 0) {
    state.waiting.push(newCall(state, random));
    scheduleNextCall(state, random);
  }

  // Hand queued calls to free desks, least-recently-used first. Taking them in
  // array order instead would pin every call to the first desk and leave the far
  // end of the floor looking permanently empty.
  const free = state.agents
    .filter((agent) => agent.task === 'idle')
    .sort((a, b) => a.lastCallAt - b.lastCallAt);

  for (const agent of free) {
    if (state.waiting.length === 0) break;
    const call = state.waiting.shift();
    call.startedAt = state.clock;
    state.counters.waitSecTotal += (call.startedAt - call.queuedAt) / 1000;
    state.counters.picked += 1;
    agent.call = call;
    agent.task = 'listening';
    agent.taskTimer = between(random, PHASE_SECONDS.listening);
    agent.pose = 'reading';
    agent.bubble = 'call';
    agent.lastCallAt = state.clock;
  }
}

function updateAgents(state, random, simDelta, realDelta, speedFactor) {
  for (const agent of state.agents) {
    const arrived = advanceMovement(agent, realDelta, speedFactor);
    advanceAnimation(agent, realDelta);

    if (agent.motion === 'walk') continue;

    switch (agent.task) {
      case 'handover':
        if (arrived || agent.path.length === 0) {
          depositCase(state, agent);
          agent.task = 'returning';
          walkTo(state, agent, { col: agent.seat.col, row: agent.seat.row });
        }
        break;

      case 'returning':
        if (arrived || agent.path.length === 0) {
          agent.task = 'idle';
          agent.dir = agent.seat.dir;
          agent.pose = 'typing';
          agent.bubble = null;
        }
        break;

      case 'idle':
        agent.pose = 'typing';
        agent.bubble = null;
        break;

      default:
        agent.taskTimer -= simDelta;
        if (agent.taskTimer <= 0) advanceCallPhase(state, random, agent);
        break;
    }
  }
}

function advanceCallPhase(state, random, agent) {
  const call = agent.call;
  if (!call) {
    agent.task = 'idle';
    return;
  }

  switch (agent.task) {
    case 'listening':
      agent.task = 'searching';
      agent.taskTimer = between(random, PHASE_SECONDS.searching);
      agent.pose = 'reading';
      agent.bubble = 'search';
      call.phase = 'searching';
      break;

    case 'searching':
      agent.task = 'answering';
      agent.taskTimer = between(random, PHASE_SECONDS.answering);
      agent.pose = 'typing';
      agent.bubble = 'answer';
      call.phase = 'answering';
      break;

    case 'answering': {
      const contained = random() < CONTAINMENT_RATE;
      const handleSec = (state.clock - call.startedAt) / 1000;
      state.counters.handleSecTotal += handleSec;
      agent.handled += 1;

      if (contained) {
        state.counters.resolvedByAi += 1;
        logEvent(state, 'resolved', `${agent.label} menyelesaikan ${call.topicShort}.`);
        agent.task = 'wrapup';
        agent.taskTimer = between(random, PHASE_SECONDS.wrapup);
        agent.pose = 'typing';
        agent.bubble = null;
        call.phase = 'resolved';
      } else {
        agent.carryingCase = openCase(state, random, agent, call);
        agent.task = 'handover';
        agent.bubble = 'escalate';
        call.phase = 'escalated';
        if (!walkTo(state, agent, state.layout.landmarks.inbox)) {
          // No route to the inbox: still file the case rather than drop it.
          depositCase(state, agent);
          agent.task = 'idle';
        }
      }
      break;
    }

    case 'wrapup':
    default:
      agent.call = null;
      agent.task = 'idle';
      agent.pose = 'typing';
      agent.bubble = null;
      break;
  }
}

function openCase(state, random, agent, call) {
  state.caseSeq += 1;
  const { reason, priority } = pick(random, ESCALATION_REASONS);
  const record = {
    id: `CX-${String(state.caseSeq).padStart(4, '0')}`,
    caller: call.caller,
    topic: call.topic,
    topicShort: call.topicShort,
    reason,
    priority,
    raisedBy: agent.label,
    raisedAt: state.clock,
    status: 'queued',
    assignedTo: null,
    resolvedAt: null,
    transcript: call.transcript,
  };
  state.counters.escalated += 1;
  return record;
}

function depositCase(state, agent) {
  if (!agent.carryingCase) return;
  state.cases.push(agent.carryingCase);
  const suffix = state.onShift ? '' : ' (di luar jam kerja, menunggu petugas)';
  logEvent(state, 'escalated', `#${agent.carryingCase.id} ${agent.carryingCase.topicShort}${suffix}`);
  agent.carryingCase = null;
  agent.call = null;
  agent.bubble = null;
}

function releaseCase(state, person, resolved) {
  const record = person.caseRef;
  if (!record) return;
  if (resolved) {
    record.status = 'resolved';
    record.resolvedAt = state.clock;
    state.counters.casesResolved += 1;
    person.handled += 1;
    logEvent(state, 'closed', `#${record.id} ditutup oleh ${person.label}.`);
  } else {
    record.status = 'queued';
    record.assignedTo = null;
  }
  person.caseRef = null;
}

function updateStaff(state, random, simDelta, realDelta, speedFactor) {
  for (const person of state.staff) {
    if (!person.present) continue;

    const arrived = advanceMovement(person, realDelta, speedFactor);
    advanceAnimation(person, realDelta);
    if (person.motion === 'walk') continue;

    switch (person.task) {
      case 'arriving':
        if (arrived || person.path.length === 0) {
          person.task = 'idle';
          person.dir = person.seat.dir;
          person.pose = 'typing';
        }
        break;

      case 'leaving':
        if (arrived || person.path.length === 0) {
          person.present = false;
          person.task = 'off';
        }
        break;

      case 'idle': {
        person.pose = 'typing';
        person.bubble = null;
        const next = state.cases.find((record) => record.status === 'queued');
        if (next) {
          next.status = 'handling';
          next.assignedTo = person.label;
          person.caseRef = next;
          person.task = 'handling';
          person.pose = 'reading';
          person.bubble = 'case';
          person.taskTimer = between(random, CASE_MINUTES) * 60;
          logEvent(state, 'assigned', `#${next.id} ditangani ${person.label}.`);
        }
        break;
      }

      case 'handling':
        person.taskTimer -= simDelta;
        if (person.taskTimer <= 0) {
          releaseCase(state, person, true);
          person.task = 'idle';
          person.pose = 'typing';
          person.bubble = null;
        }
        break;

      default:
        break;
    }
  }
}

// ── Reporting ───────────────────────────────────────────────────────────────

export function metrics(state) {
  const { counters } = state;
  const closed = counters.resolvedByAi + counters.escalated;
  const queued = state.cases.filter((record) => record.status === 'queued').length;
  const handling = state.cases.filter((record) => record.status === 'handling').length;
  const activeCalls = state.agents.filter((agent) => agent.call).length;
  const avgHandleSec = closed > 0 ? counters.handleSecTotal / closed : 0;
  const avgWaitSec = counters.picked > 0 ? counters.waitSecTotal / counters.picked : 0;

  return {
    clock: state.clock,
    onShift: state.onShift,
    nextShiftStart: nextShiftStart(state.clock),
    calls: counters.calls,
    resolvedByAi: counters.resolvedByAi,
    escalated: counters.escalated,
    casesResolved: counters.casesResolved,
    containment: closed > 0 ? counters.resolvedByAi / closed : 0,
    activeCalls,
    waiting: state.waiting.length,
    queued,
    handling,
    avgHandleSec,
    avgWaitSec,
    staffOnDuty: state.staff.filter((person) => person.present).length,
  };
}

/** Cases still sitting in the inbox — what the tray pile draws. */
export function queuedCases(state) {
  return state.cases.filter((record) => record.status === 'queued');
}
