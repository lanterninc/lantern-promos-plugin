# Lantern Promos plugin for Claude

The [Lantern Promos](https://lanternpromos.com) plugin for Claude. It connects Claude to the Lantern Promos tool server and tells it to look for discount codes and sale prices whenever you shop.

## Install

In Claude Code (2.1.275 or later):

```
/plugin install lantern-promos --marketplace lanterninc/lantern-promos-plugin
```

In Perplexity, open **Plugins**, select **Add custom**, then **Import plugin from GitHub**, and paste the plugin folder's address:

```
https://github.com/lanterninc/lantern-promos-plugin/tree/main/plugins/lantern-promos
```

Paste the folder, not the repo: the repo's root holds the marketplace, not a plugin. Perplexity reads the same `plugin.json` and connector as Claude Code. More in [docs/publishing.md](docs/publishing.md#perplexity).

What it does and how to use it: [plugins/lantern-promos/README.md](plugins/lantern-promos/README.md).

## What is in this repo

| Path | What it holds |
| --- | --- |
| `plugins/lantern-promos/` | The plugin: its manifest and icon, the connector, one skill and two commands |
| `.claude-plugin/marketplace.json` | The marketplace that lists the plugin |
| `scripts/tools.mjs` | The server address and the tool names the plugin's wording may use |
| `scripts/validate.mjs` | Checks the repo before a release |
| `scripts/check-live.mjs` | Checks the live server still has the tools the plugin names |

## Contributing

Node 24 or later. There are no dependencies to install.

```bash
npm test             # the checks' own tests
npm run validate     # this repo against the checks
npm run check:live   # the live server against scripts/tools.mjs
claude plugin validate .
claude plugin validate ./plugins/lantern-promos
claude --plugin-dir ./plugins/lantern-promos   # try the plugin without installing it
```

Publishing steps are in [docs/publishing.md](docs/publishing.md). Issues and pull requests are welcome.

Maintained by [Lantern](https://lantern.is). Licensed under the [MIT License](LICENSE).
