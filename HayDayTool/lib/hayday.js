'use strict';

const { TTLCache } = require('./cache');

/**
 * Data layer for the HayDay MCP server.
 *
 * Fetches live production data from hayday.info, normalizes it, caches it for
 * one hour, and exposes query helpers. The query helpers come in two flavors:
 *
 *   - Pure functions (search, findItem, byMachine, ...) operate on an array you
 *     pass in. They do no I/O, so they're trivial to unit-test.
 *   - async wrappers (searchItems, getItem, ...) load the cached data set and
 *     delegate to the pure function.
 *
 * The upstream endpoint returns a flat JSON array; each element looks like:
 *   { level, machine, price, product, profit_per_hour, time_min, xp, xp_per_hour }
 * There is no category grouping — `machine` doubles as the category. Some
 * `product` strings carry trailing zero-width characters, and some
 * `profit_per_hour` values are negative. Both are handled below.
 */

const API_URL = 'https://hayday.info/api/production-data';
const CACHE_KEY = 'production-data';
const TTL_MS = 60 * 60 * 1000; // 1 hour

// Machines that represent things you grow vs. raw animal products.
const CROP_MACHINES = ['crops', 'trees & bushes'];
const ANIMAL_MACHINES = ['animal products'];

// Zero-width / bidi control characters that pollute some product names.
const ZERO_WIDTH = /[​-‏‪-‮⁠﻿]/g;

const cache = new TTLCache(TTL_MS);

/** Strip zero-width characters and trim. Non-strings pass through unchanged. */
function clean(value) {
  if (typeof value !== 'string') return value;
  return value.replace(ZERO_WIDTH, '').trim();
}

/** Normalize one raw API item into a clean, predictable shape. */
function normalize(raw) {
  return {
    product: clean(raw.product),
    machine: clean(raw.machine),
    level: raw.level,
    price: raw.price,
    time_min: raw.time_min,
    xp: raw.xp,
    profit_per_hour: raw.profit_per_hour,
    xp_per_hour: raw.xp_per_hour,
  };
}

/* --------------------------------------------------------------------------
 * Fetching + caching
 * ------------------------------------------------------------------------ */

/** Fetch and normalize the raw array from the upstream API. */
async function fetchData() {
  let res;
  try {
    res = await fetch(API_URL, {
      headers: { accept: 'application/json', 'user-agent': 'hayday-mcp-server' },
    });
  } catch (err) {
    throw new Error(`Failed to reach hayday.info: ${err.message}`);
  }
  if (!res.ok) {
    throw new Error(`API returned ${res.status} ${res.statusText}`);
  }
  const body = await res.json();
  if (!Array.isArray(body)) {
    throw new Error('Unexpected API response: expected a JSON array');
  }
  return body.map(normalize).filter((item) => item.product);
}

/** Return the cached data set, fetching + caching it on a miss. */
async function getData() {
  const cached = cache.get(CACHE_KEY);
  if (cached) return cached;
  const data = await fetchData();
  cache.set(CACHE_KEY, data);
  return data;
}

/** Force the next getData() to re-fetch from the live source. */
function clearCache() {
  cache.clear();
  return { cleared: true };
}

/* --------------------------------------------------------------------------
 * Pure query functions (no I/O — take the data array as the first argument)
 * ------------------------------------------------------------------------ */

/** Case-insensitive substring match on product name OR machine. */
function search(data, query) {
  const q = clean(String(query ?? '')).toLowerCase();
  if (!q) return [];
  return data.filter(
    (i) => i.product.toLowerCase().includes(q) || i.machine.toLowerCase().includes(q)
  );
}

/** Find a single product: exact (case-insensitive) match first, then substring. */
function findItem(data, product) {
  const q = clean(String(product ?? '')).toLowerCase();
  if (!q) return null;
  return (
    data.find((i) => i.product.toLowerCase() === q) ||
    data.find((i) => i.product.toLowerCase().includes(q)) ||
    null
  );
}

