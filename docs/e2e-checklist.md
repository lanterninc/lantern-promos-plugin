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
