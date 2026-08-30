# Manarion Farm Calculator

Static browser calculator converted from the supplied Google Sheet and Apps Script. It uses plain HTML, CSS, and JavaScript with no dependencies or build step.

## What is implemented

- Username / Resource-MD tax / Harvest-Wisdom potion / Resonance potion inputs
- Live Manarion player, market, and guild API normalization
- Battler daily totals
- TSer daily totals
- TSer best-potion optimizer (0-250,000 in 1,000 steps)
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
- Workbook snapshot fallbacks for Emilia and Hohmono while browser CORS behavior is being tested

## Hosting

Serve the repository root directly with GitHub Pages. If `api.manarion.com` does not permit browser CORS requests from the GitHub Pages origin, a very small API proxy will be required. The calculator itself does not need a server, and the validated workbook snapshots remain available as fallbacks.

## Validation

Run the dependency-free regression check with Node:

```sh
node validation.test.js
```

The check locks the Hohmono values documented in `VALIDATION.md`, including the best-potion search, all validated TSer ROI rows, and the shared Battler/TSer Tome Drop ROI.

## Formula notes

TSer Tome Drop ROI uses the same calculation as the Battler row (`K31 = G148`), so it is now calculated dynamically for every player.

The newer Hohmono workbook also resolved the TSer farm no-hedge and Farm + Hedge rows: K29 and K30 contain formulas, and those formulas have been ported.

See `VALIDATION.md` for exact comparison values and the discrepancy between the older stored 79.99 / 52.07 values and the formulas in the newest workbook.

## Files

- `index.html` - page structure
- `styles.css` - responsive dark UI
- `calculator.js` - spreadsheet formulas converted to named JavaScript functions
- `data.js` - validated Emilia and Hohmono workbook snapshots
- `app.js` - API fetching, fallback selection, and UI rendering
- `validation.test.js` - dependency-free formula regression checks
- `VALIDATION.md` - workbook-vs-JavaScript validation notes