/** Sorted list of distinct machine/category names. */
function distinctMachines(data) {
  return [...new Set(data.map((i) => i.machine))].sort((a, b) => a.localeCompare(b));
}

/** All products made by an exact (case-insensitive) machine name. */
function byMachine(data, machine) {
  const q = clean(String(machine ?? '')).toLowerCase();
  return data.filter((i) => i.machine.toLowerCase() === q);
}

/** Field crops + trees & bushes. */
function crops(data) {
  return data.filter((i) => CROP_MACHINES.includes(i.machine.toLowerCase()));
}

/** Raw animal products (eggs, milk, wool, bacon, ...). */
function animals(data) {
  return data.filter((i) => ANIMAL_MACHINES.includes(i.machine.toLowerCase()));
}

/** Everything unlocked AT exactly this level. */
function levelUnlocks(data, level) {
  const n = Number(level);
  return data.filter((i) => i.level === n).sort((a, b) => a.product.localeCompare(b.product));
}

/** Everything unlocked AT OR BELOW this level, ordered by unlock level. */
function unlocksUpto(data, level) {
  const n = Number(level);
  return data
    .filter((i) => typeof i.level === 'number' && i.level <= n)
    .sort((a, b) => a.level - b.level || a.product.localeCompare(b.product));
}

/**
 * Top items by profit/hour.
 * @param {object} opts
 * @param {number} [opts.limit=10]
 * @param {number} [opts.minLevel=1]   include items unlocked at >= this level
 * @param {number} [opts.maxLevel]     include items unlocked at <= this level
 * @param {string} [opts.machine]      restrict to one machine (e.g. "Crops")
 */
function bestProfit(data, { limit = 10, minLevel = 1, maxLevel = Infinity, machine = null } = {}) {
  let items = data.filter(
    (i) =>
      typeof i.profit_per_hour === 'number' &&
      typeof i.level === 'number' &&
      i.level >= minLevel &&
      i.level <= maxLevel
  );
  if (machine) {
    const m = clean(String(machine)).toLowerCase();
    items = items.filter((i) => i.machine.toLowerCase() === m);
  }
  items.sort((a, b) => b.profit_per_hour - a.profit_per_hour);
  const n = Number(limit);
  return items.slice(0, Number.isFinite(n) && n > 0 ? n : 10);
}

/** Look up several named products and return them side by side. */
function compare(data, products) {
  const list = Array.isArray(products) ? products : [];
  return list.map((p) => {
    const found = findItem(data, p);
    return found || { product: String(p), error: 'not found' };
  });
}

/* --------------------------------------------------------------------------
 * async wrappers used by the MCP server
 * ------------------------------------------------------------------------ */

async function searchItems(query) {
  return search(await getData(), query);
}
async function getItem(product) {
  return findItem(await getData(), product);
}
async function getMachines() {
  return distinctMachines(await getData());
}
async function getByMachine(machine) {
  return byMachine(await getData(), machine);
}
async function getCrops() {
  return crops(await getData());
}
async function getAnimals() {
  return animals(await getData());
}
async function getLevelUnlocks(level) {
  return levelUnlocks(await getData(), level);
}
async function getUnlocksUpto(level) {
  return unlocksUpto(await getData(), level);
}
async function getBestProfit(opts) {
  return bestProfit(await getData(), opts);
}
async function compareProfit(products) {
  return compare(await getData(), products);
}

module.exports = {
  // constants
  API_URL,
  CROP_MACHINES,
  ANIMAL_MACHINES,
  // low-level
  clean,
  normalize,
  fetchData,
  getData,
  clearCache,
  // pure
  search,
  findItem,
  distinctMachines,
  byMachine,
  crops,
  animals,
  levelUnlocks,
  unlocksUpto,
  bestProfit,
  compare,
  // async wrappers
  searchItems,
  getItem,
  getMachines,
  getByMachine,
  getCrops,
  getAnimals,
  getLevelUnlocks,
  getUnlocksUpto,
  getBestProfit,
  compareProfit,
};
