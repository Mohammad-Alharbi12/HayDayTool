#!/usr/bin/env node
'use strict';

/**
 * HayDay Data MCP server.
 *
 * A read-only Model Context Protocol server that serves live HayDay game data
 * (crops, products, animals, machines, level unlocks, profit) as MCP tools.
 * Speaks JSON-RPC 2.0 over stdio with newline-delimited messages and has zero
 * runtime dependencies.
 *
 * This is a data lookup tool. It does NOT interact with the HayDay game, send
 * inputs, or automate gameplay.
 */

const hayday = require('./lib/hayday');
const list = require('./lib/list');

const SERVER_INFO = { name: 'hayday-data', version: '1.2.0' };
const PROTOCOL_VERSION = '2024-11-05';

/* --------------------------------------------------------------------------
 * Tool registry
 *
 * Each tool declares its MCP metadata (description + JSON Schema) and a handler
 * that returns a plain JS value. The transport layer below turns that value
 * into an MCP `content` payload.
 * ------------------------------------------------------------------------ */

const TOOLS = [
  {
    name: 'search_items',
    description:
      'Search items by product name or machine. Case-insensitive substring match. ' +
      'Example queries: "wheat", "bakery", "cheese".',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text to match against product name or machine.' },
      },
      required: ['query'],
    },
    handler: (args) => hayday.searchItems(args.query),
  },
  {
    name: 'get_item',
    description: 'Full details for a specific product (e.g. "Bread"). Exact match preferred, falls back to substring.',
    inputSchema: {
      type: 'object',
      properties: {
        product: { type: 'string', description: 'Product name to look up.' },
      },
      required: ['product'],
    },
    handler: async (args) => {
      const item = await hayday.getItem(args.product);
      if (!item) {
        return { error: `Product not found: "${args.product}". Try search_items to find the exact name.` };
      }
      return item;
    },
  },
  {
    name: 'get_machines',
    description: 'List all distinct machine / category names (there are 48).',
    inputSchema: { type: 'object', properties: {} },
    handler: () => hayday.getMachines(),
  },
  {
    name: 'get_by_machine',
    description: 'All products made by a given machine (e.g. "Dairy", "Bakery", "Crops"). Use get_machines for exact names.',
    inputSchema: {
      type: 'object',
      properties: {
        machine: { type: 'string', description: 'Exact machine / category name.' },
      },
      required: ['machine'],
    },
    handler: async (args) => {
      const items = await hayday.getByMachine(args.machine);
      if (items.length === 0) {
        return { error: `Machine not found: "${args.machine}". Use get_machines for exact names.` };
      }
      return items;
    },
  },
  {
    name: 'get_crops',
    description: 'All field crops plus trees & bushes.',
    inputSchema: { type: 'object', properties: {} },
    handler: () => hayday.getCrops(),
  },
  {
    name: 'get_animals',
    description: 'All raw animal products (eggs, milk, wool, bacon, etc.).',
    inputSchema: { type: 'object', properties: {} },
    handler: () => hayday.getAnimals(),
  },
  {
    name: 'get_level_unlocks',
    description: 'Everything that unlocks at a specific level.',
    inputSchema: {
      type: 'object',
      properties: {
        level: { type: 'integer', description: 'Exact unlock level.', minimum: 1 },
      },
      required: ['level'],
    },
    handler: (args) => hayday.getLevelUnlocks(args.level),
  },
  {
    name: 'get_unlocks_upto',
    description: 'Everything available at or below a level, ordered by unlock level.',
    inputSchema: {
      type: 'object',
      properties: {
        level: { type: 'integer', description: 'Maximum unlock level (inclusive).', minimum: 1 },
      },
      required: ['level'],
    },
    handler: (args) => hayday.getUnlocksUpto(args.level),
  },
  {
    name: 'get_best_profit',
    description:
      'Top items by profit/hour. Optionally bound the unlock level range and restrict to one machine. ' +
      'For "best crop at level 15", pass { maxLevel: 15, machine: "Crops" }.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'How many to return (default 10).', minimum: 1 },
        minLevel: { type: 'integer', description: 'Only items unlocked at or above this level (default 1).', minimum: 1 },
        maxLevel: { type: 'integer', description: 'Only items unlocked at or below this level.', minimum: 1 },
        machine: { type: 'string', description: 'Restrict to one machine, e.g. "Crops".' },
      },
    },
    handler: (args) => hayday.getBestProfit(args || {}),
  },
  {
    name: 'compare_profit',
    description: 'Compare profit/time/XP for specific products side by side.',
    inputSchema: {
      type: 'object',
      properties: {
        products: {
          type: 'array',
          items: { type: 'string' },
          description: 'Product names to compare, e.g. ["Wheat", "Corn", "Bread"].',
        },
      },
      required: ['products'],
    },
    handler: (args) => hayday.compareProfit(args.products),
  },
  {
    name: 'clear_cache',
    description: 'Force a refresh from the live source on the next call (bypasses the 1-hour cache).',
    inputSchema: { type: 'object', properties: {} },
    handler: () => hayday.clearCache(),
  },

  /* ----- Needed-goods checklist (persistent storage planner) ----- */
  {
    name: 'list_add',
    description:
      'Add a good you need to your checklist (or increase its amount). Validates the name against ' +
      'live game data and classifies it into barn or silo. Shows updated space remaining.',
    inputSchema: {
      type: 'object',
      properties: {
        product: { type: 'string', description: 'Product name, e.g. "Bread".' },
        amount: { type: 'integer', description: 'How many you need (added to any existing amount). Default 1.', minimum: 1 },
      },
      required: ['product'],
    },
    handler: async (args) => {
      const found = await hayday.getItem(args.product);
      if (!found) {
        return { error: `Product not found: "${args.product}". Use search_items to find the exact name.` };
      }
      return list.addOrUpdate({
        product: found.product,
        machine: found.machine,
        amount: args.amount ?? 1,
        mode: 'inc',
      });
    },
  },
  {
    name: 'list_set_amount',
    description: 'Set the exact amount needed for a good already on your checklist.',
    inputSchema: {
      type: 'object',
      properties: {
        product: { type: 'string', description: 'Product name as it appears on the list.' },
        amount: { type: 'integer', description: 'Exact amount needed (replaces the current amount).', minimum: 1 },
      },
      required: ['product', 'amount'],
    },
    handler: async (args) => {
      // Resolve so a fresh item gets the right machine; existing ones just update.
      const found = await hayday.getItem(args.product);
      if (!found) {
        return { error: `Product not found: "${args.product}". Use search_items to find the exact name.` };
      }
      return list.addOrUpdate({
        product: found.product,
        machine: found.machine,
        amount: args.amount,
        mode: 'set',
      });
    },
  },
  {
    name: 'list_check',
    description: 'Mark a good on your checklist as collected (or uncollected with checked=false).',
    inputSchema: {
      type: 'object',
      properties: {
        product: { type: 'string', description: 'Product name as it appears on the list.' },
        checked: { type: 'boolean', description: 'true = collected (default), false = still needed.' },
      },
      required: ['product'],
    },
    handler: (args) => {
      const res = list.setChecked(args.product, args.checked !== false);
      if (!res.found) return { error: `"${args.product}" is not on your list. Add it with list_add.` };
      return res.summary;
    },
  },
  {
    name: 'list_remove',
    description: 'Remove a good from your checklist entirely.',
    inputSchema: {
      type: 'object',
      properties: {
        product: { type: 'string', description: 'Product name as it appears on the list.' },
      },
      required: ['product'],
    },
    handler: (args) => {
      const res = list.remove(args.product);
      if (!res.found) return { error: `"${args.product}" is not on your list.` };
      return res.summary;
    },
  },
  {
    name: 'list_view',
    description:
      'Show your needed-goods checklist with the summary header: barn/silo capacity, space used, ' +
      'space remaining, and collected vs. still-needed counts.',
    inputSchema: { type: 'object', properties: {} },
    handler: () => list.view(),
  },
  {
    name: 'list_set_capacity',
    description:
      'Set your barn and/or silo capacity so the checklist can show how much space you have left.',
    inputSchema: {
      type: 'object',
      properties: {
        barn: { type: 'integer', description: 'Barn capacity (holds everything except field crops).', minimum: 0 },
        silo: { type: 'integer', description: 'Silo capacity (holds field crops).', minimum: 0 },
      },
    },
    handler: (args) => list.setCapacity(args || {}),
  },
  {
    name: 'list_clear',
    description: 'Remove all goods from your checklist (your capacity settings are kept).',
    inputSchema: { type: 'object', properties: {} },
    handler: () => list.clearItems(),
  },
  {
    name: 'list_export',
    description:
      'Return the whole checklist as one clean, copy-paste-friendly text block — a header with ' +
      'barn/silo space left, then goods grouped by storage with [ ] / [x] checkboxes. Copy it in one go.',
    inputSchema: { type: 'object', properties: {} },
    handler: () => list.exportText(),
  },
];

