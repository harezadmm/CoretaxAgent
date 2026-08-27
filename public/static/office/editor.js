/**
 * Layout editor: paint tiles, place and move furniture, persist to localStorage.
 *
 * Editing mutates the same layout object the simulation is walking around, so
 * every change has to be followed by a blocked-grid rebuild — otherwise
 * characters path straight through a desk that was just dropped in front of
 * them. `onChange` is the single place that happens.
 *
 * Moving a desk carries its seat and monitor along. Leaving them behind is
 * technically valid but produces an office where an agent types at empty air,
 * which reads as a bug even though nothing is broken.
 */

import {
  TILE,
  TILE_SIZE,
  buildAssetIndex,
  createDefaultLayout,
  deserializeLayout,
  isInside,
  serializeLayout,
  setTile,
  validateLayout,
} from './tilemap.js';

const STORAGE_KEY = 'bpom.office.layout.v1';

const PAINTS = [
  { id: 'floor', tile: TILE.FLOOR, label: 'Lantai' },
  { id: 'carpet-ai', tile: TILE.CARPET_AI, label: 'Karpet AI' },
  { id: 'carpet-staff', tile: TILE.CARPET_STAFF, label: 'Karpet petugas' },
  { id: 'wall', tile: TILE.WALL, label: 'Dinding' },
];

/** Palette order, most-used first — the catalogue's own order is alphabetical by id. */
const CATEGORY_LABEL = {
  desks: 'Meja',
  chairs: 'Kursi & sofa',
  electronics: 'Elektronik',
  decor: 'Dekorasi',
  wall: 'Hiasan dinding',
  misc: 'Lainnya',
};
const CATEGORY_ORDER = Object.keys(CATEGORY_LABEL);

export function loadStoredLayout() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return deserializeLayout(JSON.parse(raw));
  } catch {
    // A malformed entry is not worth surfacing — fall back to the default office.
    return null;
  }
}

function storeLayout(layout) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeLayout(layout)));
    return true;
  } catch {
    return false;
  }
}

export function clearStoredLayout() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing useful to do if storage is unavailable */
  }
}

/**
 * @param {object} options
 * @param {HTMLElement} options.bar        Container for the editor toolbar
 * @param {object} options.assets          Loaded sprite sets, for palette thumbnails
 * @param {() => object} options.getLayout Current layout
 * @param {(layout: object) => void} options.onChange Called after every mutation
 * @param {(layout: object) => void} options.onReplace Called when the whole layout is swapped
 */
