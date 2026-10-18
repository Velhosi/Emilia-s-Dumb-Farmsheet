# Manarion formulas for another project

Prepared 2026-10-13 from this project's `calculator.js`, the user's supplied cost table, and the user's confirmed mechanics. Source revision: `77805e7e75a3e6c7148174a8e01f63612ba32577`.

Updated 2026-10-17 to reflect the local TSer Potion Boost pricing correction: purchased level determines cost for both roles; total boost determines effect.

Also updated for Ambidextrous construction timing and the Shards constellation drop-amount multiplier. Potency is already included in the API's total Potion Boost. Other new constellation perks are not independently simulated by this update.

Updated 2026-10-18 for Pinnacle in Nexus inference and the marginal research gain used in Shard ROI, verified against live API totals.

This document describes the current calculator. Formulas added from the screenshot are identified below; they have not been added to the calculator itself. No live player or market values are hardcoded here. Code blocks use mathematical notation: `^` means exponentiation (use `**` in JavaScript).

## 1. Upgrade costs, including the supplied screenshot

Let `L` be the current purchased level/rank and `n` the number of upgrades. A cumulative cost `C(L)` means the total cost from level 0 through level L:

```text
Next-level cost = C(L + 1) - C(L)
Batch cost      = C(L + n) - C(L)

S1(L) = L(L + 1) / 2
S2(L) = L(L + 1)(2L + 1) / 6
```

| Investment | Cumulative cost C(L) | Next-level cost from L | Currency | Source |
| --- | --- | --- | --- | --- |
| Combat shard boosts | `L(L + 1)` | `2(L + 1)` | Shards | User's screenshot |
| Spell / resistance ranks | `[L(L + 1) / 2]^2` | `(L + 1)^3` | Elemental tomes | User's screenshot |
| Mana Shield rank | `L(L + 1) / 2` | `L + 1` | Mana Shield tomes | User's screenshot |
| Enchantment ranks | `L(L + 1) / 2` | `L + 1` | Corresponding formulas | User's screenshot |
| Base Resource Amount | `5L(L + 1)(2L + 1) / 6` | `5(L + 1)^2` | **Mana Dust** | Existing calculator; currency confirmed by user |
| One farm section | `L(L + 1)(2L + 1) / 6` | `(L + 1)^2` | Section's resource | Existing potion-comparison farm cost |

Base Resources costs **MD**, despite the screenshot's Resources label. Do not multiply its cost by a resource market price. Use `BaseBoosts[124]` for its purchased level, not the equipment-boosted total. Each purchased level adds `0.01` to base resource amount; the ROI compares 5,000 levels, adding 50.

The screenshot's **combat shard boost** cost is separate from the calculator's **gathering research Shard ROI** cost in section 8. Spell/resistance ranks are also separate from the resource-funded Tome Drop upgrades in section 9. The screenshot supplies costs only; it does not supply those upgrades' benefit formulas.

For a farm section, the expanded batch resource cost is:

```text
FarmResources(L, n)
  = S2(L + n) - S2(L)
  = nL^2 + Ln(n + 1) + n(n + 1)(2n + 1) / 6

Golems use Iron; Fertilizer uses Fish; Plots use Wood.
Farm MD value = resources needed * average resource price
```

Other upgrade costs:

```text
BuildingCost(L) = 7,500,000(L + 1)^3
                + 30,000(L + 1)^3 * averageResourcePrice

PotionBoostCost(b) = floor(10,000,000 * 1.1^b)
HedgeCost(n)        = n * 10^12 MD
```

Building cost combines direct MD plus 10,000 times the new level cubed of each of three resources, valued at their average price. It is used for Laboratory, Spire, Dust Collector, and Workshop.

For Potion Boost, `b` is the purchased level. Both the Battler comparison and TSer Potion Boost ROI use `potionBoostLevel` for cost and total `potionBoost` for effect. Extra bonus points do not increase the purchase price. Legacy inputs without a separate purchased level fall back to the total boost.

Numerical precision: JavaScript `Number` cannot represent every integer above `2^53 - 1`. At Base Resources level 710,013, buying 5,000 levels costs mathematically 12,691,939,275,387,500 MD. The current JS expression returns 12,691,939,275,387,520; the supplied game screenshot shows 12,691,939,275,387,648. Exact integer arithmetic can recover the mathematical result but does not guarantee an exact match to the game's displayed rounding.

