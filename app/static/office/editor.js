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

const STORAGE_KEY = 'coretax.office.layout.v1';

const PAINTS = [
  { id: 'floor', tile: TILE.FLOOR, label: 'Lantai' },
  { id: 'carpet-ai', tile: TILE.CARPET_AI, label: 'Karpet AI' },
  { id: 'carpet-staff', tile: TILE.CARPET_STAFF, label: 'Karpet petugas' },
  { id: 'wall', tile: TILE.WALL, label: 'Dinding' },
];

const CATEGORY_LABEL = {
  desks: 'Meja',
  chairs: 'Kursi & sofa',
  electronics: 'Elektronik',
  decor: 'Dekorasi',
  wall: 'Hiasan dinding',
  misc: 'Lainnya',
};

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
 * @param {object} options.catalog         Sprite catalog
 * @param {() => object} options.getLayout Current layout
 * @param {(layout: object) => void} options.onChange Called after every mutation
 * @param {(layout: object) => void} options.onReplace Called when the whole layout is swapped
 */
export function createEditor({ bar, catalog, getLayout, onChange, onReplace }) {
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

  const groupsByCategory = new Map();
  for (const [id, group] of Object.entries(catalog.groups)) {
    const category = group.category ?? 'misc';
    if (!groupsByCategory.has(category)) groupsByCategory.set(category, []);
    groupsByCategory.get(category).push({ id, group });
  }

  function furnitureOptions() {
    return [...groupsByCategory.entries()]
      .map(([category, entries]) => {
        const options = entries
          .map(({ group }) => `<option value="${group.default}">${group.name}</option>`)
          .join('');
        return `<optgroup label="${CATEGORY_LABEL[category] ?? category}">${options}</optgroup>`;
      })
      .join('');
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
      <div class="editor-row" data-when="place">
        <span class="editor-label">Perabot</span>
        <select data-role="furniture">${furnitureOptions()}</select>
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

    bar.querySelector('[data-role="furniture"]').value = state.furnitureType;
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
    const select = event.target.closest('select');
    if (select) return;
    if (!button) return;

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

  bar.addEventListener('change', (event) => {
    if (event.target.dataset.role === 'furniture') {
      state.furnitureType = event.target.value;
      state.tool = 'place';
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
      context.strokeStyle = state.grabbed ? '#ffb248' : '#52d7e8';
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
