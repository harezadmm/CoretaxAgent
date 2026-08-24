/**
 * Layout and pathfinding rules for the Virtual Office floor.
 *
 * Run with `node --test tests/js/` — these modules are deliberately free of DOM
 * and canvas access so they can be exercised without a browser.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import {
  TILE,
  buildAssetIndex,
  buildBlockedGrid,
  createDefaultLayout,
  deserializeLayout,
  findPath,
  groupBlocks,
  isWalkable,
  neighbourMask,
  serializeLayout,
  setTile,
  tileAt,
  validateLayout,
} from '../../app/static/office/tilemap.js';

const catalog = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../app/static/assets/office/catalog.json', import.meta.url)), 'utf8'),
);

test('the default office passes its own validation', () => {
  assert.deepEqual(validateLayout(createDefaultLayout(), catalog), []);
});

test('the default office has eight AI desks and four escalation desks', () => {
  const layout = createDefaultLayout();
  assert.equal(layout.seats.filter((seat) => seat.kind === 'ai').length, 8);
  assert.equal(layout.seats.filter((seat) => seat.kind === 'human').length, 4);
  for (const seat of layout.seats) assert.ok(seat.monitor, `${seat.id} has no monitor`);
});

test('a monitor sits on its own desk, two rows above the seat', () => {
  const layout = createDefaultLayout();
  const desks = layout.furniture.filter((item) => item.type === 'DESK_FRONT');

  for (const seat of layout.seats) {
    // The renderer lifts the sprite in pixels; the tile it names must be the
    // desk's own row, or the monitor floats a whole tile clear of the surface.
    assert.equal(seat.monitor.row, seat.row - 2, `${seat.id} monitor is not on the desk row`);
    assert.equal(seat.monitor.col, seat.col, `${seat.id} monitor is not centred on the desk`);

    const desk = desks.find(
      (item) => item.row === seat.monitor.row && seat.col >= item.col && seat.col < item.col + 3,
    );
    assert.ok(desk, `${seat.id} has a monitor with no desk under it`);
  }
});

test('every seat can reach the entrance and the escalation inbox', () => {
  const layout = createDefaultLayout();
  const blocked = buildBlockedGrid(layout, catalog);
  const { door, inbox } = layout.landmarks;

  for (const seat of layout.seats) {
    assert.ok(findPath(layout, blocked, seat, door).length > 0, `${seat.id} cannot reach the door`);
    assert.ok(findPath(layout, blocked, seat, inbox).length > 0, `${seat.id} cannot reach the inbox`);
  }
});

test('a path is contiguous, four-connected, and excludes its start tile', () => {
  const layout = createDefaultLayout();
  const blocked = buildBlockedGrid(layout, catalog);
  const start = layout.seats[0];
  const path = findPath(layout, blocked, start, layout.landmarks.inbox);

  assert.ok(path.length > 0);
  assert.notDeepEqual(path[0], { col: start.col, row: start.row });
  assert.deepEqual(path.at(-1), { col: layout.landmarks.inbox.col, row: layout.landmarks.inbox.row });

  let previous = { col: start.col, row: start.row };
  for (const step of path) {
    const distance = Math.abs(step.col - previous.col) + Math.abs(step.row - previous.row);
    assert.equal(distance, 1, `step ${JSON.stringify(step)} is not adjacent to ${JSON.stringify(previous)}`);
    assert.ok(isWalkable(layout, blocked, step.col, step.row), 'path crosses an unwalkable tile');
    previous = step;
  }
});

test('pathfinding gives up rather than walking through walls', () => {
  const layout = createDefaultLayout();
  const blocked = buildBlockedGrid(layout, catalog);
  // A tile outside the room: enclosed by the outer wall, so unreachable.
  assert.deepEqual(findPath(layout, blocked, layout.seats[0], { col: 0, row: 0 }), []);
});

test('pathing to the tile you are already on returns no steps', () => {
  const layout = createDefaultLayout();
  const blocked = buildBlockedGrid(layout, catalog);
  const seat = layout.seats[0];
  assert.deepEqual(findPath(layout, blocked, seat, { col: seat.col, row: seat.row }), []);
});

test('desks block movement but the seats in front of them stay walkable', () => {
  const layout = createDefaultLayout();
  const blocked = buildBlockedGrid(layout, catalog);
  const desk = layout.furniture.find((item) => item.type === 'DESK_FRONT');

  assert.equal(blocked[desk.row * layout.cols + desk.col], 1, 'desk tile should be blocked');
  for (const seat of layout.seats) {
    assert.equal(blocked[seat.row * layout.cols + seat.col], 0, `${seat.id} should never be blocked`);
  }
});

test('wall decor and desktop items do not block the floor', () => {
  const index = buildAssetIndex(catalog);
  assert.equal(groupBlocks(index.get('WHITEBOARD')), false, 'wall decor hangs on an already-solid tile');
  assert.equal(groupBlocks(index.get('PC_FRONT_ON_1')), false, 'a monitor sits on a desk that already blocks');
  assert.equal(groupBlocks(index.get('CUSHIONED_CHAIR_FRONT')), false, 'a chair must be reachable to sit on');
  assert.equal(groupBlocks(index.get('DESK_FRONT')), true);
  assert.equal(groupBlocks(index.get('LARGE_PLANT')), true);
});

test('the neighbour mask reads N/E/S/W as bits 1/2/4/8', () => {
  const layout = { cols: 3, rows: 3, tiles: new Array(9).fill(TILE.FLOOR) };
  const isWall = (tile) => tile === TILE.WALL;

  assert.equal(neighbourMask(layout, 1, 1, isWall), 0, 'no wall neighbours');

  setTile(layout, 1, 0, TILE.WALL);
  assert.equal(neighbourMask(layout, 1, 1, isWall), 1, 'north only');
  setTile(layout, 2, 1, TILE.WALL);
  assert.equal(neighbourMask(layout, 1, 1, isWall), 1 | 2, 'north + east');
  setTile(layout, 1, 2, TILE.WALL);
  setTile(layout, 0, 1, TILE.WALL);
  assert.equal(neighbourMask(layout, 1, 1, isWall), 15, 'all four');
});

test('tiles beyond the map edge count as matching, so borders are not drawn as corners', () => {
  const layout = { cols: 2, rows: 2, tiles: new Array(4).fill(TILE.WALL) };
  assert.equal(neighbourMask(layout, 0, 0, (tile) => tile === TILE.WALL), 15);
});

test('a layout survives a save and load round trip', () => {
  const original = createDefaultLayout();
  const restored = deserializeLayout(JSON.parse(JSON.stringify(serializeLayout(original))));

  assert.ok(restored);
  assert.equal(restored.cols, original.cols);
  assert.equal(restored.rows, original.rows);
  assert.deepEqual(Array.from(restored.tiles), Array.from(original.tiles));
  assert.equal(restored.furniture.length, original.furniture.length);
  assert.equal(restored.seats.length, original.seats.length);
  assert.deepEqual(validateLayout(restored, catalog), []);
});

test('a stale or damaged stored layout is rejected instead of throwing', () => {
  const good = serializeLayout(createDefaultLayout());

  assert.equal(deserializeLayout(null), null);
  assert.equal(deserializeLayout('not an object'), null);
  assert.equal(deserializeLayout({ ...good, version: 99 }), null, 'a future version must not be guessed at');
  assert.equal(
    deserializeLayout({ ...good, version: 1 }),
    null,
    'version 1 placed monitors a tile higher and must not be reused',
  );
  assert.equal(deserializeLayout({ ...good, tiles: [1, 2, 3] }), null, 'tile count must match cols x rows');
  assert.equal(deserializeLayout({ ...good, seats: [] }), null, 'a layout with no seats has nobody to simulate');
  assert.equal(deserializeLayout({ ...good, cols: 0 }), null);
});

test('unknown tile values are coerced to floor rather than rendering as holes', () => {
  const stored = serializeLayout(createDefaultLayout());
  stored.tiles[0] = 999;
  const restored = deserializeLayout(stored);
  assert.equal(tileAt(restored, 0, 0), TILE.FLOOR);
});

test('validation reports a seat stranded behind furniture', () => {
  const layout = createDefaultLayout();
  const { inbox } = layout.landmarks;
  // Wall the inbox in on all four sides.
  for (const [dc, dr] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    setTile(layout, inbox.col + dc, inbox.row + dr, TILE.WALL);
  }
  const problems = validateLayout(layout, catalog);
  assert.ok(problems.length > 0, 'a sealed-off inbox must be reported');
  assert.ok(problems.some((problem) => problem.includes('inbox')));
});
