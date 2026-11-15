# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
