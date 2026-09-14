# Manarion Farm Calculator

Static browser calculator converted from the supplied Google Sheet and Apps Script. It uses plain HTML, CSS, and JavaScript with no dependencies or build step.

## What is implemented

- Username / Resource-MD tax / Harvest-Wisdom potion / Resonance potion inputs
- Battler / TSer role selector with role-specific results
- Adaptive number abbreviations that promote values through K, M, B, T, Q, Qi, and higher tiers
- Separate TSer cards for daily income, potion comparison, and ROI
- Live Manarion player, market, and guild API normalization
- Battler daily totals
- Battler Net herbs and maximum sustainable potion summaries
- Battle potion analysis comparing one Potion Boost upgrade with a stronger sustainable Wisdom potion funded by balanced farm upgrades and Hedge Fund coverage
- TSer daily totals
- TSer best-potion optimizer (0-1,000,000 in 1,000 steps)
- Ambitious equipment-prefix detection and -1% total TSer resources per equipped item (maximum 8%)
- Lab ROI
- Spire ROI
- Potion Boost ROI
- Base Resource ROI
- Shard ROI
- Farm no-hedge ROI
- Farm + Hedge ROI
- Battler + TSer Tome Drop ROI (same calculation)
- Dust Collector ROI
- Workshop -> Dust Collector ROI using live Workshop, Construction boost, and active Construction pet data
- Fresh live API requests only after the player submits the setup form; runtime responses are not cached
- Dedicated Cloudflare Worker relay for browser-safe live Manarion requests, with direct API fallback
- Submitted setup values are remembered only in that browser; restoring them never triggers an automatic API request
- Unified asset-version query strings are bumped on deployment so browsers fetch current CSS and JavaScript without clearing saved inputs

## Hosting

Serve the repository root directly with GitHub Pages. The calculator has no package dependencies or build step. At runtime it requests current player, market, and guild data through the dedicated Cloudflare Worker, with the direct Manarion API as a fallback. Neither route caches responses, and the site does not load workbook snapshots or substitute stored results when a request fails.

The Worker source and deployment configuration live in `cloudflare-worker/`. It is deployed separately from GitHub Pages at `https://emilia-manarion-api.emilia-manarion-api.workers.dev`; see `cloudflare-worker/README.md` for deployment commands. Its browser CORS allowlist includes the GitHub Pages origin and local previews.

## Validation

Run the dependency-free regression check with Node:

```sh
node validation.test.js
node battler-potion.test.js
```

The check locks the Hohmono values documented in `VALIDATION.md`, including the best-potion search, all validated TSer ROI rows, and the shared Battler/TSer Tome Drop ROI.

## Formula notes

All daily action totals share a 27,400-action event day. At 1,200 actions per hour, potion consumption, Laboratory savings, and Tome Drop calculations use the derived duration of 22.833333… hours (22 hours 50 minutes), with full precision retained in calculations.

Battler Mana Dust includes the 150 starter enemies omitted by the API's current enemy count. It uses the effective enemy level `e = currentEnemy + 150` in both the base reward and the high-level multiplier: `(0.0001 × e² + e^1.2 + 10 × e) × 1.01^((e − 150000) / 2000)`, with the multiplier applied only above `e = 150000`. Daily MD and the Dust Collector / Workshop calculations share this formula.

Battle potion analysis starts at the highest sustainable whole-level Wisdom tier (up to 999,999), using the entered Resonance potion and the existing 1:1 herb-trading assumption. At total Potion Boost `B`, the matching Wisdom tier is `ceil(currentTier × (101 + B) / (100 + B))`. The cost of Potion Boost uses its purchased base level, while its effect uses the total boost. The farm plan catches up the lowest farm stat, then distributes whole levels evenly across tied stats until the matching potion is sustainable. Resources are summed from each level's squared resource cost and valued at the average resource price; Hedge Fund increases cover the added farm tax. The recommendation compares MD cost per percentage-point gain in Wisdom's potion effect, excluding other XP bonuses and Potion Boost's additional Resonance benefit. TSer's existing potion analysis remains in 1,000-level steps.

The Potion Boost section also shows the additional Resonance shard value per 10% retained after guild shard tax. It uses the shared daily allowance of 27,400 shard-eligible battles after accounting for events. With `x = 3 × Battle + Mining + Fishing + Woodcutting` from the player API, the minimum base drop is `100 × (1 + x / 10)^(1 − 0.3 × x / (x + 20000))` and its mean is 1.5 times the minimum. The developer-confirmed base drop chance is 1/80, multiplied by total Drop Boost and capped at 100%. A one-point Potion Boost upgrade adds `5 × ResonanceTier / 100` percentage points to the shard bonus. The unchanged additive gear bonus cancels in the difference. Additional daily shards are multiplied by 10% and the market sell price for shards. Multiply the displayed value by `(100 − shard tax %) / 10`; the resource/MD tax input is unrelated. No event shard income or extra herb cost is added, and the Wisdom XP recommendation remains separate.

TSer Tome Drop ROI uses the same calculation as the Battler row (`K31 = G148`), so it is calculated dynamically for every player. The highest-level tome is upgraded and its own live sell price values the additional drops.

Farm — no hedge selects the best next 1,000-level Golems, Fertilizer, or Plots upgrade after the 50,000 MD tax per added herb. Farm + Hedge selects the best paired upgrade after adding enough whole Hedge Fund increases to permanently cover that added tax; its daily benefit is the full gross value of the added herbs, without adding the avoided tax a second time. A Hedge Fund increase costs 1T MD and removes 1B MD per hour of farm tax, equivalent to a standalone 41.67-day payback.

The post-workbook Ambitious rule is applied as a final multiplier to TSer resources: `1 - (Ambitious item count / 100)`. The count comes from equipped API items whose name or explicit prefix starts with `Ambitious`, and is capped at eight. The original validated workbook snapshots use a count of zero, so their documented outputs remain unchanged.

See `VALIDATION.md` for exact comparison values and the discrepancy between the older stored 79.99 / 52.07 values and the formulas in the newest workbook.

## Files

- `index.html` - page structure
- `styles.css` - responsive dark UI
- `calculator.js` - spreadsheet formulas converted to named JavaScript functions
- `data.js` - validated Emilia and Hohmono fixtures used only by the regression test
- `app.js` - live API fetching and UI rendering
- `validation.test.js` - dependency-free formula regression checks
- `battler-potion.test.js` - sustainable Wisdom equivalence, balanced farm allocation, and upgrade cost checks
- `VALIDATION.md` - workbook-vs-JavaScript validation notes
- `cloudflare-worker/` - restricted live API relay and its tests/deployment configuration