export function createEditor({ bar, assets, getLayout, onChange, onReplace }) {
  const { catalog } = assets;
  const assetIndex = buildAssetIndex(catalog);
  const state = {
    active: false,
    tool: 'move',
    paint: PAINTS[0],
    furnitureType: 'DESK_FRONT',
    grabbed: null,
    hover: null,
    problems: [],
  };

  const groupsByCategory = new Map(CATEGORY_ORDER.map((category) => [category, []]));
  for (const [id, group] of Object.entries(catalog.groups)) {
    const category = groupsByCategory.has(group.category) ? group.category : 'misc';
    groupsByCategory.get(category).push({ id, group });
  }
  for (const [category, entries] of groupsByCategory) {
    if (entries.length === 0) groupsByCategory.delete(category);
  }

  const THUMB = 40;

  /**
   * Draw a furniture sprite into a fixed-size swatch.
   *
   * The catalogue spans 16x16 stools to 48x64 tables, so each is scaled by the
   * largest whole factor that fits and then centred — a fractional scale would
   * blur the very pixel art the palette exists to show.
   */
  function thumbnail(assetId) {
    const sprite = assets.furniture.get(assetId);
    const canvas = document.createElement('canvas');
    canvas.width = THUMB;
    canvas.height = THUMB;
    if (!sprite) return canvas;

    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    const scale = Math.max(1, Math.floor(Math.min(THUMB / sprite.w, THUMB / sprite.h)));
    context.drawImage(
      sprite.image,
      Math.round((THUMB - sprite.w * scale) / 2),
      Math.round((THUMB - sprite.h * scale) / 2),
      sprite.w * scale,
      sprite.h * scale,
    );
    return canvas;
  }

  /** Build the palette as real elements — the thumbnails are canvases, not markup. */
  function buildPalette(host) {
    host.replaceChildren();
    for (const [category, entries] of groupsByCategory) {
      const group = document.createElement('div');
      group.className = 'palette-group';

      const heading = document.createElement('span');
      heading.className = 'palette-heading';
      heading.textContent = CATEGORY_LABEL[category] ?? category;
      group.append(heading);

      const items = document.createElement('div');
      items.className = 'palette-items';
      for (const entry of entries) {
        const id = entry.group.default;
        if (!id) continue;
        const button = document.createElement('button');
        button.className = `palette-item${id === state.furnitureType ? ' active' : ''}`;
        button.dataset.furniture = id;
        button.title = entry.group.name;
        button.setAttribute('aria-label', entry.group.name);
        button.append(thumbnail(id));
        items.append(button);
      }
      group.append(items);
      host.append(group);
    }
  }

  function renderBar() {
    const tool = (id, label) =>
      `<button data-tool="${id}" class="${state.tool === id ? 'active' : ''}">${label}</button>`;
    const paint = (entry) =>
      `<button data-paint="${entry.id}" class="${state.paint.id === entry.id ? 'active' : ''}">${entry.label}</button>`;

    bar.innerHTML = `
      <div class="editor-row">
        <span class="editor-label">Alat</span>
        <span class="tool-group">
          ${tool('move', '✥ Pindah')}
          ${tool('place', '＋ Tambah')}
          ${tool('erase', '⌫ Hapus')}
          ${tool('paint', '▦ Lantai')}
        </span>
      </div>
      <div class="editor-row editor-palette-row" data-when="place">
        <span class="editor-label">Perabot</span>
        <div class="editor-palette" data-role="palette"></div>
      </div>
      <div class="editor-row" data-when="paint">
        <span class="editor-label">Permukaan</span>
        <span class="tool-group">${PAINTS.map(paint).join('')}</span>
      </div>
      <div class="editor-row editor-actions">
        <button class="outline-button" data-action="reset">↺ Kembalikan denah awal</button>
        <span class="editor-status ${state.problems.length ? 'warn' : 'ok'}">${
          state.problems.length ? `⚠ ${state.problems[0]}` : '✓ Denah valid · tersimpan otomatis'
        }</span>
      </div>`;

    buildPalette(bar.querySelector('[data-role="palette"]'));
    for (const row of bar.querySelectorAll('[data-when]')) {
      row.hidden = row.dataset.when !== state.tool;
    }
  }

  function commit() {
    const layout = getLayout();
    state.problems = validateLayout(layout, catalog);
    storeLayout(layout);
    onChange(layout);
    renderBar();
  }

  function footprintOf(type) {
    const asset = catalog.assets[type];
    return { fw: asset?.fw ?? 1, fh: asset?.fh ?? 1 };
  }

  /** Topmost furniture overlapping a tile — the last one placed wins, as drawn. */
  function furnitureAt(layout, col, row) {
    for (let i = layout.furniture.length - 1; i >= 0; i -= 1) {
      const item = layout.furniture[i];
      const { fw, fh } = footprintOf(item.type);
      if (col >= item.col && col < item.col + fw && row >= item.row && row < item.row + fh) {
        return item;
      }
    }
    return null;
  }

  /** The seat a desk belongs to, by the geometry `createDefaultLayout` builds. */
  function seatForDesk(layout, item) {
    if (!assetIndex.get(item.type) || assetIndex.get(item.type).id !== 'DESK') return null;
    return layout.seats.find((seat) => seat.col === item.col + 1 && seat.row === item.row + 2) ?? null;
  }

  function moveItem(layout, item, col, row) {
    const seat = seatForDesk(layout, item);
    const deltaCol = col - item.col;
    const deltaRow = row - item.row;
    item.col = col;
    item.row = row;
    if (seat) {
      seat.col += deltaCol;
      seat.row += deltaRow;
      if (seat.monitor) {
        seat.monitor.col += deltaCol;
        seat.monitor.row += deltaRow;
      }
    }
  }

  function handleClick(tile) {
    const layout = getLayout();
    if (!isInside(layout, tile.col, tile.row)) return;

    switch (state.tool) {
      case 'move': {
        if (state.grabbed) {
          moveItem(layout, state.grabbed, tile.col, tile.row);
          state.grabbed = null;
          commit();
        } else {
          state.grabbed = furnitureAt(layout, tile.col, tile.row);
        }
        break;
      }

      case 'place': {
        layout.furniture.push({
          uid: `f-user-${layout.furniture.length}-${tile.col}-${tile.row}`,
          type: state.furnitureType,
          col: tile.col,
          row: tile.row,
        });
        commit();
        break;
      }

      case 'erase': {
        const item = furnitureAt(layout, tile.col, tile.row);
        if (item) {
          layout.furniture = layout.furniture.filter((entry) => entry !== item);
          commit();
        }
        break;
      }

      case 'paint': {
        setTile(layout, tile.col, tile.row, state.paint.tile);
        commit();
        break;
      }

      default:
        break;
    }
  }

  function handleDrag(tile) {
    if (state.tool !== 'paint') return;
    const layout = getLayout();
    if (!isInside(layout, tile.col, tile.row)) return;
    if (layout.tiles[tile.row * layout.cols + tile.col] === state.paint.tile) return;
    setTile(layout, tile.col, tile.row, state.paint.tile);
    commit();
  }

  bar.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;

    if (button.dataset.furniture) {
      state.furnitureType = button.dataset.furniture;
      for (const item of bar.querySelectorAll('.palette-item')) {
        item.classList.toggle('active', item === button);
      }
      return;
    }

    if (button.dataset.tool) {
      state.tool = button.dataset.tool;
      state.grabbed = null;
      renderBar();
      return;
    }
    if (button.dataset.paint) {
      state.paint = PAINTS.find((entry) => entry.id === button.dataset.paint) ?? PAINTS[0];
      renderBar();
      return;
    }
    if (button.dataset.action === 'reset') {
      clearStoredLayout();
      const fresh = createDefaultLayout();
      onReplace(fresh);
      state.grabbed = null;
      state.problems = validateLayout(fresh, catalog);
      renderBar();
    }
  });

  /** Grid, hover box and the sprite being carried, painted on top of the office. */
  function overlay({ context, origin, scale, layout }) {
    if (!state.active) return;

    context.strokeStyle = 'rgba(82, 215, 232, 0.14)';
    context.lineWidth = 1;
    context.beginPath();
    for (let col = 0; col <= layout.cols; col += 1) {
      const x = origin.x + col * TILE_SIZE * scale + 0.5;
      context.moveTo(x, origin.y);
      context.lineTo(x, origin.y + layout.rows * TILE_SIZE * scale);
    }
    for (let row = 0; row <= layout.rows; row += 1) {
      const y = origin.y + row * TILE_SIZE * scale + 0.5;
      context.moveTo(origin.x, y);
      context.lineTo(origin.x + layout.cols * TILE_SIZE * scale, y);
    }
    context.stroke();

    if (state.hover) {
      const { fw, fh } =
        state.tool === 'place'
          ? footprintOf(state.furnitureType)
          : state.grabbed
            ? footprintOf(state.grabbed.type)
            : { fw: 1, fh: 1 };
      context.strokeStyle = state.grabbed ? '#ffb248' : '#529de8';
      context.lineWidth = Math.max(1, Math.round(scale / 2));
      context.strokeRect(
        origin.x + state.hover.col * TILE_SIZE * scale,
        origin.y + state.hover.row * TILE_SIZE * scale,
        fw * TILE_SIZE * scale,
        fh * TILE_SIZE * scale,
      );
    }
  }

  return {
    overlay,
    get active() {
      return state.active;
    },
    get tool() {
      return state.tool;
    },
    setActive(active) {
      state.active = active;
      state.grabbed = null;
      bar.hidden = !active;
      if (active) {
        state.problems = validateLayout(getLayout(), catalog);
        renderBar();
      }
    },
    setHover(tile) {
      state.hover = tile;
    },
    click: handleClick,
    drag: handleDrag,
  };
}
