<p align="center">
  <img src="assets/logo.svg" alt="HayDay Tool" width="620">
</p>

# HayDay Tool

[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-node%3Atest-informational)](test/)

**Live HayDay game data — crops, products, animals, machines, and level unlocks — exposed as MCP tools for any AI assistant.**

Works with Claude Desktop, Cursor, VS Code (Continue), opencode, and any MCP-compatible client.

> **Read-only. Not a bot.** This server only answers questions about game data — like a wiki your AI can query. It does not connect to the HayDay game, send inputs, automate gameplay, or play on your behalf.

## What it's for

HayDay has hundreds of items, recipes, and level gates, and keeping track of what to plant, craft, and unlock next is a chore. This server hands your AI assistant the full game data set so it can help you **plan your farm** — "what's worth making tonight," "what unlocks at my level," "which crop pays best" — without you digging through a wiki.

## How it works

```
AI client ──MCP/stdio──▶ HayDay MCP Server ──HTTPS──▶ hayday.info API ──▶ normalized data
                                   │
                          1-hour in-memory cache
```

Data is fetched **live** from [hayday.info](https://hayday.info) and cached in memory for one hour to stay friendly to the source. When Supercell updates the game and the source updates, your next cache refresh picks it up — no reinstall, no manual data files.

## Requirements

- **Node.js 18 or newer** (uses the built-in global `fetch` and `node:test` — no dependencies to install).

## Quick start

```bash
git clone https://github.com/biblestudytn26/HayDayTool.git
cd HayDayTool
npm install        # no deps, but runs any lifecycle scripts
npm test           # optional: verify everything works
node server.js     # starts and waits for an MCP client over stdio
```

Running `node server.js` directly just waits silently for a client to connect over stdio — that's expected. Point a client at it using one of the configs below.

## Tools

| Tool | What it returns | Arguments |
|------|-----------------|-----------|
| `search_items` | Items matching a name or machine (substring, case-insensitive) | `query` |
| `get_item` | Full details for one product | `product` |
| `get_machines` | All 48 machine / category names | — |
| `get_by_machine` | Every product from one machine | `machine` |
| `get_crops` | Field crops + trees & bushes | — |
| `get_animals` | Raw animal products (egg, milk, wool, bacon…) | — |
| `get_level_unlocks` | Everything that unlocks at a level | `level` |
| `get_unlocks_upto` | Everything available at or below a level | `level` |
| `get_best_profit` | Top items by profit/hour | `limit?`, `minLevel?`, `maxLevel?`, `machine?` |
| `compare_profit` | Several named products side by side | `products[]` |
| `clear_cache` | Force a live refresh on the next call | — |

Each item comes back with: `product`, `machine`, `level`, `price`, `time_min`, `xp`, `profit_per_hour`, `xp_per_hour`.

### Needed-goods checklist (storage planner)

A persistent checklist for the goods you need to gather — for boat crates, truck
orders, or anything else. Add goods with amounts, check them off as you collect
them, and watch your remaining storage space as the list grows. Field crops
count against your **silo**; everything else (tree/bush fruit, animal products,
all machine goods) counts against your **barn**.

| Tool | What it does | Arguments |
|------|--------------|-----------|
| `list_view` | Show the checklist + summary (capacity, used, remaining, collected vs. needed) | — |
| `list_add` | Add a good, or increase its amount | `product`, `amount?` |
| `list_set_amount` | Set a good's exact amount | `product`, `amount` |
| `list_check` | Mark a good collected / not collected | `product`, `checked?` |
| `list_remove` | Remove a good from the list | `product` |
| `list_set_capacity` | Set your barn / silo sizes | `barn?`, `silo?` |
| `list_clear` | Remove all goods (capacity kept) | — |
| `list_export` | Return the list as one clean text block to copy in one go | — |

The checklist is saved to disk so it survives between sessions. By default it
lives at `~/.hayday-mcp/list.json`; set the `HAYDAY_LIST_FILE` environment
variable to change that. Capacity defaults to 1000 barn / 1000 silo — set
`list_set_capacity` to your real barn and silo sizes so "space remaining" is
accurate.

### Example questions your AI can now answer

**"What's the best crop I can grow at level 15?"**
→ `get_best_profit({ maxLevel: 15, machine: "Crops" })`

**"Compare wheat, corn, and bread."**
→ `compare_profit({ products: ["Wheat", "Corn", "Bread"] })`

**"What do I unlock at level 30?"**
→ `get_level_unlocks({ level: 30 })`

**"Where do I make cheese and what's it worth?"**
→ `get_item({ product: "Cheese" })`

**"I need 20 bread and 50 wheat for orders — how much barn space is that?"**
→ `list_add({ product: "Bread", amount: 20 })`, `list_add({ product: "Wheat", amount: 50 })`, then `list_view()`

## Client setup

In every config below, set `cwd` (or the path in the command) to wherever you cloned this repo.

### Claude Desktop

Edit `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hayday-data": {
      "command": "node",
      "args": ["server.js"],
      "cwd": "/absolute/path/to/HayDayTool"
    }
  }
}
```

### Cursor

Settings → MCP → Add new server:

| Field | Value |
|-------|-------|
| Name | `hayday-data` |
| Type | `command` |
| Command | `node /absolute/path/to/HayDayTool/server.js` |

### VS Code (Continue)

Add to `~/.continue/config.json`:

```json
{
  "experimental": {
    "mcpServers": {
      "hayday-data": {
        "command": "node",
        "args": ["server.js"],
        "cwd": "/absolute/path/to/HayDayTool"
      }
    }
  }
}
```

### opencode

Add to `opencode.jsonc`:

```json
{
  "mcpServers": {
    "hayday-data": {
      "command": "node",
      "args": ["server.js"],
      "cwd": "/absolute/path/to/HayDayTool"
    }
  }
}
```

## Data source

All data comes from [hayday.info](https://hayday.info), a community-run HayDay database. The server reads its `/api/production-data` endpoint — a flat array of ~348 items across 48 machines/categories — and normalizes each entry.

**Included:** field crops, trees & bushes, raw animal products, all machine-made goods, unlock levels, price, production time, XP, and profit/hour and XP/hour (as provided by the source).

**Not included:** ingredient/recipe breakdowns (which items combine into a product), building upgrade costs, and derby/boat/town data.

A note on the data: some upstream product names carry trailing zero-width characters (the server strips them), and a few items have a negative `profit_per_hour` — those are kept and simply rank last.

## Project layout

```
HayDayTool/
  server.js          # MCP server: JSON-RPC over stdio, tool registry
  lib/
    hayday.js        # fetch, normalize, cache, and query the data
    cache.js         # tiny TTL cache
    list.js          # persistent needed-goods checklist / storage planner
  test/
    api.test.js      # data + cache layer (offline, uses a fixture)
    mcp.test.js      # MCP protocol layer + stdio end-to-end
    list.test.js     # checklist / storage planner (offline, temp file)
    fixture.js       # sample data for offline tests
  assets/            # logo (svg + png)
  package.json
  CHANGELOG.md
  LICENSE            # MIT
```

## Testing

```bash
npm test
```

Runs the full suite with Node's built-in test runner (`node --test`). Tests are offline — the protocol and data logic are exercised against a fixture, so no network call is needed to verify the build.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Client connects but tools return nothing | Wrong `cwd` / path in the client config | Point it at the absolute path of this folder |
| `API returned 429` or slow responses | Rate-limited by hayday.info | Wait — the 1-hour cache cools it down — or call `clear_cache` and retry |
| `Product not found` for a real item | Name mismatch (or stray characters) | Run `search_items` first to get the exact name |
| `Machine not found` | Name mismatch | Run `get_machines` for the exact 48 names |
| Server exits right after stdin closes | Normal — the stdio transport ended | Restart it; your client manages this for you |
| Data looks stale | Cache hit within the hour | Call `clear_cache` to force a live fetch |

## Contributing

1. Fork the repo.
2. Create a feature branch.
3. Run `npm test`.
4. Open a pull request.

## License

MIT — see [LICENSE](LICENSE).

## Legal notice

This project is an independent, read-only data tool and is **not affiliated with, endorsed by, or connected to Supercell Oy**. HayDay is a trademark of Supercell Oy. All game data is sourced from publicly available community resources. This tool does not interact with the HayDay game client, its servers, or its APIs, and is provided for informational and educational purposes only.
