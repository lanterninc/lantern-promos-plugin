#!/usr/bin/env node
// Checks the repo before a release or a directory submission: the marketplace, the plugin manifest, the connector,
// the icon, the listing README, skill and command frontmatter, the tool names the wording uses, and no em or en
// dashes (or the HTML entities that render as them) in any text file.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { MCP_SERVER_KEY, MCP_URL, TOOLS } from './tools.mjs';

const SKIPPED_DIRS = new Set(['.git', 'node_modules']);
// Built from character codes and parts, so this file never holds the characters or entities it looks for.
const DASHES = [
  [String.fromCharCode(0x2014), 'em dash (U+2014)'],
  [String.fromCharCode(0x2013), 'en dash (U+2013)'],
];
const AMP = '&';
const DASH_ENTITIES = [
  [new RegExp(`${AMP}mdash;|${AMP}#8212;|${AMP}#x2014;`, 'i'), 'em dash entity'],
  [new RegExp(`${AMP}ndash;|${AMP}#8211;|${AMP}#x2013;`, 'i'), 'en dash entity'],
];
// Claude apps accept 200 characters in a skill description.
const MAX_SKILL_DESCRIPTION = 200;
// The Claude directory's limits for a listing.
const MIN_README_WORDS = 40;
const ICON_MIN = 512;
const ICON_MAX = 2048;
const ICON_MAX_BYTES = 2 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// A tool name in backticks: lower case words joined by underscores, with or without a connector prefix that ends in "__".
const TOOL_MENTION = /`(?:[A-Za-z0-9_-]+__)?([a-z]+(?:_[a-z]+)+)`/g;

const rel = (rootDir, path) => relative(rootDir, path).split(sep).join('/');
const splitLines = (text) => text.split(/\r?\n/);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;

function isHttps(value) {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) walk(join(dir, entry.name), out);
    } else if (entry.isFile()) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

/** A file's text, or null for a binary file. */
function readText(path) {
  const buffer = readFileSync(path);
  return buffer.includes(0) ? null : buffer.toString('utf8');
}

/** A JSON object read from a file, or null after reporting why it could not be read. */
function readJson(rootDir, file, problems) {
  const path = join(rootDir, file);
  if (!existsSync(path)) {
    problems.push({ file, line: 0, message: 'file is missing' });
    return null;
  }
  try {
    const value = JSON.parse(readFileSync(path, 'utf8'));
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('not an object');
    return value;
  } catch {
    problems.push({ file, line: 1, message: 'not a valid JSON object' });
    return null;
  }
}

/** A Markdown file's frontmatter fields, each with its value, whether it was quoted, and its line. Null when there is none. */
function frontmatter(lines) {
  if (lines[0] !== '---') return null;
  const fields = {};
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') return fields;
    const match = /^([A-Za-z_-]+):\s*(.*)$/.exec(lines[i]);
    if (!match) continue;
    const quoted = /^(["']).*\1$/.test(match[2]);
    fields[match[1]] = { value: quoted ? match[2].slice(1, -1) : match[2], quoted, line: i + 1 };
  }
  return null;
}

/** Checks the marketplace and returns each plugin it lists whose folder exists. */
function checkMarketplace(rootDir, problems) {
  const file = '.claude-plugin/marketplace.json';
  const marketplace = readJson(rootDir, file, problems);
  if (!marketplace) return [];
  const problem = (message) => problems.push({ file, line: 1, message });
  for (const key of ['name', 'description']) {
    if (!isText(marketplace[key])) problem(`${key} is missing`);
  }
  if (!isText(marketplace.owner?.name)) problem('owner.name is missing');
  if (!isHttps(marketplace.owner?.url)) problem('owner.url must be an https address');
  if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length === 0) {
    problem('plugins is empty');
    return [];
  }
  const plugins = [];
  for (const entry of marketplace.plugins) {
    if (!isText(entry?.name) || !isText(entry?.source) || !isText(entry?.description)) {
      problem('every plugin needs a name, a source and a description');
      continue;
    }
    const dir = join(rootDir, entry.source);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      problem(`plugin source ${entry.source} is not a folder`);
      continue;
    }
    plugins.push({ dir, name: entry.name });
  }
  return plugins;
}

