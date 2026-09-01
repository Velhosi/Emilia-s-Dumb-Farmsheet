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
- Automatic browser-CORS relay fallback when a direct Manarion request is rejected
- Submitted setup values are remembered only in that browser; restoring them never triggers an automatic API request
- Unified asset-version query strings are bumped on deployment so browsers fetch current CSS and JavaScript without clearing saved inputs

## Hosting

Serve the repository root directly with GitHub Pages. The calculator has no server, package dependencies, or build step. At runtime it requests the current player, market, and guild data from Manarion. It tries the API directly first and uses Jina Reader's direct-fetch relay with caching disabled when the browser rejects the direct cross-origin request. The site does not load workbook snapshots or substitute stored results when a request fails.

## Validation

Run the dependency-free regression check with Node:

```sh
node validation.test.js
```

The check locks the Hohmono values documented in `VALIDATION.md`, including the best-potion search, all validated TSer ROI rows, and the shared Battler/TSer Tome Drop ROI.

## Formula notes

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
- `VALIDATION.md` - workbook-vs-JavaScript validation notes
