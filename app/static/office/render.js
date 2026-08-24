/**
 * Canvas renderer for the office.
 *
 * Draws in layers — floor, carpet, wall, then everything with a footprint sorted
 * by its bottom edge so a character walking behind a plant is occluded by it.
 *
 * The camera scale is a whole number of *device* pixels per sprite pixel. A
 * fractional scale (which is what a CSS-pixel zoom becomes on a 125% display)
 * lands sprite edges between pixels and the tile seams show as bright hairlines;
 * keeping it integral is what makes the art look like pixel art rather than a
 * resized photo.
 */

import {
  TILE,
  TILE_SIZE,
  buildAssetIndex,
  isCarpetTile,
  neighbourMask,
  tileAt,
} from './tilemap.js';

export const MIN_SCALE = 1;
export const MAX_SCALE = 6;

/** One extra tile of headroom so the 16x32 wall pieces on row 0 are not clipped. */
const WALL_OVERHANG = TILE_SIZE;

/**
 * Pixel offsets that plant an object on a furniture sprite's surface.
 *
 * These come from the artwork, not from the tile grid. `DESK_FRONT` is
 * transparent down to y=11, so its tabletop begins 11px into its own tile; the
 * PC sprite's keyboard ends at y=22 with nine blank rows beneath it. Aligning
 * on tile boundaries alone leaves the monitor floating five pixels clear of the
 * desk, which is exactly what it looked like.
 */
const MONITOR_LIFT = -5;
/** Draw order nudge: after the desk it stands on, before anyone sitting at it. */
const SURFACE_SORT_BIAS = 1;

/** Escalation slips on the inbox tray, in pixels inside the tray sprite's tile. */
const PILE = { x: 10, baseY: 24, width: 12, step: 1.6, maxVisible: 7 };

const BUBBLE_STYLE = {
  call: { fill: '#52d7e8', glyph: 'phone' },
  search: { fill: '#a590ff', glyph: 'search' },
  answer: { fill: '#46d7a6', glyph: 'wave' },
  escalate: { fill: '#ffb248', glyph: 'doc' },
  case: { fill: '#ffb248', glyph: 'doc' },
};

const ZONE_MARK = { ai: '#52d7e8', human: '#ffb248' };