## 2. Shared inputs and units

```text
A = 27,400 actions/day
ActionsPerHour = 1,200
H = A / 1,200 = 22.833333333333... active hours/day
FarmHours = 24

t = resource/MD tax in percentage points (25 means 25%)
q = 1 - t / 100
P = Harvest tier for a TSer, Wisdom tier for a Battler
Z = Resonance potion tier
B = total Potion Boost in percentage points
D = total Potion Duration boost in percentage points
duration = 1 + D / 100  [hours per potion]

pBloom = Bloomwell sell price in MD/herb
pSage  = Sageroot sell price in MD/herb
pRes   = round((IronSell + FishSell + WoodSell) / 3)
pHerb  = (pBloom + pSage) / 2

ambitiousCount = equipped Ambitious items, clamped to 0..8
a = 1 - ambitiousCount / 100
```

Use full precision internally. The 22.83-hour display is rounded; calculations use `27400 / 1200`. Farms run for 24 hours. The current model also uses 27,400 shard-eligible non-event battles/day; it adds no shard income during events.

Resource/MD tax is distinct from the flat farm production levy and from guild shard tax. Market prices are MD per unit. Fetch player data and prices together for a consistent valuation.

## 3. Farm production and potion consumption

For farm levels `G` (Golems), `F` (Fertilizer), and `Pl` (Plots):

```text
herbsPerHour = 2.5 * (1 + G/100)^0.9
                  * (1 + F/100)^0.9
                  * (1 + Pl/100)^0.9
herbsPerDay = 24 * herbsPerHour
bloomProduced = herbsPerDay / 2
sageProduced  = herbsPerDay / 2

PotionHerbs(P)   = P(P + 1)/2 + 0.0002P^3
ResonanceHerbs(Z) = 2 * [Z(Z + 1)/2 + 0.0002Z^3]

mainPotionHerbsPerHour = PotionHerbs(P) / duration
resonanceHerbsPerHour  = ResonanceHerbs(Z) / duration
mainUsed = mainPotionHerbsPerHour * H
resUsed  = resonanceHerbsPerHour * H
```

Harvest uses Bloomwells; Wisdom uses Sageroots. Resonance consumes equal amounts of both herbs; `resUsed` above is the combined amount.

```text
TSer:
  leftoverBloom = herbsPerDay/2 - mainUsed - resUsed/2
  leftoverSage  = herbsPerDay/2 - resUsed/2

Battler:
  leftoverBloom = herbsPerDay/2 - resUsed/2
  leftoverSage  = herbsPerDay/2 - mainUsed - resUsed/2

netHerbs = leftoverBloom + leftoverSage
leftoverHerbValue = leftoverBloom*pBloom + leftoverSage*pSage
farmLevy = herbsPerDay * 50,000
hedgeDiscount = HedgeLevel * 10^9 * 24
farmNetIncome = leftoverHerbValue - farmLevy + hedgeDiscount
```

The implementation's `farmTax` field actually means **farmNetIncome**, not the amount of tax paid. Negative herb leftovers are valued as a cost at the same sell price. The current formula applies the full Hedge discount without capping it at the levy.

Maximum sustainable potion is the highest whole-number `P` satisfying:

```text
herbsPerDay >= [PotionHerbs(P) + ResonanceHerbs(Z)] * H / duration
```

This assumes the herbs can be exchanged 1:1, so combined herbs must be nonnegative; each individual herb balance need not be. Hold Resonance fixed. Search integer tiers with binary search. Battler Wisdom is capped at 999,999; the TSer sustainability search has no matching one-million ceiling. If even P=0 cannot support Resonance, the current helper returns 0 as a fallback, not proof that Resonance is sustainable.

## 4. TSer resource income

