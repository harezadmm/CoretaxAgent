/**
 * The DOM around the canvas: toolbar, metric strip, detail panel, queue and log.
 *
 * Split from render.js because these are two different update budgets. The
 * canvas repaints every frame; this markup only needs to change a few times a
 * second, and rewriting `innerHTML` sixty times a second would fight the user's
 * text selection and burn layout time for no visible gain.
 *
 * Markup deliberately reuses the dashboard's existing class names
 * (`panel-kicker`, `status-pill`, `table-panel`, `case-item`, …) so the view
 * inherits the established styling instead of introducing a second look.
 */

import { SPEEDS } from './sim.js';

const STATUS_LABEL = {
  idle: 'MENUNGGU PANGGILAN',
  listening: 'MENDENGARKAN',
  searching: 'MENCARI DI KNOWLEDGE BASE',
  answering: 'MENJAWAB',
  wrapup: 'MERAPIKAN CATATAN',
  handover: 'MENGANTAR KE INBOX',
  returning: 'KEMBALI KE MEJA',
  off: 'DI LUAR JAM KERJA',
  arriving: 'MENUJU MEJA',
  leaving: 'PULANG',
  handling: 'MENANGANI KASUS',
};

const STATUS_TONE = {
  listening: 'searching',
  searching: 'searching',
  answering: 'answering',
  handover: 'priority-medium',
  handling: 'answering',
  idle: 'resolved',
  off: 'priority-low',
};

