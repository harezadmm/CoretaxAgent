/**
 * The office floor as data: tile grid, furniture placement, seats, pathfinding.
 *
 * Deliberately free of DOM and canvas access so the layout rules can be tested
 * under `node --test`. Anything that needs an image or an element lives in
 * sprites.js or render.js; this module only ever deals in numbers and plain
 * objects.
 *
 * A layout is the single source of truth for both the renderer and the editor,
 * which is why `createDefaultLayout()` builds the same shape that
 * `deserializeLayout()` accepts back from localStorage.
 */

export const TILE_SIZE = 16;

export const TILE = {
  VOID: 0,
  FLOOR: 1,
  WALL: 2,
  CARPET_AI: 3,
  CARPET_STAFF: 4,
};

const WALKABLE_TILES = new Set([TILE.FLOOR, TILE.CARPET_AI, TILE.CARPET_STAFF]);
const CARPET_TILES = new Set([TILE.CARPET_AI, TILE.CARPET_STAFF]);

export const DIR = { DOWN: 'down', UP: 'up', RIGHT: 'right', LEFT: 'left' };

/**
 * Version history, all of which invalidate a stored layout rather than migrate it:
 *   2 — `seat.monitor.row` became the desk's own row, not the tile above it.
 *   3 — the room grew from 26x16 to 36x17, with more desks in both zones.
 */
export const LAYOUT_VERSION = 4;

/** Tiles a character may stand on, ignoring furniture. */
export function isWalkableTile(tile) {
  return WALKABLE_TILES.has(tile);
}

export function isCarpetTile(tile) {
  return CARPET_TILES.has(tile);
}

export function isInside(layout, col, row) {
  return col >= 0 && row >= 0 && col < layout.cols && row < layout.rows;
}

export function tileAt(layout, col, row) {
  if (!isInside(layout, col, row)) return TILE.VOID;
  return layout.tiles[row * layout.cols + col];
}

export function setTile(layout, col, row, tile) {
  if (!isInside(layout, col, row)) return false;
  layout.tiles[row * layout.cols + col] = tile;
  return true;
}

/**
 * Neighbour bitmask used to pick a piece out of the 16-piece wall and carpet
 * sheets: N=1, E=2, S=4, W=8. Tiles outside the map count as matching so the
 * map edge does not draw an inside corner against nothing.
 */
export function neighbourMask(layout, col, row, matches) {
  const check = (c, r) => (isInside(layout, c, r) ? matches(tileAt(layout, c, r)) : true);
  return (
    (check(col, row - 1) ? 1 : 0) |
    (check(col + 1, row) ? 2 : 0) |
    (check(col, row + 1) ? 4 : 0) |
    (check(col - 1, row) ? 8 : 0)
  );
}

// ── Furniture ───────────────────────────────────────────────────────────────

/**
 * Whether a furniture group blocks movement.
 *
 * Wall decor hangs on a tile that is already a wall, and surface items (a PC,
 * a coffee cup) sit on a desk that already blocks — counting either again would
 * be harmless but misleading. Chairs are walkable on purpose: a character has to
 * be able to reach the tile it sits on.
 */
export function groupBlocks(group) {
  if (!group) return true;
  return !group.onWall && !group.onSurface && group.category !== 'chairs';
}

function assetFootprint(catalog, type) {
  const asset = catalog?.assets?.[type];
  return { fw: asset?.fw ?? 1, fh: asset?.fh ?? 1 };
}

/**
 * Map every sprite id back to the furniture group it belongs to.
 *
 * Built once and passed around rather than rescanned per lookup: the blocked
 * grid, the renderer's wall-decor split and the editor all need the same answer.
 */
export function buildAssetIndex(catalog) {
  const index = new Map();
  for (const [groupId, group] of Object.entries(catalog?.groups ?? {})) {
    for (const variant of group.variants ?? []) index.set(variant, { ...group, id: groupId });
  }
  return index;
}


/**
 * Grid of tiles blocked by furniture. Seats are punched back out afterwards:
 * a seat is always reachable even when it overlaps something solid, otherwise a
 * character could be stranded by a decorative sprite.
 */
export function buildBlockedGrid(layout, catalog) {
  const blocked = new Uint8Array(layout.cols * layout.rows);
  const index = buildAssetIndex(catalog);
  for (const item of layout.furniture) {
    const group = index.get(item.type) ?? null;
    if (!groupBlocks(group)) continue;
    const { fw, fh } = assetFootprint(catalog, item.type);
    for (let dr = 0; dr < fh; dr += 1) {
      for (let dc = 0; dc < fw; dc += 1) {
        const col = item.col + dc;
        const row = item.row + dr;
        if (isInside(layout, col, row)) blocked[row * layout.cols + col] = 1;
      }
    }
  }
  for (const seat of layout.seats) {
    if (isInside(layout, seat.col, seat.row)) blocked[seat.row * layout.cols + seat.col] = 0;
  }
  return blocked;
}