```text
g = highest of Mining, Fishing, Woodcutting levels
baseRes = TotalBoosts[124] / 100
baseResResearch = TotalBoosts[106]
research = max(TotalBoosts[30], TotalBoosts[31], TotalBoosts[32]) * 100
potBase(P, B) = 0.1 * P * (1 + B/100)

unpottedPerAction = (1 + 0.03g + baseRes)
                  * (1 + baseResResearch/100)
                  * (1 + research/100) * a

pottedPerAction(P) = (1 + 0.03g + baseRes + potBase(P, B))
                   * (1 + baseResResearch/100)
                   * ((research + 604.42)/100) * a

grossResourcesPerDay = pottedPerAction(P) * A
playerResourcesPerDay = grossResourcesPerDay * q
grossResourceValuePerDay = grossResourcesPerDay * pRes
playerResourceValuePerDay = playerResourcesPerDay * pRes

unpottedResourcesPerDay = unpottedPerAction * q * A
extraResourceValue = (playerResourcesPerDay - unpottedResourcesPerDay) * pRes
farmPlusPotionIncome = farmNetIncome + extraResourceValue
fullIncome = farmNetIncome + playerResourceValuePerDay
```

The current unpotted formula uses `1 + research/100`, whereas the potted formula uses `(research + 604.42)/100`. The separate resource-upgrade ROI formulas use `research/100`. These are literal current implementation choices; do not silently make them identical when porting.

Personal highest-income potion searches `P = 0, 1000, 2000, ..., 1,000,000`, maximizing `farmPlusPotionIncome`. It is not restricted to sustainable potions. Since the unpotted baseline is constant, the same tier maximizes full income.

```text
lossFromCurrent = bestFarmPlusPotionIncome - currentFarmPlusPotionIncome
percentLoss = 100 * lossFromCurrent / bestFarmPlusPotionIncome
```

Guild potion optimization repeats that search with `t=0`, still including herb costs, the farm levy, and Hedge discount. The hidden guild card displays gross resource value at the recommended and current tiers and their difference. Its optimization objective still includes herb costs, so it need not recommend the highest gross-resource tier. Its UI flag is `SHOW_GUILD_POTION = false` in `app.js`.

## 5. Battler Mana Dust income

```text
e = API Enemy + 150
baseMD = 0.0001e^2 + e^1.2 + 10e
enemyMultiplier = e > 150000 ? 1.01^((e - 150000)/2000) : 1

grossMDPerBattle = baseMD * enemyMultiplier
                 * (1 + 0.2*DustCollectorLevel/100)
                 * (1 + DustCodex/100)
                 * (1 + EquipmentDustBonus/100)

grossBattleMDPerDay = grossMDPerBattle * A
playerBattleMDPerDay = grossBattleMDPerDay * q
fullBattlerIncome = playerBattleMDPerDay + farmNetIncome
```

The API excludes 150 starter enemies. Include them in both the base reward and the post-150,000 multiplier. Wisdom affects XP, not battle MD, in this model. Shard and tome drops are not included in `fullBattlerIncome`.

## 6. Potion Boost versus farm: Battler Wisdom effect

Start with the maximum sustainable Wisdom tier `P0` and the entered Resonance tier. A one-point Potion Boost upgrade changes `B` to `B+1` with no extra herb consumption.

```text
boostCost = floor(10,000,000 * 1.1^purchasedPotionBoostLevel)
boostEffectGainPercent = 100 / (100 + B)
matchingWisdomTier = ceil(P0 * (101 + B)/(100 + B))
farmEffectGainPercent = 100 * (matchingWisdomTier/P0 - 1)

extraHerbsConsumedPerDay = [PotionHerbs(matchingWisdomTier) - PotionHerbs(P0)]
                          * H / duration
requiredHerbsPerDay = [PotionHerbs(matchingWisdomTier) + ResonanceHerbs(Z)]
                     * H / duration
```

For the farm alternative, first bring the lowest farm section up toward the others. Once sections are tied, distribute extra levels evenly, differing by at most one. Binary-search the minimum total added levels that produce the required daily herbs along this balanced path. This is a defined balancing strategy, not an exhaustive optimization across arbitrary resource prices.

```text
farmResources = sum over Golems, Fertilizer, Plots of FarmResources(L, addedLevels)
extraProductionPerHour = upgradedHerbsPerHour - currentHerbsPerHour
hedgeLevels = ceil(max(0, extraProductionPerHour * 50,000) / 10^9)
farmAndHedgeCost = farmResources*pRes + hedgeLevels*10^12

boostCostPerPercent = boostCost / boostEffectGainPercent
farmCostPerPercent  = farmAndHedgeCost / farmEffectGainPercent
Recommended option = lower cost per percent gain
```

