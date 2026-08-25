const TOKEN_STORAGE_KEY = 'coretax.ragAdminToken';
// Every document, not a sample. The renderer batches its draw calls so the full
// corpus stays interactive; see render().
const GRAPH_LIMIT = 20000;

// Past this many nodes the topic mesh is noise rather than information, so it
// only appears for whatever is selected.
const TOPIC_EDGE_BUDGET = 1500;

const SOURCE_LABELS = {
  official_regulation: 'Regulasi DJP',
  official_html: 'Coretaxpedia',
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

// The disc is squashed vertically because the canvas is far wider than it is
// tall; every placement and every hit test goes through this same factor.
const FLATTEN = 0.75;
const PULSE_PERIOD = 5200;

function withAlpha(hex, alpha) {
  const int = parseInt(hex.slice(1), 16);
  return `rgba(${(int >> 16) & 255},${(int >> 8) & 255},${int & 255},${alpha})`;
}

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
    this.maxOrbit = 0;
    this.reducedMotion = false;
    this.onScreen = true;
    this.geometryVersion = 0;
    this.edgeCacheKey = null;
    this.edgeLanes = [];
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
  }

  setData(payload) {
    this.nodes = payload.nodes.map((node) => ({
      ...node,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      clusterX: 0,
      clusterY: 0,
      orbit: 0,
      pinned: false,
    }));
    this.edges = payload.edges;
    this.nodeMap = new Map(this.nodes.map((node) => [node.id, node]));
    this.layoutOrganicClusters();
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.animationStart = performance.now();
    this.pulse = 0;
    // Fresh data relaxes from scratch; resuming after a hidden tab or a drag
    // must not reset the cooling, so only setData seeds this.
    this.alpha = 1;
    this.geometryVersion += 1;
    this.edgeCacheKey = null;
    if (this.reducedMotion) this.settle();
    this.fit();
    this.start();
  }

  /** Relax the whole graph at once, for readers who opted out of motion. */
  settle() {
    for (let step = 0; step < 220; step += 1) this.tick(1 - step / 260);
    this.updateExtent();
    this.geometryVersion += 1;
  }

  start() {
    if (this.frame) cancelAnimationFrame(this.frame);
    if (this.reducedMotion) {
      this.render();
      this.frame = null;
      return;
    }

    const step = (now) => {
      // Cooling relaxation: the graph visibly finds its own shape, then holds
      // still so the edge cache can stop rebuilding.
      if (this.alpha > 0.02) {
        this.tick(this.alpha);
        this.alpha *= 0.988;
        this.updateExtent();
        this.geometryVersion += 1;
      }
      this.pulse = ((now - this.animationStart) % PULSE_PERIOD) / PULSE_PERIOD;
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
    if (!this.frame && !this.reducedMotion && this.nodes.length && this.awake()) {
      this.animationStart = performance.now();
      this.start();
    }
  }

  /**
   * Seed organic clusters, one per source type.
   *
   * An earlier version packed documents into strict concentric arcs. It was
   * tidy but mechanical, and it read as a fan rather than a memory graph, so
   * placement is now a rough disc per cluster that the simulation relaxes into
   * its own shape.
   */
  layoutOrganicClusters() {
    const SPACING = 14;

    const byType = new Map();
    for (const node of this.nodes) {
      if (node.kind !== 'document') continue;
      const key = node.source_type || 'unknown';
      if (!byType.has(key)) byType.set(key, []);
      byType.get(key).push(node);
    }

    // A disc holding n dots at SPACING apart has radius ~sqrt(n/pi)*SPACING.
    const clusters = [...byType.entries()]
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
      .map(([type, docs]) => ({ type, docs, radius: Math.sqrt(docs.length / Math.PI) * SPACING + 40 }));

    // Largest cluster takes the middle; the rest ring it just far enough out to
    // clear both radii, which keeps the groups legible without a rigid grid.
    const placed = [];
    clusters.forEach((cluster, index) => {
      if (index === 0) {
        cluster.cx = 0;
        cluster.cy = 0;
      } else {
        const golden = index * 2.399963;
        // The vertical squash below shortens the real gap, so pad for it here.
        const distance = (clusters[0].radius + cluster.radius + 130) * 1.22;
        cluster.cx = Math.cos(golden) * distance;
        cluster.cy = Math.sin(golden) * distance * 0.82;
      }
      placed.push(cluster);
    });

    const sourceByType = new Map(
      this.nodes.filter((node) => node.kind === 'source').map((node) => [node.source_type, node]),
    );

    for (const cluster of placed) {
      const source = sourceByType.get(cluster.type);
      if (source) {
        source.x = cluster.cx;
        source.y = cluster.cy;
        source.clusterX = cluster.cx;
        source.clusterY = cluster.cy;
      }
      // Break the cluster into lobes. A sunflower disc is even by construction,
      // which is precisely what made the previous layout look machine-made: no
      // amount of jitter rescues a shape whose outline is a perfect circle.
      const lobeCount = Math.max(1, Math.min(7, Math.round(Math.sqrt(cluster.docs.length) / 9)));
      const lobes = [];
      for (let index = 0; index < lobeCount; index += 1) {
        const hash = hashNumber(`${cluster.type}:lobe:${index}`);
        const angle = ((hash % 3600) / 3600) * Math.PI * 2;
        const reach = (0.12 + ((hash >>> 12) % 100) / 150) * cluster.radius;
        lobes.push({
          x: cluster.cx + Math.cos(angle) * reach,
          y: cluster.cy + Math.sin(angle) * reach * 0.9,
          weight: 0.55 + ((hash >>> 5) % 100) / 110,
        });
      }
      const totalWeight = lobes.reduce((sum, lobe) => sum + lobe.weight, 0);
      for (const lobe of lobes) {
        lobe.radius = Math.sqrt(lobe.weight / totalWeight) * cluster.radius * 1.05;
      }

      cluster.docs.forEach((node) => {
        const hash = hashNumber(node.id);
        const lobe = lobes[hash % lobes.length];
        const spread = ((hash >>> 3) % 1000) / 1000;
        const angle = (((hash >>> 11) % 3600) / 3600) * Math.PI * 2;
        // Two harmonics on the reach give the lobe a ragged edge instead of a
        // rim; the union of several such lobes is what reads as organic.
        const wobble = 1 + 0.26 * Math.sin(angle * 3 + lobe.x * 0.01) + 0.16 * Math.sin(angle * 5 + lobe.y * 0.01);
        const radius = Math.sqrt(spread) * lobe.radius * wobble;
        node.x = lobe.x + Math.cos(angle) * radius;
        node.y = lobe.y + Math.sin(angle) * radius * 0.9;
        // Gravity aims at the lobe, not the cluster centre, so relaxation keeps
        // the lumpy outline instead of rounding it back into a disc.
        node.clusterX = lobe.x;
        node.clusterY = lobe.y;
      });
    }

    this.seedTopics();
    this.updateExtent();
  }

  /** Drop each topic onto the centre of mass of the documents it links. */
  seedTopics() {
    const means = new Map();
    for (const edge of this.edges) {
      if (edge.kind !== 'topic') continue;
      const a = this.nodeMap.get(edge.source);
      const b = this.nodeMap.get(edge.target);
      if (!a || !b) continue;
      const topic = a.kind === 'topic' ? a : b;
      const other = topic === a ? b : a;
      if (topic.kind !== 'topic' || other.kind !== 'document') continue;
      if (!means.has(topic.id)) means.set(topic.id, { x: 0, y: 0, n: 0 });
      const mean = means.get(topic.id);
      mean.x += other.x;
      mean.y += other.y;
      mean.n += 1;
    }
    for (const node of this.nodes) {
      if (node.kind !== 'topic') continue;
      const mean = means.get(node.id);
      const hash = hashNumber(node.id);
      if (mean && mean.n) {
        node.x = mean.x / mean.n + ((hash % 80) - 40);
        node.y = mean.y / mean.n + (((hash >>> 8) % 80) - 40);
      } else {
        node.x = ((hash % 600) - 300);
        node.y = (((hash >>> 8) % 600) - 300);
      }
      node.clusterX = node.x;
      node.clusterY = node.y;
    }
  }

  updateExtent() {
    let maxOrbit = 1;
    for (const node of this.nodes) {
      node.orbit = Math.hypot(node.x, node.y);
      if (node.orbit > maxOrbit) maxOrbit = node.orbit;
    }
    this.maxOrbit = maxOrbit;
  }

  /**
   * One relaxation tick: springs along the contains-edges, short-range
   * repulsion so dots never pile up, and a weak pull towards the node's own
   * cluster. Repulsion goes through a spatial hash, so the cost stays linear
   * even with the whole corpus on screen.
   */
  tick(alpha) {
    const CELL = 15;
    const SPAN = 1 << 16;
    const buckets = new Map();
    for (const node of this.nodes) {
      // Numeric keys: building 6.5k template strings per tick, then nine more
      // lookups each, was most of the frame budget.
      const key = (Math.round(node.x / CELL) + SPAN) * (SPAN * 2) + (Math.round(node.y / CELL) + SPAN);
      let bucket = buckets.get(key);
      if (!bucket) { bucket = []; buckets.set(key, bucket); }
      bucket.push(node);
    }

    // Only the root-to-source links behave like springs. Pulling every document
    // to a fixed distance from its source cannot be satisfied by thousands of
    // them at once, and the attempt crushed the cluster into a dense ring.
    for (const edge of this.edges) {
      if (edge.kind === 'topic') continue;
      const a = this.nodeMap.get(edge.source);
      const b = this.nodeMap.get(edge.target);
      if (!a || !b || a.kind !== 'root' || b.kind !== 'source') continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy) || 0.01;
      const force = ((distance - 300) / distance) * 0.02 * alpha;
      b.vx -= dx * force;
      b.vy -= dy * force;
    }

    for (const node of this.nodes) {
      if (node.pinned || node.kind === 'root') continue;
      const cx = Math.round(node.x / CELL);
      const cy = Math.round(node.y / CELL);
      for (let ox = -1; ox <= 1; ox += 1) {
        for (let oy = -1; oy <= 1; oy += 1) {
          const bucket = buckets.get((cx + ox + SPAN) * (SPAN * 2) + (cy + oy + SPAN));
          if (!bucket) continue;
          for (let index = 0; index < bucket.length; index += 1) {
            const other = bucket[index];
            if (other === node) continue;
            const dx = node.x - other.x;
            const dy = node.y - other.y;
            const sq = dx * dx + dy * dy;
            if (sq > CELL * CELL) continue;
            if (sq === 0) {
              // Exactly coincident. Skipping the pair, as this used to, leaves
              // them welded together forever because the push direction is
              // undefined; nudge each along its own hashed bearing instead.
              const bearing = (hashNumber(node.id) % 628) / 100;
              node.vx += Math.cos(bearing) * CELL * 0.3 * alpha;
              node.vy += Math.sin(bearing) * CELL * 0.3 * alpha;
              continue;
            }
            const distance = Math.sqrt(sq);
            const push = ((CELL - distance) / distance) * 0.28 * alpha;
            node.vx += dx * push;
            node.vy += dy * push;
          }
        }
      }
      // Just enough gravity to stop a cluster drifting; the seed already sizes
      // it, so anything stronger only compresses what repulsion spread out.
      node.vx += (node.clusterX - node.x) * 0.0004 * alpha;
      node.vy += (node.clusterY - node.y) * 0.0004 * alpha;
    }

    for (const node of this.nodes) {
      if (node.pinned || node.kind === 'root') { node.vx = 0; node.vy = 0; continue; }
      node.vx *= 0.82;
      node.vy *= 0.82;
      node.x += Math.max(-9, Math.min(9, node.vx));
      node.y += Math.max(-9, Math.min(9, node.vy));
    }
  }

  worldFromPointer(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - this.transform.x) / this.transform.scale,
      y: (event.clientY - rect.top - this.transform.y) / this.transform.scale,
      screenX: event.clientX - rect.left,
      screenY: event.clientY - rect.top,
    };
  }

  nodeRadius(node) {
    if (node.kind === 'root') return 15;
    if (node.kind === 'source') return 9.5;
    if (node.kind === 'topic') return 6.5;
    return Math.max(2.4, 1.6 + Number(node.size || 1) * 0.72);
  }

  hitTest(point) {
    for (let index = this.nodes.length - 1; index >= 0; index -= 1) {
      const node = this.nodes[index];
      const radius = this.nodeRadius(node) + 7 / this.transform.scale;
      if (Math.hypot(point.x - node.x, point.y - node.y) <= radius) return node;
    }
    return null;
  }

  pointerDown(event) {
    const point = this.worldFromPointer(event);
    const node = this.hitTest(point);
    this.pointer = {
      id: event.pointerId,
      mode: node ? 'node' : 'pan',
      node,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
    };
    if (node) node.pinned = true;
    this.canvas.setPointerCapture(event.pointerId);
  }

  pointerMove(event) {
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
    if (Math.hypot(event.clientX - this.pointer.startX, event.clientY - this.pointer.startY) > 4) {
      this.pointer.moved = true;
    }
    if (this.pointer.mode === 'pan') {
      this.transform.x += dx;
      this.transform.y += dy;
    } else if (this.pointer.node) {
      this.pointer.node.x = point.x;
      this.pointer.node.y = point.y;
      this.geometryVersion += 1;
      // Let the neighbours give way instead of staying frozen around the drag.
      this.alpha = Math.max(this.alpha || 0, 0.3);
      if (!this.frame) this.resume();
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
    if (node) {
      // Anchor it where it was dropped so it is not dragged back by its cluster.
      if (moved) {
        node.clusterX = node.x;
        node.clusterY = node.y;
      }
      node.pinned = false;
    }
    this.pointer = null;
    this.canvas.releasePointerCapture(event.pointerId);
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
    const xs = this.nodes.map((node) => node.x);
    const ys = this.nodes.map((node) => node.y);
    const minX = Math.min(...xs) - 55;
    const maxX = Math.max(...xs) + 55;
    const minY = Math.min(...ys) - 55;
    const maxY = Math.max(...ys) + 55;
    const scaleX = this.viewport.width / Math.max(1, maxX - minX);
    const scaleY = this.viewport.height / Math.max(1, maxY - minY);
    this.transform.scale = Math.min(1.35, Math.max(0.3, Math.min(scaleX, scaleY) * 0.92));
    this.transform.x = this.viewport.width / 2 - ((minX + maxX) / 2) * this.transform.scale;
    this.transform.y = this.viewport.height / 2 - ((minY + maxY) / 2) * this.transform.scale;
    this.render();
  }

  selectDocument(documentId) {
    const node = this.nodes.find((entry) => entry.document_id === documentId);
    this.selectedNodeId = node?.id || null;
    if (node && this.viewport) {
      const targetScale = Math.max(this.transform.scale, 1.05);
      this.transform.scale = targetScale;
      this.transform.x = this.viewport.width / 2 - node.x * targetScale;
      this.transform.y = this.viewport.height / 2 - node.y * targetScale;
    }
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

    // Every edge sharing a stroke style is collected into one Path2D and drawn
    // with a single stroke(). At full corpus that turns 15k canvas calls per
    // frame into four, which is the difference between animating and crawling.
    // Edge geometry only moves while nodes move, so rebuild it when the layout
    // or the selection actually changes rather than once per frame.
    const edgeKey = `${this.geometryVersion}|${selected || ''}`;
    if (this.edgeCacheKey !== edgeKey) {
      // Each source fans an edge to every one of its documents, so the ink piles
      // up with the corpus. Left fixed, 6.5k overlapping strokes swamp the dots;
      // hold the total roughly constant instead.
      const ink = Math.min(0.16, Math.max(0.03, (0.16 * 1200) / Math.max(1, this.nodes.length)));
      const laneMap = new Map();
      const laneFor = (style, thick) => {
        const key = `${style}|${thick}`;
        let lane = laneMap.get(key);
        if (!lane) {
          lane = { path: new Path2D(), style, thick };
          laneMap.set(key, lane);
        }
        return lane;
      };
      // The topic mesh is 9k chords at full corpus — noise, not information.
      // Above the budget it is reserved for whatever the reader selected.
      const showEveryTopicEdge = this.nodes.length <= TOPIC_EDGE_BUDGET;

      for (const edge of this.edges) {
        const source = this.nodeMap.get(edge.source);
        const target = this.nodeMap.get(edge.target);
        if (!source || !target) continue;
        const linked = Boolean(selected) && connected.has(source.id) && connected.has(target.id);
        const isTopic = edge.kind === 'topic';
        if (isTopic && !showEveryTopicEdge && !linked) continue;

        const bright = !selected || linked;
        let lane;
        if (isTopic) {
          lane = laneFor(linked ? 'rgba(139,147,184,0.3)' : 'rgba(139,147,184,0.05)', linked);
        } else {
          // Carry the source's own hue. A single cyan for every fan repainted
          // the smaller wedges in the largest category's colour.
          const base = source.kind === 'source'
            ? SOURCE_COLORS[source.source_type] || '#7f8c95'
            : '#53d9e5';
          lane = laneFor(withAlpha(base, bright ? ink : ink * 0.16), bright);
        }
        lane.path.moveTo(source.x, source.y);
        if (isTopic) {
          // Bow topic links towards the centre; straight chords would rake
          // across the document arcs and rebuild the hairball.
          lane.path.quadraticCurveTo((source.x + target.x) * 0.22, (source.y + target.y) * 0.22, target.x, target.y);
        } else {
          lane.path.lineTo(target.x, target.y);
        }
      }

      this.edgeLanes = [...laneMap.values()];
      this.edgeCacheKey = edgeKey;
    }

    // Line width tracks zoom, so it is applied at draw time, not bake time.
    const thin = 0.35 / this.transform.scale ** 0.25;
    const thick = 0.75 / this.transform.scale ** 0.25;
    for (const lane of this.edgeLanes || []) {
      ctx.strokeStyle = lane.style;
      ctx.lineWidth = lane.thick ? thick : thin;
      ctx.stroke(lane.path);
    }

    // A slow ring sweeping outwards from the root, brightening the nodes it
    // crosses — the retrieval pass made visible.
    const pulseOrbit = this.reducedMotion ? -1 : this.pulse * (this.maxOrbit || 0) * 1.05;
    if (pulseOrbit > 0) {
      ctx.beginPath();
      ctx.ellipse(0, 0, pulseOrbit, pulseOrbit * FLATTEN, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(83,217,229,${0.16 * (1 - this.pulse)})`;
      ctx.lineWidth = 1.1 / this.transform.scale ** 0.25;
      ctx.stroke();
    }

    const colorOf = (node) => (node.kind === 'topic'
      ? TOPIC_COLOR
      : node.kind === 'root'
        ? '#ffffff'
        : SOURCE_COLORS[node.source_type] || '#7f8c95');
    const radiusOf = (node) => {
      // Swell briefly as the pulse ring passes over this orbit.
      const wake = pulseOrbit > 0 ? Math.max(0, 1 - Math.abs(node.orbit - pulseOrbit) / 44) : 0;
      return { radius: this.nodeRadius(node) * (1 + wake * 0.3), wake };
    };

    // Plain dots are grouped by fill and opacity so the bulk of the corpus costs
    // one fill() per group. Anything that needs a glow, a ring or a label is
    // rare enough to draw on its own afterwards.
    const groups = new Map();
    const standouts = [];
    for (const node of this.nodes) {
      const isSelected = node.id === selected;
      const isHovered = node.id === this.hoveredNodeId;
      const ringed = node.status === 'warning' || node.status === 'review' || node.editable;
      if (isSelected || isHovered || ringed || node.kind !== 'document') {
        standouts.push(node);
        continue;
      }
      const color = colorOf(node);
      const alpha = selected && !connected.has(node.id) ? 0.18 : node.status === 'repealed' ? 0.42 : 0.92;
      const key = `${color}|${alpha}`;
      let group = groups.get(key);
      if (!group) {
        group = { path: new Path2D(), color, alpha };
        groups.set(key, group);
      }
      const { radius } = radiusOf(node);
      group.path.moveTo(node.x + radius, node.y);
      group.path.arc(node.x, node.y, radius, 0, Math.PI * 2);
    }

    ctx.shadowBlur = 0;
    for (const group of groups.values()) {
      ctx.globalAlpha = group.alpha;
      ctx.fillStyle = group.color;
      ctx.fill(group.path);
    }

    for (const node of standouts) {
      const color = colorOf(node);
      const isSelected = node.id === selected;
      const isHovered = node.id === this.hoveredNodeId;
      const dimmed = selected && !connected.has(node.id);
      const { radius, wake } = radiusOf(node);
      ctx.globalAlpha = dimmed ? 0.18 : node.status === 'repealed' ? 0.42 : 0.92;
      if (isSelected || isHovered || node.kind === 'root' || wake > 0.05) {
        ctx.shadowColor = color;
        ctx.shadowBlur = isSelected ? 18 : isHovered || node.kind === 'root' ? 10 : wake * 9;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      if (node.status === 'warning' || node.status === 'review') {
        ctx.strokeStyle = '#ffb248';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      if (node.editable) {
        ctx.strokeStyle = '#ff78b7';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      const showLabel = node.kind !== 'document' || isSelected || isHovered;
      if (showLabel) {
        const label = node.label.length > 54 ? `${node.label.slice(0, 51)}…` : node.label;
        ctx.font = `${node.kind === 'root' ? 700 : 500} ${node.kind === 'document' ? 8 : 9}px Cascadia Mono, Consolas, monospace`;
        ctx.fillStyle = isSelected || isHovered ? '#ffffff' : '#c2cbd0';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, node.x + radius + 5, node.y);
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
          </div>
          <div class="rag-legend"><span><i class="legend-official"></i>Resmi</span><span><i class="legend-curated"></i>Curated</span><span><i class="legend-managed"></i>Operator</span><span><i class="legend-topic"></i>Topik</span></div>
        </div>
        <footer class="rag-graph-footer"><span data-rag-graph-summary>Menyiapkan data…</span><span>Drag · zoom · klik node untuk detail</span></footer>
      </section>
      <aside class="rag-manager" aria-label="Panel pengelolaan memory">
        <div class="rag-manager-head"><div><p class="panel-kicker">MEMORY LIBRARY</p><h3>Manage knowledge</h3></div><button type="button" data-rag-action="add" aria-label="Tambah memory">＋</button></div>
        <label class="rag-side-search"><span>⌕</span><input type="search" data-rag-field="side-query" placeholder="Cari di library…" aria-label="Cari library knowledge" /></label>
        <div class="rag-document-list" aria-live="polite">${loadingMarkup('Memuat dokumen…')}</div>
        <div class="rag-pagination"><button type="button" data-rag-action="previous-page" aria-label="Halaman sebelumnya">‹</button><span data-rag-page>Halaman 1</span><button type="button" data-rag-action="next-page" aria-label="Halaman berikutnya">›</button></div>
        <section class="rag-inspector" aria-live="polite"><div class="rag-inspector-empty"><span>✦</span><strong>Pilih sebuah node</strong><p>Detail sumber, status, chunk, dan aksi pengelolaan akan tampil di sini.</p></div></section>
      </aside>
    </div>
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
    const params = new URLSearchParams({ limit: String(GRAPH_LIMIT) });
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
    const suffix = payload.truncated ? ` · menampilkan sampel ${formatNumber(payload.displayed_documents)}` : '';
    root.querySelector('[data-rag-graph-summary]').textContent = `${formatNumber(payload.total_documents)} dokumen · ${formatNumber(payload.nodes.length)} nodes${suffix}`;
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