export function isWalkable(layout, blocked, col, row) {
  if (!isInside(layout, col, row)) return false;
  if (!isWalkableTile(tileAt(layout, col, row))) return false;
  return blocked[row * layout.cols + col] === 0;
}

// ── Pathfinding ─────────────────────────────────────────────────────────────

/**
 * A* over the 4-connected walkable grid. Returns the tiles to step through,
 * excluding the start and including the goal, or `[]` when no route exists.
 *
 * Four-connected rather than eight because the character sheet only has down,
 * up and right frames — a diagonal step has no sprite to draw.
 */
export function findPath(layout, blocked, from, to) {
  if (!isWalkable(layout, blocked, to.col, to.row)) return [];
  if (from.col === to.col && from.row === to.row) return [];

  const { cols, rows } = layout;
  const total = cols * rows;
  const startIndex = from.row * cols + from.col;
  const goalIndex = to.row * cols + to.col;

  const cameFrom = new Int32Array(total).fill(-1);
  const gScore = new Float64Array(total).fill(Infinity);
  const closed = new Uint8Array(total);
  gScore[startIndex] = 0;

  const heuristic = (index) => {
    const col = index % cols;
    const row = (index - col) / cols;
    return Math.abs(col - to.col) + Math.abs(row - to.row);
  };

  // A binary heap is overkill for a 32x20 room; a linear scan over the open set
  // costs less than the bookkeeping would.
  const open = new Set([startIndex]);

  while (open.size > 0) {
    let current = -1;
    let bestScore = Infinity;
    for (const index of open) {
      const score = gScore[index] + heuristic(index);
      if (score < bestScore) {
        bestScore = score;
        current = index;
      }
    }

    if (current === goalIndex) {
      const path = [];
      let node = current;
      while (node !== startIndex && node !== -1) {
        const col = node % cols;
        path.push({ col, row: (node - col) / cols });
        node = cameFrom[node];
      }
      return path.reverse();
    }

    open.delete(current);
    closed[current] = 1;

    const col = current % cols;
    const row = (current - col) / cols;
    const neighbours = [
      [col, row - 1],
      [col + 1, row],
      [col, row + 1],
      [col - 1, row],
    ];

    for (const [nc, nr] of neighbours) {
      if (!isWalkable(layout, blocked, nc, nr)) continue;
      const index = nr * cols + nc;
      if (closed[index]) continue;
      const tentative = gScore[current] + 1;
      if (tentative < gScore[index]) {
        cameFrom[index] = current;
        gScore[index] = tentative;
        open.add(index);
      }
    }
  }

  return [];
}

// ── Default layout ──────────────────────────────────────────────────────────

/**
 * Room size is chosen so the whole floor fills the dashboard's canvas at a whole
 * scale factor. At 36x17 the map is 576x288 art pixels, which needs 1152x576
 * device pixels to render at 2x — just inside a full-width canvas on a 1440px
 * viewport once the side panel stacks below. Any wider and the fit drops to 1x,
 * where 16px sprites stop being readable.
 */
const COLS = 36;
const ROWS = 17;

/**
 * Desk bands: a 3-wide desk occupies two rows and the seat sits one row below
 * it, so a band is three rows deep and the next one starts immediately after.
 *
 * Bands used to be spaced four rows apart, which spent a whole empty row per
 * band on a corridor the seat row already provides — a floor of 24 desks in a
 * room with space for 36. Packing them to three fits a fourth band and a
 * seventh column without growing the room, which matters: the map is sized so
 * it renders at a whole scale factor, and a wider one drops to 1x where 16px
 * sprites stop being readable.
 */
const AI_DESK_COLS = [1, 5, 9, 13, 17, 21, 24];
const AI_DESK_ROWS = [2, 5, 8, 11];
/**
 * The escalation desks are packed two abreast, which leaves column 34 as the
 * only way between the bands — a desk row spans its full width and would
 * otherwise seal the upper desks off from the partition door. Widening this
 * zone to fit the seventh AI column did exactly that: six of the eight staff
 * seats lost every path to the escalation inbox. The seventh column butts
 * against its neighbour on the AI side instead, where spare columns remain.
 */
const STAFF_DESK_COLS = [28, 31];
const STAFF_DESK_ROWS = [2, 5, 8, 11];

/** Column of the partition dividing the AI floor from the escalation desks. */
const PARTITION_COL = 27;
/** Rows left open in the partition so characters can cross between zones. */
const PARTITION_GAP_ROWS = [13, 14];
/** Columns left open in the bottom wall — the way in and out of the office. */
const DOOR_COLS = [17, 18];

