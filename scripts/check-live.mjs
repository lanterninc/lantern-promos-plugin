#!/usr/bin/env node
// Asks the live Lantern Promos tool server for its tools and compares them with the names this plugin uses.
// Exit 0: every pinned tool is served. Exit 1: the server no longer has a pinned tool. Exit 2: the server could
// not be asked, which says nothing about the tools either way.
import { isMain } from './is-main.mjs';
import { MCP_URL, TOOLS } from './tools.mjs';

const TIMEOUT_MS = 30_000;

/** Which pinned tools the server lacks, and which server tools the plugin does not name. */
export function compareTools(pinned, live) {
  return {
    missing: pinned.filter((name) => !live.includes(name)),
    extra: live.filter((name) => !pinned.includes(name)),
  };
}

/** The tool names in a tool list answer. Throws when the answer is an error or not a tool list. */
export function toolNamesFrom(body) {
  if (body?.error) throw new Error(`the server answered with an error: ${body.error.message ?? 'unknown'}`);
  const tools = body?.result?.tools;
  if (!Array.isArray(tools) || tools.some((tool) => typeof tool?.name !== 'string')) throw new Error('the answer is not a tool list');
  return tools.map((tool) => tool.name);
}

/** Asks the server for its tool names. */
export async function fetchToolNames(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'user-agent': 'lantern-promos-plugin-check',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`the server answered ${response.status}`);
  return toolNamesFrom(await response.json());
}

async function main() {
  const url = process.argv[2] ?? MCP_URL;
  let live;
  try {
    live = await fetchToolNames(url);
  } catch (error) {
    console.error(`Could not check ${url}: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
    return;
  }
  const { missing, extra } = compareTools(TOOLS, live);
  for (const name of extra) console.log(`Note: the server also has ${name}, which the plugin does not name.`);
  for (const name of missing) console.error(`The server no longer has ${name}, which the plugin names.`);
  if (missing.length === 0) console.log(`All ${TOOLS.length} tools the plugin names are served by ${url}.`);
  process.exitCode = missing.length ? 1 : 0;
}

if (isMain(import.meta.url)) await main();
