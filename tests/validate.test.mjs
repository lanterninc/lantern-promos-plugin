// Fixtures are written to temp folders at run time, so this repo never commits the dash characters it checks for.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MCP_URL } from '../scripts/tools.mjs';
import { validate } from '../scripts/validate.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/validate.mjs', import.meta.url));
const PLUGIN = 'plugins/lantern-promos';
const EM = String.fromCharCode(0x2014);
const EN_ENTITY = '&' + 'ndash;';
const ALL_TOOLS = 'Call `find_store_coupons`, `find_deals` or `get_apply_link`.';
const roots = [];

afterEach(() => {
  while (roots.length) rmSync(roots.pop(), { recursive: true, force: true });
});

/** The first 33 bytes of a PNG: the signature and an IHDR chunk of the given size. Enough for the icon check. */
function pngHeader(width, height) {
  const bytes = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0);
  bytes.writeUInt32BE(13, 8);
  bytes.write('IHDR', 12, 'latin1');
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const skill = (name, description, body = ALL_TOOLS) => `---\nname: ${name}\ndescription: ${description}\n---\n\n# Title\n\n${body}\n`;
const command = (body) => `---\ndescription: "Find deals. Usage: /lantern-promos:deals <product>"\n---\n\n${body}\n`;
const README = `${Array.from({ length: 40 }, (_, index) => `word${index}`).join(' ')}\n`;
const MARKETPLACE = {
  name: 'lantern-promos',
  description: 'A marketplace.',
  owner: { name: 'Lantern', url: 'https://lantern.is' },
  plugins: [{ name: 'lantern-promos', source: `./${PLUGIN}`, description: 'A plugin.' }],
};
const MANIFEST = {
  name: 'lantern-promos',
  displayName: 'Lantern Promos',
  description: 'A plugin.',
  version: '0.1.0',
  author: { name: 'Lantern', url: 'https://lantern.is' },
  homepage: 'https://lanternpromos.com',
  privacyPolicyUrl: 'https://lantern.is/shopper-privacy',
  license: 'MIT',
};
const CONNECTOR = { mcpServers: { 'lantern-promos': { type: 'http', url: MCP_URL } } };

const MARKETPLACE_FILE = '.claude-plugin/marketplace.json';
const MANIFEST_FILE = `${PLUGIN}/.claude-plugin/plugin.json`;
const ICON_FILE = `${PLUGIN}/.claude-plugin/icon.png`;
const CONNECTOR_FILE = `${PLUGIN}/.mcp.json`;
const README_FILE = `${PLUGIN}/README.md`;
const SKILL_FILE = `${PLUGIN}/skills/find-things/SKILL.md`;
const COMMAND_FILE = `${PLUGIN}/commands/deals.md`;