let uidCounter = 0;
function uid(prefix) {
  uidCounter += 1;
  return `${prefix}-${uidCounter}`;
}

function place(furniture, type, col, row) {
  furniture.push({ uid: uid('f'), type, col, row });
}

export function createDefaultLayout() {
  uidCounter = 0;
  const tiles = new Array(COLS * ROWS).fill(TILE.FLOOR);
  const layout = {
    version: LAYOUT_VERSION,
    cols: COLS,
    rows: ROWS,
    tiles,
    furniture: [],
    seats: [],
    landmarks: {},
  };

  // Outer walls.
  for (let col = 0; col < COLS; col += 1) {
    setTile(layout, col, 0, TILE.WALL);
    setTile(layout, col, ROWS - 1, DOOR_COLS.includes(col) ? TILE.FLOOR : TILE.WALL);
  }
  for (let row = 0; row < ROWS; row += 1) {
    setTile(layout, 0, row, TILE.WALL);
    setTile(layout, COLS - 1, row, TILE.WALL);
  }

  // Partition between the AI floor and the escalation desks.
  for (let row = 1; row < ROWS - 1; row += 1) {
    if (!PARTITION_GAP_ROWS.includes(row)) setTile(layout, PARTITION_COL, row, TILE.WALL);
  }

  // Accent carpet under each working area, so the two zones read apart at a
  // glance. It runs to row 13, the seat row of the fourth desk band.
  for (let row = 1; row <= 13; row += 1) {
    for (let col = 1; col <= PARTITION_COL - 1; col += 1) setTile(layout, col, row, TILE.CARPET_AI);
    for (let col = PARTITION_COL + 1; col <= COLS - 2; col += 1) {
      setTile(layout, col, row, TILE.CARPET_STAFF);
    }
  }

  const { furniture, seats } = layout;

  // Eight AI workstations: desk, monitor, and the seat the agent works from.
  //
  // The monitor is recorded on the seat rather than dropped into `furniture`
  // because the renderer swaps its sprite with the seat's state — dark when the
  // desk is empty, animating while a call is being handled. Its `row` is the
  // desk's own row; the renderer lifts the sprite by a few pixels so the
  // keyboard lands on the desk surface rather than a whole tile above it.
  let aiIndex = 0;
  for (const row of AI_DESK_ROWS) {
    for (const col of AI_DESK_COLS) {
      aiIndex += 1;
      place(furniture, 'DESK_FRONT', col, row);
      seats.push({
        id: `ai-${aiIndex}`,
        kind: 'ai',
        col: col + 1,
        row: row + 2,
        dir: DIR.UP,
        label: `AI-${String(aiIndex).padStart(2, '0')}`,
        monitor: { col: col + 1, row },
      });
    }
  }

  // Four human escalation desks behind the partition.
  let staffIndex = 0;
  for (const row of STAFF_DESK_ROWS) {
    for (const col of STAFF_DESK_COLS) {
      staffIndex += 1;
      place(furniture, 'DESK_FRONT', col, row);
      seats.push({
        id: `staff-${staffIndex}`,
        kind: 'human',
        col: col + 1,
        row: row + 2,
        dir: DIR.UP,
        label: `PETUGAS-${String(staffIndex).padStart(2, '0')}`,
        monitor: { col: col + 1, row },
      });
    }
  }

  // Escalation inbox: the tray cases pile onto when no operator is on shift.
  place(furniture, 'SMALL_TABLE_FRONT', 29, 14);
  place(furniture, 'BOOKSHELF', 32, 14);
  // Anything two tiles tall on the last floor row would render through the
  // bottom wall, so the trim along row 15 is all single-tile pieces.
  place(furniture, 'POT', 34, 15);

  // The partition greenery is gone: the seventh desk column now runs to the
  // partition itself, so there is no spare column beside it to stand a plant in.

  // Break area along the bottom of the AI floor. Row 13 became the fourth
  // band's seat row, so everything that used to sit there moved down a row.
  place(furniture, 'LARGE_PLANT', 1, 14);
  place(furniture, 'SOFA_FRONT', 4, 14);
  place(furniture, 'COFFEE_TABLE', 7, 14);
  place(furniture, 'COFFEE', 8, 14);
  place(furniture, 'SOFA_SIDE', 10, 14);
  place(furniture, 'DOUBLE_BOOKSHELF', 13, 14);
  place(furniture, 'WOODEN_BENCH', 16, 15);
  place(furniture, 'CACTUS', 20, 14);
  place(furniture, 'CUSHIONED_BENCH', 22, 15);
  place(furniture, 'SMALL_TABLE_FRONT', 24, 14);
  place(furniture, 'BIN', 26, 15);
  place(furniture, 'POT', 12, 15);

  // Wall fittings.
  place(furniture, 'CLOCK', 17, 0);
  place(furniture, 'WHITEBOARD', 2, 0);
  place(furniture, 'LARGE_PAINTING', 8, 0);
  place(furniture, 'SMALL_PAINTING', 14, 0);
  place(furniture, 'SMALL_PAINTING_2', 22, 0);
  place(furniture, 'SMALL_PAINTING', 31, 0);

  layout.landmarks = {
    /** Tile an AI agent walks to in order to hand a case over. */
    inbox: { col: 29, row: 13 },
    /** Where the inbox tray is drawn, and where the case pile stacks. */
    inboxTray: { col: 29, row: 14 },
    /** Just inside the entrance — staff spawn and despawn here. */
    door: { col: DOOR_COLS[0], row: ROWS - 2 },
  };

  return layout;
}