export function formatClock(timestamp) {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function formatDay(timestamp) {
  return new Date(timestamp).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
}

export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  return `${String(minutes).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
  });
}

/** Static shell. Everything that changes is rewritten by the update functions below. */
export function officeMarkup() {
  const speedButtons = SPEEDS.map(
    (speed) => `<button data-speed="${speed}">${speed}×</button>`,
  ).join('');

  return `
    <div class="office-layout">
      <article class="office-stage-panel">
        <div class="workflow-toolbar">
          <div>
            <p class="panel-kicker">VIRTUAL OFFICE · BPOM AI CALL CENTER</p>
            <h3>Meja AI menjawab panggilan → kasus sulit diantar ke meja petugas</h3>
          </div>
          <div class="canvas-tools office-tools">
            <span class="tool-group speed-group" role="group" aria-label="Kecepatan simulasi">${speedButtons}</span>
            <span class="tool-group">
              <button data-action="zoom-out" aria-label="Perkecil">−</button>
              <span class="office-scale" id="office-scale">3×</span>
              <button data-action="zoom-in" aria-label="Perbesar">＋</button>
              <button data-action="fit">Fit</button>
            </span>
            <button class="outline-button icon-only" data-action="toggle-edit" title="Edit layout" aria-label="Edit layout">✎</button>
          </div>
        </div>

        <div class="office-canvas-wrap">
          <canvas id="office-canvas" aria-label="Visualisasi kantor call center BPOM"></canvas>
          <div class="office-hud" id="office-hud"></div>
          <div class="office-editor-bar" id="office-editor-bar" hidden></div>
        </div>

        <div class="office-metrics" id="office-metrics"></div>
      </article>

      <aside class="office-side">
        <article class="table-panel office-detail-panel">
          <div class="table-panel-head">
            <div><p class="panel-kicker">DETAIL MEJA</p><h3 id="office-detail-title">Pilih meja</h3></div>
            <span class="status-pill live-pill" id="office-shift-pill">●</span>
          </div>
          <div id="office-detail"></div>
        </article>

        <article class="table-panel office-queue-panel">
          <div class="table-panel-head">
            <div><p class="panel-kicker">INBOX ESKALASI</p><h3>Menunggu petugas <span class="badge" id="office-queue-count">0</span></h3></div>
          </div>
          <div class="case-list" id="office-queue"></div>
        </article>

        <article class="table-panel office-log-panel">
          <div class="table-panel-head">
            <div><p class="panel-kicker">AKTIVITAS</p><h3>Live log</h3></div>
          </div>
          <div class="office-log" id="office-log"></div>
        </article>
      </aside>
    </div>`;
}

// ── Metric strip ────────────────────────────────────────────────────────────

function chip(label, value, note, tone) {
  return `<article class="office-chip"><span class="stat-mark ${tone}"></span><p>${label}</p><strong>${value}</strong><small>${note}</small></article>`;
}

export function renderMetrics(host, metrics) {
  const containment = metrics.calls > 0 ? `${(metrics.containment * 100).toFixed(1)}%` : '—';
  host.innerHTML = [
    chip('PANGGILAN HARI INI', metrics.calls.toLocaleString('id-ID'), `${metrics.activeCalls} sedang berjalan`, 'green'),
    chip('DIJAWAB AI', metrics.resolvedByAi.toLocaleString('id-ID'), `${containment} selesai otomatis`, 'cyan'),
    chip('DIESKALASI', metrics.escalated.toLocaleString('id-ID'), `${metrics.queued} menunggu petugas`, 'amber'),
    chip('DITUTUP PETUGAS', metrics.casesResolved.toLocaleString('id-ID'), `${metrics.staffOnDuty} petugas bertugas`, 'violet'),
    chip('RATA-RATA TANGANI', formatDuration(metrics.avgHandleSec), `antre ${formatDuration(metrics.avgWaitSec)}`, 'cyan'),
  ].join('');
}

export function renderHud(host, metrics, { shifted = false } = {}) {
  const shift = metrics.onShift
    ? '<em class="office-shift on">JAM KERJA</em>'
    : `<em class="office-shift off">DI LUAR JAM KERJA</em><small>Petugas kembali ${formatClock(metrics.nextShiftStart)}</small>`;
  // When the view opened outside office hours the clock was moved forward to a
  // working morning. Say so, rather than let it read as the real time.
  const note = shifted
    ? '<small class="office-sim-note">jam simulasi · di luar jam kerja asli</small>'
    : '';
  host.innerHTML = `
    <div class="office-clock"><strong>${formatClock(metrics.clock)}</strong><small>${formatDay(metrics.clock)}</small>${note}</div>
    <div class="office-shift-box">${shift}</div>`;
}

// ── Detail panel ────────────────────────────────────────────────────────────

function transcriptMarkup(lines, upTo) {
  if (!lines?.length) return '';
  const shown = lines.slice(0, Math.max(1, upTo));
  return `<div class="transcript office-transcript">${shown
    .map(
      ([who, text]) =>
        `<div class="transcript-line ${who === 'ai' ? 'ai' : 'caller'}"><small>${
          who === 'ai' ? 'AI' : 'CALLER'
        }</small><p>${escapeHtml(text)}</p></div>`,
    )
    .join('')}</div>`;
}

function agentDetail(agent, state) {
  const status = STATUS_LABEL[agent.task] ?? agent.task.toUpperCase();
  const tone = STATUS_TONE[agent.task] ?? 'searching';
  const call = agent.call;

  const rows = [
    `<div class="office-row"><span>Status</span><em class="${tone}">${status}</em></div>`,
    `<div class="office-row"><span>Panggilan hari ini</span><b>${agent.handled}</b></div>`,
  ];

  if (call) {
    const elapsed = (state.clock - call.startedAt) / 1000;
    rows.push(
      `<div class="office-row"><span>Penelepon</span><b>${escapeHtml(call.caller)}</b></div>`,
      `<div class="office-row"><span>Topik</span><b>${escapeHtml(call.topic)}</b></div>`,
      `<div class="office-row"><span>Durasi</span><b class="mono">${formatDuration(elapsed)}</b></div>`,
    );
  } else {
    rows.push('<div class="office-row"><span>Panggilan</span><b class="muted-label">Tidak ada</b></div>');
  }

  const phaseIndex = { listening: 1, searching: 2, answering: 3 }[agent.task] ?? 3;
  return rows.join('') + (call ? transcriptMarkup(call.transcript, phaseIndex) : '');
}

function staffDetail(person, state, metrics) {
  const status = STATUS_LABEL[person.task] ?? person.task.toUpperCase();
  const tone = STATUS_TONE[person.task] ?? 'priority-low';
  const rows = [
    `<div class="office-row"><span>Status</span><em class="${tone}">${status}</em></div>`,
    `<div class="office-row"><span>Kasus ditutup</span><b>${person.handled}</b></div>`,
  ];

  if (!person.present) {
    rows.push(
      `<div class="office-row"><span>Kembali bertugas</span><b class="mono">${formatClock(metrics.nextShiftStart)}</b></div>`,
      `<div class="office-row"><span>Antre menunggu</span><b>${metrics.queued} kasus</b></div>`,
    );
    return rows.join('');
  }

  const record = person.caseRef;
  if (record) {
    rows.push(
      `<div class="office-row"><span>Kasus</span><b class="case-id">#${record.id}</b></div>`,
      `<div class="office-row"><span>Topik</span><b>${escapeHtml(record.topic)}</b></div>`,
      `<div class="office-row"><span>Alasan eskalasi</span><b>${escapeHtml(record.reason)}</b></div>`,
      `<div class="office-row"><span>Prioritas</span><em class="priority-${record.priority.toLowerCase()}">${record.priority}</em></div>`,
      `<div class="office-row"><span>Diangkat oleh</span><b>${escapeHtml(record.raisedBy)}</b></div>`,
    );
    return rows.join('') + transcriptMarkup(record.transcript, 3);
  }

  rows.push('<div class="office-row"><span>Kasus</span><b class="muted-label">Menunggu tugas</b></div>');
  return rows.join('');
}

