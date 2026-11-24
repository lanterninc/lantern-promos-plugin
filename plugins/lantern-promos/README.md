# Lantern Promos

Lantern Promos finds discount codes and sale prices while you shop with Claude. It collects codes from online stores and tests many of them on real carts, so Claude can tell you which code worked, what it gives, and open the store with it applied.

It is free and needs no account.

## Install

In Claude Code (2.1.275 or later):

```
/plugin install lantern-promos --marketplace lanterninc/lantern-promos-plugin
```

On older versions, add the marketplace first:

```
claude plugin marketplace add lanterninc/lantern-promos-plugin
/plugin install lantern-promos
```

The plugin connects Claude to `https://mcp.lanternpromos.com/mcp`. There is nothing to sign in to.

Using Claude on the web, desktop or phone? Add Lantern Promos as a connector with the link at https://lanternpromos.com/#claude.

## Use it

Shop as you normally would. When you are about to buy something online, Claude checks Lantern Promos for a code. You can also ask:

- "Is there a code that works at allbirds.com?"
- "Find me a deal on running shoes."
- "Test the codes on these and give me the link."

| Command | What it does |
| --- | --- |
| `/lantern-promos:codes <store>` | Lists the discount codes Lantern Promos has for a store |
| `/lantern-promos:deals <product>` | Finds products on sale, each with a code that applies |

## What to expect

- Claude tells you whether a real cart accepted a code and when it was last checked. An untested code is called untested.
- Claude gives you a link that opens the store with the code applied. You complete the purchase yourself.
- Claude does not make up codes, and it says when the list may be incomplete.

## Privacy

Claude sends Lantern Promos the store or product you ask about and, when you ask it to test a code, the items you picked. How Lantern handles that: https://lantern.is/shopper-privacy

Made by [Lantern](https://lantern.is). MIT License.
