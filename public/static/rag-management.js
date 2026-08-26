const TOKEN_STORAGE_KEY = 'bpom.ragAdminToken';
// A sample of the corpus, not all of it. 20k chunks packed the sphere solid:
// there was no gap left between dots for a link to be drawn in, and the mesh
// was invisible no matter what alpha it used. 8k keeps the cloud dense while
// leaving the background visible through it.
const GRAPH_LIMIT = 8000;

const SOURCE_LABELS = {
  official_regulation: 'Peraturan BPOM',
  official_html: 'Artikel resmi',
  official_pdf: 'Manual resmi',
  curated: 'Knowledge terkurasi',
  curated_official_synthesis: 'Knowledge terkurasi',
  operator_note: 'Catatan operator',
  internal_procedure: 'Prosedur internal',
  faq: 'FAQ internal',
  knowledge_document: 'Dokumen knowledge',
};

// Categorical hues only. #ffb248 and #ff78b7 are reserved for the warning and
// editable rings, so no source type may claim them or a document's category
// becomes indistinguishable from its status.
const SOURCE_COLORS = {
  official_regulation: '#53d9e5',
  official_html: '#46d7a6',
  official_pdf: '#a590ff',
  curated: '#f5de70',
  curated_official_synthesis: '#f5de70',
  operator_note: '#ff9ad5',
  internal_procedure: '#78a8ff',
  faq: '#c2b280',
  knowledge_document: '#8d9aa4',
};

// Topics are structure rather than a category, so they stay neutral and leave
// the violet to official_pdf.
const TOPIC_COLOR = '#8b93b8';

const PULSE_PERIOD = 5200;
// Radians per second: about 17 degrees, so a full turn takes roughly 21s.
const ROTATION_RATE = 0.3;
const SPIN_STORAGE_KEY = 'bpom.ragAutoSpin';

const STATUS_LABELS = {
  active: 'Aktif',
  review: 'Perlu review',
  warning: 'Warning',
  repealed: 'Dicabut',
  superseded: 'Diubah',
};

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('id-ID');
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return 'Tidak diketahui';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function sourceLabel(value) {
  return SOURCE_LABELS[value] || String(value || 'Knowledge').replaceAll('_', ' ');
}

function statusLabel(value) {
  return STATUS_LABELS[value] || value || 'Aktif';
}

function safeExternalUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function debounce(callback, delay = 320) {
  let timer = null;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => callback(...args), delay);
  };
}