These percentages measure the change in the **Wisdom potion's effect**, not the change in total character XP after all other bonuses. Resonance's MD benefit is reported separately. No comparison is produced for P0=0; a matching Wisdom tier above 999,999 is unavailable. Keep exact individual farm increments in the calculation even when the UI rounds them into one combined label.

## 7. Resonance shard income from one Potion Boost upgrade

```text
x = 3*BattleLevel + MiningLevel + FishingLevel + WoodcuttingLevel
minimumBaseDrop = 100 * (1 + x/10)^(1 - 0.3*x/(x + 20000))
maximumBaseDrop = 2 * minimumBaseDrop
averageBaseDrop = 1.5 * minimumBaseDrop

baseDropChance = 1/80
effectiveDropChance = min(1, baseDropChance * (1 + DropBoost/100))
dropsPerDay = A * effectiveDropChance

resonanceBonusPercent = 5 * Z * (1 + B/100)
extraResonanceBonusPercent = 5 * Z / 100
nextResonanceBonusPercent = resonanceBonusPercent + extraResonanceBonusPercent

shardConstellationMultiplier = 1 + 0.03 * Constellation[14]
averageDrop = averageBaseDrop
             * (1 + (EquipmentShardBonus + resonanceBonusPercent)/100)
             * shardConstellationMultiplier
currentShardsPerDay = dropsPerDay * averageDrop
extraShardsPerDay = dropsPerDay * averageBaseDrop * extraResonanceBonusPercent/100
                   * shardConstellationMultiplier

extraShardsRetainedAt90PercentTax = extraShardsPerDay * 0.1
extraMDPerDayAt90PercentTax = extraShardsRetainedAt90PercentTax * ShardSellPrice
```

The base chance 1/80 is developer-confirmed according to the user. Gear and Resonance bonuses are additive; unchanged gear cancels from the marginal gain. For shard tax `s`, use `extraShardsPerDay * (1-s/100) * ShardSellPrice`, or multiply the displayed 10%-retained value by `(100-s)/10`. Resource/MD tax does not apply to this separate shard estimate.

## 8. Resource, farm, and building ROI

Ordinary ROI in days is `one-time MD-valued cost / extra MD-valued benefit per day`. A zero or invalid benefit makes it unavailable. The existing division helper returns null for a nonfinite numerator/denominator or an absolute denominator at most `1e-12`; it does not filter negative ROI.

For the TSer resource upgrade formulas, define:

```text
baseFactor = (1 + 0.03g + baseRes + potBase(P, B)) * (1 + baseResResearch/100)
resourceValueFactor = A * q * pRes * a
```

### Base Resources: next 5,000 purchased levels

```text
n = 5000
cost = 5 * [S2(baseResAmount + n) - S2(baseResAmount)]  [MD]
extraDailyValue = (n/100) * (1 + baseResResearch/100)
                 * (research/100) * resourceValueFactor
ROI = cost / extraDailyValue
```

### Potion Boost: one point, TSer

```text
extraBase = potBase(P, B+1) - potBase(P, B) = P * 0.001
extraDailyValue = extraBase * (1 + baseResResearch/100)
                 * (research/100) * resourceValueFactor
cost = floor(10,000,000 * 1.1^purchasedPotionBoostLevel)
ROI = cost / extraDailyValue
```

### Spire: one level

```text
extraResearch = equipmentResearch * 0.01
extraDailyValue = baseFactor * (extraResearch/100) * resourceValueFactor
ROI = BuildingCost(SpireLevel) / extraDailyValue
```

`equipmentResearch` includes effective infusions but not the Spire multiplier; its API derivation is in section 11.

### Gathering research shards: next 1,000 levels

This is the existing TSer Shard ROI, separate from the screenshot's combat shard boost cost.

```text
L = purchased gathering research boost (BaseBoosts[gatheringId])
n = 1000
shardsNeeded = 0.000005 * [S2(L+n) - S2(L-1)]
             + 2 * [S1(L+n) - S1(L-1)]
cost = shardsNeeded * ShardBuyPrice
extraResearch = n * (0.0002*NexusLevel + 0.02) * pinnacleResearchMultiplier
extraDailyValue = baseFactor * (extraResearch/100) * resourceValueFactor
ROI = cost / extraDailyValue
```

