# Validation against supplied XLSX workbooks

The JavaScript conversion was checked against both the Emilia workbook and the newer Hohmono/TSer workbook. The live calculator now intentionally uses 27,400 daily actions for gathering and for both potted and unpotted TSer calculations, superseding the older workbook action counts.

Hourly calculations use that same event day: 27,400 actions ÷ 1,200 actions per hour = 22.833333… hours (22 hours 50 minutes). This derived duration replaces the old 22.4-hour assumption in potion consumption, Laboratory savings, and Tome Drop calculations. Only the displayed duration is rounded to 22.83 hours.

## Hohmono TSer validation

Inputs from the supplied Hohmono workbook:

- Username: Hohmono
- Resource/MD tax: 40%
- Harvest/Wisdom potion: 171,000
- Potion of Resonance: 57,000

Outputs that do not depend on the updated daily-action counts still reproduce the workbook. Action-dependent rows show the current 27,400-action calculator result:

| Output | Workbook / screenshot | JavaScript |
| --- | ---: | ---: |
| Leftover Bloomwells | -438,460,707,710 | -458,630,448,292.964 |
| Leftover Sageroots | 565,889,552,794 | 565,149,207,131.252 |
| Leftover herb sale value | 11,375.27 T | 8,717.6602 T |
| Farm tax value | 11,375.29 T | 8,717.6793 T |
| Extra resource value | 202,318.7 T | 208,048.6118 T |
| Farm + potion income | 213,694.02 T | 216,766.2911 T |
| Full income | 302,701.64 T | 305,679.8086 T |
| Highest-income potion | 125,000 | 125,000 |
| Income at best potion | 236,499.9 T | 240,013.3805 T |
| Loss from current potion | 22,805.9 T | 23,247.0894 T |
| Percent loss | 9.643091518% | 9.685747243% |

### Derived herb and potion values

- Net herbs combine the current-potion Bloomwell and Sageroot leftovers. For the Hohmono snapshot this is **106,518,758,838.289** herbs for either role once herb trading is allowed.
- Maximum sustainable potion is the highest 1,000-level Harvest/Wisdom potion whose combined Bloomwell and Sageroot total stays at or above zero, allowing either herb to be traded into the other as needed. The calculation keeps the entered Resonance potion active and uses the API's total Potion Duration boost, which includes Laboratory duration. For the Hohmono snapshot this is **176,000** for both Battler and TSer.
- A nonzero `SigilBoost` other than the Distillation/Potion Duration identifier (`110`) activates the event-accuracy warning. Missing or zero values do not.
- Workshop → Dust Collector ROI reads Workshop level from `BaseBoosts[150]`, total Construction boost from `TotalBoosts[104]`, and the active Construction pet's level from `Pets[24]`. Stored workbook fixtures retain their original manual values through the calculator's compatibility fallback.

### Hohmono TSer ROI validation

| ROI | Workbook | JavaScript |
| --- | ---: | ---: |
| Lab | 145.261399 d | 137.672790 d |
| Spire | 135.2979062 d | 142.2109379 d |
| Potion boost | 233.9868499 d | 229.5462236 d |
| Base resources | 154.0746152 d | 151.1505714 d |
| Shards | 135.5421791 d | 132.9698457 d |
| Farm no hedge (best 1,000-level upgrade) | 116.8462011 d | 116.8462011 d |
| Farm + Hedge (permanent tax coverage) | 61.09496282 d | 86.31631968 d |

The newer Hohmono XLSX contains formulas in K29 and K30, so those two TSer farm ROI rows are implemented dynamically in the website. Farm — no hedge intentionally reports the lowest ROI among the next 1,000 Golems, Fertilizer, and Plots upgrades instead of averaging the three results. Farm + Hedge evaluates those same three choices, adds enough whole Hedge Fund increases to permanently cover the selected upgrade's additional farm tax, then divides the combined one-time cost by the full untaxed daily herb value. The avoided tax is not added again as a separate benefit. Each Hedge Fund increase costs 1T MD and removes 1B MD per hour of farm tax, which gives a standalone payback rate of 41.6667 days. Battler and TSer use the same selected upgrade and ROI.

The Laboratory ROI values Harvest-potion savings using the herb consumed by the selected role (Sageroots for Battlers and Bloomwells for TSers), and applies the full derived 22.833333…-hour daily duration to both halves of the Resonance-potion savings. This produces separate Laboratory ROI values for the two roles; the Hohmono snapshot evaluates to **146.894586 days** for Battler and **137.672790 days** for TSer.

## Screenshot vs. latest XLSX discrepancy

The Hohmono screenshot shows **79.99 d** for Farm no hedge and **52.07 d** for Farm + Hedge. The newer downloaded XLSX evaluates those cells to **116.85 d** and **61.09 d** for Hohmono. The earlier Emilia XLSX had 79.99 / 52.07 stored as literal values with no formulas.

The website does not carry forward the old literal values. Farm — no hedge applies the user-approved rule of displaying the best individual 1,000-level farm upgrade rather than the workbook’s three-upgrade average. Farm + Hedge intentionally uses the game's clarified permanent-discount mechanics without double-counting the avoided tax; for Hohmono it selects Golems +1,000, requires 3,459 Hedge Fund increases, and evaluates to **86.316320 days**.

## Tome Drop sell-price correction

TSer **Tome drop** references the Battler Tome Drop ROI directly (`K31 = G148`), so the website uses the same calculation for both roles. The workbook always valued the additional drops with the Nature Tome price, even when another tome was being upgraded. The website intentionally corrects that behavior by selecting the highest-level tome and using that tome’s own live sell price. Hohmono’s highest tome is Water at level 425; with that tome’s price and all 27,400 daily event actions, the result changes from the workbook’s **291.9240 days** to **274.062137 days**. The earlier screenshot value of `134.33` was a stale stored value.

## Emilia validation already completed

The earlier workbook also matched the JavaScript engine for the core Battler outputs and dynamic ROIs, including Lab, Dust Collector, farm upgrades, Battler tome drop, Workshop -> Dust Collector, Potion Boost, and Base Resources. The Hohmono workbook additionally validates Spire and Shard ROI with finite values.

## Automated regression check

`validation.test.js` runs the Hohmono snapshot through the same `calculator.js` engine used in the browser. It asserts the three 27,400 daily-action constants, the matching 22-hour-50-minute duration, the documented current TSer outputs and ROI values, the 125,000 best-potion result, and the shared Battler/TSer Tome Drop ROI. It also checks that Laboratory savings match the actual additional daily herb income from +1 Potion Duration for both roles, and that Tome drops cover all 27,400 event actions. Run it with `node validation.test.js`; it requires no installed packages.

The regression check also covers the post-workbook Ambitious rule. It verifies that each detected equipped Ambitious prefix reduces potted and unpotted TSer resources by 1%, adjusts resource-derived ROI, leaves Battler and non-resource ROI unchanged, and caps the penalty at eight items. It also verifies that a player running a lower potion can receive a higher upgrade recommendation from the 0-1,000,000 search, that the full one-million ceiling is evaluated, that sustainable-potion analysis responds to Resonance usage and total Potion Duration, that the sigil warning distinguishes Distillation from another active sigil, and that live Workshop, Construction, and Construction-pet data affect Workshop → Dust Collector ROI. Both workbook snapshots have an Ambitious count of zero, preserving every previously validated value.