function hashNumber(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

class RagGraph {
  constructor(canvas, onSelect) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.onSelect = onSelect;
    this.nodes = [];
    this.edges = [];
    this.nodeMap = new Map();
    this.selectedNodeId = null;
    this.hoveredNodeId = null;
    this.frame = null;
    this.pulse = 0;
    this.radius = 400;
    this.mesh = [];
    this.yaw = 0;
    this.pitch = 0.34;
    this.reducedMotion = false;
    this.onScreen = true;
    this.transform = { x: 0, y: 0, scale: 1 };
    this.pointer = null;
    this.controller = new AbortController();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.bindEvents();
    this.resize();
  }

  bindEvents() {
    const signal = this.controller.signal;
    this.canvas.addEventListener('pointerdown', (event) => this.pointerDown(event), { signal });
    this.canvas.addEventListener('pointermove', (event) => this.pointerMove(event), { signal });
    this.canvas.addEventListener('pointerup', (event) => this.pointerUp(event), { signal });
    this.canvas.addEventListener('pointercancel', () => { this.pointer = null; }, { signal });
    this.canvas.addEventListener('pointerleave', () => {
      if (!this.pointer && this.hoveredNodeId) {
        this.hoveredNodeId = null;
        this.render();
      }
    }, { signal });
    this.canvas.addEventListener('wheel', (event) => this.zoomAt(event), { signal, passive: false });
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault(), { signal });
    this.canvas.addEventListener('dblclick', () => this.fit(), { signal });
    this.canvas.addEventListener('keydown', (event) => {
      if (event.key === '+' || event.key === '=') this.zoom(1.2);
      if (event.key === '-') this.zoom(0.84);
      if (event.key === '0') this.fit();
    }, { signal });

    // The idle animation runs forever, so give it back to the machine whenever
    // the canvas is off screen or the tab is in the background.
    document.addEventListener('visibilitychange', () => this.resume(), { signal });
    this.intersectionObserver = new IntersectionObserver((entries) => {
      this.onScreen = entries.some((entry) => entry.isIntersecting);
      this.resume();
    });
    this.intersectionObserver.observe(this.canvas);
  }

  resize() {
    const parent = this.canvas.parentElement;
    // offsetWidth is the layout size in CSS pixels. getBoundingClientRect()
    // reports the size *after* the shell's zoom, and feeding that back into
    // style.width gets zoomed a second time — each ResizeObserver pass grew the
    // canvas again until allocation failed and the panel went blank white.
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(320, Math.min(6000, parent.offsetWidth || 320));
    const height = Math.max(360, Math.min(6000, parent.offsetHeight || 360));
    this.canvas.width = Math.floor(width * ratio);
    this.canvas.height = Math.floor(height * ratio);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.pixelRatio = ratio;
    this.viewport = { width, height };
    this.render();
    this.resume();
  }

  setData(payload) {
    this.nodes = payload.nodes.map((node) => ({
      ...node,
      // The renderer's "document" kind means a clickable leaf dot. A chunk is
      // one, and it already carries its parent's document_id, so the inspector
      // keeps working untouched.
      kind: node.kind === 'chunk' ? 'document' : node.kind,
      bx: 0, by: 0, bz: 0,
      sx: 0, sy: 0, near: 0, persp: 1,
    }));
    this.edges = payload.edges;
    this.nodeMap = new Map(this.nodes.map((node) => [node.id, node]));
    this.yaw = 0.6;
    this.pitch = 0.34;
    this.layoutSphere();
    this.buildMesh();
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const stored = window.localStorage.getItem(SPIN_STORAGE_KEY);
    // Default follows the accessibility preference, but the reader can override
    // it. Letting the OS flag silently kill the rotation left no way to tell a
    // deliberate setting from a broken feature.
    this.autoRotate = stored === null ? !this.reducedMotion : stored === 'on';
    this.animationStart = performance.now();
    this.pulse = 0;
    this.project();
    this.fit();
    this.start();
  }

  /**
   * Scatter the corpus through a ball rather than across a plane.
   *
   * Direction comes from a Fibonacci spiral, which spaces points evenly over a
   * sphere. Radius comes from the cube root of a hashed value, which is what
   * spreads density evenly through the volume instead of piling everything onto
   * the surface. Two harmonics then push the shell in and out so the silhouette
   * is ragged rather than a machined ball.
   */
  layoutSphere() {
    const documents = this.nodes.filter((node) => node.kind === 'document');
    const radius = Math.max(260, Math.min(640, Math.cbrt(Math.max(1, documents.length)) * 23));
    this.radius = radius;

    const golden = Math.PI * (3 - Math.sqrt(5));
    documents.forEach((node, index) => {
      const hash = hashNumber(node.id);
      const t = (index + 0.5) / documents.length;
      const y = 1 - 2 * t;
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = index * golden + ((hash % 100) / 100 - 0.5) * 0.5;

      const fill = Math.cbrt(0.05 + 0.95 * (((hash >>> 6) % 1000) / 1000));
      const spike = 1 + 0.22 * Math.sin(theta * 3 + y * 4) + 0.15 * Math.sin(theta * 5 - y * 7);
      const reach = radius * fill * spike;

      node.bx = Math.cos(theta) * ring * reach;
      node.by = y * reach;
      node.bz = Math.sin(theta) * ring * reach;
    });

    const root = this.nodeMap.get('rag-root');
    if (root) { root.bx = 0; root.by = 0; root.bz = 0; }

    // Sources ride an inner shell and topics an outer one, so both stay legible
    // against the document haze between them.
    const shell = (list, distance, offset) => {
      list.forEach((node, index) => {
        const t = (index + 0.5) / Math.max(1, list.length);
        const y = 1 - 2 * t;
        const ring = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = index * golden + offset;
        node.bx = Math.cos(theta) * ring * distance;
        node.by = y * distance;
        node.bz = Math.sin(theta) * ring * distance;
      });
    };
    shell(this.nodes.filter((node) => node.kind === 'source'), radius * 0.34, 0.4);
    shell(this.nodes.filter((node) => node.kind === 'topic'), radius * 1.14, 1.1);
  }

  /**
   * Link every document to its nearest neighbour so the orb reads as a web.
   *
   * This is a visual scaffold, not a claim about the corpus: the real edges run
   * hub-and-spoke from four source nodes and project as a starburst, which is
   * not the reference at all. Selection still highlights the real edges. Built
   * once, because the positions only rotate afterwards.
   */
  buildMesh() {
    const all = this.nodes.filter((node) => node.kind === 'document');
    // Link a sparse sample, not every dot. A nearest-neighbour mesh over 20k
    // packed nodes draws lines shorter than the dots at their ends — measured,
    // the entire mesh lit one pixel on the canvas. Sampling spreads the
    // endpoints far enough apart for the line between them to be seen.
    const stride = Math.max(1, Math.round(all.length / 1800));
    const documents = all.filter((_, index) => index % stride === 0);
    const cell = Math.max(24, this.radius / 4);
    const buckets = new Map();
    for (const node of documents) {
      const id = `${Math.round(node.bx / cell)}:${Math.round(node.by / cell)}:${Math.round(node.bz / cell)}`;
      let bucket = buckets.get(id);
      if (!bucket) { bucket = []; buckets.set(id, bucket); }
      bucket.push(node);
    }

    const mesh = [];
    const seen = new Set();
    // One link per dot is affordable at a few thousand nodes and not at twenty
    // thousand: the mesh alone costs a frame more than the dots do, and at that
    // density it reads as haze rather than structure. Thin it so the line count
    // stays flat as the corpus grows.
    for (let index = 0; index < documents.length; index += 1) {
      const node = documents[index];
      const cx = Math.round(node.bx / cell);
      const cy = Math.round(node.by / cell);
      const cz = Math.round(node.bz / cell);
      const candidates = [];
      for (let ox = -1; ox <= 1; ox += 1) {
        for (let oy = -1; oy <= 1; oy += 1) {
          for (let oz = -1; oz <= 1; oz += 1) {
            const bucket = buckets.get(`${cx + ox}:${cy + oy}:${cz + oz}`);
            if (bucket) candidates.push(...bucket);
          }
        }
      }
      const distance = (other) => (other.bx - node.bx) ** 2 + (other.by - node.by) ** 2 + (other.bz - node.bz) ** 2;
      candidates.sort((a, b) => distance(a) - distance(b));
      let taken = 0;
      for (const other of candidates) {
        if (taken >= 1) break;
        if (other === node) continue;
        const pair = node.id < other.id ? `${node.id}|${other.id}` : `${other.id}|${node.id}`;
        if (seen.has(pair)) continue;
        seen.add(pair);
        mesh.push([node, other]);
        taken += 1;
      }
    }
    this.mesh = mesh;
  }

  /** Rotate the fixed positions into screen space and record their depth. */
  project() {
    const cosYaw = Math.cos(this.yaw);
    const sinYaw = Math.sin(this.yaw);
    const cosPitch = Math.cos(this.pitch);
    const sinPitch = Math.sin(this.pitch);
    const focal = this.radius * 3.1;
    const span = this.radius * 1.35;

    for (const node of this.nodes) {
      const x1 = node.bx * cosYaw - node.bz * sinYaw;
      const z1 = node.bx * sinYaw + node.bz * cosYaw;
      const y1 = node.by * cosPitch - z1 * sinPitch;
      const z2 = node.by * sinPitch + z1 * cosPitch;
      const persp = focal / (focal + z2);
      node.sx = x1 * persp;
      node.sy = y1 * persp;
      node.persp = persp;
      // 1 nearest the viewer, 0 furthest from it.
      node.near = Math.min(1, Math.max(0, 1 - (z2 + span) / (2 * span)));
    }
  }

  settle() {
    this.project();
  }

  setAutoRotate(on) {
    this.autoRotate = Boolean(on);
    window.localStorage.setItem(SPIN_STORAGE_KEY, this.autoRotate ? 'on' : 'off');
    this.start();
    return this.autoRotate;
  }

  start() {
    if (this.frame) cancelAnimationFrame(this.frame);
    if (!this.autoRotate) {
      this.project();
      this.render();
      this.frame = null;
      return;
    }

    this.lastFrame = performance.now();
    const step = (now) => {
      const elapsed = now - this.animationStart;
      // Advance by elapsed time, not by frame: a per-frame step runs twice as
      // fast on a 120Hz panel. 0.0017rad/frame worked out at one revolution per
      // minute, which reads as a still image.
      const delta = Math.min(0.05, (now - this.lastFrame) / 1000);
      this.lastFrame = now;
      // Never stop outright. With 6.5k dots filling the orb, "the cursor is on
      // a dot" is very nearly "the cursor is over the canvas", so pausing on
      // hover froze the animation exactly as pausing on the whole canvas did.
      // Crawl instead, which keeps a hovered dot catchable without the graph
      // ever looking dead.
      if (!this.pointer) {
        this.yaw += ROTATION_RATE * (this.hoveredNodeId ? 0.15 : 1) * delta;
      }
      this.project();
      this.pulse = (elapsed % PULSE_PERIOD) / PULSE_PERIOD;
      this.render();
      this.frame = this.awake() ? requestAnimationFrame(step) : null;
    };

    this.frame = requestAnimationFrame(step);
  }

  /** Idle motion is not worth a frame when nobody can see the canvas. */
  awake() {
    return !document.hidden && this.onScreen !== false;
  }

  resume() {
    if (!this.frame && this.autoRotate && this.nodes.length && this.awake()) {
      this.animationStart = performance.now();
      this.start();
    }
  }

  /** Ratio between visual and layout pixels under the display-scale zoom. */
  zoomFactor() {
    const rect = this.canvas.getBoundingClientRect();
    return this.canvas.offsetWidth ? rect.width / this.canvas.offsetWidth : 1;
  }

  worldFromPointer(event) {
    const rect = this.canvas.getBoundingClientRect();
    // clientX and the rect are visual pixels, but the canvas transform is in
    // layout pixels. Under the display-scale zoom those differ, and the error
    // grows with distance from the origin — the far side of the orb becomes
    // unclickable. Dividing by the measured ratio removes it.
    const zoom = this.canvas.offsetWidth ? rect.width / this.canvas.offsetWidth : 1;
    const localX = (event.clientX - rect.left) / zoom;
    const localY = (event.clientY - rect.top) / zoom;
    return {
      x: (localX - this.transform.x) / this.transform.scale,
      y: (localY - this.transform.y) / this.transform.scale,
      screenX: localX,
      screenY: localY,
    };
  }

  nodeRadius(node) {
    if (node.kind === 'root') return 15;
    if (node.kind === 'source') return 9.5;
    if (node.kind === 'topic') return 6.5;
    return Math.max(2.4, 1.6 + Number(node.size || 1) * 0.72);
  }

  hitTest(point) {
    let best = null;
    let bestScore = -1;
    const slack = 5 / this.transform.scale;
    for (const node of this.nodes) {
      const size = this.nodeRadius(node) * (0.5 + node.near * 0.7);
      // Track the drawn dot, with enough margin that a near miss still counts.
      const radius = size * 1.8 + slack;
      const distance = Math.hypot(point.x - node.sx, point.y - node.sy);
      if (distance > radius) continue;
      // Balance "in front of everything else" against "actually under the
      // cursor": depth alone let a near node win from the edge of its halo
      // while a dot dead under the pointer lost.
      const score = node.near * 0.55 + (1 - distance / radius) * 0.45;
      if (score > bestScore) {
        bestScore = score;
        best = node;
      }
    }
    return best;
  }

  pointerDown(event) {
    const point = this.worldFromPointer(event);
    const node = this.hitTest(point);
    // Shift, the right button or the middle button pan the view; a plain drag
    // turns the orb. Panning used to be unreachable — every drag rotated.
    const panning = event.shiftKey || event.button === 1 || event.button === 2;
    this.pointer = {
      id: event.pointerId,
      node: panning ? null : node,
      mode: panning ? 'pan' : 'rotate',
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
    };
    this.canvas.style.cursor = panning ? 'grabbing' : 'grab';
    this.canvas.setPointerCapture(event.pointerId);
  }

  pointerMove(event) {
    // A pointerup swallowed by the browser would leave this.pointer set, and
    // the idle rotation checks it — the orb would then sit frozen forever with
    // nothing on screen to explain why.
    if (this.pointer && event.buttons === 0) {
      this.pointer = null;
      this.resume();
    }
    const point = this.worldFromPointer(event);
    if (!this.pointer) {
      const hovered = this.hitTest(point)?.id || null;
      if (hovered !== this.hoveredNodeId) {
        this.hoveredNodeId = hovered;
        this.canvas.style.cursor = hovered ? 'pointer' : 'grab';
        this.render();
      }
      return;
    }

    const dx = event.clientX - this.pointer.lastX;
    const dy = event.clientY - this.pointer.lastY;
    this.pointer.lastX = event.clientX;
    this.pointer.lastY = event.clientY;
    // 4px used to be the budget, which a hand chasing a turning orb blows
    // through every time — the click then registered as a rotate and the
    // document never opened.
    if (Math.hypot(event.clientX - this.pointer.startX, event.clientY - this.pointer.startY) > 11) {
      this.pointer.moved = true;
    }

    const zoom = this.zoomFactor();
    if (this.pointer.mode === 'pan') {
      // Deltas arrive in visual pixels; the transform is in layout pixels.
      this.transform.x += dx / zoom;
      this.transform.y += dy / zoom;
    } else {
      // Nodes are fixed to the sphere, so a plain drag turns the whole orb
      // rather than pulling one dot out of it.
      this.yaw += (dx / zoom) * 0.006;
      this.pitch = Math.max(-1.25, Math.min(1.25, this.pitch + (dy / zoom) * 0.006));
      this.project();
    }
    this.render();
  }

  pointerUp(event) {
    if (!this.pointer) return;
    const { node, moved } = this.pointer;
    if (node && node.kind === 'document' && !moved) {
      this.selectedNodeId = node.id;
      this.onSelect(node.document_id);
    }
    this.pointer = null;
    this.canvas.style.cursor = this.hoveredNodeId ? 'pointer' : 'grab';
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    this.resume();
    this.render();
  }

  zoomAt(event) {
    event.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const previous = this.transform.scale;
    const next = Math.min(3.2, Math.max(0.28, previous * Math.exp(-event.deltaY * 0.0012)));
    const worldX = (pointerX - this.transform.x) / previous;
    const worldY = (pointerY - this.transform.y) / previous;
    this.transform.scale = next;
    this.transform.x = pointerX - worldX * next;
    this.transform.y = pointerY - worldY * next;
    this.render();
  }

  zoom(multiplier) {
    const centerX = this.viewport.width / 2;
    const centerY = this.viewport.height / 2;
    const previous = this.transform.scale;
    const next = Math.min(3.2, Math.max(0.28, previous * multiplier));
    const worldX = (centerX - this.transform.x) / previous;
    const worldY = (centerY - this.transform.y) / previous;
    this.transform.scale = next;
    this.transform.x = centerX - worldX * next;
    this.transform.y = centerY - worldY * next;
    this.render();
  }

  fit() {
    if (!this.nodes.length || !this.viewport) return;
    // Frame the sphere itself, not the current projection: fitting to a shape
    // that rotates would make the view breathe once per revolution.
    const extent = (this.radius || 400) * 1.32;
    const scale = Math.min(this.viewport.width, this.viewport.height) / (extent * 2);
    this.transform.scale = Math.min(1.6, Math.max(0.25, scale * 0.96));
    this.transform.x = this.viewport.width / 2;
    this.transform.y = this.viewport.height / 2;
    this.render();
  }

  selectDocument(documentId) {
    const node = this.nodes.find((entry) => entry.document_id === documentId);
    this.selectedNodeId = node?.id || null;
    this.render();
  }

  render() {
    if (!this.context || !this.viewport) return;
    const ctx = this.context;
    const ratio = this.pixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, this.viewport.width, this.viewport.height);
    ctx.save();
    ctx.translate(this.transform.x, this.transform.y);
    ctx.scale(this.transform.scale, this.transform.scale);

    const selected = this.selectedNodeId;
    const connected = new Set();
    if (selected) {
      connected.add(selected);
      for (const edge of this.edges) {
        if (edge.source === selected) connected.add(edge.target);
        if (edge.target === selected) connected.add(edge.source);
      }
    }

    const radius = this.radius || 400;
    const BANDS = 6;
    const lineScale = this.transform.scale ** 0.25;

    // Core glow, so the middle of the orb reads as dense rather than merely
    // crowded.
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    glow.addColorStop(0, 'rgba(126,205,235,0.07)');
    glow.addColorStop(0.55, 'rgba(96,150,205,0.03)');
    glow.addColorStop(1, 'rgba(96,150,205,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Mesh, banded by depth: one Path2D per band keeps this to six strokes for
    // thirteen thousand segments.
    const meshPaths = [];
    for (let index = 0; index < BANDS; index += 1) meshPaths.push(new Path2D());
    for (const link of this.mesh || []) {
      const a = link[0];
      const b = link[1];
      const depth = (a.near + b.near) / 2;
      if (depth < 0.18) continue;
      const band = Math.min(BANDS - 1, Math.max(0, Math.floor(depth * BANDS)));
      meshPaths[band].moveTo(a.sx, a.sy);
      meshPaths[band].lineTo(b.sx, b.sy);
    }

    // The corpus' real edges are hub-and-spoke, so they only earn ink when the
    // reader has actually picked something.
    let selectionPath = null;
    if (selected) {
      const path = new Path2D();
      for (const edge of this.edges) {
        const a = this.nodeMap.get(edge.source);
        const b = this.nodeMap.get(edge.target);
        if (!a || !b || !connected.has(a.id) || !connected.has(b.id)) continue;
        path.moveTo(a.sx, a.sy);
        path.lineTo(b.sx, b.sy);
      }
      // Stroked after the dots, further down. Drawn here it went under eight
      // thousand of them and vanished, which is what made a selected node look
      // unconnected to anything.
      selectionPath = path;
    }

    // Dots, grouped by colour and depth band so the far side of the orb is
    // drawn first and reads as further away.
    const groups = new Map();
    const standouts = [];
    for (const node of this.nodes) {
      const isSelected = node.id === selected;
      const isHovered = node.id === this.hoveredNodeId;
      if (isSelected || isHovered || node.kind !== 'document') {
        standouts.push(node);
        continue;
      }
      const band = Math.min(BANDS - 1, Math.max(0, Math.floor(node.near * BANDS)));
      const colour = SOURCE_COLORS[node.source_type] || '#7f8c95';
      const key = `${colour}|${band}`;
      let group = groups.get(key);
      if (!group) {
        group = { path: new Path2D(), colour, band };
        groups.set(key, group);
      }
      // Bigger and solid rather than small and haloed: without bloom to carry
      // it, the dot itself has to be the thing you see and aim at.
      const size = this.nodeRadius(node) * (0.5 + node.near * 0.7);
      group.path.moveTo(node.sx + size, node.sy);
      group.path.arc(node.sx, node.sy, size, 0, Math.PI * 2);
    }

    ctx.shadowBlur = 0;
    const ordered = [...groups.values()].sort((a, b) => a.band - b.band);
    for (const group of ordered) {
      const depth = (group.band + 0.5) / BANDS;
      // Drawn back to front. The alpha floor used to be 0.62, which reads as
      // washed-out the moment dots are large enough to overlap — and at twenty
      // thousand of them they always are. Depth is now carried almost entirely
      // by size, with only a slight fade left to it.
      ctx.globalAlpha = selected ? 0.22 : 0.70 + depth * 0.22;
      ctx.fillStyle = group.colour;
      ctx.fill(group.path);
      // A dark rim separates overlapping dots — but only once they are big
      // enough to have room for one. Fitted to the panel a dot is about two
      // pixels across, and a rim there eats the dot instead of outlining it:
      // it cost 30% of the lit pixels and dropped mean brightness from 224
      // to 144. lineWidth is in world units, so divide by the zoom to keep it
      // roughly one screen pixel.
      if (this.transform.scale > 1.5) {
        ctx.globalAlpha = selected ? 0.14 : 0.45 + depth * 0.3;
        ctx.strokeStyle = '#05080b';
        ctx.lineWidth = 1.1 / this.transform.scale;
        ctx.stroke(group.path);
      }
    }

    // Drawn over the dots, not under them. Underneath, twenty thousand opaque
    // dots covered the sphere so completely that the mesh left two lit pixels
    // on the whole canvas — no alpha would have rescued it.
    ctx.globalAlpha = 1;
    for (let index = 0; index < BANDS; index += 1) {
      const depth = (index + 0.5) / BANDS;
      ctx.strokeStyle = `rgba(178,220,252,${(selected ? 0.05 : 0.22) + depth * (selected ? 0.08 : 0.33)})`;
      ctx.lineWidth = (0.6 + depth * 0.9) / lineScale;
      ctx.stroke(meshPaths[index]);
    }

    if (selectionPath) {
      // Bold, on top of everything: this is the one thing the reader asked to
      // see. A glow carries it over the dot field underneath.
      ctx.globalAlpha = 1;
      ctx.shadowColor = '#53d9e5';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = 'rgba(120,240,255,0.95)';
      ctx.lineWidth = 2.6 / this.transform.scale;
      ctx.stroke(selectionPath);
      ctx.shadowBlur = 0;
    }

    for (const node of standouts) {
      const isSelected = node.id === selected;
      const isHovered = node.id === this.hoveredNodeId;
      const colour = node.kind === 'topic'
        ? TOPIC_COLOR
        : node.kind === 'root'
          ? '#ffffff'
          : SOURCE_COLORS[node.source_type] || '#7f8c95';
      const size = this.nodeRadius(node) * (0.6 + node.near * 0.8);
      ctx.globalAlpha = selected && !connected.has(node.id) && node.kind === 'document'
        ? 0.25
        : 0.4 + node.near * 0.6;
      if (isSelected || isHovered || node.kind === 'root') {
        ctx.shadowColor = colour;
        ctx.shadowBlur = isSelected ? 20 : 11;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.beginPath();
      ctx.arc(node.sx, node.sy, size, 0, Math.PI * 2);
      ctx.fillStyle = colour;
      ctx.fill();
      if (node.status === 'warning' || node.status === 'review') {
        ctx.strokeStyle = '#ffb248';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      if (node.kind !== 'document' || isSelected || isHovered) {
        const label = node.label.length > 46 ? `${node.label.slice(0, 43)}…` : node.label;
        // Font size is in world units, so at fit zoom an 8px label rendered at
        // about two screen pixels of mush. Divide by the zoom to pin it to a
        // constant on-screen size, and drop the depth alpha the dots left
        // behind — text at 0.4 opacity reads as blur, not distance.
        const px = (node.kind === 'document' ? 9 : 10) / this.transform.scale;
        ctx.globalAlpha = 1;
        ctx.font = `${node.kind === 'root' ? 700 : 500} ${px}px Cascadia Mono, Consolas, monospace`;
        ctx.lineWidth = 3 / this.transform.scale;
        ctx.strokeStyle = 'rgba(5,8,11,0.85)';
        ctx.lineJoin = 'round';
        ctx.strokeText(label, node.sx + size + 5, node.sy);
        ctx.fillStyle = isSelected || isHovered ? '#ffffff' : '#dbe4e7';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, node.sx + size + 5, node.sy);
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  destroy() {
    this.controller.abort();
    this.resizeObserver.disconnect();
    this.intersectionObserver?.disconnect();
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = null;
  }
}

function loadingMarkup(message = 'Memuat memory RAG…') {
  return `<div class="rag-loading-shell"><span class="rag-spinner"></span><p>${escapeHtml(message)}</p></div>`;
}

function accessMarkup(capabilities, error = '') {
  if (capabilities.access_mode === 'disabled') {
    return `<section class="rag-access-card"><span class="rag-access-icon">⌁</span><p class="panel-kicker">RAG MANAGEMENT LOCKED</p><h2>Aktifkan akses administrator</h2><p>Set <code>RAG_ADMIN_TOKEN</code> pada environment aplikasi, lalu muat ulang halaman. Endpoint pengelolaan sengaja ditutup saat aplikasi bukan berjalan lokal.</p></section>`;
  }
  return `<section class="rag-access-card"><span class="rag-access-icon">⌁</span><p class="panel-kicker">SECURE KNOWLEDGE ACCESS</p><h2>Buka RAG Management</h2><p>Masukkan token administrator. Token hanya disimpan selama tab ini terbuka.</p><form id="rag-unlock-form"><label>Admin token<input id="rag-token-input" type="password" autocomplete="off" minlength="8" required placeholder="RAG_ADMIN_TOKEN" /></label>${error ? `<p class="rag-form-error">${escapeHtml(error)}</p>` : ''}<button class="primary-button" type="submit">Unlock management</button></form></section>`;
}

function shellMarkup(capabilities) {
  const lockAction = capabilities.requires_token
    ? '<button class="rag-ghost-button" type="button" data-rag-action="lock">Lock</button>'
    : '<span class="rag-local-badge">LOCAL ACCESS</span>';
  return `<section class="rag-page" aria-label="RAG Management">
    <header class="rag-page-heading">
      <div><p class="eyebrow">KNOWLEDGE GRAPH · RAG OPERATIONS</p><h2>RAG Management</h2><p class="subtle">Lihat hubungan memory AI dan kelola knowledge operator dari satu workspace.</p></div>
      <div class="rag-heading-actions">${lockAction}<button class="primary-button" type="button" data-rag-action="add">＋ Tambah memory</button></div>
    </header>
    <section class="rag-stats" aria-label="Ringkasan RAG">
      <article><i class="cyan"></i><span>TOTAL SOURCES</span><strong data-rag-stat="documents">—</strong><small>Dokumen siap ditelusuri</small></article>
      <article><i class="green"></i><span>RETRIEVAL CHUNKS</span><strong data-rag-stat="chunks">—</strong><small>Konten setelah deduplikasi</small></article>
      <article><i class="violet"></i><span>MEMORY OPERATOR</span><strong data-rag-stat="editable">—</strong><small>Dapat diedit dan dihapus</small></article>
      <article><i class="amber"></i><span>NEEDS ATTENTION</span><strong data-rag-stat="warnings">—</strong><small>Warning ekstraksi atau review</small></article>
    </section>
    <div class="rag-workspace">
      <section class="rag-graph-panel" aria-label="Visualisasi graph RAG">
        <div class="rag-toolbar">
          <label class="rag-search"><span>⌕</span><input type="search" data-rag-field="query" placeholder="Cari judul, topik, regulasi…" aria-label="Cari knowledge" /></label>
          <select data-rag-field="source" aria-label="Filter tipe sumber"><option value="all">Semua sumber</option></select>
          <select data-rag-field="status" aria-label="Filter status"><option value="all">Semua status</option><option value="active">Aktif</option><option value="review">Review</option><option value="warning">Warning</option><option value="repealed">Dicabut</option><option value="superseded">Diubah</option></select>
          <button class="rag-tool-button" type="button" data-rag-action="refresh" title="Muat ulang graph" aria-label="Muat ulang data RAG">↻</button>
        </div>
        <div class="rag-canvas-wrap">
          <canvas class="rag-canvas" tabindex="0" aria-label="Graph interaktif sumber dan topik RAG. Drag untuk bergerak, scroll untuk zoom."></canvas>
          <div class="rag-graph-state" aria-live="polite">${loadingMarkup('Menyusun graph knowledge…')}</div>
          <div class="rag-graph-controls" role="group" aria-label="Kontrol graph">
            <button type="button" data-rag-action="zoom-in" aria-label="Perbesar">＋</button>
            <button type="button" data-rag-action="zoom-out" aria-label="Perkecil">−</button>
            <button type="button" data-rag-action="fit" aria-label="Tampilkan seluruh graph">⌗</button>
            <button type="button" data-rag-action="toggle-spin" data-rag-spin aria-label="Putar otomatis" title="Putar otomatis">↻</button>
          </div>
          <div class="rag-legend"><span><i class="legend-official"></i>Resmi</span><span><i class="legend-curated"></i>Curated</span><span><i class="legend-managed"></i>Operator</span><span><i class="legend-topic"></i>Topik</span></div>
        </div>
        <footer class="rag-graph-footer"><span data-rag-graph-summary>Menyiapkan data…</span><span>Drag putar · Shift atau klik kanan geser · scroll zoom · klik node untuk detail</span></footer>
      </section>
      <aside class="rag-manager" aria-label="Panel pengelolaan memory">
        <div class="rag-manager-head"><div><p class="panel-kicker">MEMORY LIBRARY</p><h3>Manage knowledge</h3></div><button type="button" data-rag-action="add" aria-label="Tambah memory">＋</button></div>
        <label class="rag-side-search"><span>⌕</span><input type="search" data-rag-field="side-query" placeholder="Cari di library…" aria-label="Cari library knowledge" /></label>
        <div class="rag-document-list" aria-live="polite">${loadingMarkup('Memuat dokumen…')}</div>
        <div class="rag-pagination"><button type="button" data-rag-action="previous-page" aria-label="Halaman sebelumnya">‹</button><span data-rag-page>Halaman 1</span><button type="button" data-rag-action="next-page" aria-label="Halaman berikutnya">›</button></div>
        <section class="rag-inspector" aria-live="polite"><div class="rag-inspector-empty"><span>✦</span><strong>Pilih sebuah node</strong><p>Detail sumber, status, chunk, dan aksi pengelolaan akan tampil di sini.</p></div></section>
      </aside>
    </div>
    <div class="rag-resize-handle" data-rag-resize role="separator" aria-orientation="horizontal" tabindex="0" title="Tarik untuk memperbesar · klik ganda untuk kembalikan" aria-label="Ubah tinggi workspace"><span></span></div>
    <dialog class="rag-dialog" data-rag-dialog="editor" aria-labelledby="rag-editor-heading">
      <form class="rag-editor-form" method="dialog" id="rag-editor-form">
        <div class="rag-dialog-head"><div><p class="panel-kicker">OPERATOR MEMORY</p><h3 id="rag-editor-heading" data-rag-editor-title>Tambah memory RAG</h3></div><button type="button" data-rag-action="close-editor" aria-label="Tutup">×</button></div>
        <div class="rag-form-grid"><label class="rag-wide">Judul<input name="title" minlength="2" maxlength="180" required placeholder="Contoh: SOP validasi aktivasi akun" /></label><label>Tipe<select name="source_type"><option value="operator_note">Catatan operator</option><option value="internal_procedure">Prosedur internal</option><option value="faq">FAQ internal</option></select></label><label>Status<select name="status"><option value="active">Aktif</option><option value="review">Perlu review</option></select></label><label class="rag-wide">URL sumber (opsional)<input name="source_url" type="url" maxlength="2048" placeholder="https://…" /></label><label class="rag-wide">Tag, pisahkan dengan koma<input name="tags" maxlength="500" placeholder="aktivasi, akun, troubleshooting" /></label><label class="rag-wide">Isi knowledge<div class="rag-content-tools"><span>Markdown didukung · maksimum 500.000 karakter</span><button type="button" data-rag-action="import-file" aria-label="Import file Markdown atau teks">Import .md/.txt</button><input type="file" data-rag-file accept=".md,.txt,text/markdown,text/plain" hidden /></div><textarea name="content" maxlength="500000" required placeholder="Tuliskan fakta, prosedur, batasan, dan kapan agent harus melakukan eskalasi."></textarea></label></div>
        <p class="rag-form-error" data-rag-form-error hidden></p>
        <div class="rag-dialog-actions"><span data-rag-character-count>0 / 500.000</span><div><button class="rag-ghost-button" type="button" data-rag-action="close-editor">Batal</button><button class="primary-button" type="submit" data-rag-save>Simpan memory</button></div></div>
      </form>
    </dialog>
    <dialog class="rag-dialog rag-confirm-dialog" data-rag-dialog="delete" aria-labelledby="rag-delete-heading"><form method="dialog"><span class="rag-danger-icon">!</span><h3 id="rag-delete-heading">Hapus memory dari RAG?</h3><p>Dokumen akan dipindahkan ke folder trash dan langsung dikeluarkan dari retrieval AI.</p><div class="rag-dialog-actions"><span></span><div><button class="rag-ghost-button" value="cancel">Batal</button><button class="rag-danger-button" value="confirm">Pindahkan ke trash</button></div></div></form></dialog>
  </section>`;
}

const WORKSPACE_HEIGHT_KEY = 'bpom.ragWorkspaceHeight';
const WORKSPACE_MIN = 380;
const WORKSPACE_MAX = 2600;

/** Current shell zoom, so pointer deltas can be converted to layout pixels. */
function uiScale() {
  const value = Number(getComputedStyle(document.documentElement).getPropertyValue('--ui-scale'));
  return Number.isFinite(value) && value > 0 ? value : 1;
}

/**
 * Drag the bottom edge to give the graph more room; double-click to hand the
 * height back to the stylesheet.
 */
function bindResizeHandle(root) {
  const workspace = root.querySelector('.rag-workspace');
  const handle = root.querySelector('[data-rag-resize]');
  if (!workspace || !handle) return;

  const apply = (height) => {
    const next = Math.round(Math.min(WORKSPACE_MAX, Math.max(WORKSPACE_MIN, height)));
    // Set the variable the stylesheet reads rather than an inline height: as a
    // grid item the workspace ignored the inline value entirely.
    document.documentElement.style.setProperty('--rag-workspace-height', `${next}px`);
  };

  const stored = Number(window.localStorage.getItem(WORKSPACE_HEIGHT_KEY));
  if (Number.isFinite(stored) && stored >= WORKSPACE_MIN) apply(stored);

  let origin = null;

  handle.addEventListener('pointerdown', (event) => {
    // offsetHeight, not the bounding rect: the rect is post-zoom, and feeding
    // that back into a CSS pixel height compounds the scale on every drag.
    origin = { y: event.clientY, height: workspace.offsetHeight, scale: uiScale() };
    handle.setPointerCapture(event.pointerId);
    handle.classList.add('dragging');
    event.preventDefault();
  });

  handle.addEventListener('pointermove', (event) => {
    if (!origin) return;
    apply(origin.height + (event.clientY - origin.y) / origin.scale);
  });

  const finish = (event) => {
    if (!origin) return;
    origin = null;
    handle.classList.remove('dragging');
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    window.localStorage.setItem(WORKSPACE_HEIGHT_KEY, String(workspace.offsetHeight));
  };
  handle.addEventListener('pointerup', finish);
  handle.addEventListener('pointercancel', finish);

  handle.addEventListener('dblclick', () => {
    document.documentElement.style.removeProperty('--rag-workspace-height');
    window.localStorage.removeItem(WORKSPACE_HEIGHT_KEY);
  });

  handle.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 120 : 40;
    if (event.key === 'ArrowDown') apply(workspace.offsetHeight + step);
    else if (event.key === 'ArrowUp') apply(workspace.offsetHeight - step);
    else return;
    window.localStorage.setItem(WORKSPACE_HEIGHT_KEY, String(workspace.offsetHeight));
    event.preventDefault();
  });
}

export function mountRagManagement(root, notify = () => {}) {
  const controller = new AbortController();
  const state = {
    capabilities: null,
    token: sessionStorage.getItem(TOKEN_STORAGE_KEY) || '',
    query: '',
    sourceType: 'all',
    status: 'all',
    page: 1,
    pageSize: 28,
    pageTotal: 0,
    graph: null,
    workspaceController: null,
    selectedDocument: null,
    editingDocument: null,
    destroyed: false,
  };

  const session = {
    destroy() {
      state.destroyed = true;
      controller.abort();
      state.workspaceController?.abort();
      state.graph?.destroy();
      root.querySelectorAll('dialog[open]').forEach((dialog) => dialog.close());
    },
  };

  const headers = (hasBody = false) => {
    const values = { Accept: 'application/json' };
    if (hasBody) values['Content-Type'] = 'application/json';
    if (state.token) values['X-RAG-Admin-Token'] = state.token;
    return values;
  };

  const request = async (path, options = {}) => {
    const response = await fetch(path, {
      ...options,
      headers: { ...headers(Boolean(options.body)), ...(options.headers || {}) },
      signal: controller.signal,
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok) {
      const error = new Error(payload?.detail || 'Permintaan RAG Management gagal.');
      error.status = response.status;
      throw error;
    }
    return payload;
  };

  const showAccess = (error = '') => {
    state.workspaceController?.abort();
    state.workspaceController = null;
    state.graph?.destroy();
    state.graph = null;
    root.innerHTML = accessMarkup(state.capabilities, error);
    root.querySelector('#rag-unlock-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = root.querySelector('#rag-token-input');
      state.token = input.value.trim();
      sessionStorage.setItem(TOKEN_STORAGE_KEY, state.token);
      root.innerHTML = loadingMarkup('Memverifikasi token…');
      try {
        await renderWorkspace();
      } catch (requestError) {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        state.token = '';
        showAccess(requestError.message);
      }
    }, { signal: controller.signal });
  };

  const graphParams = () => {
    // Chunks, not documents: 263 regulations hold 51k chunks, so a document
    // graph drew 263 dots for the entire knowledge base.
    const params = new URLSearchParams({ limit: String(GRAPH_LIMIT), unit: 'chunk' });
    if (state.query) params.set('q', state.query);
    if (state.sourceType !== 'all') params.set('source_type', state.sourceType);
    if (state.status !== 'all') params.set('status', state.status);
    return params;
  };

  const listParams = () => {
    const params = new URLSearchParams({
      page: String(state.page),
      page_size: String(state.pageSize),
    });
    if (state.query) params.set('q', state.query);
    if (state.sourceType !== 'all') params.set('source_type', state.sourceType);
    if (state.status !== 'all') params.set('status', state.status);
    return params;
  };

  const graphState = (message = '', tone = '') => {
    const element = root.querySelector('.rag-graph-state');
    if (!element) return;
    element.className = `rag-graph-state ${tone}`.trim();
    element.innerHTML = message;
    element.hidden = !message;
  };

  const renderStats = (stats) => {
    root.querySelector('[data-rag-stat="documents"]').textContent = formatNumber(stats.total_documents);
    root.querySelector('[data-rag-stat="chunks"]').textContent = formatNumber(stats.total_chunks);
    root.querySelector('[data-rag-stat="editable"]').textContent = formatNumber(stats.editable_documents);
    root.querySelector('[data-rag-stat="warnings"]').textContent = formatNumber(stats.warning_documents + (stats.statuses.review || 0));
    const sourceSelect = root.querySelector('[data-rag-field="source"]');
    const current = sourceSelect.value || state.sourceType;
    sourceSelect.innerHTML = '<option value="all">Semua sumber</option>' + Object.entries(stats.source_types)
      .map(([value, count]) => `<option value="${escapeHtml(value)}">${escapeHtml(sourceLabel(value))} (${formatNumber(count)})</option>`)
      .join('');
    sourceSelect.value = [...sourceSelect.options].some((option) => option.value === current) ? current : 'all';
  };

  const renderDocuments = (page) => {
    state.pageTotal = page.total;
    const list = root.querySelector('.rag-document-list');
    if (!page.items.length) {
      list.innerHTML = '<div class="rag-list-empty"><span>⌕</span><strong>Tidak ada dokumen</strong><p>Coba ubah pencarian atau filter.</p></div>';
    } else {
      list.innerHTML = page.items.map((document) => `<button class="rag-document-item ${state.selectedDocument?.id === document.id ? 'selected' : ''}" type="button" data-document-id="${document.id}"><span class="rag-document-dot" style="--node-color:${SOURCE_COLORS[document.source_type] || '#8d9aa4'}"></span><span><strong>${escapeHtml(document.title)}</strong><small>${escapeHtml(sourceLabel(document.source_type))} · ${formatNumber(document.chunk_count)} chunks</small></span><em class="rag-status ${escapeHtml(document.status)}">${escapeHtml(statusLabel(document.status))}</em>${document.editable ? '<i title="Editable">✎</i>' : '<i class="locked" title="Read-only">⌁</i>'}</button>`).join('');
    }
    const maxPage = Math.max(1, Math.ceil(page.total / state.pageSize));
    root.querySelector('[data-rag-page]').textContent = `Halaman ${state.page} / ${maxPage}`;
    root.querySelector('[data-rag-action="previous-page"]').disabled = state.page <= 1;
    root.querySelector('[data-rag-action="next-page"]').disabled = state.page >= maxPage;
  };

  const renderInspector = (document) => {
    const inspector = root.querySelector('.rag-inspector');
    const externalUrl = safeExternalUrl(document.source_url);
    const bodyPreview = document.content.length > 1600 ? `${document.content.slice(0, 1600)}\n…` : document.content;
    inspector.innerHTML = `<div class="rag-inspector-head"><span class="rag-source-chip" style="--chip:${SOURCE_COLORS[document.source_type] || '#8d9aa4'}">${escapeHtml(sourceLabel(document.source_type))}</span><em class="rag-status ${escapeHtml(document.status)}">${escapeHtml(statusLabel(document.status))}</em></div><h3>${escapeHtml(document.title)}</h3><p class="rag-path">${escapeHtml(document.relative_path)}</p><div class="rag-detail-grid"><div><span>Chunks</span><strong>${formatNumber(document.chunk_count)}</strong></div><div><span>Ukuran</span><strong>${formatBytes(document.size_bytes)}</strong></div><div><span>Diperbarui</span><strong>${escapeHtml(formatDate(document.updated_at))}</strong></div><div><span>Akses</span><strong>${document.editable ? 'Editable' : 'Read-only'}</strong></div></div>${document.tags.length ? `<div class="rag-tags">${document.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>` : ''}<pre class="rag-content-preview">${escapeHtml(bodyPreview || document.preview)}</pre>${document.editable ? '<p class="rag-managed-note">Memory operator. Perubahan akan langsung membangun ulang retrieval index.</p>' : '<p class="rag-readonly-note">Sumber resmi bersifat read-only agar hasil sinkronisasi tetap utuh.</p>'}<div class="rag-inspector-actions">${externalUrl ? `<a href="${escapeHtml(externalUrl)}" target="_blank" rel="noopener noreferrer">Buka sumber ↗</a>` : ''}${document.editable ? '<button type="button" data-rag-action="edit">Edit</button><button class="danger" type="button" data-rag-action="delete">Hapus</button>' : ''}</div>`;
  };

  const selectDocument = async (documentId) => {
    root.querySelector('.rag-inspector').innerHTML = loadingMarkup('Membuka dokumen…');
    try {
      const document = await request(`/api/knowledge/documents/${encodeURIComponent(documentId)}`);
      if (state.destroyed) return;
      state.selectedDocument = document;
      state.graph?.selectDocument(documentId);
      renderInspector(document);
      root.querySelectorAll('.rag-document-item').forEach((item) => item.classList.toggle('selected', item.dataset.documentId === documentId));
    } catch (error) {
      if (error.name === 'AbortError') return;
      root.querySelector('.rag-inspector').innerHTML = `<div class="rag-list-empty"><strong>Dokumen gagal dibuka</strong><p>${escapeHtml(error.message)}</p></div>`;
    }
  };

  const loadDocuments = async () => {
    const list = root.querySelector('.rag-document-list');
    list.innerHTML = loadingMarkup('Memuat dokumen…');
    const page = await request(`/api/knowledge/documents?${listParams()}`);
    if (!state.destroyed) {
      renderStats(page.stats);
      renderDocuments(page);
    }
    return page;
  };

  const loadGraph = async () => {
    graphState(loadingMarkup('Menyusun graph knowledge…'));
    const payload = await request(`/api/knowledge/graph?${graphParams()}`);
    if (state.destroyed) return payload;
    state.graph.setData(payload);
    // Reflect the stored auto-spin choice on the toolbar button.
    root.querySelectorAll('[data-rag-spin]').forEach((button) => {
      button.classList.toggle('off', !state.graph.autoRotate);
      button.setAttribute('aria-pressed', String(state.graph.autoRotate));
    });
    const shown = formatNumber(payload.displayed_documents);
    const total = formatNumber(payload.total_chunks || payload.displayed_documents);
    const suffix = payload.truncated ? ` · menampilkan ${shown} dari ${total}` : '';
    root.querySelector('[data-rag-graph-summary]').textContent = `${formatNumber(payload.total_documents)} dokumen · ${total} chunk${suffix}`;
    if (!payload.displayed_documents) {
      graphState('<div class="rag-list-empty"><span>⌕</span><strong>Graph kosong</strong><p>Tidak ada memory yang cocok dengan filter ini.</p></div>', 'empty');
    } else {
      graphState('');
    }
    return payload;
  };

  const reloadData = async () => {
    try {
      await Promise.all([loadGraph(), loadDocuments()]);
    } catch (error) {
      if (error.name === 'AbortError') return;
      if (error.status === 401 && state.capabilities.requires_token) {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        state.token = '';
        showAccess(error.message);
        return;
      }
      graphState(`<div class="rag-list-empty"><strong>Data RAG gagal dimuat</strong><p>${escapeHtml(error.message)}</p><button type="button" data-rag-action="refresh">Coba lagi</button></div>`, 'error');
      notify(error.message);
    }
  };

  const openEditor = (document = null) => {
    state.editingDocument = document;
    const dialog = root.querySelector('[data-rag-dialog="editor"]');
    const form = root.querySelector('#rag-editor-form');
    form.reset();
    form.elements.title.value = document?.title || '';
    form.elements.source_type.value = document?.source_type || 'operator_note';
    form.elements.status.value = document?.status === 'review' ? 'review' : 'active';
    form.elements.source_url.value = document?.source_url || '';
    form.elements.tags.value = document?.tags?.join(', ') || '';
    form.elements.content.value = document?.content || '';
    root.querySelector('[data-rag-editor-title]').textContent = document ? 'Edit memory RAG' : 'Tambah memory RAG';
    root.querySelector('[data-rag-save]').textContent = document ? 'Simpan perubahan' : 'Simpan memory';
    root.querySelector('[data-rag-form-error]').hidden = true;
    root.querySelector('[data-rag-character-count]').textContent = `${formatNumber(form.elements.content.value.length)} / 500.000`;
    dialog.showModal();
    form.elements.title.focus();
  };

  const saveDocument = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const saveButton = root.querySelector('[data-rag-save]');
    const errorElement = root.querySelector('[data-rag-form-error]');
    const payload = {
      title: form.elements.title.value.trim(),
      source_type: form.elements.source_type.value,
      status: form.elements.status.value,
      source_url: form.elements.source_url.value.trim() || null,
      tags: form.elements.tags.value.split(',').map((tag) => tag.trim()).filter(Boolean),
      content: form.elements.content.value,
    };
    saveButton.disabled = true;
    saveButton.textContent = 'Menyimpan…';
    errorElement.hidden = true;
    try {
      const editingId = state.editingDocument?.id;
      const result = await request(
        editingId ? `/api/knowledge/documents/${encodeURIComponent(editingId)}` : '/api/knowledge/documents',
        { method: editingId ? 'PUT' : 'POST', body: JSON.stringify(payload) },
      );
      root.querySelector('[data-rag-dialog="editor"]').close();
      state.page = 1;
      state.selectedDocument = result.document;
      notify(result.message);
      await reloadData();
      if (result.document) await selectDocument(result.document.id);
    } catch (error) {
      if (error.name === 'AbortError') return;
      errorElement.textContent = error.message;
      errorElement.hidden = false;
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = state.editingDocument ? 'Simpan perubahan' : 'Simpan memory';
    }
  };

  const deleteDocument = async () => {
    if (!state.selectedDocument?.editable) return;
    const dialog = root.querySelector('[data-rag-dialog="delete"]');
    dialog.showModal();
    const result = await new Promise((resolve) => {
      dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true });
    });
    if (result !== 'confirm' || state.destroyed) return;
    try {
      const response = await request(`/api/knowledge/documents/${encodeURIComponent(state.selectedDocument.id)}`, { method: 'DELETE' });
      notify(response.message);
      state.selectedDocument = null;
      root.querySelector('.rag-inspector').innerHTML = '<div class="rag-inspector-empty"><span>✦</span><strong>Memory dihapus</strong><p>Pilih node lain atau tambahkan memory baru.</p></div>';
      await reloadData();
    } catch (error) {
      if (error.name !== 'AbortError') notify(error.message);
    }
  };

  const importFile = async (file) => {
    if (!file) return;
    if (!/\.(md|txt)$/i.test(file.name) || file.size > 500_000) {
      notify('Pilih file .md/.txt berukuran maksimal 500 KB.');
      return;
    }
    const form = root.querySelector('#rag-editor-form');
    form.elements.content.value = await file.text();
    if (!form.elements.title.value) form.elements.title.value = file.name.replace(/\.(md|txt)$/i, '').replaceAll('-', ' ');
    root.querySelector('[data-rag-character-count]').textContent = `${formatNumber(form.elements.content.value.length)} / 500.000`;
  };

  const bindWorkspace = () => {
    state.workspaceController?.abort();
    state.workspaceController = new AbortController();
    const signal = state.workspaceController.signal;
    const canvas = root.querySelector('.rag-canvas');
    state.graph = new RagGraph(canvas, selectDocument);
    root.querySelector('#rag-editor-form').addEventListener('submit', saveDocument, { signal });
    root.querySelector('#rag-editor-form textarea').addEventListener('input', (event) => {
      root.querySelector('[data-rag-character-count]').textContent = `${formatNumber(event.target.value.length)} / 500.000`;
    }, { signal });
    root.querySelector('[data-rag-file]').addEventListener('change', (event) => importFile(event.target.files[0]), { signal });

    const updateSearch = debounce((value) => {
      state.query = value.trim();
      state.page = 1;
      root.querySelectorAll('[data-rag-field="query"], [data-rag-field="side-query"]').forEach((input) => { input.value = value; });
      reloadData();
    });
    root.querySelectorAll('[data-rag-field="query"], [data-rag-field="side-query"]').forEach((input) => {
      input.addEventListener('input', (event) => updateSearch(event.target.value), { signal });
    });
    root.querySelector('[data-rag-field="source"]').addEventListener('change', (event) => {
      state.sourceType = event.target.value;
      state.page = 1;
      reloadData();
    }, { signal });
    root.querySelector('[data-rag-field="status"]').addEventListener('change', (event) => {
      state.status = event.target.value;
      state.page = 1;
      reloadData();
    }, { signal });

    root.addEventListener('click', (event) => {
      const documentItem = event.target.closest('[data-document-id]');
      if (documentItem) {
        selectDocument(documentItem.dataset.documentId);
        return;
      }
      const action = event.target.closest('[data-rag-action]')?.dataset.ragAction;
      if (!action) return;
      if (action === 'add') openEditor();
      if (action === 'edit' && state.selectedDocument?.editable) openEditor(state.selectedDocument);
      if (action === 'delete') deleteDocument();
      if (action === 'refresh') reloadData();
      if (action === 'zoom-in') state.graph.zoom(1.2);
      if (action === 'zoom-out') state.graph.zoom(0.84);
      if (action === 'fit') state.graph.fit();
      if (action === 'toggle-spin') {
        const on = state.graph.setAutoRotate(!state.graph.autoRotate);
        root.querySelectorAll('[data-rag-spin]').forEach((button) => button.classList.toggle('off', !on));
        notify(on ? 'Rotasi otomatis aktif.' : 'Rotasi otomatis dimatikan.');
      }
      if (action === 'close-editor') root.querySelector('[data-rag-dialog="editor"]').close();
      if (action === 'import-file') root.querySelector('[data-rag-file]').click();
      if (action === 'previous-page' && state.page > 1) { state.page -= 1; loadDocuments(); }
      if (action === 'next-page' && state.page * state.pageSize < state.pageTotal) { state.page += 1; loadDocuments(); }
      if (action === 'lock') {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        state.token = '';
        showAccess();
      }
    }, { signal });
  };

  const renderWorkspace = async () => {
    state.workspaceController?.abort();
    state.graph?.destroy();
    state.graph = null;
    root.innerHTML = shellMarkup(state.capabilities);
    bindWorkspace();
    bindResizeHandle(root);
    await reloadData();
  };

  const initialize = async () => {
    try {
      state.capabilities = await request('/api/knowledge/capabilities');
      if (state.destroyed) return;
      if (state.capabilities.access_mode === 'disabled') {
        showAccess();
        return;
      }
      if (state.capabilities.requires_token && !state.token) {
        showAccess();
        return;
      }
      await renderWorkspace();
    } catch (error) {
      if (error.name === 'AbortError') return;
      root.innerHTML = `<section class="rag-access-card"><span class="rag-access-icon">!</span><h2>RAG Management tidak tersedia</h2><p>${escapeHtml(error.message)}</p><button class="outline-button" type="button" data-rag-retry>Coba lagi</button></section>`;
      root.querySelector('[data-rag-retry]')?.addEventListener('click', () => initialize(), { signal: controller.signal });
    }
  };

  initialize();
  return session;
}