The current cost expression sums `0.000005*k^2 + 2*k` from **k=L through L+n inclusive**, i.e. 1,001 terms for n=1,000. This preserves the current implementation; it is not a claim that this endpoint convention has been independently confirmed. Do not replace it with the combat cost. Missing Nexus or shard-price inputs make this ROI unavailable. The Pinnacle multiplier is defined in section 11 and defaults to 1 for older inputs.

### Laboratory: one level

Let `HP = PotionHerbs(P)` and `HZ = ResonanceHerbs(Z)`.

```text
nextDuration = 1 + (D+1)/100
mainHerbsSaved = (HP/duration - HP/nextDuration) * H
resonanceHerbsSaved = (HZ/duration - HZ/nextDuration) * H
mainHerbPrice = TSer ? pBloom : pSage
dailySavings = abs(mainHerbsSaved*mainHerbPrice + resonanceHerbsSaved*pHerb)
ROI = BuildingCost(LaboratoryLevel) / dailySavings
```

### Dust Collector: one level

```text
extraDailyMD = playerBattleMDPerDay(DustCollectorLevel+1)
              - playerBattleMDPerDay(DustCollectorLevel)
ROI = BuildingCost(DustCollectorLevel) / extraDailyMD
```

### Farm without Hedge: choose one section +1,000

Evaluate Golems, Fertilizer, and Plots individually; choose the lowest finite ROI.

```text
extraHerbsPerDay = 24 * [herbsPerHour(sectionLevel+1000) - currentHerbsPerHour]
cost = [1000L^2 + 1,001,000L + 333,833,500 + 208,500] * pRes
dailyBenefit = extraHerbsPerDay * (pHerb - 50,000)
ROI = cost / dailyBenefit
```

The legacy farm ROI cost includes an extra **208,500 resource units** beyond the ordinary sum of squares. The newer balanced farm potion comparison uses the plain sum of squares and does not include this extra term. This document preserves both paths; it does not establish a game-mechanic reason for the extra term.

### Farm plus Hedge: choose one section +1,000 and cover its added levy

```text
extraHerbsPerHour = extraHerbsPerDay / 24
hedgeLevels = ceil(max(0, extraHerbsPerHour*50,000) / 10^9)
combinedCost = farmCostFromPreviousFormula + hedgeLevels*10^12
dailyBenefit = extraHerbsPerDay * pHerb
ROI = combinedCost / dailyBenefit
```

Select the lowest finite paired ROI. Do not add avoided farm tax again to the gross herb benefit. This ROI does not credit rounding surplus in the whole Hedge levels.

```text
Standalone Hedge ROI = 10^12 / (10^9 * 24) = 41.666666... days
```

## 9. Tome Drop upgrades and ROI

These are the resource-funded Tome Drop upgrades used by both roles, not the screenshot's spell/resistance rank costs.

```text
TomeTotalCost(L) = 200L^5 + 250250L^4 + (1499500/3)L^3
                  + 249750L^2 - (100/3)L
upgradeResources = TomeTotalCost(L+1) - TomeTotalCost(L)
cost = upgradeResources * pRes
```

Select the highest-level Nature, Water, or Fire tome upgrade; ties follow that order. Use the selected tome's own sell price.

```text
tomeDropChance = 0.005 * (1 + DropBoost/100)
enemyBoost = floor((HighestEnemy + 150)/1000)
guildMultiplier = 1 + log2(1 + 0.006*GuildLevel)
averageDrop = (L + enemyBoost/2 + 1) * guildMultiplier
nextAverageDrop = averageDrop + guildMultiplier
currentTomesPerDay = A * tomeDropChance * averageDrop
extraTomesPerDay = A * tomeDropChance * guildMultiplier
extraDailyValue = extraTomesPerDay * SelectedTomeSellPrice
ROI = cost / extraDailyValue
```

Unlike the shard drop helper, the existing tome helper does not cap drop chance at 1. It applies neither resource/MD tax nor a separate tome tax. Tome income is not added to either role's main daily income total.

## 10. Workshop to Dust Collector cumulative payback model

This is the calculator's existing model, with the same opportunity-cost term. It estimates accumulating value from construction speed and continued Dust Collector building; it is not a fixed daily-income upgrade ROI.

