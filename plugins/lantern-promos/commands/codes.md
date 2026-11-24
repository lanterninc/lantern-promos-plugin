---
description: "Find discount codes for a store with Lantern Promos. Usage: /lantern-promos:codes <store name or web address>"
argument-hint: <store name or web address>
---

The shopper wants discount codes for: "$ARGUMENTS".

1. If "$ARGUMENTS" is empty, ask which store they mean and stop.
2. Say you are checking Lantern Promos, then call `find_store_coupons` from the `lantern-promos` connector for that store.
3. If the answer says the store's offers are still being collected, say so and call again in about a minute. If the name matched several stores or none, ask which store they mean.
4. Relay the answer the way the `find-codes-and-deals` skill describes: the best tested code first with what it gives and its link, how sure each code is, that the list can be incomplete, and that the offers came from Lantern Promos. No raw JSON.