function checkManifest(rootDir, plugin, problems) {
  const file = rel(rootDir, join(plugin.dir, '.claude-plugin/plugin.json'));
  const manifest = readJson(rootDir, file, problems);
  if (!manifest) return;
  const problem = (message) => problems.push({ file, line: 1, message });
  for (const key of ['name', 'displayName', 'description', 'license']) {
    if (!isText(manifest[key])) problem(`${key} is missing`);
  }
  if (isText(manifest.name) && manifest.name !== plugin.name) problem('name must equal the marketplace entry name');
  if (!isText(manifest.author?.name)) problem('author.name is missing');
  if (typeof manifest.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    problem('version must be three numbers, for example 0.1.0');
  }
  for (const key of ['homepage', 'privacyPolicyUrl']) {
    if (!isHttps(manifest[key])) problem(`${key} must be an https address`);
  }
}

function checkConnector(rootDir, plugin, problems) {
  const file = rel(rootDir, join(plugin.dir, '.mcp.json'));
  const config = readJson(rootDir, file, problems);
  if (!config) return;
  const problem = (message) => problems.push({ file, line: 1, message });
  const servers = config.mcpServers !== null && typeof config.mcpServers === 'object' ? config.mcpServers : {};
  const keys = Object.keys(servers);
  if (keys.length !== 1 || keys[0] !== MCP_SERVER_KEY) {
    problem(`mcpServers must hold exactly one server, named ${MCP_SERVER_KEY}`);
    return;
  }
  const server = servers[MCP_SERVER_KEY];
  if (server?.type !== 'http') problem('the server type must be http');
  // An exact match, so an address with a variable, a user name or another host can never reach the directory.
  if (server?.url !== MCP_URL) problem(`the server url must be ${MCP_URL}`);
}

function checkIcon(rootDir, plugin, problems) {
  const path = join(plugin.dir, '.claude-plugin/icon.png');
  const file = rel(rootDir, path);
  const problem = (message) => problems.push({ file, line: 0, message });
  if (!existsSync(path)) {
    problem('file is missing');
    return;
  }
  const bytes = readFileSync(path);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE) || bytes.toString('latin1', 12, 16) !== 'IHDR') {
    problem('not a PNG');
    return;
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== height) problem(`must be square, found ${width} by ${height}`);
  else if (width < ICON_MIN || width > ICON_MAX) problem(`must be ${ICON_MIN} to ${ICON_MAX} pixels wide, found ${width}`);
  if (bytes.length >= ICON_MAX_BYTES) problem('must be under 2 MB');
}

function checkListingReadme(rootDir, plugin, problems) {
  const path = join(plugin.dir, 'README.md');
  const file = rel(rootDir, path);
  if (!existsSync(path)) {
    problems.push({ file, line: 0, message: 'file is missing' });
    return;
  }
  const words = readFileSync(path, 'utf8').split(/\s+/).filter((word) => /[A-Za-z0-9]/.test(word));
  if (words.length < MIN_README_WORDS) {
    problems.push({ file, line: 1, message: `needs at least ${MIN_README_WORDS} words, found ${words.length}` });
  }
}

function checkSkill(file, folder, lines, problems) {
  const fields = frontmatter(lines);
  if (!fields) {
    problems.push({ file, line: 1, message: 'missing frontmatter' });
    return;
  }
  const { name, description } = fields;
  if (!name || name.value !== folder) problems.push({ file, line: name?.line ?? 1, message: 'name must equal folder name' });
  if (!description || !description.value.trim()) {
    problems.push({ file, line: description?.line ?? 1, message: 'missing description' });
    return;
  }
  const problem = (message) => problems.push({ file, line: description.line, message });
  if (!description.value.startsWith('Use when')) problem('description must start with "Use when"');
  if (!description.quoted && description.value.includes(': ')) problem('an unquoted description must not contain a colon followed by a space');
  if (description.value.length > MAX_SKILL_DESCRIPTION) problem(`description exceeds ${MAX_SKILL_DESCRIPTION} characters`);
}