```text
W = Workshop level
C = total Construction boost
p = active Construction pet level, or 0
s = buildSpeed, default 1

petMultiplier = [3*(1-0.02p) + 6*(0.02p)]/3 = 1 + 0.02p
ambidextrousChance = BaseBoosts[104] * Constellation[6] / 10000
expectedExtraSecondsPerTick = 3 * ambidextrousChance
tickMultiplier = petMultiplier + ambidextrousChance
m = (1 + C/100) * tickMultiplier * s
nextM = (1 + (C+1)/100) * tickMultiplier * s
buildsPerDay = (86400/m) * s
timeSavePerBuild = buildsPerDay * [1 - (1+C/100)/(1+(C+1)/100)] / s

collectorDailyValue = extra daily taxed MD from one Dust Collector level
dustTowerValuePerSecond = collectorDailyValue * m / 86400
valuePerFutureBuild = timeSavePerBuild * dustTowerValuePerSecond
dailyCumulativeValue = valuePerFutureBuild * m
workshopCost = BuildingCost(W)

paybackNumerator = collectorDailyValue + workshopCost*s
paybackDenominator = 0.5 * dailyCumulativeValue
paybackDays = sqrt(paybackNumerator / paybackDenominator)
```

Under this model, accumulated modeled value at day `d` is `0.5*dailyCumulativeValue*d^2`, reaching the modeled numerator at payback. `collectorDailyValue` in the numerator is the existing opportunity-cost allowance. The coefficients are held constant; ongoing enemy progression, rising future building costs, queue interruptions, and funding every future collector are not simulated.

The source calls `m` `buildSeconds` internally but returns it as `currentConstructionMultiplier`; treat these as legacy variable names, not an independently verified literal building duration. Preserve the equation when porting; a redesign would be a separate change.

## 11. API inputs, equipment, and Nexus inference

The current app requests `/players/:username`, `/market`, and `/guilds` from the Manarion API, using its browser relay with a direct-API fallback. The direct base is `https://api.manarion.com`. These are the existing app's routes; this reference does not verify a guild-member roster endpoint. Role, potion tiers, and resource/MD tax come from entered settings, not automatic API inference.

| Normalized input | Source / conversion |
| --- | --- |
| Battle / gathering levels | `Level`, `MiningLevel`, `FishingLevel`, `WoodcuttingLevel` |
| Current / highest enemy | `Enemy`, `HighestEnemy` |
| Golems / Fertilizer / Plots | `TotalBoosts[130]`, `[131]`, `[132]` |
| Hedge level | `BaseBoosts[134]` |
| Total potion duration | `TotalBoosts[110]` |
| Total / purchased Potion Boost | `TotalBoosts[108]` / `BaseBoosts[108]`; purchased falls back to total if missing |
| Total base resources | `TotalBoosts[124] / 100` |
| Purchased base resources | `BaseBoosts[124]` |
| Base resource research | `TotalBoosts[106]` |
| Research | `max(TotalBoosts[30], [31], [32]) * 100` |
| Laboratory / Workshop | `BaseBoosts[160]` / `BaseBoosts[150]` |
| Spire for ROI / Nexus inference | `TotalBoosts[152]` / `BaseBoosts[152]` |
| Dust Collector | `TotalBoosts[161]` |
| Dust codex / equipment bonus | `TotalBoosts[101]` / `[121]` |
| Drop Boost / equipment shard bonus | `TotalBoosts[102]` / `[122]` |
| Nature / Water / Fire tome levels | `BaseBoosts[27]` / `[26]` / `[25]` |
| Construction boost | `TotalBoosts[104]`; fallback `Workshop + BaseBoosts[104]` |
| Purchased Construction Codex / Ambidextrous ranks | `BaseBoosts[104]` / `Constellation[6]` |
| Shards constellation ranks | `Constellation[14]`; amount multiplier `1 + 0.03 * ranks` |
| Potency | `Constellation[11]`; already included in `TotalBoosts[108]`, do not add again |
| Pinnacle | `Constellation[49] > 0`; research multiplier from matching equipped items and `BaseBoosts[152]` |
| Construction pet | `Pets[24].Level` when active; search by pet ID 24 if needed; missing Active defaults true in parser |
| Guild level | Match player's `GuildID` to guild list `ID`, then read `Level` |
| Non-Distillation sigil warning | `SigilBoost > 0 && SigilBoost != 110` |

