# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.10.0] - 2026-11-15

### Changed
- **Inventory now feeds the List's "full now" automatically.** Set your barn/silo
  size on the List tab and the "full now" values come straight from your
  inventory totals (and update live as inventory changes), so space-left is
  correct without entering it twice. A toggle ("'Full now' comes from my
  inventory", on by default) lets you switch back to manual entry. Replaced the
  old "Use as List's Full now" button with this automatic link.

## [2.9.0] - 2026-11-15

### Added
- **"Read all with AI" on the Inventory screen.** One button reads every attached
  screenshot into your inventory, one image at a time, with live progress. The
  per-image "Read with AI" still works too. Unmatched items collect into a single
  review list.

## [2.8.0] - 2026-11-15

### Changed
- **Screenshot reading now auto-adds to inventory.** Reading a screenshot adds
  every matched item straight to your inventory — no "Add selected" step and no
  Have/Need toggle (the whole screen is inventory now). Items it couldn't match
  wait in a short "review" list with an Add button.
- **Editable inventory quantities.** Type a count directly on any inventory row
  (0 removes it), in addition to the +/- steppers — handy for fixing counts the
  AI read as 1.

## [2.7.0] - 2026-11-15

### Added
- **Inventory-aware planning.** The planner now subtracts what's already in your
  inventory at every recipe level, so it shows only what you still need to gather
  (toggle off for the full recipe). Shows how many units your inventory covers,
  and celebrates when you already have everything.
- **Order screenshots → plan.** From an AI-read screenshot you can send the "need"
  items straight to the planner, which cross-references your inventory and tells
  you exactly what to produce/gather to fill the order.
- **Editable detected quantities.** Each AI-detected item now has an editable
  quantity field in the review list.

### Fixed
- AI reading parser is far more forgiving (handles code fences, bare arrays, and
  alternate field names), fixing "nothing found" on valid screenshots.

## [2.6.0] - 2026-11-15

### Changed
- **AI screenshot reading now runs through a private, password-gated server**
  instead of a per-user Anthropic key. The owner's Anthropic key lives only as a
  server secret (never in the page); turning on AI reading just takes an access
  password, entered once per device. Reads are limited to whoever has the
  password. Privacy policy updated to match.

## [2.5.0] - 2026-11-15

### Added
- **AI screenshot reading (bring your own key).** Enter your own Anthropic API key
  and the screenshot viewer gets a "Read with AI" button that auto-extracts the
  items and amounts from a shot and sorts them into Have (inventory) vs. Need
  (list), which you review and add with one tap. Key is stored only in your
  browser and sent only to Anthropic; manual logging still works with no key.
  Privacy policy updated to cover it.

## [2.4.0] - 2026-11-15

### Added
- **Inventory tab.** Track what you actually have, grouped by barn/silo with live
  space-used bars and +/- steppers. Saved on-device.
- **Screenshots.** Attach multiple screenshots (barn, silo, truck/boat orders, the
  newspaper) as a reference strip; tap one to view it full-screen and log items
  straight from it — "+ Have" adds to inventory, "+ Need" adds to your List.
  Images are downscaled and stored locally (IndexedDB), never uploaded.
- **Inventory <-> List links:** needed goods show a "have N" chip when they're in
  your inventory, and one tap feeds your inventory totals into the List's barn/silo
  "Full now". Per-tab help updated to cover the new tab.

## [2.3.0] - 2026-11-14

### Added
- **Privacy Policy and Terms of Use pages** (`privacy.html`, `terms.html`), linked
  from a new footer along with a GitHub link and a © HayDay Tool line.
- **Per-page help.** An ℹ️ button in the header opens a bottom sheet explaining
  what the current tab is for and how to use it — tailored to whichever tab
  you're on (Browse, Profit, Unlocks, Planner, List).

## [2.2.0] - 2026-11-14

### Added
- **Barn & silo "full now" tracking.** The checklist now takes both the storage
  *size* and how *full it is right now*, so each bar shows the current fill plus
  what the list still needs stacked against capacity, and tells you the free
  space now and what's left after you collect the list (or warns when it won't
  fit). Values persist and update live as you type. Copy/export reflects it too.
