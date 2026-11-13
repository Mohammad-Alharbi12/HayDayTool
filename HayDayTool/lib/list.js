'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/**
 * Persistent "what do I need to collect" checklist for HayDay.
 *
 * Each entry is a good you need, an amount, and whether you've collected it yet.
 * The summary header shows how many units are planned against your barn/silo
 * capacity, so you can watch your remaining space as you add to the list.
 *
 * HayDay storage rules:
 *   - Field crops (machine "Crops") live in the SILO.
 *   - Everything else — tree & bush fruit, animal products, machine goods —
 *     lives in the BARN.
 *
 * State is persisted as JSON. The file path is HAYDAY_LIST_FILE if set,
 * otherwise ~/.hayday-mcp/list.json. Writes are atomic (temp file + rename).
 */

const LIST_FILE =
  process.env.HAYDAY_LIST_FILE || path.join(os.homedir(), '.hayday-mcp', 'list.json');

const DEFAULT_CAPACITY = { barn: 1000, silo: 1000 };

/** Which storage a machine's output occupies. */
function storageOf(machine) {
  return String(machine || '').toLowerCase() === 'crops' ? 'silo' : 'barn';
}

function emptyState() {
  return { capacity: { ...DEFAULT_CAPACITY }, items: [] };
}

/** Load state from disk, tolerating a missing or corrupt file. */
function load() {
  let state;
  try {
    state = JSON.parse(fs.readFileSync(LIST_FILE, 'utf8'));
  } catch {
    return emptyState();
  }
  // Defensive shape-fixing so a hand-edited file can't crash us.
  if (!state || typeof state !== 'object') return emptyState();
  if (!state.capacity || typeof state.capacity !== 'object') state.capacity = { ...DEFAULT_CAPACITY };
  if (typeof state.capacity.barn !== 'number') state.capacity.barn = DEFAULT_CAPACITY.barn;
  if (typeof state.capacity.silo !== 'number') state.capacity.silo = DEFAULT_CAPACITY.silo;
  if (!Array.isArray(state.items)) state.items = [];
  return state;
}

/** Persist state atomically. */
function save(state) {
  const dir = path.dirname(LIST_FILE);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${LIST_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, LIST_FILE);
  return state;
}

/** Find an item index by product name (case-insensitive). */
function indexOf(state, product) {
  const q = String(product || '').trim().toLowerCase();
  return state.items.findIndex((it) => it.product.toLowerCase() === q);
}

/** Build the summary header + item view from a state object. */
function summarize(state) {
  const used = { barn: 0, silo: 0 };
  let totalUnits = 0;
  let collectedUnits = 0;

  const items = state.items.map((it) => {
    const storage = storageOf(it.machine);
    used[storage] += it.amount;
    totalUnits += it.amount;
    if (it.checked) collectedUnits += it.amount;
    return { ...it, storage };
  });

  const remaining = {
    barn: state.capacity.barn - used.barn,
    silo: state.capacity.silo - used.silo,
  };

  return {
    capacity: state.capacity,
    used,
    remaining,
    over_capacity: {
      barn: remaining.barn < 0 ? -remaining.barn : 0,
      silo: remaining.silo < 0 ? -remaining.silo : 0,
    },
    totals: {
      distinct_items: state.items.length,
      total_units: totalUnits,
      collected_units: collectedUnits,
      needed_units: totalUnits - collectedUnits,
    },
    items,
    list_file: LIST_FILE,
  };
}

/* --------------------------------------------------------------------------
 * Mutations — each loads, changes, saves, and returns the fresh summary.
 * The server resolves a product's real name + machine (against live game data)
 * before calling addOrUpdate, so the list only ever holds valid goods.
 * ------------------------------------------------------------------------ */

/**
 * Add a good (or adjust an existing one).
 * @param {{product:string, machine:string, amount?:number, mode?:'inc'|'set'}} opts
 */
function addOrUpdate({ product, machine, amount = 1, mode = 'inc' }) {
  const n = Math.max(1, Math.floor(Number(amount) || 1));
  const state = load();
  const idx = indexOf(state, product);
  if (idx === -1) {
    state.items.push({ product, machine, amount: n, checked: false });
  } else {
    state.items[idx].amount = mode === 'set' ? n : state.items[idx].amount + n;
    if (machine) state.items[idx].machine = machine; // refresh classification
  }
  return summarize(save(state));
}

/** Remove a good from the list. Returns {found, summary}. */
function remove(product) {
  const state = load();
  const idx = indexOf(state, product);
  if (idx === -1) return { found: false, summary: summarize(state) };
  state.items.splice(idx, 1);
  return { found: true, summary: summarize(save(state)) };
}

/** Mark a good collected / not collected. Returns {found, summary}. */
function setChecked(product, checked = true) {
  const state = load();
  const idx = indexOf(state, product);
  if (idx === -1) return { found: false, summary: summarize(state) };
  state.items[idx].checked = Boolean(checked);
  return { found: true, summary: summarize(save(state)) };
}

/** Set barn and/or silo capacity. */
function setCapacity({ barn, silo } = {}) {
  const state = load();
  if (Number.isFinite(barn)) state.capacity.barn = Math.max(0, Math.floor(barn));
  if (Number.isFinite(silo)) state.capacity.silo = Math.max(0, Math.floor(silo));
  return summarize(save(state));
}

/** Remove all items (capacity is kept). */
function clearItems() {
  const state = load();
  state.items = [];
  return summarize(save(state));
}

/** Current checklist + summary header. */
function view() {
  return summarize(load());
}

/**
 * Render the checklist as a single clean, copy-paste-friendly text block:
 * a header with capacity / space left, then goods grouped by storage with
 * [ ] / [x] checkboxes.
 */
function formatText(state) {
  const s = summarize(state);
  const date = new Date().toISOString().slice(0, 10);
  const lines = [`HayDay — Needed Goods (${date})`, ''];

  const over = (store) => (s.over_capacity[store] ? ` — OVER by ${s.over_capacity[store]}` : '');
  lines.push(`Barn: ${s.used.barn}/${s.capacity.barn} used · ${s.remaining.barn} left${over('barn')}`);
  lines.push(`Silo: ${s.used.silo}/${s.capacity.silo} used · ${s.remaining.silo} left${over('silo')}`);
  lines.push(
    `Collected ${s.totals.collected_units}/${s.totals.total_units} units · ${s.totals.distinct_items} items`
  );

  if (s.items.length === 0) {
    lines.push('', '(list is empty)');
    return lines.join('\n');
  }

  for (const store of ['barn', 'silo']) {
    const group = s.items.filter((i) => i.storage === store);
    if (group.length === 0) continue;
    lines.push('', store.toUpperCase());
    for (const it of group) {
      lines.push(`[${it.checked ? 'x' : ' '}] ${it.amount}× ${it.product}`);
    }
  }
  return lines.join('\n');
}

/** Load and render the checklist as copy-paste text. */
function exportText() {
  return formatText(load());
}

module.exports = {
  LIST_FILE,
  DEFAULT_CAPACITY,
  storageOf,
  summarize,
  load,
  save,
  addOrUpdate,
  remove,
  setChecked,
  setCapacity,
  clearItems,
  view,
  formatText,
  exportText,
};
