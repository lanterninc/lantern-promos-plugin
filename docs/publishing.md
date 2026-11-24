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

## When the server changes

`scripts/tools.mjs` pins the server address and the tool names the skill and commands may use. When the Lantern Promos server adds, renames or removes a tool, update that list and the wording together.

`npm run check:live` exits 1 when the server no longer has a pinned tool, and 2 when the server could not be asked at all, which says nothing about the tools. The `live` workflow runs it every week and on every push to `main`.

GitHub pauses a scheduled workflow in a public repo after 60 days with no commits. When the repo has been quiet that long, turn `live` back on in the Actions tab, or run `npm run check:live` by hand. A failed scheduled run emails whoever last changed the schedule line in `live.yml`.