- **Live search dropdown.** The "Add a good" and planner inputs now show a
  tap-to-select suggestion list that filters item names as you type (with the
  machine shown), replacing the inconsistent native datalist. Arrow keys + Enter
  work on desktop; tap to pick on mobile.

## [2.1.0] - 2026-11-14

### Changed
- **Mobile-app redesign.** The web app now uses a native app shell: a sticky top
  app bar, a status strip, a scrollable content area, and a fixed bottom tab bar
  with icons (Browse · Profit · Unlocks · Planner · List) and a count badge.
  Result tables became tap-friendly list rows (name, machine chip, level/time,
  profit/hr, and a round "+" button), Browse gained a sort control, inputs and
  tap targets were enlarged for touch, and safe-area insets are respected. On
  desktop it renders as a centered phone frame. Added PWA/theme-color meta tags.

## [2.0.0] - 2026-11-13

### Added
- **HayDay Tool web app** (`index.html`) — a self-contained static page: browse
  all items with search/sort/filter, a best-profit finder, level-unlock lookups,
  and the needed-goods checklist with barn/silo space tracking and a one-tap
  copy export. Saves the list in the browser (localStorage). Reads live data
  from hayday.info via a CORS proxy with fallbacks, caching, and manual refresh.
- **Recipe Planner** — enter target products and quantities and get the full
  raw-material rollup (expanded recursively down to crops, tree/bush fruit, and
  animal products), totalled by barn/silo space, with copy-to-clipboard and
  "add raw materials to My List." Recipe data ships in `data/recipes.js`,
  sourced from the Hay Day Fandom Wiki (via drarvindc/hayday-tracker).
- Project logo (`assets/`).

The MCP server (below) is unchanged and remains available for AI clients.

## [1.2.0] - 2026-11-13

### Added
- `list_export` — returns the checklist as one clean, copy-paste-friendly text
  block (header with barn/silo space left, then goods grouped by storage with
  `[ ]` / `[x]` checkboxes).

### Changed
- Tool results that are plain strings are now returned verbatim instead of
  JSON-encoded, so exported text pastes cleanly.

## [1.1.0] - 2026-11-13

### Added
- **Needed-goods checklist** — a persistent storage planner. Add goods with
  amounts, check them off as you collect them, and see a running header with
  barn/silo capacity, space used, and space remaining (crops count against the
  silo; everything else against the barn). Seven new tools: `list_add`,
  `list_set_amount`, `list_check`, `list_remove`, `list_view`,
  `list_set_capacity`, `list_clear`.
- Checklist state persists to `HAYDAY_LIST_FILE` (default
  `~/.hayday-mcp/list.json`), written atomically.
- `list_add` / `list_set_amount` validate product names against live game data,
  so the list only ever holds real goods.

## [1.0.0] - 2026-11-13

### Added
- Initial release.
- MCP server over stdio (JSON-RPC 2.0, newline-delimited), zero runtime dependencies.
- Live data fetch from hayday.info with a 1-hour in-memory TTL cache.
- Eleven tools: `search_items`, `get_item`, `get_machines`, `get_by_machine`,
  `get_crops`, `get_animals`, `get_level_unlocks`, `get_unlocks_upto`,
  `get_best_profit`, `compare_profit`, `clear_cache`.
- `get_best_profit` accepts optional `maxLevel` and `machine` filters in
  addition to `limit` and `minLevel`, so "best crop up to level 15" is a single
  call.
- Data normalization strips the trailing zero-width characters present on some
  upstream product names.
- Smoke tests for the data/cache layer and the MCP protocol layer
  (`node --test`).