function emptyDetail(metrics) {
  return `
    <p class="subtle office-hint">Klik meja mana pun untuk melihat panggilan atau kasus yang sedang ditangani.</p>
    <div class="office-legend">
      <span><i class="legend-dot ai"></i>Meja agent AI — menjawab panggilan otomatis</span>
      <span><i class="legend-dot human"></i>Meja petugas — menangani pertanyaan yang tidak bisa dijawab AI</span>
      <span><i class="legend-dot inbox"></i>Inbox eskalasi — kasus menumpuk di luar jam kerja</span>
    </div>
    <div class="office-row"><span>Meja AI aktif</span><b>${metrics.activeCalls} dari ${metrics.aiDesks}</b></div>
    <div class="office-row"><span>Petugas bertugas</span><b>${metrics.staffOnDuty} dari ${metrics.staffDesks}</b></div>
    <div class="office-row"><span>Antrean panggilan</span><b>${metrics.waiting}</b></div>`;
}

export function renderDetail(host, titleHost, pillHost, { selection, state, metrics }) {
  pillHost.className = `status-pill ${metrics.onShift ? 'live-pill' : 'off-pill'}`;
  pillHost.textContent = metrics.onShift ? '● JAM KERJA' : '○ TUTUP';

  if (!selection) {
    titleHost.textContent = 'Pilih meja';
    host.innerHTML = emptyDetail(metrics);
    return;
  }

  const occupant =
    state.agents.find((agent) => agent.seatId === selection) ??
    state.staff.find((person) => person.seatId === selection);

  if (!occupant) {
    titleHost.textContent = 'Meja kosong';
    host.innerHTML = emptyDetail(metrics);
    return;
  }

  titleHost.textContent = occupant.label;
  host.innerHTML =
    occupant.kind === 'ai' ? agentDetail(occupant, state) : staffDetail(occupant, state, metrics);
}

// ── Queue and log ───────────────────────────────────────────────────────────

export function renderQueue(host, countHost, state) {
  const queued = state.cases.filter((record) => record.status === 'queued');
  countHost.textContent = String(queued.length);

  if (queued.length === 0) {
    host.innerHTML = '<p class="subtle office-hint">Tidak ada kasus menunggu. Semua eskalasi sudah ditangani.</p>';
    return;
  }

  host.innerHTML = queued
    .slice(-6)
    .reverse()
    .map(
      (record) => `
      <div class="case-item office-case">
        <span class="case-priority ${record.priority === 'HIGH' ? 'high' : record.priority === 'MED' ? 'medium' : 'low'}"></span>
        <span><strong>${escapeHtml(record.topicShort)}</strong><small>#${record.id} · ${escapeHtml(record.caller)} · ${formatClock(record.raisedAt)}</small></span>
        <em>${record.priority}</em>
      </div>`,
    )
    .join('');
}

export function renderLog(host, state) {
  if (state.log.length === 0) {
    host.innerHTML = '<p class="subtle office-hint">Belum ada aktivitas.</p>';
    return;
  }
  host.innerHTML = state.log
    .slice(0, 9)
    .map(
      (entry) =>
        `<div class="office-log-line ${entry.kind}"><span class="mono">${formatClock(entry.at)}</span><p>${escapeHtml(entry.text)}</p></div>`,
    )
    .join('');
}
