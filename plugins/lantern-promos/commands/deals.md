---
description: "Find products on sale with a code that applies, using Lantern Promos. Usage: /lantern-promos:deals <product>"
argument-hint: <product>
---

The shopper wants deals on: "$ARGUMENTS".

1. If "$ARGUMENTS" is empty, ask what they are shopping for and stop.
2. Say you are checking Lantern Promos, then call `find_deals` from the `lantern-promos` connector. Send the request the way the tool's inputs ask for it.
3. Relay the answer the way the `find-codes-and-deals` skill describes: the best matches with their codes and links, how sure each code is, that the list can be incomplete, and that the deals came from Lantern Promos. No raw JSON.
4. Offer to test a code on the item they pick. That is `get_apply_link`.
