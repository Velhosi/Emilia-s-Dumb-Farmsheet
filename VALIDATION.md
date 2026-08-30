# Validation against supplied XLSX workbooks

The JavaScript conversion has now been checked against both the Emilia workbook and the newer Hohmono/TSer workbook.

## Hohmono TSer validation

Inputs from the supplied Hohmono workbook:

- Username: Hohmono
- Resource/MD tax: 40%
- Harvest/Wisdom potion: 171,000
- Potion of Resonance: 57,000

The JavaScript engine reproduces the current workbook's calculated TSer outputs (differences below the displayed precision are floating-point/formatting only):

| Output | Workbook / screenshot | JavaScript |
| --- | ---: | ---: |
| Leftover Bloomwells | -438,460,707,710 | -438,460,707,709.667 |
| Leftover Sageroots | 565,889,552,794 | 565,889,552,794.089 |
| Leftover herb sale value | 11,375.27 T | 11,375.2687 T |
| Farm tax value | 11,375.29 T | 11,375.2878 T |
| Extra resource value | 202,318.7 T | 202,318.7287 T |
| Farm + potion income | 213,694.02 T | 213,694.0165 T |
| Full income | 302,701.64 T | 302,701.6395 T |
| Highest-income potion | 125,000 | 125,000 |
| Income at best potion | 236,499.9 T | 236,499.9202 T |
| Loss from current potion | 22,805.9 T | 22,805.9037 T |
| Percent loss | 9.643091518% | 9.643091518% |

### Hohmono TSer ROI validation

| ROI | Workbook | JavaScript |
| --- | ---: | ---: |
| Lab | 145.261399 d | 145.261399 d |
| Spire | 135.2979062 d | 135.2979062 d |
| Potion boost | 233.9868499 d | 233.9868499 d |
| Base resources | 154.0746152 d | 154.0746152 d |
| Shards | 135.5421791 d | 135.5421791 d |
| Farm no hedge (latest XLSX formula) | 116.8462011 d | 116.8462011 d |
| Farm + Hedge (latest XLSX formula) | 61.09496282 d | 61.09496282 d |

The newer Hohmono XLSX contains formulas in K29 and K30, so those two TSer farm ROI rows are now implemented dynamically in the website.

## Screenshot vs. latest XLSX discrepancy

The Hohmono screenshot shows **79.99 d** for Farm no hedge and **52.07 d** for Farm + Hedge. However, the newer downloaded XLSX contains formulas in those cells and evaluates them to **116.85 d** and **61.09 d** for Hohmono. The earlier Emilia XLSX had 79.99 / 52.07 stored as literal values with no formulas.

For now the website follows the formulas present in the newest XLSX rather than carrying forward the old literal values.

## TSer Tome Drop resolved

TSer **Tome drop** should reference the Battler Tome Drop ROI directly (`K31 = G148`). The website now uses the same `tomeDropROI()` calculation for both roles. In the latest Hohmono workbook, `G148` evaluates to approximately **291.9240 days**, so the earlier screenshot value of `134.33` was a stale stored value rather than the intended dynamic result.

## Emilia validation already completed

The earlier workbook also matched the JavaScript engine for the core Battler outputs and dynamic ROIs, including Lab, Dust Collector, farm upgrades, Battler tome drop, Workshop -> Dust Collector, Potion Boost, and Base Resources. The Hohmono workbook additionally validates Spire and Shard ROI with finite values.

## Automated regression check

`validation.test.js` runs the Hohmono snapshot through the same `calculator.js` engine used in the browser. It asserts the documented TSer outputs and ROI values, the 125,000 best-potion result, and the shared Battler/TSer Tome Drop ROI. Run it with `node validation.test.js`; it requires no installed packages and does not alter any workbook-derived formulas.

The regression check also covers the post-workbook Aspiration rule. It verifies that each detected equipped Aspiration prefix reduces potted and unpotted TSer resources by 1%, adjusts resource-derived ROI, leaves Battler and non-resource ROI unchanged, and caps the penalty at eight items. It also verifies that a player running a lower potion can receive a higher upgrade recommendation from the 0-1,000,000 search and that the full one-million ceiling is evaluated. Both workbook snapshots have an Aspiration count of zero, preserving every previously validated value.
