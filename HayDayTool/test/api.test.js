'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { TTLCache } = require('../lib/cache');
const hay = require('../lib/hayday');
// The fixture mirrors RAW upstream data; normalize it exactly as getData() does.
const DATA = require('./fixture').map(hay.normalize);

/* -------------------------- cache -------------------------- */

test('cache stores and returns a value', () => {
  const c = new TTLCache(1000);
  c.set('k', 42);
  assert.equal(c.get('k'), 42);
  assert.equal(c.has('k'), true);
});

test('cache returns undefined for a missing key', () => {
  const c = new TTLCache(1000);
  assert.equal(c.get('nope'), undefined);
  assert.equal(c.has('nope'), false);
});

test('cache expires entries after the TTL', () => {
  const c = new TTLCache(5);
  c.set('k', 'v');
  return new Promise((resolve) => {
    setTimeout(() => {
      assert.equal(c.get('k'), undefined);
      resolve();
    }, 20);
  });
});

test('cache clear() empties the store', () => {
  const c = new TTLCache(1000);
  c.set('a', 1);
  c.set('b', 2);
  c.clear();
  assert.equal(c.size, 0);
});

test('cache rejects a non-positive TTL', () => {
  assert.throws(() => new TTLCache(0));
  assert.throws(() => new TTLCache(-1));
});

/* -------------------------- clean / normalize -------------------------- */

test('clean strips zero-width characters and trims', () => {
  assert.equal(hay.clean('Ginger​​'), 'Ginger');
  assert.equal(hay.clean('  Bread  '), 'Bread');
});

test('clean passes non-strings through', () => {
  assert.equal(hay.clean(5), 5);
  assert.equal(hay.clean(null), null);
});

test('normalize produces the expected shape and cleans the product name', () => {
  const n = hay.normalize({
    level: 45, machine: 'Bakery', price: 403, product: 'Pizza​',
    profit_per_hour: 94.1, time_min: 12, xp: 48, xp_per_hour: 225.8,
  });
  assert.equal(n.product, 'Pizza');
  assert.deepEqual(Object.keys(n).sort(), [
    'level', 'machine', 'price', 'product', 'profit_per_hour', 'time_min', 'xp', 'xp_per_hour',
  ].sort());
});

/* -------------------------- search / lookup -------------------------- */

test('search matches product name (case-insensitive)', () => {
  const r = hay.search(DATA, 'bread');
  const names = r.map((i) => i.product);
  assert.ok(names.includes('Bread'));
  assert.ok(names.includes('Corn bread'));
});

test('search matches machine name', () => {
  const r = hay.search(DATA, 'bakery');
  assert.ok(r.every((i) => i.machine === 'Bakery'));
  assert.equal(r.length, 3);
});

test('search returns empty for a blank query', () => {
  assert.deepEqual(hay.search(DATA, ''), []);
});

test('findItem prefers an exact match', () => {
  const item = hay.findItem(DATA, 'corn');
  assert.equal(item.product, 'Corn'); // not "Corn bread"
});

test('findItem falls back to substring', () => {
  const item = hay.findItem(DATA, 'frutti');
  assert.equal(item.product, 'Frutti di Mare pizza');
});

test('findItem returns null when nothing matches', () => {
  assert.equal(hay.findItem(DATA, 'zzzzz'), null);
});

/* -------------------------- machines / categories -------------------------- */

test('distinctMachines is deduplicated and sorted', () => {
  const m = hay.distinctMachines(DATA);
  assert.deepEqual(m, ['Animal Products', 'Bakery', 'Crops', 'Dairy', 'Trees & Bushes']);
});

test('byMachine is case-insensitive and exact', () => {
  const r = hay.byMachine(DATA, 'dairy');
  assert.equal(r.length, 1);
  assert.equal(r[0].product, 'Cheese');
});

test('crops include Crops and Trees & Bushes', () => {
  const r = hay.crops(DATA).map((i) => i.product).sort();
  assert.deepEqual(r, ['Apple', 'Corn', 'Wheat']);
});

test('animals include only raw Animal Products', () => {
  const r = hay.animals(DATA).map((i) => i.product).sort();
  assert.deepEqual(r, ['Egg', 'Milk']);
});

/* -------------------------- levels -------------------------- */

test('levelUnlocks returns items at exactly that level', () => {
  const r = hay.levelUnlocks(DATA, 1).map((i) => i.product).sort();
  assert.deepEqual(r, ['Corn', 'Egg', 'Wheat']);
});

test('unlocksUpto is inclusive and ordered by level', () => {
  const r = hay.unlocksUpto(DATA, 2);
  assert.ok(r.every((i) => i.level <= 2));
  for (let k = 1; k < r.length; k++) assert.ok(r[k].level >= r[k - 1].level);
});

/* -------------------------- profit -------------------------- */

test('bestProfit sorts descending and respects limit', () => {
  const r = hay.bestProfit(DATA, { limit: 2 });
  assert.equal(r.length, 2);
  assert.ok(r[0].profit_per_hour >= r[1].profit_per_hour);
  assert.equal(r[0].product, 'Frutti di Mare pizza');
});

test('bestProfit honors maxLevel + machine (best crop up to level 15)', () => {
  const r = hay.bestProfit(DATA, { maxLevel: 15, machine: 'Crops' });
  assert.ok(r.every((i) => i.machine === 'Crops' && i.level <= 15));
  assert.equal(r[0].product, 'Corn');
});

test('bestProfit keeps negative-profit items (ranked last)', () => {
  const r = hay.bestProfit(DATA, { machine: 'Trees & Bushes' });
  assert.equal(r[0].product, 'Apple');
  assert.ok(r[0].profit_per_hour < 0);
});

/* -------------------------- compare -------------------------- */

test('compare returns one row per requested product', () => {
  const r = hay.compare(DATA, ['Wheat', 'Corn', 'Bread']);
  assert.equal(r.length, 3);
  assert.equal(r[0].product, 'Wheat');
});

test('compare flags products that do not exist', () => {
  const r = hay.compare(DATA, ['Wheat', 'Nonexistent']);
  assert.equal(r[1].error, 'not found');
});
