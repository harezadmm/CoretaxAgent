/**
 * Loads the vendored pixel-art sheets and cuts them into ready-to-draw canvases.
 *
 * Everything here runs once, at view mount: the slicing and recolouring is done
 * up front into offscreen canvases so the render loop only ever calls
 * `drawImage`. Tiles are 16px, so even recolouring every sheet pixel by pixel
 * costs well under a frame.
 *
 * Floors, walls and carpets ship as greyscale (see ATTRIBUTION.md) and are
 * recoloured to the dashboard's terminal palette. Furniture and characters are
 * full-colour artwork and are drawn exactly as they come from upstream.
 */

const SHEET = {
  wall: { cols: 4, w: 16, h: 32 },
  carpet: { cols: 4, w: 16, h: 16 },
};

/**
 * Two-point ramps applied to the greyscale sheets: the darkest pixel in a sheet
 * becomes `dark`, the lightest becomes `light`, everything between is mixed.
 * Straight multiply-blending would have crushed the two greys in `floor_N.png`
 * into the same near-black.
 */
export const TINTS = {
  // The old range topped out at #242c34, which is close enough to the page
  // background that the floor tiles read as one flat fill and their texture
  // disappears entirely. Lift both ends so the pattern is actually visible.
  floor: { dark: '#1f262e', light: '#3a4550' },
  wall: { dark: '#0a0d10', light: '#39434d' },
  carpetAi: { dark: '#0d2b31', light: '#1d5560' },
  carpetStaff: { dark: '#2c2113', light: '#5a4522' },
};

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  return { canvas, context };
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Gagal memuat sprite: ${url}`));
    image.src = url;
  });
}

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

/**
 * Recolour a greyscale sprite along a two-point ramp, preserving alpha.
 *
 * The ramp is normalised against the luminance actually present in the sheet
 * rather than against 0–255: the floor tiles only span #a7a7a7 to #ededed, so a
 * fixed range would flatten them to a single shade.
 */
function tint(image, { dark, light }) {
  const { canvas, context } = makeCanvas(image.width, image.height);
  context.drawImage(image, 0, 0);
  const data = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = data.data;

  let min = 255;
  let max = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) continue;
    const lum = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
    if (lum < min) min = lum;
    if (lum > max) max = lum;
  }

  const [dr, dg, db] = hexToRgb(dark);
  const [lr, lg, lb] = hexToRgb(light);
  const span = max - min;

  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) continue;
    const lum = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
    const t = span > 0 ? (lum - min) / span : 0.5;
    pixels[i] = Math.round(dr + (lr - dr) * t);
    pixels[i + 1] = Math.round(dg + (lg - dg) * t);
    pixels[i + 2] = Math.round(db + (lb - db) * t);
  }

  context.putImageData(data, 0, 0);
  return canvas;
}

function slice(source, sx, sy, width, height, { flip = false } = {}) {
  const { canvas, context } = makeCanvas(width, height);
  if (flip) {
    context.translate(width, 0);
    context.scale(-1, 1);
  }
  context.drawImage(source, sx, sy, width, height, 0, 0, width, height);
  return canvas;
}

/** Cut a 16-piece bitmask sheet (walls, carpets) into an array indexed by mask. */
function sliceBitmaskSheet(source, spec) {
  const pieces = [];
  for (let index = 0; index < 16; index += 1) {
    const col = index % spec.cols;
    const row = Math.floor(index / spec.cols);
    pieces.push(slice(source, col * spec.w, row * spec.h, spec.w, spec.h));
  }
  return pieces;
}

/**
 * Cut one character sheet into its animation sets.
 *
 * Upstream lays out 3 direction rows (down, up, right) of 7 frames each, and
 * derives left by mirroring right — there is no fourth row to read.
 */
function sliceCharacter(image, spec) {
  const { frameW, frameH, rows, walk, typing, reading } = spec;
  const byRow = {};
  rows.forEach((direction, rowIndex) => {
    const frames = [];
    for (let frame = 0; frame < spec.framesPerRow; frame += 1) {
      frames.push(slice(image, frame * frameW, rowIndex * frameH, frameW, frameH));
    }
    byRow[direction] = frames;
  });

  const mirrored = [];
  for (let frame = 0; frame < spec.framesPerRow; frame += 1) {
    mirrored.push(slice(image, frame * frameW, rows.indexOf('right') * frameH, frameW, frameH, { flip: true }));
  }
  byRow.left = mirrored;

  const build = (indices) => {
    const set = {};
    for (const direction of ['down', 'up', 'right', 'left']) {
      set[direction] = indices.map((index) => byRow[direction][index]);
    }
    return set;
  };

  return { walk: build(walk), typing: build(typing), reading: build(reading) };
}

/**
 * Sprite sets are immutable once built, and the dashboard remounts this view
 * every time the user navigates back to it. Caching the promise means a return
 * visit reuses the decoded images instead of re-slicing and re-tinting all
 * eighty sheets; a rejection is dropped so a failed load can be retried.
 */
const cache = new Map();

/**
 * Load every sheet the office needs.
 *
 * @param {string} base URL prefix the assets are served from.
 * @returns {Promise<object>} sliced, recoloured sprite sets plus the raw catalog.
 */
export function loadOfficeAssets(base = '/static/assets/office') {
  if (!cache.has(base)) {
    const pending = buildOfficeAssets(base);
    pending.catch(() => cache.delete(base));
    cache.set(base, pending);
  }
  return cache.get(base);
}

async function buildOfficeAssets(base) {
  const catalog = await fetch(`${base}/catalog.json`).then((response) => {
    if (!response.ok) throw new Error(`catalog.json: HTTP ${response.status}`);
    return response.json();
  });

  const [floorImages, carpetImages, wallImages, characterImages] = await Promise.all([
    Promise.all(catalog.floors.map((file) => loadImage(`${base}/floors/${file}`))),
    Promise.all(catalog.carpets.map((file) => loadImage(`${base}/carpets/${file}`))),
    Promise.all(catalog.walls.map((file) => loadImage(`${base}/walls/${file}`))),
    Promise.all(catalog.character.files.map((file) => loadImage(`${base}/characters/${file}`))),
  ]);

  const furnitureEntries = Object.entries(catalog.assets);
  const furnitureImages = await Promise.all(
    furnitureEntries.map(([, asset]) => loadImage(`${base}/${asset.file}`)),
  );

  const furniture = new Map();
  furnitureEntries.forEach(([id, asset], index) => {
    furniture.set(id, {
      image: furnitureImages[index],
      w: asset.w,
      h: asset.h,
      fw: asset.fw,
      fh: asset.fh,
    });
  });

  return {
    catalog,
    /** Tinted 16x16 floor variants. */
    floors: floorImages.map((image) => tint(image, TINTS.floor)),
    /** Bitmask-indexed 16x32 wall pieces. */
    walls: sliceBitmaskSheet(tint(wallImages[0], TINTS.wall), SHEET.wall),
    /** Bitmask-indexed 16x16 carpet pieces, one recolour per zone. */
    carpets: {
      ai: sliceBitmaskSheet(tint(carpetImages[0], TINTS.carpetAi), SHEET.carpet),
      staff: sliceBitmaskSheet(tint(carpetImages[1] ?? carpetImages[0], TINTS.carpetStaff), SHEET.carpet),
    },
    characters: characterImages.map((image) => sliceCharacter(image, catalog.character)),
    furniture,
  };
}