Market mappings:

```text
Bloomwell = Sell[41]; Sageroot = Sell[40]
Resource average = round((Sell[8] + Sell[7] + Sell[9])/3)
Shard value from drops = Sell[2]
Shard purchase cost for ROI = Buy[2]
Nature tome = Sell[15]; Water tome = Sell[14]; Fire tome = Sell[13]
```

The parser additionally exposes rounded buy/sell midpoint prices for Power Orb (35), Perfect Orb (50), Divine Essence (47), and Elementium (46); they currently have no associated ROI formulas here.

Equipment and Nexus:

```text
gatheringId = 30 for highest Mining, 31 for highest Fishing, otherwise 32
             (ties prefer Mining, then Fishing)
effectiveInfusions(item) = item.Infusions + (item is Imbued ? 1 : 0)
infusionMultiplier(item) = 1 + effectiveInfusions(item)/20
Only equipped items contribute below (missing IsEquipped defaults to equipped).

matchingItems = count(equipped items with positive Boosts[gatheringId])
pinnacleResearchMultiplier = Constellation[49] > 0
  ? 1 + matchingItems * 0.0005 * (1 + BaseBoosts[152]/100)
  : 1

equipmentResearch = sum(item.Boosts[gatheringId] * infusionMultiplier(item) / 50)
equipmentBaseRes = sum(item.Boosts[124]/100 * infusionMultiplier(item))

equipmentTerm = sum(floor(item.Boosts[gatheringId] * infusionMultiplier(item))
                    * (1 + BaseBoosts[152]/100))

NexusLevel = round((
  (((TotalBoosts[gatheringId] - 1)/pinnacleResearchMultiplier*100/0.02 - equipmentTerm)
     / BaseBoosts[gatheringId]) - 1
) * 100)
```

Missing item boosts contribute zero. Imbued is recognized by numeric prefix ID 10, an Imbued item name, or an explicit Imbued prefix name. The API's `Infusions` excludes the extra infusion; add it exactly once even when multiple identifiers match. Ambitious is counted from equipped items' names or explicit prefix names, capped at eight.

The Pinnacle formula matches the October 18 API totals for Hohmono, Ownin, and Pepo. The observed multiplier uses the **full Spire factor**, including its base 1x (equivalently, `1 + matchingItems * (Spire + 100) * 0.000005`). It multiplies the research bonus, excluding the API's baseline 1. For Hohmono, eight matching items and Spire 1,415 give `1.0606x` and Nexus 25,921. Current research already contains Pinnacle: remove it only for the inverse Nexus calculation, and apply it to the marginal research from new shard upgrades. This correction does not add a Pinnacle model to the Spire ROI formula above.

`equipmentBaseRes` is available from normalization but the income formula already uses `TotalBoosts[124]/100`; do not add equipment base resources again. Nexus inference uses the highest gathering **level** to select its boost ID, while normalized research independently uses the largest total gathering boost. Do not confuse the two selections. An invalid Nexus inference returns unavailable, not a genuine level zero.

## 12. Combining players for a guild income project

Choose one active role per player, and retain their selected potion tiers and tax settings.

```text
grossActivityValue = TSer ? grossResourceValuePerDay : grossBattleMDPerDay
playerActivityValue = grossActivityValue * (1 - resourceOrMDTax/100)
guildActivityTaxValue = grossActivityValue - playerActivityValue
playerNetIncome = playerActivityValue + farmNetIncome
combinedPlayerAndGuildValue = playerNetIncome + guildActivityTaxValue
```

Sum each column over successfully fetched, uniquely identified members. Gross activity includes the tax portion; do not add guild tax to gross activity again. TSer full income already includes baseline resources; do not add potted and unpotted days together. The farm production levy is not automatically guild income. Shard/tome income and their tax rates are separate optional categories; the current daily-income totals omit them. Partial API failures and missing settings should remain identifiable instead of silently contributing a fabricated zero.

For an exact implementation reference, carry `calculator.js` alongside this document. `validation.test.js`, `battler-potion.test.js`, and `data.js` provide historical regression fixtures; they are not fresh player data. All special cases above describe the source as captured, not additional changes to the current website.
