# Publishing

The plugin installs straight from this repo, so what is on `main` is what shoppers get.

## Every change

```bash
npm test
npm run validate
npm run check:live
claude plugin validate .
claude plugin validate ./plugins/lantern-promos
```

Then run the steps in [e2e-checklist.md](e2e-checklist.md) with `claude --plugin-dir ./plugins/lantern-promos`.

## Claude directory listing

Submit at https://claude.ai/directory/manage as a **Plugin bundle**: source `lanterninc/lantern-promos-plugin`, path `plugins/lantern-promos`. A Claude org Owner, or a role with the Directory permission, submits.

- One submission is allowed per repo and folder, so later versions update this one.
- The listing is read from `plugins/lantern-promos/.claude-plugin/plugin.json` (`displayName`, `description`, `privacyPolicyUrl`), the `icon.png` beside it, and `plugins/lantern-promos/README.md`.
- The directory refuses a connector address it cannot read for certain, such as one with a variable in it. `npm run validate` fails on anything but the one fixed address.
- Bump `version` in `plugin.json` for every listing update.
- Once the plugin is listed, change the "Using Claude on the web, desktop or phone?" paragraph in the listing README to the directory install.

## Perplexity

Perplexity installs the plugin folder as it is. With no `plugin.json` at a package's root, it reads `.claude-plugin/plugin.json`, so this repo keeps one manifest for both. It needs only `name` from the manifest, and a `description` of up to 1,024 characters. It takes the connector from `.mcp.json` and the skill from `skills/`. Perplexity plugins carry skills and connectors, not commands, so `/lantern-promos:codes` and `/lantern-promos:deals` work in Claude Code only. The skill covers the same requests.

`npm run validate` checks Perplexity's limits: up to 32 skills, 1,000 files and 20 MB in the plugin folder. It also checks that no `plugin.json` or `mcp.json` sits at the folder's root, where Perplexity would read it ahead of the Claude Code files.

To install it for yourself, open **Plugins**, select **Add custom**, then **Import plugin from GitHub**, and paste `https://github.com/lanterninc/lantern-promos-plugin/tree/main/plugins/lantern-promos`. Only public repos can be imported, and the folder address is needed because the repo's root has no plugin. To install it for an organization, an admin uploads a `.zip` under **Organization settings**, **Plugins and skills**, **Upload plugin**:

```bash
cd plugins && zip -r ../lantern-promos.zip lantern-promos -x '*.DS_Store'
```

To update an uploaded plugin, open it, select **More actions**, then **Replace file**.

- Perplexity shows the plugin as `lantern-promos` with a generic icon and "by lanterninc", since it reads neither `displayName`, `icon.png` nor `author`.
- Perplexity's Discover tab lists only plugins Perplexity publishes, and it has no submission process for others yet.
- A plugin with skills needs a Perplexity plan that includes Perplexity Computer.
- In an organization, members need an admin to allow personal plugins and custom connectors.

## When the server changes

`scripts/tools.mjs` pins the server address and the tool names the skill and commands may use. When the Lantern Promos server adds, renames or removes a tool, update that list and the wording together.

`npm run check:live` exits 1 when the server no longer has a pinned tool, and 2 when the server could not be asked at all, which says nothing about the tools. The `live` workflow runs it every week and on every push to `main`.

GitHub pauses a scheduled workflow in a public repo after 60 days with no commits. When the repo has been quiet that long, turn `live` back on in the Actions tab, or run `npm run check:live` by hand. A failed scheduled run emails whoever last changed the schedule line in `live.yml`.
