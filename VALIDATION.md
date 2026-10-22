# Validation against supplied XLSX workbooks

The JavaScript conversion was checked against both the Emilia workbook and the newer Hohmono/TSer workbook. The live calculator now intentionally uses 27,400 daily actions for gathering and for both potted and unpotted TSer calculations, superseding the older workbook action counts.

Hourly calculations use that same event day: 27,400 actions ÷ 1,200 actions per hour = 22.833333… hours (22 hours 50 minutes). This derived duration replaces the old 22.4-hour assumption in potion consumption, Laboratory savings, and Tome Drop calculations. Only the displayed duration is rounded to 22.83 hours.

## Hohmono TSer validation

`sunpetal-potion.test.js` checks the developer's approximate Sunpetal production formula against the existing fixtures: Emilia produces about **178,639.668/day**, sustaining tier **481** (177,950.519/day consumed; tier 482 needs 178,750.400/day). Hohmono's historical fixture sustains tier **650**. Tests verify the exact next-tier boundary, total Potion Duration, 24-hour production versus 27,400-action potion use, the 999,999 limit, zero supported tiers, and independence from other potions, resource tax, and Potion Boost. These are estimates under the supplied production formula, not observations of exact in-game Sunpetal output.

The historical fixtures have no elemental star harvest bonus, so their original values below remain unchanged. `star-bonus.test.js` separately verifies that a 39-star Water bonus raises Hohmono's modeled Fish output by **3.9%** and divides resource-based ROI by **1.039**, without changing farm herbs, sustainability, Battler income, or non-resource ROI. It checks all three elemental mappings, rank sums, unassigned stars, missing/lagging star counts, personal and guild potion optimization, paginated leaderboard lookup, and API relay fallback. The Worker tests cover the new restricted leaderboard route. Run `node --test star-bonus.test.js cloudflare-worker/test/worker.test.js`.

October 19 deployment verification used the live relay with the local preview's Origin header and checked `Access-Control-Allow-Origin` and `Cache-Control: no-store`. Hohmono returned **44 unlocked / 39 assigned**, **+4.4% Fish**, and Nexus **25,921**; Pepo returned **33 / 33**, no matching Fish bonus, and Nexus **24,600**; Mephisto returned **1 / 1**, **+0.1% Wood**, and Nexus **24,600**. These are live observations, not fixed future expectations.

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
- Maximum sustainable potion keeps the combined Bloomwell and Sageroot total at or above zero, allowing either herb to be traded into the other 1:1. The calculation keeps the entered Resonance potion active and uses the API's total Potion Duration boost, which includes Laboratory duration. Both Battler and TSer search whole potion levels; Battler Wisdom is capped at 999,999. For the Hohmono snapshot the exact sustainable tier is **176,763** for both roles, and tier **176,764** consumes more herbs than the farm produces. TSer's separate highest-income optimizer still uses 1,000-level steps.
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

## September 14 Mana Dust scaling correction

The historical workbook comparison above predates this correction. The base reward already used `currentEnemy + 150`, but the high-level multiplier used the unadjusted enemy level. Applying the effective level consistently reproduces Emilia's reported Elnaeth tracker value. With enemy 617,692, Dust Collector 930, Base Mana Dust 205%, equipment Mana Dust 289,563%, and 25% tax, the result changes from **283.25692663478858Qa/day** to **283.46839304123597Qa/day**, displayed as **283.47Qa**. The corrected hourly amount is **12.414674147791356Qa**, displayed as **12.41Qa**. Elnaeth v4.6.2 uses actual battle loot and the same 27,400 / 28,800 daily event correction. This comparison supports the effective-level correction; it is not a direct inspection of the game's server formula.

The user also confirmed that the API's current enemy count omits 150 starter enemies which still count toward Mana Dust. Regression checks fix this captured example and cover effective enemy levels 149,999, 150,000, and 150,001. Daily MD, Dust Collector ROI, and Workshop → Dust Collector ROI all use the corrected shared reward function. The TSer income formulas are unaffected.