export function createRenderer(canvas, assets) {
  const context = canvas.getContext('2d', { alpha: false });
  const assetIndex = buildAssetIndex(assets.catalog);

  const camera = { scale: 3, panX: 0, panY: 0 };
  let layout = null;
  let deviceWidth = 0;
  let deviceHeight = 0;

  /** Stable per-tile floor variant, so the floor has texture but never shimmers. */
  function floorVariant(col, row) {
    const hash = (col * 73856093) ^ (row * 19349663);
    return assets.floors[Math.abs(hash) % assets.floors.length];
  }

  function mapSize() {
    return {
      width: layout.cols * TILE_SIZE,
      height: layout.rows * TILE_SIZE + WALL_OVERHANG,
    };
  }

  /** Top-left of the map in device pixels, centred then panned then clamped. */
  function origin() {
    const { width, height } = mapSize();
    const scaledW = width * camera.scale;
    const scaledH = height * camera.scale;

    let x = Math.floor((deviceWidth - scaledW) / 2) + Math.round(camera.panX);
    let y = Math.floor((deviceHeight - scaledH) / 2) + Math.round(camera.panY);

    // When the map is larger than the viewport, keep at least one edge in view;
    // when it is smaller, ignore the pan entirely and stay centred.
    if (scaledW > deviceWidth) x = Math.min(0, Math.max(deviceWidth - scaledW, x));
    else x = Math.floor((deviceWidth - scaledW) / 2);
    if (scaledH > deviceHeight) y = Math.min(0, Math.max(deviceHeight - scaledH, y));
    else y = Math.floor((deviceHeight - scaledH) / 2);

    return { x, y: y + WALL_OVERHANG * camera.scale };
  }

  function drawSprite(image, worldX, worldY) {
    if (!image) return;
    const { x, y } = origin();
    context.drawImage(
      image,
      x + Math.round(worldX * camera.scale),
      y + Math.round(worldY * camera.scale),
      image.width * camera.scale,
      image.height * camera.scale,
    );
  }

  // ── Layers ────────────────────────────────────────────────────────────────

  function drawGround() {
    for (let row = 0; row < layout.rows; row += 1) {
      for (let col = 0; col < layout.cols; col += 1) {
        const tile = tileAt(layout, col, row);
        if (tile === TILE.VOID) continue;
        drawSprite(floorVariant(col, row), col * TILE_SIZE, row * TILE_SIZE);

        if (isCarpetTile(tile)) {
          const pieces = tile === TILE.CARPET_AI ? assets.carpets.ai : assets.carpets.staff;
          const mask = neighbourMask(layout, col, row, (neighbour) => neighbour === tile);
          drawSprite(pieces[mask], col * TILE_SIZE, row * TILE_SIZE);
        }
      }
    }
  }

  function drawWalls() {
    for (let row = 0; row < layout.rows; row += 1) {
      for (let col = 0; col < layout.cols; col += 1) {
        if (tileAt(layout, col, row) !== TILE.WALL) continue;
        const mask = neighbourMask(layout, col, row, (tile) => tile === TILE.WALL);
        drawSprite(assets.walls[mask], col * TILE_SIZE, row * TILE_SIZE - TILE_SIZE);
      }
    }
  }

  /** Pictures, clocks and whiteboards hang on the wall face, behind everything else. */
  function drawWallDecor() {
    for (const item of layout.furniture) {
      const group = assetIndex.get(item.type);
      if (!group?.onWall) continue;
      const sprite = assets.furniture.get(item.type);
      if (!sprite) continue;
      drawSprite(sprite.image, item.col * TILE_SIZE, item.row * TILE_SIZE - TILE_SIZE);
    }
  }

  function monitorSprite(seat, occupant, now) {
    const busy = seat.kind === 'ai' ? Boolean(occupant?.call) : occupant?.task === 'handling';
    if (!occupant?.present) return assets.furniture.get('PC_FRONT_OFF');
    if (!busy) return assets.furniture.get('PC_FRONT_ON_1');
    const frame = 1 + (Math.floor(now / 180) % 3);
    return assets.furniture.get(`PC_FRONT_ON_${frame}`);
  }

  function characterSprite(character) {
    const set = assets.characters[character.palette % assets.characters.length];
    const pose = character.motion === 'walk' ? 'walk' : character.pose === 'reading' ? 'reading' : 'typing';
    const frames = set[pose][character.dir] ?? set[pose].down;
    return frames[character.frame % frames.length];
  }

  function drawBubble(character) {
    const style = BUBBLE_STYLE[character.bubble];
    if (!style) return;

    const { x, y } = origin();
    const scale = camera.scale;
    const width = 13 * scale;
    const height = 11 * scale;
    const left = x + Math.round((character.x - 6.5) * scale);
    const top = y + Math.round((character.y - 30) * scale);

    context.fillStyle = 'rgba(7, 9, 11, 0.92)';
    context.fillRect(left, top, width, height);
    context.fillStyle = style.fill;
    context.fillRect(left, top, width, Math.max(1, Math.round(scale * 0.8)));
    context.fillRect(left + 3 * scale, top + 4 * scale, 3 * scale, 3 * scale);
    // Tail, pointing down at the head below.
    context.fillStyle = 'rgba(7, 9, 11, 0.92)';
    context.fillRect(left + 5 * scale, top + height, 3 * scale, 2 * scale);
  }

  /** Small coloured pad under a character, so AI and human staff read apart. */
  function drawZoneMark(character) {
    const { x, y } = origin();
    const scale = camera.scale;
    context.fillStyle = ZONE_MARK[character.kind] ?? ZONE_MARK.ai;
    context.globalAlpha = 0.22;
    context.fillRect(
      x + Math.round((character.x - 5) * scale),
      y + Math.round((character.y + 4) * scale),
      10 * scale,
      3 * scale,
    );
    context.globalAlpha = 1;
  }

  /**
   * The escalation tray: one slip per queued case, capped so it cannot tower.
   *
   * Positioned against the tray sprite's own surface (`SMALL_TABLE_FRONT` is
   * transparent above y=11) rather than the top of its tile, so the stack rests
   * on the table instead of hovering over it.
   */
  function drawInboxPile(simState) {
    const tray = layout.landmarks?.inboxTray;
    if (!tray) return;
    const queued = simState.cases.filter((record) => record.status === 'queued').length;
    if (queued === 0) return;

    const { x, y } = origin();
    const scale = camera.scale;
    const visible = Math.min(queued, PILE.maxVisible);
    const left = x + Math.round((tray.col * TILE_SIZE + PILE.x) * scale);
    const base = y + Math.round((tray.row * TILE_SIZE + PILE.baseY) * scale);
    const slip = Math.max(1, Math.round(scale));
    const step = Math.max(slip + 1, Math.round(PILE.step * scale));

    for (let i = 0; i < visible; i += 1) {
      const top = base - i * step;
      context.fillStyle = i === visible - 1 ? '#ffd79a' : '#e8dcc6';
      context.fillRect(left, top, PILE.width * scale, slip);
      context.fillStyle = 'rgba(0,0,0,0.38)';
      context.fillRect(left, top + slip, PILE.width * scale, Math.max(1, Math.round(slip / 2)));
    }

    if (queued > visible) {
      const fontSize = Math.max(9, Math.round(3.6 * scale));
      context.font = `${fontSize}px "Cascadia Mono", Consolas, monospace`;
      context.fillStyle = '#ffb248';
      context.textAlign = 'center';
      context.fillText(`+${queued - visible}`, left + (PILE.width / 2) * scale, base - visible * step - slip);
      context.textAlign = 'left';
    }
  }

  function label(text, worldX, worldY, colour) {
    const { x, y } = origin();
    const scale = camera.scale;
    const fontSize = Math.max(9, Math.round(3.4 * scale));
    context.font = `${fontSize}px "Cascadia Mono", Consolas, monospace`;
    context.textAlign = 'center';

    const width = context.measureText(text).width + 8;
    const left = x + Math.round(worldX * scale) - width / 2;
    const top = y + Math.round(worldY * scale);

    context.fillStyle = 'rgba(7, 9, 11, 0.88)';
    context.fillRect(left, top, width, fontSize + 6);
    context.fillStyle = colour;
    context.fillText(text, left + width / 2, top + fontSize + 1);
    context.textAlign = 'left';
  }

  /** Dim the room outside office hours, so the empty escalation desks read as "closed". */
  function drawNightWash(simState) {
    const hour = new Date(simState.clock).getHours();
    const darkness = hour >= 8 && hour < 17 ? 0 : hour >= 6 && hour < 20 ? 0.16 : 0.34;
    if (darkness === 0) return;
    context.fillStyle = `rgba(6, 12, 24, ${darkness})`;
    context.fillRect(0, 0, deviceWidth, deviceHeight);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    deviceWidth = Math.max(1, Math.round(rect.width * dpr));
    deviceHeight = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== deviceWidth || canvas.height !== deviceHeight) {
      canvas.width = deviceWidth;
      canvas.height = deviceHeight;
    }
    context.imageSmoothingEnabled = false;
  }

  /** Largest whole scale that still shows the entire room. */
  function fitScale() {
    if (!layout) return 3;
    const { width, height } = mapSize();
    const scale = Math.floor(Math.min(deviceWidth / width, deviceHeight / height));
    return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
  }

  function draw(simState, options = {}) {
    layout = simState.layout;
    context.imageSmoothingEnabled = false;
    context.fillStyle = '#07090b';
    context.fillRect(0, 0, deviceWidth, deviceHeight);

    drawGround();
    drawWalls();
    drawWallDecor();

    const now = options.now ?? 0;
    const drawables = [];

    for (const item of layout.furniture) {
      const group = assetIndex.get(item.type);
      if (group?.onWall) continue;
      const sprite = assets.furniture.get(item.type);
      if (!sprite) continue;
      const worldY = item.row * TILE_SIZE;
      drawables.push({
        sort: worldY + sprite.h,
        paint: () => drawSprite(sprite.image, item.col * TILE_SIZE, worldY),
      });
    }

    const occupants = new Map();
    for (const character of [...simState.agents, ...simState.staff]) {
      occupants.set(character.seatId, character);
    }

    for (const seat of layout.seats) {
      if (!seat.monitor) continue;
      const sprite = monitorSprite(seat, occupants.get(seat.id), now);
      if (!sprite) continue;
      // The desk occupies two rows from `monitor.row`, so sorting just past its
      // bottom edge puts the monitor on the desk while the agent sitting one row
      // further down still draws in front of both.
      const deskBottom = (seat.monitor.row + 2) * TILE_SIZE;
      drawables.push({
        sort: deskBottom + SURFACE_SORT_BIAS,
        paint: () =>
          drawSprite(sprite.image, seat.monitor.col * TILE_SIZE, seat.monitor.row * TILE_SIZE + MONITOR_LIFT),
      });
    }

    const tray = layout.landmarks?.inboxTray;
    if (tray) {
      drawables.push({
        sort: (tray.row + 2) * TILE_SIZE + SURFACE_SORT_BIAS,
        paint: () => drawInboxPile(simState),
      });
    }

    for (const character of [...simState.agents, ...simState.staff]) {
      if (!character.present) continue;
      const sprite = characterSprite(character);
      drawables.push({
        sort: character.y + 8,
        paint: () => {
          drawZoneMark(character);
          drawSprite(sprite, character.x - 8, character.y - 24);
          drawBubble(character);
        },
      });
    }

    drawables.sort((a, b) => a.sort - b.sort);
    for (const drawable of drawables) drawable.paint();

    drawNightWash(simState);

    if (options.highlightSeatId) {
      const seat = layout.seats.find((entry) => entry.id === options.highlightSeatId);
      const occupant = seat && occupants.get(seat.id);
      if (seat) {
        const { x, y } = origin();
        const scale = camera.scale;
        context.strokeStyle = ZONE_MARK[seat.kind] ?? ZONE_MARK.ai;
        context.lineWidth = Math.max(1, Math.round(scale / 2));
        context.strokeRect(
          x + Math.round((seat.col * TILE_SIZE - 2) * scale),
          y + Math.round((seat.row * TILE_SIZE - 18) * scale),
          20 * scale,
          32 * scale,
        );
        if (occupant) label(seat.label, occupant.x, occupant.y + 10, ZONE_MARK[seat.kind]);
      }
    }

    if (options.hoverSeatId && options.hoverSeatId !== options.highlightSeatId) {
      const seat = layout.seats.find((entry) => entry.id === options.hoverSeatId);
      if (seat) label(seat.label, seat.col * TILE_SIZE + 8, seat.row * TILE_SIZE + 10, '#c9d0d5');
    }

    if (options.overlay) options.overlay({ context, origin: origin(), scale: camera.scale, layout });
  }

  function screenToTile(clientX, clientY) {
    if (!layout) return null;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const { x, y } = origin();
    const col = Math.floor(((clientX - rect.left) * dpr - x) / (TILE_SIZE * camera.scale));
    const row = Math.floor(((clientY - rect.top) * dpr - y) / (TILE_SIZE * camera.scale));
    return { col, row };
  }

  /**
   * Which seat the pointer is over. Desks are the interesting target, so the hit
   * box covers the seat tile plus the desk and monitor above it rather than only
   * the single tile the character stands on.
   */
  function seatAt(clientX, clientY) {
    const tile = screenToTile(clientX, clientY);
    if (!tile || !layout) return null;
    return (
      layout.seats.find(
        (seat) =>
          tile.col >= seat.col - 1 &&
          tile.col <= seat.col + 1 &&
          tile.row >= seat.row - 3 &&
          tile.row <= seat.row,
      ) ?? null
    );
  }

  return {
    camera,
    resize,
    draw,
    fitScale,
    screenToTile,
    seatAt,
    setScale(value) {
      camera.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.round(value)));
    },
    panBy(dx, dy) {
      const dpr = window.devicePixelRatio || 1;
      camera.panX += dx * dpr;
      camera.panY += dy * dpr;
    },
    resetPan() {
      camera.panX = 0;
      camera.panY = 0;
    },
  };
}