// ── Persistence ─────────────────────────────────────────────────────────────

export function serializeLayout(layout) {
  return {
    version: LAYOUT_VERSION,
    cols: layout.cols,
    rows: layout.rows,
    tiles: Array.from(layout.tiles),
    furniture: layout.furniture.map(({ uid: id, type, col, row }) => ({ uid: id, type, col, row })),
    seats: layout.seats.map((seat) => ({ ...seat })),
    landmarks: layout.landmarks,
  };
}

/**
 * Rebuild a layout from stored JSON, returning `null` when the payload is not a
 * layout this version understands. A corrupt or stale entry in localStorage
 * should fall back to the default office, never throw on load.
 */
export function deserializeLayout(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.version !== LAYOUT_VERSION) return null;
  const { cols, rows } = raw;
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols <= 0 || rows <= 0) return null;
  if (!Array.isArray(raw.tiles) || raw.tiles.length !== cols * rows) return null;
  if (!Array.isArray(raw.furniture) || !Array.isArray(raw.seats)) return null;

  const validTiles = new Set(Object.values(TILE));
  const tiles = raw.tiles.map((tile) => (validTiles.has(tile) ? tile : TILE.FLOOR));

  const furniture = raw.furniture
    .filter((item) => item && typeof item.type === 'string')
    .filter((item) => Number.isInteger(item.col) && Number.isInteger(item.row))
    .map((item) => ({ uid: item.uid || uid('f'), type: item.type, col: item.col, row: item.row }));

  const seats = raw.seats
    .filter((seat) => seat && Number.isInteger(seat.col) && Number.isInteger(seat.row))
    .map((seat) => ({
      id: String(seat.id ?? uid('seat')),
      kind: seat.kind === 'human' ? 'human' : 'ai',
      col: seat.col,
      row: seat.row,
      dir: Object.values(DIR).includes(seat.dir) ? seat.dir : DIR.UP,
      label: String(seat.label ?? seat.id ?? ''),
    }));

  if (seats.length === 0) return null;

  const fallback = createDefaultLayout().landmarks;
  return {
    version: LAYOUT_VERSION,
    cols,
    rows,
    tiles,
    furniture,
    seats,
    landmarks: raw.landmarks && typeof raw.landmarks === 'object' ? raw.landmarks : fallback,
  };
}

/**
 * Problems that would strand the simulation. Reported rather than thrown so the
 * editor can show them and still let the user keep editing.
 */
export function validateLayout(layout, catalog) {
  const problems = [];
  const blocked = buildBlockedGrid(layout, catalog);

  const aiSeats = layout.seats.filter((seat) => seat.kind === 'ai');
  const humanSeats = layout.seats.filter((seat) => seat.kind === 'human');
  if (aiSeats.length === 0) problems.push('Belum ada kursi agent AI.');
  if (humanSeats.length === 0) problems.push('Belum ada kursi petugas.');

  for (const seat of layout.seats) {
    if (!isInside(layout, seat.col, seat.row)) {
      problems.push(`Kursi ${seat.label} berada di luar denah.`);
    } else if (!isWalkableTile(tileAt(layout, seat.col, seat.row))) {
      problems.push(`Kursi ${seat.label} berdiri di atas tile yang tidak bisa dilalui.`);
    }
  }

  // Every seat must be able to reach the escalation inbox, otherwise a case
  // handed over there would never be picked up.
  const inbox = layout.landmarks?.inbox;
  if (inbox && layout.seats.length > 0) {
    if (!isWalkable(layout, blocked, inbox.col, inbox.row)) {
      problems.push('Inbox eskalasi terhalang furnitur.');
    } else {
      for (const seat of layout.seats) {
        if (seat.col === inbox.col && seat.row === inbox.row) continue;
        if (findPath(layout, blocked, seat, inbox).length === 0) {
          problems.push(`Kursi ${seat.label} tidak punya jalur ke inbox eskalasi.`);
        }
      }
    }
  }

  return problems;
}