## Automated regression check

Constellation regression coverage checks effect 6 (Ambidextrous), effect 14 (Shards), and effect 11 (Potency already reflected in total boost). At 100 Construction Codex, three Ambidextrous ranks and pet level 12, expected tick progress is multiplied by 1.27, combining the pet's 0.24 and Ambidextrous's 0.03 additively. Tests cover no active pet, zero purchased Codex, unchanged building costs, fixed Codex chance across a Workshop upgrade, and preservation of the existing cumulative payback model. Three Shards ranks increase current and marginal shard amounts by 9% with unchanged drop chance; tests reconcile current and upgraded totals, 90% shard tax retention, and ten-rank scaling. A 245-purchased/249-total Potency case retains the correct price and Wisdom effect while keeping Resonance income separate from the XP recommendation. Missing constellation fields default to zero.

Ownin's October 17 API response separates 245 purchased Potion Boost levels from 249% total boost. The TSer ROI regression combines those two captured boost values with the existing Hohmono fixture's other inputs: the extra four bonus points increase current income without raising the next upgrade's cost or marginal ROI. It also checks that changing only the purchased level from 245 to 249 raises ROI by 46.41%, that a purchased level of zero is respected, and that current income is independent of the purchased-level pricing input. Existing fixtures without a separate purchased level retain their historical results. The corrected next-level cost at purchased level 245 is 138.422875Q MD rather than the 202.664931Q obtained by incorrectly pricing level 249.

The guild card's displayed resource comparison is separate from the optimizer's income after herb costs. The Hohmono fixture yields **474.659338Q/day** gross resources at the recommended tier and **494.936882Q/day** at its entered tier, a **−20.277544Q/day** gross resource change. Tests check these values, their reconciliation, and zero change when already using the recommended tier.

The guild potion analysis selects **161,000** for the Hohmono snapshot, compared with the personal optimum of **125,000** at 40% resource tax. It yields **474.659338Q** gross resource value plus **30.190727Q** farm income after costs, for **504.850065Q/day** before resource tax and **1.195504Q/day** more than the entered 171,000 potion on the same basis. Tests cover invariance to resource tax, agreement with the personal optimizer at zero tax, neighbouring search tiers, sensitivity to herb prices, zero-value resources, the one-million ceiling, and preservation of the original inputs.

The September 24 xChrispy API snapshot reproduces the Imbued/Nexus bug: treating the Imbued pickaxe as 32 infusions inferred Nexus 23,987, while its 33 effective infusions produce the user-confirmed Nexus **23,970**. Tests cover the numeric prefix ID and name representations, ensure matching ID and name do not double-count the perk, and check that an Imbued +32 item matches a normal +33 item. The same correction applies to equipment research and base-resource contributions; other prefixes do not gain an infusion.

October 18 Pinnacle captures reproduce Hohmono's inflated Nexus **28,064**, corrected to the user-confirmed **25,921** by removing the **1.0606x** research multiplier. Ownin's **1.0444x** multiplier likewise yields **25,921**. Pepo has Pinnacle (**1.0464x**) and resolves to **24,600**; Mephisto has no Pinnacle and also resolves to **24,600**, including the extra infusion from Imbued gloves. Their gathering boosts without matching equipment independently confirm 24,600. Ignoring Mephisto's Imbued infusion instead gives 24,613. Tests cover these four captures, Pinnacle combined with Imbued, missing/locked Pinnacle, zero Spire, matching versus unrelated or unequipped items, and unchanged API research for current income. Shard ROI is checked against the income difference from a reconstructed +1,000 research-upgrade snapshot. A fresh xChrispy capture without Pinnacle also stayed at **25,921**.

