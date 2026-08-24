/**
 * Mounts the Virtual Office view: loads sprites, starts the simulation, and
 * wires the canvas, toolbar and side panel together.
 *
 * This module owns the frame loop and every event listener, which is why it also
 * owns `destroy()`. The dashboard swaps views by replacing markup, so a listener
 * or a `requestAnimationFrame` left running here would keep a whole simulation
 * alive behind a screen nobody is looking at.
 */

import { createEditor, loadStoredLayout } from './editor.js';
import {
  formatClock,
  officeMarkup,
  renderDetail,
  renderHud,
  renderLog,
  renderMetrics,
  renderQueue,
} from './panel.js';
import { createRenderer } from './render.js';
import { DEFAULT_SPEED, SPEEDS, createSimulation, officeStartTime } from './sim.js';
import { buildBlockedGrid, createDefaultLayout } from './tilemap.js';
import { loadOfficeAssets } from './sprites.js';

/** How often the surrounding DOM is refreshed. The canvas still runs at 60fps. */
const PANEL_INTERVAL_MS = 400;

export async function mountOffice(host, { onStatus } = {}) {
  host.innerHTML = officeMarkup();

  const canvas = host.querySelector('#office-canvas');
  const wrap = host.querySelector('.office-canvas-wrap');
  const metricsHost = host.querySelector('#office-metrics');
  const hudHost = host.querySelector('#office-hud');
  const detailHost = host.querySelector('#office-detail');
  const detailTitle = host.querySelector('#office-detail-title');
  const shiftPill = host.querySelector('#office-shift-pill');
  const queueHost = host.querySelector('#office-queue');
  const queueCount = host.querySelector('#office-queue-count');
  const logHost = host.querySelector('#office-log');
  const scaleLabel = host.querySelector('#office-scale');
  const editorBar = host.querySelector('#office-editor-bar');

  let assets;
  try {
    assets = await loadOfficeAssets();
  } catch (error) {
    host.innerHTML = `<article class="table-panel"><div class="table-panel-head"><div><p class="panel-kicker">VIRTUAL OFFICE</p><h3>Sprite gagal dimuat</h3></div></div><p class="subtle office-hint">${error.message}</p></article>`;
    return { destroy() {} };
  }

  let layout = loadStoredLayout() ?? createDefaultLayout();

  // Opened outside office hours, the clock starts on the next working morning so
  // the escalation desks are staffed rather than empty. The HUD flags it.
  const openedAt = Date.now();
  const startTime = officeStartTime(openedAt);
  const clockShifted = startTime !== openedAt;

  let simulation = createSimulation({
    layout,
    catalog: assets.catalog,
    startTime,
    speed: DEFAULT_SPEED,
  });

  const renderer = createRenderer(canvas, assets);
  let selection = null;
  let hoverSeatId = null;
  let speed = DEFAULT_SPEED;

  const editor = createEditor({
    bar: editorBar,
    assets,
    getLayout: () => layout,
    onChange: (updated) => {
      // The simulation walks the same object, so its blocked grid has to be
      // rebuilt in place before the next tick reads it.
      simulation.state.blocked = buildBlockedGrid(updated, assets.catalog);
      snapSeatedCharacters();
    },
    onReplace: (fresh) => {
      layout = fresh;
      simulation = createSimulation({
        layout,
        catalog: assets.catalog,
        startTime: simulation.state.clock,
        speed,
      });
    },
  });

  /** Keep anyone already sitting lined up with their desk after it is moved. */
  function snapSeatedCharacters() {
    for (const character of [...simulation.state.agents, ...simulation.state.staff]) {
      if (character.motion === 'walk') continue;
      const seat = character.seat;
      character.col = seat.col;
      character.row = seat.row;
      character.x = seat.col * 16 + 8;
      character.y = seat.row * 16 + 8;
    }
  }

  function updateScaleLabel() {
    scaleLabel.textContent = `${renderer.camera.scale}×`;
  }

  function setSpeed(value) {
    speed = value;
    simulation.setSpeed(value);
    for (const button of host.querySelectorAll('[data-speed]')) {
      button.classList.toggle('active', Number(button.dataset.speed) === value);
    }
  }

  // ── Frame loop ────────────────────────────────────────────────────────────

  let frame = 0;
  let lastFrameAt = performance.now();
  let lastPanelAt = 0;
  let running = true;

  function refreshPanels(now) {
    const metrics = simulation.metrics();
    renderMetrics(metricsHost, metrics);
    renderHud(hudHost, metrics, { shifted: clockShifted });
    renderDetail(detailHost, detailTitle, shiftPill, {
      selection,
      state: simulation.state,
      metrics,
    });
    renderQueue(queueHost, queueCount, simulation.state);
    renderLog(logHost, simulation.state);
    lastPanelAt = now;
    if (onStatus) onStatus(metrics);
  }

  function tick(now) {
    if (!running) return;
    const delta = (now - lastFrameAt) / 1000;
    lastFrameAt = now;

    simulation.update(delta);
    renderer.draw(simulation.state, {
      now,
      highlightSeatId: selection,
      hoverSeatId,
      overlay: editor.active ? editor.overlay : null,
    });

    if (now - lastPanelAt >= PANEL_INTERVAL_MS) refreshPanels(now);
    frame = requestAnimationFrame(tick);
  }

  // ── Events ────────────────────────────────────────────────────────────────

  const listeners = [];
  function on(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  }

  let dragging = null;

  on(canvas, 'pointerdown', (event) => {
    // Capture keeps a drag alive if the pointer leaves the canvas. It throws for
    // a pointer the browser has already released, which must not take the
    // click handling down with it.
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      /* dragging still works, it just stops at the canvas edge */
    }
    if (editor.active) {
      editor.click(renderer.screenToTile(event.clientX, event.clientY));
      dragging = { mode: 'paint' };
      return;
    }
    dragging = { mode: 'pan', x: event.clientX, y: event.clientY, moved: false };
  });

  on(canvas, 'pointermove', (event) => {
    const tile = renderer.screenToTile(event.clientX, event.clientY);
    editor.setHover(tile);

    if (dragging?.mode === 'paint') {
      editor.drag(tile);
      return;
    }

    if (dragging?.mode === 'pan') {
      const dx = event.clientX - dragging.x;
      const dy = event.clientY - dragging.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragging.moved = true;
      renderer.panBy(dx, dy);
      dragging.x = event.clientX;
      dragging.y = event.clientY;
      return;
    }

    const seat = renderer.seatAt(event.clientX, event.clientY);
    hoverSeatId = seat?.id ?? null;
    canvas.style.cursor = editor.active ? 'crosshair' : seat ? 'pointer' : 'grab';
  });

  on(canvas, 'pointerup', (event) => {
    try {
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
    if (dragging?.mode === 'pan' && !dragging.moved) {
      const seat = renderer.seatAt(event.clientX, event.clientY);
      selection = seat?.id ?? null;
      refreshPanels(performance.now());
    }
    dragging = null;
  });

  on(canvas, 'pointerleave', () => {
    hoverSeatId = null;
    editor.setHover(null);
    dragging = null;
  });

  on(
    wrap,
    'wheel',
    (event) => {
      if (!event.ctrlKey && Math.abs(event.deltaY) < 2) return;
      event.preventDefault();
      renderer.setScale(renderer.camera.scale + (event.deltaY < 0 ? 1 : -1));
      updateScaleLabel();
    },
    { passive: false },
  );

  on(host, 'click', (event) => {
    const button = event.target.closest('button');
    if (!button || editorBar.contains(button)) return;

    if (button.dataset.speed) {
      setSpeed(Number(button.dataset.speed));
      return;
    }

    switch (button.dataset.action) {
      case 'zoom-in':
        renderer.setScale(renderer.camera.scale + 1);
        updateScaleLabel();
        break;
      case 'zoom-out':
        renderer.setScale(renderer.camera.scale - 1);
        updateScaleLabel();
        break;
      case 'fit':
        renderer.setScale(renderer.fitScale());
        renderer.resetPan();
        updateScaleLabel();
        break;
      case 'toggle-edit': {
        const next = !editor.active;
        editor.setActive(next);
        button.classList.toggle('active', next);
        button.textContent = next ? '✓ Selesai edit' : '✎ Edit layout';
        canvas.style.cursor = next ? 'crosshair' : 'grab';
        break;
      }
      default:
        break;
    }
  });

  const observer = new ResizeObserver(() => {
    renderer.resize();
    renderer.setScale(renderer.fitScale());
    updateScaleLabel();
  });
  observer.observe(wrap);

  function onVisibility() {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(frame);
    } else if (!running) {
      running = true;
      lastFrameAt = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }
  on(document, 'visibilitychange', onVisibility);

  // ── Start ─────────────────────────────────────────────────────────────────

  renderer.resize();
  renderer.setScale(renderer.fitScale());
  updateScaleLabel();
  setSpeed(SPEEDS.includes(DEFAULT_SPEED) ? DEFAULT_SPEED : SPEEDS[0]);
  refreshPanels(performance.now());
  frame = requestAnimationFrame(tick);

  return {
    destroy() {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      for (const off of listeners) off();
    },
    /** Exposed for the dashboard's status line. */
    clock: () => formatClock(simulation.state.clock),
  };
}