const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]));

/* --------------------------------------------------------------------------
 * JSON-RPC method handlers
 * ------------------------------------------------------------------------ */

async function handleRequest(msg) {
  const { id, method, params } = msg;

  switch (method) {
    case 'initialize':
      return {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      };

    case 'ping':
      return {};

    case 'tools/list':
      return {
        tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
      };

    case 'tools/call': {
      const name = params && params.name;
      const args = (params && params.arguments) || {};
      const tool = TOOL_MAP.get(name);
      if (!tool) {
        return rpcError(id, -32602, `Unknown tool: ${name}`);
      }
      try {
        const result = await tool.handler(args);
        const isError = result && typeof result === 'object' && 'error' in result && Object.keys(result).length === 1;
        // Strings are returned verbatim (e.g. the copy-paste export); objects are JSON.
        const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
        return {
          content: [{ type: 'text', text }],
          isError: Boolean(isError),
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }

    default:
      // Unknown notification (no id) → ignore; unknown request → method-not-found.
      if (id === undefined || id === null) return undefined;
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

function rpcError(id, code, message) {
  return { __rpcError: true, id, error: { code, message } };
}

/* --------------------------------------------------------------------------
 * stdio transport: newline-delimited JSON-RPC 2.0
 * ------------------------------------------------------------------------ */

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

async function dispatch(msg) {
  // Notifications have no `id` and expect no response.
  const isNotification = msg.id === undefined || msg.id === null;

  const result = await handleRequest(msg);
  if (result === undefined) return; // nothing to send (e.g. a notification)

  if (result && result.__rpcError) {
    send({ jsonrpc: '2.0', id: result.id, error: result.error });
    return;
  }

  if (isNotification) return;
  send({ jsonrpc: '2.0', id: msg.id, result });
}

function startStdioServer() {
  let buffer = '';

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;

      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
        continue;
      }
      // Fire and forget; responses are ordered by the OS write queue.
      dispatch(msg).catch((err) => {
        if (msg && msg.id !== undefined && msg.id !== null) {
          send({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: err.message } });
        }
      });
    }
  });

  // stdio transport ended — exit cleanly.
  process.stdin.on('end', () => process.exit(0));
}

if (require.main === module) {
  startStdioServer();
}

module.exports = { TOOLS, TOOL_MAP, handleRequest, SERVER_INFO, PROTOCOL_VERSION };