The October 21 Spire ROI correction is checked against independently reconstructed +1 Spire API totals for those same four captures. Each case verifies that Nexus stays fixed and that the predicted payback matches the extra daily resource income at 0% and 25% tax, including Ambitious and elemental star multipliers. A zero-Spire, one-item case checks the first level, exclusion of the baseline, and the cross-term from simultaneous equipment and Pinnacle growth; unrelated or unequipped items do not increase the Pinnacle slope. No matching equipment yields no Spire resource payback. The original workbook fixtures, which omit Pinnacle, retain their recorded ROI values.

The Resonance value tests cover API mapping of all four player levels, the weighted base shard formula, a hand-calculated 2,568.75-extra-shard example, the shared allowance of 27,400 non-event battles per day, 10% retention at 90% shard tax, and linear scaling with Resonance tier, Drop Boost, and shard price. They also verify that resource/MD tax and unchanged additive equipment bonuses do not alter the marginal value. A September 13 Emilia sample (93,780 Battle; 52,950 Mining; 52,950 Fishing; 79,413 Woodcutting; 194% Drop Boost; 40,000 Resonance; 13,206 MD shard sell price) evaluates to **8.448264T MD per day per 10% retained**, using the developer-confirmed 1/80 base drop chance.

`battler-potion.test.js` checks the new Battle potion analysis independently. The Emilia comparison fixture uses 540,000 Golems, 540,000 Fertilizer, 530,000 Plots, 631% Potion Duration, 235% purchased and total Potion Boost, 40,000 Resonance, and a 33 MD average resource price. Its exact sustainable Wisdom ceiling is 98,952. Potion Boost +1 costs 53.368010Q MD and is matched by a 99,248 Wisdom potion. The balanced farm plan adds 4,614 Plots, requires 1.307391Q resources and 11,510 Hedge Fund increases, and costs 54.653902Q MD. Tests verify the next unsupported potion, the minimum supporting farm upgrade, exact resource sums, sufficient Hedge Fund coverage, low-stat catch-up, even growth, both recommendation outcomes, and base-versus-total Potion Boost pricing. Run it with `node battler-potion.test.js`.

`validation.test.js` runs the Hohmono snapshot through the same `calculator.js` engine used in the browser. It asserts the three 27,400 daily-action constants, the matching 22-hour-50-minute duration, the documented current TSer outputs and ROI values, the 125,000 best-potion result, and the shared Battler/TSer Tome Drop ROI. It also checks that Laboratory savings match the actual additional daily herb income from +1 Potion Duration for both roles, and that Tome drops cover all 27,400 event actions. Run it with `node validation.test.js`; it requires no installed packages.

The regression check also covers the post-workbook Ambitious rule. It verifies that each detected equipped Ambitious prefix reduces potted and unpotted TSer resources by 1%, adjusts resource-derived ROI, leaves Battler and non-resource ROI unchanged, and caps the penalty at eight items. It also verifies that a player running a lower potion can receive a higher upgrade recommendation from the 0-1,000,000 search, that the full one-million ceiling is evaluated, that sustainable-potion analysis responds to Resonance usage and total Potion Duration, that the sigil warning distinguishes Distillation from another active sigil, and that live Workshop, Construction, and Construction-pet data affect Workshop → Dust Collector ROI. Both workbook snapshots have an Ambitious count of zero, so the Ambitious rule itself leaves their previously validated values unchanged.

October 21 herb and Laboratory checks (`node --test farm-lab-market.test.js`) cover separate 2%-per-rank Atlas bonuses, unequal herb yields and prices, unchanged base upkeep and Sunpetal output, sustainable tier boundaries, Farm ROI reconciled against daily income changes, and sufficient Hedge coverage. Market tests verify exact midpoints for every mapped price and one-sided quote fallback. Laboratory tests hold the entered Guidance tier fixed, reconcile Sunpetal savings for both roles, check zero/blank Guidance, and make ROI unavailable if a positive Guidance input has no Sunpetal quote. Historical workbook fixtures retain their explicit old prices; live API prices now use midpoints. The Emilia Resonance capture previously valued at 13,206 MD now uses its 12,466.5 MD midpoint.