/** A small repo that passes every check. A test changes one file to break one rule; null removes a file. */
function makeRepo(changes = {}) {
  const root = mkdtempSync(join(tmpdir(), 'promos-plugin-validate-'));
  roots.push(root);
  const files = {
    [MARKETPLACE_FILE]: json(MARKETPLACE),
    [MANIFEST_FILE]: json(MANIFEST),
    [ICON_FILE]: pngHeader(1024, 1024),
    [CONNECTOR_FILE]: json(CONNECTOR),
    [README_FILE]: README,
    [SKILL_FILE]: skill('find-things', 'Use when someone is buying something online.'),
    [COMMAND_FILE]: command('Call `find_deals`.'),
    ...changes,
  };
  for (const [path, content] of Object.entries(files)) {
    if (content === null) continue;
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

const messages = (root) => validate(root).map((problem) => `${problem.file}: ${problem.message}`);

// Each case: what it proves, the one change that breaks the good repo, and every problem expected, in order.
const CASES = [
  ['a well-formed repo has no problems', {}, []],

  ['a missing marketplace is reported', { [MARKETPLACE_FILE]: null }, [`${MARKETPLACE_FILE}: file is missing`]],
  ['a marketplace that is not valid JSON is a problem, not a crash', { [MARKETPLACE_FILE]: '{ "name": ' }, [`${MARKETPLACE_FILE}: not a valid JSON object`]],
  ['a marketplace with no owner address is reported', { [MARKETPLACE_FILE]: json({ ...MARKETPLACE, owner: { name: 'Lantern' } }) }, [`${MARKETPLACE_FILE}: owner.url must be an https address`]],
  ['a plugin source that is not a folder is reported', { [MARKETPLACE_FILE]: json({ ...MARKETPLACE, plugins: [{ ...MARKETPLACE.plugins[0], source: './plugins/missing' }] }) }, [`${MARKETPLACE_FILE}: plugin source ./plugins/missing is not a folder`]],

  ['a manifest that is not valid JSON is a problem, not a crash', { [MANIFEST_FILE]: '{ "name": ' }, [`${MANIFEST_FILE}: not a valid JSON object`]],
  ['a manifest name that differs from the marketplace entry is reported', { [MANIFEST_FILE]: json({ ...MANIFEST, name: 'other' }) }, [`${MANIFEST_FILE}: name must equal the marketplace entry name`]],
  ['a manifest with no displayName is reported', { [MANIFEST_FILE]: json({ ...MANIFEST, displayName: undefined }) }, [`${MANIFEST_FILE}: displayName is missing`]],
  ['a version that is not three numbers is reported', { [MANIFEST_FILE]: json({ ...MANIFEST, version: '1.0' }) }, [`${MANIFEST_FILE}: version must be three numbers, for example 0.1.0`]],
  ['a privacy link that is not https is reported', { [MANIFEST_FILE]: json({ ...MANIFEST, privacyPolicyUrl: 'http://lantern.is/shopper-privacy' }) }, [`${MANIFEST_FILE}: privacyPolicyUrl must be an https address`]],

  ['a second connector is reported', { [CONNECTOR_FILE]: json({ mcpServers: { ...CONNECTOR.mcpServers, other: { type: 'http', url: 'https://example.com/mcp' } } }) }, [`${CONNECTOR_FILE}: mcpServers must hold exactly one server, named lantern-promos`]],
  ['a connector address with a variable is reported', { [CONNECTOR_FILE]: json({ mcpServers: { 'lantern-promos': { type: 'http', url: '${PROMOS_MCP_URL:-https://mcp.lanternpromos.com/mcp}' } } }) }, [`${CONNECTOR_FILE}: the server url must be ${MCP_URL}`]],
  ['a connector that is not http is reported', { [CONNECTOR_FILE]: json({ mcpServers: { 'lantern-promos': { type: 'sse', url: MCP_URL } } }) }, [`${CONNECTOR_FILE}: the server type must be http`]],

  ['a missing icon is reported', { [ICON_FILE]: null }, [`${ICON_FILE}: file is missing`]],
  ['an icon that is not a PNG is reported', { [ICON_FILE]: 'this is not a png file at all, only some text' }, [`${ICON_FILE}: not a PNG`]],
  ['an icon that is not square is reported', { [ICON_FILE]: pngHeader(1024, 512) }, [`${ICON_FILE}: must be square, found 1024 by 512`]],
  ['an icon under 512 pixels is reported', { [ICON_FILE]: pngHeader(256, 256) }, [`${ICON_FILE}: must be 512 to 2048 pixels wide, found 256`]],
  ['an icon of 2 MB or more is reported', { [ICON_FILE]: Buffer.concat([pngHeader(1024, 1024), Buffer.alloc(2 * 1024 * 1024)]) }, [`${ICON_FILE}: must be under 2 MB`]],

  ['a listing README under 40 words is reported', { [README_FILE]: 'Too short.\n' }, [`${README_FILE}: needs at least 40 words, found 2`]],

  ['a skill folder with no SKILL.md is reported, and its tools count as unnamed', { [SKILL_FILE]: null, [`${PLUGIN}/skills/find-things/notes.md`]: 'x\n' }, [
    `${PLUGIN}/skills/find-things: skill folder has no SKILL.md`,
    `${PLUGIN}/skills: no skill names the tool find_store_coupons`,
    `${PLUGIN}/skills: no skill names the tool find_deals`,
    `${PLUGIN}/skills: no skill names the tool get_apply_link`,
  ]],
  ['a skill with no frontmatter is reported', { [SKILL_FILE]: `# Title\n\n${ALL_TOOLS}\n` }, [`${SKILL_FILE}: missing frontmatter`]],
  ['a skill whose name differs from its folder is reported', { [SKILL_FILE]: skill('other-name', 'Use when someone is buying something online.') }, [`${SKILL_FILE}: name must equal folder name`]],
  ['a skill description that does not start with Use when is reported', { [SKILL_FILE]: skill('find-things', 'Helps with shopping.') }, [`${SKILL_FILE}: description must start with "Use when"`]],
  ['an unquoted skill description with a colon and a space is reported', { [SKILL_FILE]: skill('find-things', 'Use when shopping online: buying things.') }, [`${SKILL_FILE}: an unquoted description must not contain a colon followed by a space`]],
  ['a skill description over 200 characters is reported', { [SKILL_FILE]: skill('find-things', `Use when ${'x'.repeat(200)}`) }, [`${SKILL_FILE}: description exceeds 200 characters`]],
  ['a skill saved with Windows line endings is read like any other', { [SKILL_FILE]: skill('find-things', 'Use when someone is buying something online.').replaceAll('\n', '\r\n') }, []],

  ['a command with no frontmatter is reported', { [COMMAND_FILE]: 'Call `find_deals`.\n' }, [`${COMMAND_FILE}: missing frontmatter`]],
  ['a command with an empty description is reported', { [COMMAND_FILE]: '---\ndescription:\n---\n\nCall `find_deals`.\n' }, [`${COMMAND_FILE}: missing description`]],

  ['a tool the pinned list does not have is reported', { [COMMAND_FILE]: command('Call `find_coupon_codes`.') }, [`${COMMAND_FILE}: find_coupon_codes is not a tool in scripts/tools.mjs`]],
  ['a tool named with its connector prefix is still checked', { [COMMAND_FILE]: command('Call `mcp__plugin_lantern-promos_lantern-promos__find_everything`.') }, [`${COMMAND_FILE}: find_everything is not a tool in scripts/tools.mjs`]],
  ['a pinned tool named with its connector prefix passes', { [COMMAND_FILE]: command('Call `mcp__plugin_lantern-promos_lantern-promos__find_deals`.') }, []],
  ['a pinned tool that no skill names is reported', { [SKILL_FILE]: skill('find-things', 'Use when someone is buying something online.', 'Call `find_store_coupons` or `find_deals`.') }, [`${PLUGIN}/skills: no skill names the tool get_apply_link`]],

  ['an em dash is reported', { [README_FILE]: `${README}A line ${EM} with a dash.\n` }, [`${README_FILE}: em dash (U+2014)`]],
  ['a dash entity is reported', { [SKILL_FILE]: skill('find-things', 'Use when someone is buying something online.', `Wait 1${EN_ENTITY}2 minutes. ${ALL_TOOLS}`) }, [`${SKILL_FILE}: en dash entity`]],
];

for (const [name, changes, expected] of CASES) {
  test(name, () => {
    assert.deepEqual(messages(makeRepo(changes)), expected);
  });
}

test('a problem carries the line it was found on', () => {
  const root = makeRepo({ [README_FILE]: `${README}A line ${EM} with a dash.\n` });
  assert.deepEqual(validate(root), [{ file: README_FILE, line: 2, message: 'em dash (U+2014)' }]);
});

test('the command prints each problem and exits 1', () => {
  const root = makeRepo({ [README_FILE]: 'Too short.\n' });
  const run = spawnSync(process.execPath, [SCRIPT, root], { encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.equal(run.stdout, `${README_FILE}:1: needs at least 40 words, found 2\n`);
});

test('the command exits 0 on a repo with no problems', () => {
  const run = spawnSync(process.execPath, [SCRIPT, makeRepo()], { encoding: 'utf8' });
  assert.equal(run.status, 0);
  assert.equal(run.stdout, 'No problems found.\n');
});