function checkCommand(file, lines, problems) {
  const fields = frontmatter(lines);
  if (!fields) {
    problems.push({ file, line: 1, message: 'missing frontmatter' });
    return;
  }
  if (!fields.description || !fields.description.value.trim()) {
    problems.push({ file, line: fields.description?.line ?? 1, message: 'missing description' });
  }
}

/** Checks a plugin's skills and commands, and that the tools they name are the pinned ones. */
function checkWording(rootDir, plugin, problems) {
  const namedBySkills = new Set();
  const checkTools = (file, lines, fromSkill) => {
    lines.forEach((content, index) => {
      for (const match of content.matchAll(TOOL_MENTION)) {
        if (!TOOLS.includes(match[1])) problems.push({ file, line: index + 1, message: `${match[1]} is not a tool in scripts/tools.mjs` });
        else if (fromSkill) namedBySkills.add(match[1]);
      }
    });
  };

  const skillsDir = join(plugin.dir, 'skills');
  const skillFolders = existsSync(skillsDir) ? readdirSync(skillsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()) : [];
  for (const entry of skillFolders) {
    const path = join(skillsDir, entry.name, 'SKILL.md');
    if (!existsSync(path)) {
      problems.push({ file: rel(rootDir, join(skillsDir, entry.name)), line: 0, message: 'skill folder has no SKILL.md' });
      continue;
    }
    const file = rel(rootDir, path);
    const lines = splitLines(readFileSync(path, 'utf8'));
    checkSkill(file, entry.name, lines, problems);
    checkTools(file, lines, true);
  }

  const commandsDir = join(plugin.dir, 'commands');
  const commandFiles = existsSync(commandsDir) ? readdirSync(commandsDir).filter((name) => name.endsWith('.md')) : [];
  for (const name of commandFiles) {
    const path = join(commandsDir, name);
    const file = rel(rootDir, path);
    const lines = splitLines(readFileSync(path, 'utf8'));
    checkCommand(file, lines, problems);
    checkTools(file, lines, false);
  }

  for (const tool of TOOLS) {
    if (!namedBySkills.has(tool)) problems.push({ file: rel(rootDir, skillsDir), line: 0, message: `no skill names the tool ${tool}` });
  }
}

function checkDashes(rootDir, problems) {
  for (const path of walk(rootDir)) {
    const text = readText(path);
    if (text === null) continue;
    const file = rel(rootDir, path);
    splitLines(text).forEach((content, index) => {
      for (const [character, message] of DASHES) {
        if (content.includes(character)) problems.push({ file, line: index + 1, message });
      }
      for (const [pattern, message] of DASH_ENTITIES) {
        if (pattern.test(content)) problems.push({ file, line: index + 1, message });
      }
    });
  }
}

/** @returns {{ file: string, line: number, message: string }[]} */
export function validate(rootDir) {
  const problems = [];
  for (const plugin of checkMarketplace(rootDir, problems)) {
    checkManifest(rootDir, plugin, problems);
    checkConnector(rootDir, plugin, problems);
    checkIcon(rootDir, plugin, problems);
    checkListingReadme(rootDir, plugin, problems);
    checkWording(rootDir, plugin, problems);
  }
  checkDashes(rootDir, problems);
  return problems;
}

function main() {
  // The repo this script lives in, so the check does not depend on the folder it is run from.
  const root = process.argv[2] ?? fileURLToPath(new URL('..', import.meta.url));
  if (!statSync(root).isDirectory()) throw new Error(`not a directory: ${root}`);
  const problems = validate(root);
  for (const problem of problems) console.log(`${problem.file}:${problem.line}: ${problem.message}`);
  if (problems.length === 0) console.log('No problems found.');
  process.exitCode = problems.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
