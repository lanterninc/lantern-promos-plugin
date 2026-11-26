# Manual test checklist

Run these in a new Claude Code session before each release, and in Claude on the web once the plugin is listed there.

Load the plugin from a checkout with `claude --plugin-dir ./plugins/lantern-promos`, or install it with the line in the README.

1. Ask: "Is there a discount code for allbirds.com?"
   - Claude says it is checking Lantern Promos and calls `find_store_coupons`.
   - The reply gives a code with what it gives and its link, says whether a real cart accepted it, says the list can be incomplete, and names Lantern Promos as the source.
2. Ask for help buying from a store without mentioning a discount, for example: "I want to buy a pair of Tree Runners from allbirds.com. Anything I should know before I check out?"
   - Claude checks Lantern Promos anyway.
3. Run `/lantern-promos:codes allbirds.com`.
   - The same call and reply as step 1.
4. Run `/lantern-promos:deals running shoes`.
   - Claude calls `find_deals` and lists deals with their codes and links.

If Claude did not call the tool, or left part of the reply out, open an issue with the exact request and what Claude said.

## Perplexity

Import the plugin as [publishing.md](publishing.md#perplexity) describes. To try a branch before it is merged, paste its folder address, with the branch name in place of `main`. Then, in a new Perplexity Computer session:

1. Run steps 1 and 2 above. Perplexity's answer should do the same as Claude's.
2. If Perplexity says Lantern Promos is not connected, connect it under **Plugins** and run step 1 again.

Perplexity plugins carry skills and connectors, not commands, so skip steps 3 and 4 there.
