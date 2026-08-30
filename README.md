# Manarion Farm Calculator

Static browser calculator converted from the supplied Google Sheet and Apps Script. It uses plain HTML, CSS, and JavaScript with no dependencies or build step.

## What is implemented

- Username / Resource-MD tax / Harvest-Wisdom potion / Resonance potion inputs
- Battler / TSer role selector with role-specific results
- Live Manarion player, market, and guild API normalization
- Battler daily totals
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
- Workshop -> Dust Collector ROI
- Fresh live API requests on initial load, player updates, and reset; runtime responses are not cached

## Hosting

Serve the repository root directly with GitHub Pages. The calculator has no server, dependencies, or build step. At runtime it requests the current player, market, and guild data directly from Manarion and does not load workbook snapshots or substitute stored results when a request fails.

## Validation

Run the dependency-free regression check with Node:

```sh
node validation.test.js
```

The check locks the Hohmono values documented in `VALIDATION.md`, including the best-potion search, all validated TSer ROI rows, and the shared Battler/TSer Tome Drop ROI.

## Formula notes

TSer Tome Drop ROI uses the same calculation as the Battler row (`K31 = G148`), so it is now calculated dynamically for every player.

The newer Hohmono workbook also resolved the TSer farm no-hedge and Farm + Hedge rows: K29 and K30 contain formulas, and those formulas have been ported.

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
