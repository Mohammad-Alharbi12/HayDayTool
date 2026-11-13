'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Point the checklist at a throwaway temp file BEFORE requiring the module,
// so these tests never touch the real ~/.hayday-mcp/list.json.
const TMP = path.join(os.tmpdir(), `hayday-list-test-${process.pid}.json`);
process.env.HAYDAY_LIST_FILE = TMP;

const list = require('../lib/list');

function reset() {
  try { fs.rmSync(TMP, { force: true }); } catch { /* ignore */ }
}

test.beforeEach(reset);
test.after(reset);

test('a fresh list is empty with default capacity', () => {
  const v = list.view();
  assert.equal(v.items.length, 0);
  assert.equal(v.totals.total_units, 0);
  assert.deepEqual(v.capacity, list.DEFAULT_CAPACITY);
});

test('storageOf: field crops go to the silo, everything else to the barn', () => {
  assert.equal(list.storageOf('Crops'), 'silo');
  assert.equal(list.storageOf('crops'), 'silo');
  assert.equal(list.storageOf('Trees & Bushes'), 'barn');
  assert.equal(list.storageOf('Bakery'), 'barn');
  assert.equal(list.storageOf('Animal Products'), 'barn');
});

test('list_add inserts a good and increments on repeat', () => {
  list.addOrUpdate({ product: 'Bread', machine: 'Bakery', amount: 2 });
  let v = list.addOrUpdate({ product: 'Bread', machine: 'Bakery', amount: 3 });
  assert.equal(v.items.length, 1);
  assert.equal(v.items[0].amount, 5);
  assert.equal(v.items[0].storage, 'barn');
});

test('set mode replaces the amount instead of adding', () => {
  list.addOrUpdate({ product: 'Bread', machine: 'Bakery', amount: 5 });
  const v = list.addOrUpdate({ product: 'Bread', machine: 'Bakery', amount: 2, mode: 'set' });
  assert.equal(v.items[0].amount, 2);
});

test('used/remaining split barn vs silo correctly', () => {
  list.addOrUpdate({ product: 'Wheat', machine: 'Crops', amount: 100 });
  list.addOrUpdate({ product: 'Bread', machine: 'Bakery', amount: 40 });
  const v = list.view();
  assert.equal(v.used.silo, 100);
  assert.equal(v.used.barn, 40);
  assert.equal(v.remaining.silo, list.DEFAULT_CAPACITY.silo - 100);
  assert.equal(v.remaining.barn, list.DEFAULT_CAPACITY.barn - 40);
  assert.equal(v.totals.total_units, 140);
});

test('checking a good updates collected vs needed counts', () => {
  list.addOrUpdate({ product: 'Bread', machine: 'Bakery', amount: 10 });
  let res = list.setChecked('bread', true); // case-insensitive
  assert.equal(res.found, true);
  assert.equal(res.summary.totals.collected_units, 10);
  assert.equal(res.summary.totals.needed_units, 0);
  res = list.setChecked('Bread', false);
  assert.equal(res.summary.totals.collected_units, 0);
  assert.equal(res.summary.totals.needed_units, 10);
});

test('checking a good that is not on the list reports found=false', () => {
  const res = list.setChecked('Ghost Item', true);
  assert.equal(res.found, false);
});

test('remove deletes a good', () => {
  list.addOrUpdate({ product: 'Bread', machine: 'Bakery', amount: 1 });
  const res = list.remove('bread');
  assert.equal(res.found, true);
  assert.equal(res.summary.items.length, 0);
});

test('setCapacity changes storage limits', () => {
  const v = list.setCapacity({ barn: 500, silo: 250 });
  assert.equal(v.capacity.barn, 500);
  assert.equal(v.capacity.silo, 250);
});

test('over_capacity is reported when a store is oversubscribed', () => {
  list.setCapacity({ barn: 30 });
  list.addOrUpdate({ product: 'Bread', machine: 'Bakery', amount: 50 });
  const v = list.view();
  assert.equal(v.remaining.barn, -20);
  assert.equal(v.over_capacity.barn, 20);
});

test('clearItems empties the list but keeps capacity', () => {
  list.setCapacity({ barn: 777 });
  list.addOrUpdate({ product: 'Bread', machine: 'Bakery', amount: 1 });
  const v = list.clearItems();
  assert.equal(v.items.length, 0);
  assert.equal(v.capacity.barn, 777);
});

test('exportText renders a copy-friendly block with checkboxes and totals', () => {
  list.setCapacity({ barn: 50, silo: 200 });
  list.addOrUpdate({ product: 'Bread', machine: 'Bakery', amount: 20 });
  list.addOrUpdate({ product: 'Wheat', machine: 'Crops', amount: 100 });
  list.setChecked('Bread', true);
  const text = list.exportText();
  assert.match(text, /HayDay . Needed Goods/);
  assert.match(text, /Barn: 20\/50 used/);
  assert.match(text, /Silo: 100\/200 used/);
  assert.match(text, /BARN/);
  assert.match(text, /SILO/);
  assert.match(text, /\[x\] 20. Bread/);
  assert.match(text, /\[ \] 100. Wheat/);
});

test('exportText handles an empty list', () => {
  const text = list.exportText();
  assert.match(text, /\(list is empty\)/);
});

test('state persists across calls (written to disk)', () => {
  list.addOrUpdate({ product: 'Corn', machine: 'Crops', amount: 12 });
  // A separate view() call reloads from the file.
  const v = list.view();
  assert.equal(v.items[0].product, 'Corn');
  assert.equal(v.items[0].amount, 12);
  assert.ok(fs.existsSync(TMP));
});
