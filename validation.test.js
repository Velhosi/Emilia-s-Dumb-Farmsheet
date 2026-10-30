'use strict';

const assert = require('node:assert/strict');
const Calc = require('./calculator.js');
const { WORKBOOK_SNAPSHOTS } = require('./data.js');

assert.equal(Calc.C.GATHER_ACTIONS_PER_DAY, 27400, 'Daily gathering actions');
assert.equal(Calc.C.TS_UNPOTTED_ACTIONS, 27400, 'Daily unpotted TSer actions');
assert.equal(Calc.C.TS_POTTED_ACTIONS, 27400, 'Daily potted TSer actions');
approximately(Calc.C.BATTLE_HOURS_PER_DAY, 22 + 50 / 60, 'Event day is 22 hours 50 minutes');
approximately(
  Calc.C.BATTLE_HOURS_PER_DAY * Calc.C.BATTLE_ACTIONS_PER_HOUR,
  Calc.C.TS_POTTED_ACTIONS,
  'Hourly event calculations cover the same actions as daily income',
);
approximately(Calc.C.HEDGE_ROI_DAYS, 41.666666666666664, 'Standalone Hedge Fund ROI');

const result = Calc.calculate(WORKBOOK_SNAPSHOTS.hohmono);
// The workbook credited unused Hedge Fund discount as income. The game caps
// upkeep at zero, so remove that historical credit from absolute income checks.
const unusedHedgeCredit = Math.max(0, WORKBOOK_SNAPSHOTS.hohmono.farmDiscount * 1e9 * 24
  - Calc.helpers.herbsPerHour(WORKBOOK_SNAPSHOTS.hohmono) * 24 * Calc.C.FARM_DUST_PER_HERB);

function approximately(actual, expected, label) {
  const tolerance = Math.max(Math.abs(expected) * 1e-15, 1e-12);
  const difference = Math.abs(actual - expected);
  assert.ok(
    difference <= tolerance,
    `${label}: expected ${expected}, received ${actual} (difference ${difference})`,
  );
}

const validatedOutputs = {
  'Battler net herbs': [result.battler.netHerbs, 106518758838.28857],
  'TSer leftover Bloomwells': [result.tser.leftoverBloom, -458630448292.9635],
  'TSer leftover Sageroots': [result.tser.leftoverSage, 565149207131.2521],
  'TSer net herbs': [result.tser.netHerbs, 106518758838.28857],
  'TSer leftover herb sale value': [result.tser.leftoverSold, 8717660153120744],
  'TSer farm tax value': [result.tser.farmTax, 8717679293508576 - unusedHedgeCredit],
  'TSer extra resource value': [result.tser.extraResValue, 208048611835618300],
  'TSer farm + potion income': [result.tser.farmPlusPotIncome, 216766291129126880 - unusedHedgeCredit],
  'TSer full income': [result.tser.fullIncome, 305679808585759500 - unusedHedgeCredit],
  'TSer best-potion income': [result.tser.bestIncome, 240013380516306200 - unusedHedgeCredit],
  'TSer current-potion loss': [result.tser.lossFromCurrentPotion, 23247089387179330],
  'TSer percent loss': [result.tser.percentLoss, 23247089387179330 / (240013380516306200 - unusedHedgeCredit) * 100],
  'Battler Lab ROI': [result.roi.battler.lab, 146.89458614873018],
  'TSer Lab ROI': [result.roi.tser.lab, 137.67279002733477],
  'Spire ROI': [result.roi.tser.spire, 142.21093788669074],
  'Potion boost ROI': [result.roi.tser.potionBoost, 229.5462235769435],
  'Base resources ROI': [result.roi.tser.baseRes, 151.15057138133992],
  'Shards ROI': [result.roi.tser.shards, 132.9698457382057],
  'Farm no hedge ROI': [result.roi.tser.farmNoHedge, 116.84620105889435],
  'Farm + hedge ROI': [result.roi.tser.farmHedge, 86.3163196801818],
  'Tome drop ROI': [result.roi.tser.tomeDrop, 274.0621370401716],
};

assert.equal(result.tser.bestPotion, 125000, 'Highest-income potion');
const guildPotion = result.tser.guildPotionAnalysis;
assert.equal(guildPotion.bestPotion, 161000, 'Guild potion maximizes value before resource tax');
approximately(guildPotion.grossResourceValue, 474659338068525950, 'Guild gross resource value');
approximately(guildPotion.currentGrossResourceValue, 494936882153751550, 'Current potion gross resource value');
approximately(guildPotion.grossResourceChange, -20277544085225600, 'Lower efficient tier shows its lower gross resource output');
approximately(
  guildPotion.currentGrossResourceValue + guildPotion.grossResourceChange,
  guildPotion.grossResourceValue,
  'Displayed gross resource difference reconciles the current and recommended potions',
);
assert.equal(
  Calc.helpers.tserGuildPotionAnalysis({ ...WORKBOOK_SNAPSHOTS.hohmono, harvestPotion: guildPotion.bestPotion }).grossResourceChange,
  0,
  'Gross resource change is zero when already using the recommended potion',
);
approximately(guildPotion.farmIncome, 30190727219356870 - unusedHedgeCredit, 'Guild potion still accounts for farm and herb costs');
approximately(guildPotion.dailyIncome, 504850065287882800 - unusedHedgeCredit, 'Guild total daily income includes baseline resources');
assert.ok(Math.abs(guildPotion.changeFromCurrent - 1195503840622720) <= Number.EPSILON * guildPotion.dailyIncome,
  'Guild gain is unchanged, allowing rounding from subtracting two large daily totals');
approximately(
  guildPotion.grossResourceValue + guildPotion.farmIncome,
  guildPotion.dailyIncome,
  'Guild resource and farm values sum to total daily income',
);
for (const tax of [0, 25, 99, 100]) {
  assert.deepEqual(
    Calc.helpers.tserGuildPotionAnalysis({ ...WORKBOOK_SNAPSHOTS.hohmono, tax }),
    guildPotion,
    `Guild potion and income are independent of ${tax}% resource tax`,
  );
}
const untaxedTserInputs = { ...WORKBOOK_SNAPSHOTS.hohmono, tax: 0 };
assert.equal(
  Calc.helpers.optimizeTserPotion(untaxedTserInputs).bestPotion,
  guildPotion.bestPotion,
  'Guild and personal recommendations agree when resource tax is zero',
);
for (const potion of [guildPotion.bestPotion - 1000, guildPotion.bestPotion + 1000]) {
  assert.ok(
    Calc.helpers.tserAtPotion(untaxedTserInputs, potion).fullIncome < guildPotion.dailyIncome,
    'Adjacent searched tiers produce less total guild value',
  );
}
assert.ok(
  Calc.helpers.tserGuildPotionAnalysis({
    ...WORKBOOK_SNAPSHOTS.hohmono,
    bloomwellPrice: WORKBOOK_SNAPSHOTS.hohmono.bloomwellPrice * 4,
  }).bestPotion < guildPotion.bestPotion,
  'More expensive Harvest herbs lower the efficient guild potion',
);
assert.equal(
  Calc.helpers.tserGuildPotionAnalysis({
    ...WORKBOOK_SNAPSHOTS.hohmono, bloomwellPrice: 0, sagerootPrice: 0,
  }).bestPotion,
  Calc.C.MAX_TSER_POTION,
  'Guild optimizer reaches the ceiling when potion herbs have no cost',
);
assert.equal(
  Calc.helpers.tserGuildPotionAnalysis({
    ...WORKBOOK_SNAPSHOTS.hohmono, averageResourcePrice: 0,
  }).bestPotion,
  0,
  'Guild optimizer avoids Harvest herb costs when resources have no value',
);
assert.equal(WORKBOOK_SNAPSHOTS.hohmono.tax, 40, 'Guild analysis preserves the entered tax');
assert.equal(result.battler.maxSustainablePotion, 176763, 'Battler maximum sustainable whole-level potion');
assert.equal(result.tser.maxSustainablePotion, 176763, 'TSer maximum sustainable whole-level potion');
assert.equal(
  result.battler.maxSustainablePotion,
  result.tser.maxSustainablePotion,
  'Battler and TSer exact ceilings use the same herb budget',
);
assert.equal(
  result.battler.netHerbs,
  result.tser.netHerbs,
  'Herb trading gives Battler and TSer the same combined net herbs',
);
assert.ok(
  result.tser.netHerbs > 0 && result.tser.maxSustainablePotion >= WORKBOOK_SNAPSHOTS.hohmono.harvestPotion,
  'A current potion with positive net herbs remains sustainable after herb trading',
);
const sustainableTotals = Calc.helpers.tserAtPotion(
  WORKBOOK_SNAPSHOTS.hohmono,
  result.tser.maxSustainablePotion,
);
const sustainableBattlerTotals = Calc.helpers.battlerAtPotion(
  WORKBOOK_SNAPSHOTS.hohmono,
  result.battler.maxSustainablePotion,
);
const nextBattlerPotionTotals = Calc.helpers.battlerAtPotion(
  WORKBOOK_SNAPSHOTS.hohmono,
  result.battler.maxSustainablePotion + 1,
);
const nextPotionTotals = Calc.helpers.tserAtPotion(
  WORKBOOK_SNAPSHOTS.hohmono,
  result.tser.maxSustainablePotion + 1,
);
assert.ok(
  sustainableTotals.leftoverBloom + sustainableTotals.leftoverSage >= 0,
  'Maximum sustainable potion has nonnegative combined herbs',
);
assert.ok(
  nextPotionTotals.leftoverBloom + nextPotionTotals.leftoverSage < 0,
  'One level above the maximum sustainable TSer potion has negative combined herbs',
);
assert.ok(
  sustainableBattlerTotals.leftoverBloom + sustainableBattlerTotals.leftoverSage >= 0,
  'Battler maximum sustainable potion has nonnegative combined herbs',
);
assert.ok(
  nextBattlerPotionTotals.leftoverBloom + nextBattlerPotionTotals.leftoverSage < 0,
  'The next Battler potion tier has negative combined herbs',
);
assert.ok(
  Calc.helpers.maxSustainableTserPotion({ ...WORKBOOK_SNAPSHOTS.hohmono, resonancePotion: 0 })
    > result.tser.maxSustainablePotion,
  'Maximum sustainable potion accounts for Resonance herb consumption after herb trading',
);
assert.ok(
  Calc.helpers.maxSustainableTserPotion({
    ...WORKBOOK_SNAPSHOTS.hohmono,
    potDuration: WORKBOOK_SNAPSHOTS.hohmono.potDuration + 100,
  }) > result.tser.maxSustainablePotion,
  'Maximum sustainable potion accounts for total Potion Duration boost',
);
assert.equal(
  result.roi.tser.tomeDrop,
  result.roi.battler.tomeDrop,
  'Battler and TSer Tome Drop ROI must remain identical',
);

const tomeDropBreakdown = Calc.helpers.tomeDropRoiBreakdown(WORKBOOK_SNAPSHOTS.hohmono);
approximately(
  tomeDropBreakdown.successfulDropsPerDay,
  27400 * tomeDropBreakdown.effectiveDropChance,
  'Tome drops cover all 27,400 event actions',
);
assert.equal(tomeDropBreakdown.tomeName, 'Water', 'Tome Drop selects the highest-level tome');
assert.equal(tomeDropBreakdown.currentLevel, 425, 'Tome Drop reports the selected tome level');
approximately(
  tomeDropBreakdown.tomeMarketPrice,
  WORKBOOK_SNAPSHOTS.hohmono.waterTomePrice,
  'Tome Drop values added drops with the selected tome sell price',
);
approximately(
  tomeDropBreakdown.extraValuePerDay,
  tomeDropBreakdown.extraTomesPerDay * tomeDropBreakdown.tomeMarketPrice,
  'Tome Drop daily value breakdown',
);
approximately(
  tomeDropBreakdown.roi,
  result.roi.tser.tomeDrop,
  'Tome Drop information panel breakdown matches ROI',
);

const battlerLabBreakdown = Calc.helpers.labRoiBreakdown(WORKBOOK_SNAPSHOTS.hohmono, 'battler');
const tserLabBreakdown = Calc.helpers.labRoiBreakdown(WORKBOOK_SNAPSHOTS.hohmono, 'tser');
approximately(battlerLabBreakdown.roi, result.roi.battler.lab, 'Battler Lab ROI breakdown');
approximately(tserLabBreakdown.roi, result.roi.tser.lab, 'TSer Lab ROI breakdown');
approximately(
  battlerLabBreakdown.harvestSavingsValuePerDay
    + battlerLabBreakdown.resonanceSavingsValuePerDay,
  battlerLabBreakdown.totalSavingsValuePerDay,
  'Battler Lab daily savings breakdown',
);
approximately(
  battlerLabBreakdown.harvestHerbsSavedPerHour * battlerLabBreakdown.eventHours,
  battlerLabBreakdown.harvestHerbsSavedPerDay,
  'Battler Lab converts hourly Wisdom herb savings across the full event day',
);
approximately(
  battlerLabBreakdown.resonanceHerbsSavedPerHour * battlerLabBreakdown.eventHours,
  battlerLabBreakdown.resonanceHerbsSavedPerDay,
  'Battler Lab converts hourly Resonance herb savings across the full event day',
);
assert.notEqual(
  battlerLabBreakdown.harvestSavingsValuePerDay,
  tserLabBreakdown.harvestSavingsValuePerDay,
  'Role-specific Lab ROI values Harvest savings with the herb consumed by that role',
);
for (const role of ['battler', 'tser']) {
  const inputs = WORKBOOK_SNAPSHOTS.hohmono;
  const breakdown = Calc.helpers.labRoiBreakdown(inputs, role);
  approximately(breakdown.eventHours, 22 + 50 / 60, `${role} Lab uses the full event duration`);
  const upgraded = Calc.helpers[`${role}AtPotion`](
    { ...inputs, potDuration: inputs.potDuration + 1 },
    inputs.harvestPotion,
  );
  const extraHerbIncome = upgraded.leftoverSold - result[role].leftoverSold;
  // Subtracting large herb-sale totals introduces more rounding than the savings breakdown.
  assert.ok(
    Math.abs(extraHerbIncome - breakdown.totalSavingsValuePerDay)
      <= breakdown.totalSavingsValuePerDay * 1e-12,
    `${role} Lab savings match the actual daily herb income gained from +1 Potion Duration`,
  );
}

const mdIncomeBreakdown = Calc.helpers.mdIncomeBreakdown(WORKBOOK_SNAPSHOTS.hohmono);
approximately(
  mdIncomeBreakdown.dailyTotal,
  result.battler.mdEarned,
  'MD information panel breakdown matches Battler daily MD',
);

// September 14 Emilia API snapshot: Elnaeth reported 283.47Qa/day and 12.41Qa/hour.
const emiliaMdSnapshot = {
  ...WORKBOOK_SNAPSHOTS.emilia,
  currentEnemy: 617692,
  dustCollector: 930,
  dustCodex: 205,
  dustEquipment: 289563,
  tax: 25,
  harvestPotion: 105000,
  resonancePotion: 40000,
};
const emiliaMd = Calc.helpers.mdIncomeBreakdown(emiliaMdSnapshot);
approximately(emiliaMd.dailyTotal, 283468393041235970, 'Emilia corrected daily MD');
assert.equal((emiliaMd.dailyTotal / 1e15).toFixed(2), '283.47', 'Emilia matches tracker daily MD');
assert.equal(
  (emiliaMd.afterTax * Calc.C.BATTLE_ACTIONS_PER_HOUR / 1e15).toFixed(2),
  '12.41',
  'Emilia matches tracker hourly MD',
);
approximately(
  Calc.calculate(emiliaMdSnapshot).battler.mdEarned,
  emiliaMd.dailyTotal,
  'Emilia daily income uses the corrected breakdown',
);
for (const [currentEnemy, expectedBase] of [
  [149849, 5376654.6432439685],
  [149850, 5376707.656796547],
  [149851, 5376787.420906818],
]) {
  approximately(
    Calc.helpers.mdIncomeBreakdown({ currentEnemy }).basePerBattle,
    expectedBase,
    `MD scaling boundary at effective enemy level ${currentEnemy + 150}`,
  );
}

const dustCollectorBreakdown = Calc.helpers.dustCollectorRoiBreakdown(
  WORKBOOK_SNAPSHOTS.hohmono,
);
approximately(
  dustCollectorBreakdown.roi,
  result.roi.battler.dustCollector,
  'Dust Collector information panel breakdown matches ROI',
);
approximately(
  dustCollectorBreakdown.upgradedDailyMd - dustCollectorBreakdown.currentDailyMd,
  dustCollectorBreakdown.extraDailyMd,
  'Dust Collector daily benefit breakdown',
);
approximately(
  dustCollectorBreakdown.nextBoostPercent - dustCollectorBreakdown.currentBoostPercent,
  0.2,
  'One Dust Collector level adds 0.2 percentage points',
);

const workshopDustCollectorBreakdown = Calc.helpers.workshopDustCollectorRoiBreakdown(
  WORKBOOK_SNAPSHOTS.hohmono,
);
approximately(
  workshopDustCollectorBreakdown.roi,
  result.roi.battler.workshopDustCollector,
  'Workshop to Dust Collector information panel breakdown matches ROI',
);
assert.equal(
  workshopDustCollectorBreakdown.constructionBoost,
  WORKBOOK_SNAPSHOTS.hohmono.workshopLevel + WORKBOOK_SNAPSHOTS.hohmono.constructionCodex,
  'Workbook fallback combines Workshop and Construction Codex once',
);
assert.equal(
  workshopDustCollectorBreakdown.constructionPetLevel,
  WORKBOOK_SNAPSHOTS.hohmono.constructionPetLevel,
  'Workshop breakdown uses the active Construction pet level',
);
approximately(
  workshopDustCollectorBreakdown.collectorDailyValue,
  dustCollectorBreakdown.extraDailyMd,
  'Workshop payback uses the next Dust Collector level daily benefit',
);
approximately(
  workshopDustCollectorBreakdown.roi,
  Math.sqrt(
    workshopDustCollectorBreakdown.paybackNumerator
      / workshopDustCollectorBreakdown.paybackDenominator,
  ),
  'Workshop cumulative payback calculation',
);

const farmNoHedgeBreakdown = Calc.helpers.farmNoHedgeRoiBreakdown(
  WORKBOOK_SNAPSHOTS.hohmono,
);
approximately(
  farmNoHedgeBreakdown.roi,
  result.roi.battler.farmNoHedge,
  'Farm without Hedge Fund information panel matches Battler ROI',
);
approximately(
  farmNoHedgeBreakdown.roi,
  result.roi.tser.farmNoHedge,
  'Farm without Hedge Fund information panel matches TSer ROI',
);
approximately(
  farmNoHedgeBreakdown.grossHerbValuePerDay - farmNoHedgeBreakdown.farmTaxPerDay,
  farmNoHedgeBreakdown.netDailyBenefit,
  'Farm without Hedge Fund daily benefit includes the herb production tax',
);
approximately(
  farmNoHedgeBreakdown.roi,
  Math.min(...Calc.helpers.farmUpgradeStats(WORKBOOK_SNAPSHOTS.hohmono)
    .map(row => row.taxedROI)
    .filter(Number.isFinite)),
  'Farm without Hedge Fund selects the lowest upgrade ROI rather than the average',
);

const farmHedgeBreakdown = Calc.helpers.farmHedgeRoiBreakdown(
  WORKBOOK_SNAPSHOTS.hohmono,
);
approximately(
  farmHedgeBreakdown.roi,
  result.roi.battler.farmHedge,
  'Farm with Hedge Fund information panel matches Battler ROI',
);
approximately(
  farmHedgeBreakdown.roi,
  result.roi.tser.farmHedge,
  'Farm with Hedge Fund information panel matches TSer ROI',
);
assert.equal(
  farmHedgeBreakdown.hedgeLevelsNeeded,
  Math.ceil(farmHedgeBreakdown.addedFarmTaxPerHour / Calc.C.HEDGE_DISCOUNT_PER_HOUR),
  'Farm with Hedge Fund buys enough whole increases to cover the added hourly tax',
);
approximately(
  farmHedgeBreakdown.hedgeCost,
  farmHedgeBreakdown.hedgeLevelsNeeded * Calc.C.HEDGE_COST_PER_LEVEL,
  'Farm with Hedge Fund includes the full one-time Hedge Fund cost',
);
approximately(
  farmHedgeBreakdown.combinedCost,
  farmHedgeBreakdown.farmUpgradeCost + farmHedgeBreakdown.hedgeCost,
  'Farm with Hedge Fund combines both one-time costs',
);
approximately(
  farmHedgeBreakdown.roi,
  farmHedgeBreakdown.combinedCost / farmHedgeBreakdown.grossHerbValuePerDay,
  'Farm with Hedge Fund uses gross herb value without double-counting avoided tax',
);

for (const [label, [actual, expected]] of Object.entries(validatedOutputs)) {
  approximately(actual, expected, label);
}

// Ownin's October 17 API values: 245 purchased levels, 249% effective boost.
// Use the existing fixture for other inputs; these are not Ownin income estimates.
const owninPotionBoost = Calc.normalizeFromApis(
  { BaseBoosts: { 108: 245 }, TotalBoosts: { 108: 249 } }, {}, [], {},
);
assert.equal(owninPotionBoost.potionBoostLevel, 245);
assert.equal(owninPotionBoost.potionBoost, 249);
const bonusPotionInputs = {
  ...WORKBOOK_SNAPSHOTS.hohmono,
  potionBoostLevel: owninPotionBoost.potionBoostLevel,
  potionBoost: owninPotionBoost.potionBoost,
};
const bonusPotionResult = Calc.calculate(bonusPotionInputs);
// Changing the total can change rounding in the subtraction of daily resource totals.
assert.ok(
  Math.abs(bonusPotionResult.roi.tser.potionBoost / result.roi.tser.potionBoost - 1) < 1e-12,
  'Extra Potion Boost preserves the next purchased upgrade cost and marginal ROI',
);
assert.ok(
  bonusPotionResult.tser.grossPotted > result.tser.grossPotted,
  'Effective Potion Boost still increases current resource income',
);
const purchased249Result = Calc.calculate({ ...bonusPotionInputs, potionBoostLevel: 249 });
approximately(
  purchased249Result.roi.tser.potionBoost / bonusPotionResult.roi.tser.potionBoost,
  1.4641,
  'Four additional purchased levels increase the upgrade cost by 46.41%',
);
assert.deepEqual(
  bonusPotionResult.tser,
  purchased249Result.tser,
  'Purchased level changes pricing without changing effective potion income',
);
const zeroPurchasedResult = Calc.calculate({ ...bonusPotionInputs, potionBoostLevel: 0 });
approximately(
  zeroPurchasedResult.roi.tser.potionBoost / bonusPotionResult.roi.tser.potionBoost,
  10_000_000 / Math.floor(10_000_000 * 1.1 ** 245),
  'A zero purchased level is used rather than falling back to the total boost',
);

const fourAmbitiousResult = Calc.calculate({
  ...WORKBOOK_SNAPSHOTS.hohmono,
  ambitiousCount: 4,
});

approximately(
  fourAmbitiousResult.tser.ambitiousPenaltyPercent,
  4,
  'Four Ambitious prefixes apply a 4% total-resource penalty',
);
approximately(
  fourAmbitiousResult.tser.grossUnpotted,
  result.tser.grossUnpotted * 0.96,
  'Ambitious penalty applies to unpotted TSer resources',
);
approximately(
  fourAmbitiousResult.tser.grossPotted,
  result.tser.grossPotted * 0.96,
  'Ambitious penalty applies to potted TSer resources',
);
assert.equal(
  fourAmbitiousResult.battler.fullIncome,
  result.battler.fullIncome,
  'Ambitious prefixes do not change Battler income',
);

for (const key of ['spire', 'potionBoost', 'baseRes', 'shards']) {
  approximately(
    fourAmbitiousResult.roi.tser[key],
    result.roi.tser[key] / 0.96,
    `Ambitious penalty applies to ${key} ROI`,
  );
}

for (const key of ['lab', 'farmNoHedge', 'farmHedge', 'tomeDrop']) {
  assert.equal(
    fourAmbitiousResult.roi.tser[key],
    result.roi.tser[key],
    `Ambitious prefixes do not change ${key} ROI`,
  );
}

const upgradeRecommendationResult = Calc.calculate({
  ...WORKBOOK_SNAPSHOTS.hohmono,
  harvestPotion: 64000,
});
assert.equal(
  upgradeRecommendationResult.tser.bestPotion,
  125000,
  'A player running a lower potion still receives the higher-income upgrade recommendation',
);

const millionCeilingResult = Calc.calculate({
  ...WORKBOOK_SNAPSHOTS.hohmono,
  bloomwellPrice: 0,
  sagerootPrice: 0,
  farmDiscount: 0,
});
assert.equal(
  millionCeilingResult.tser.bestPotion,
  1_000_000,
  'The optimizer evaluates recommendations through the one-million potion ceiling',
);

const prefixPlayer = {
  MiningLevel: 1,
  FishingLevel: 2,
  WoodcuttingLevel: 3,
  Equipment: {
    1: { Name: 'Ambitious Staff', IsEquipped: true },
    2: { Name: 'Plain Robes', Prefix: 'Ambitious', IsEquipped: true },
    3: { Name: 'Plain Sandals', prefix: { name: 'Ambitious' }, IsEquipped: true },
    4: { Name: 'ambitious Gloves', IsEquipped: true },
    5: { Name: 'Ambitious Hood', IsEquipped: false },
  },
};
const normalizedPrefixPlayer = Calc.normalizeFromApis(
  prefixPlayer,
  { Buy: {}, Sell: {} },
  [],
  { username: 'PrefixTest', tax: 0, harvestPotion: 1000, resonancePotion: 1000 },
);
assert.equal(normalizedPrefixPlayer.ambitiousCount, 4, 'Ambitious prefixes are detected from API equipment');

// September 24 xChrispy API snapshot; the player confirmed Nexus level 23,970.
const imbuedNexusPlayer = {
  MiningLevel: 100069,
  FishingLevel: 70762,
  WoodcuttingLevel: 70762,
  BaseBoosts: { 30: 7211102, 152: 981 },
  TotalBoosts: { 30: 449185.792206 },
  Equipment: Object.fromEntries([
    2265003, 2263108, 2263904, 2257983, 2264840, 2265074, 2266454, 2263202,
  ].map((boost, index) => [index + 1, {
    Name: index === 0 ? "Imbued Prospector's Pickaxe" : 'Prospector equipment',
    Prefix: index === 0 ? 10 : 0,
    IsEquipped: true,
    Infusions: 32,
    Boosts: { 30: boost },
  }])),
};
const normalizeImbuedPlayer = (player) => Calc.normalizeFromApis(
  player, {}, [], { username: 'xChrispy', tax: 25, harvestPotion: 0, resonancePotion: 0 },
);
const normalizedImbuedNexus = normalizeImbuedPlayer(imbuedNexusPlayer);
assert.equal(normalizedImbuedNexus.nexusLevel, 23970, 'Imbued equipment gives the confirmed Nexus level');
const pickaxeWithoutPerk = {
  ...imbuedNexusPlayer.Equipment[1], Name: 'Prospector Pickaxe', Prefix: 0,
};
const withoutImbuedPerk = normalizeImbuedPlayer({
  ...imbuedNexusPlayer,
  Equipment: { ...imbuedNexusPlayer.Equipment, 1: pickaxeWithoutPerk },
});
assert.equal(withoutImbuedPerk.nexusLevel, 23987, 'Ignoring the perk reproduces the inflated Nexus level');
for (const prefixFields of [
  { Prefix: 10 },
  { Prefix: '10' },
  { Prefix: 'Imbued' },
  { Prefix: { Name: 'Imbued' } },
  { Name: 'imbued Prospector Pickaxe' },
  { Name: 'Imbued Prospector Pickaxe', Prefix: 10 },
]) {
  const normalized = normalizeImbuedPlayer({
    ...imbuedNexusPlayer,
    Equipment: {
      ...imbuedNexusPlayer.Equipment,
      1: { ...pickaxeWithoutPerk, ...prefixFields },
    },
  });
  assert.equal(normalized.nexusLevel, 23970, 'Imbued prefix representations add one effective infusion');
}
const actualExtraInfusion = normalizeImbuedPlayer({
  ...imbuedNexusPlayer,
  Equipment: {
    ...imbuedNexusPlayer.Equipment,
    1: { ...pickaxeWithoutPerk, Infusions: 33 },
  },
});
assert.equal(actualExtraInfusion.nexusLevel, 23970, 'Imbued +32 matches a normal +33 item');
approximately(
  normalizedImbuedNexus.equipmentResearch,
  actualExtraInfusion.equipmentResearch,
  'Equipment research also includes the Imbued infusion',
);
const normalizedImbuedResources = normalizeImbuedPlayer({
  ...imbuedNexusPlayer,
  Equipment: { 1: { Name: 'Imbued Pickaxe', Prefix: 10, Infusions: 32, Boosts: { 124: 100 } } },
});
approximately(normalizedImbuedResources.equipmentBaseRes, 2.65, 'Imbued applies once to equipment base resources');

// October 18 API captures cover three Pinnacle players and a control with Imbued only.
const pinnacleCaptures = [
  { name: 'Hohmono', gatheringId: 31, spire: 1415, base: 8649032,
    total: 648856.4271074544, multiplier: 1.0606, pinnacle: 1, nexus: 25921,
    boosts: [2592486, 2594990, 2546178, 2544025, 2517911, 2545008, 2585794, 2595131] },
  { name: 'Ownin', gatheringId: 30, spire: 1010, base: 7363846,
    total: 516480.0717928687, multiplier: 1.0444, pinnacle: 1, nexus: 25921,
    boosts: [2470175, 2404163, 2410645, 2411745, 2398571, 2410224, 2363705, 2412306] },
  { name: 'Pepo', gatheringId: 31, spire: 1060, base: 7805278,
    total: 516789.27457638405, multiplier: 1.0464, pinnacle: 1, nexus: 24600,
    infusions: [31, 31, 31, 31, 31, 31, 31, 31],
    boosts: [2288767, 2276200, 2281820, 2295891, 2293411, 2296266, 2277672, 2294885] },
  { name: 'Mephisto', gatheringId: 32, spire: 700, base: 5948908,
    total: 358677.436, multiplier: 1, pinnacle: 0, nexus: 24600,
    infusions: [31, 29, 30, 30, 30, 30, 31, 31], prefixes: [13, 14, 11, 10, 13, 11, 8, 8],
    boosts: [2005919, 2016870, 2014974, 1975120, 2019303, 2014928, 2010716, 2022322] },
];
function assertSpireMatchesUpgrade(current, nextResearch, label) {
  const before = Calc.helpers.tserAtPotion(current, current.harvestPotion);
  const after = Calc.helpers.tserAtPotion({ ...current, research: nextResearch }, current.harvestPotion);
  const extraDailyValue = (after.pottedAfterEvent - before.pottedAfterEvent) * current.averageResourcePrice;
  const expectedRoi = Calc.helpers.buildingCost(current.spire, current.averageResourcePrice) / extraDailyValue;
  const actualRoi = Calc.calculate(current).roi.tser.spire;
  assert.ok(Number.isFinite(actualRoi) && actualRoi > 0, `${label}: Spire ROI is available`);
  assert.ok(Math.abs(actualRoi / expectedRoi - 1) < 1e-9,
    `${label}: Spire ROI matches income from the full upgraded research total (${actualRoi} vs ${expectedRoi})`);
}

for (const capture of pinnacleCaptures) {
  // Rebase historical API captures to the developer's October 30 rule. Keep
  // the observed old totals above intact; these are synthetic updated totals.
  const multiplier = capture.pinnacle ? 1 + capture.boosts.length * capture.spire * 0.000005 : 1;
  const currentTotal = 1 + (capture.total - 1) / capture.multiplier * multiplier;
  const player = {
    MiningLevel: capture.gatheringId === 30 ? 2 : 1,
    FishingLevel: capture.gatheringId === 31 ? 2 : 1,
    WoodcuttingLevel: capture.gatheringId === 32 ? 2 : 1,
    BaseBoosts: { [capture.gatheringId]: capture.base, 152: capture.spire },
    TotalBoosts: { [capture.gatheringId]: currentTotal, 152: capture.spire },
    Constellation: { 49: capture.pinnacle },
    Equipment: Object.fromEntries(capture.boosts.map((boost, i) => [i + 1, {
      IsEquipped: true, Infusions: capture.infusions?.[i] ?? 32, Prefix: capture.prefixes?.[i] ?? 0,
      Boosts: { [capture.gatheringId]: boost },
    }])),
  };
  const normalized = normalizeImbuedPlayer(player);
  assert.equal(normalized.nexusLevel, capture.nexus, `${capture.name} Nexus matches the independent level check`);
  approximately(normalized.pinnacleResearchMultiplier, multiplier, `${capture.name} Pinnacle multiplier without 100 extra levels`);
  assert.equal(normalized.research, currentTotal * 100, 'Current income retains the updated API research total without double-applying Pinnacle');
  if (capture.pinnacle) assert.ok(currentTotal < capture.total, 'Removing 100 virtual Spire levels reduces current research');

  // Rebuild a +1 Spire API total independently from equipment and the confirmed Nexus.
  const nextSpire = capture.spire + 1;
  const equipmentLevels = Object.values(player.Equipment).reduce((sum, item) => sum
    + Math.floor(item.Boosts[capture.gatheringId] * (1 + (item.Infusions + (item.Prefix === 10 ? 1 : 0)) / 20)), 0);
  const nextPinnacle = capture.pinnacle ? 1 + capture.boosts.length * nextSpire * 0.000005 : 1;
  const nextTotal = 1 + (capture.base * (1 + capture.nexus / 100)
    + equipmentLevels * (1 + nextSpire / 100)) * 0.0002 * nextPinnacle;
  const upgraded = normalizeImbuedPlayer({
    ...player,
    BaseBoosts: { ...player.BaseBoosts, 152: nextSpire },
    TotalBoosts: { ...player.TotalBoosts, [capture.gatheringId]: nextTotal, 152: nextSpire },
  });
  assert.equal(upgraded.nexusLevel, capture.nexus, `${capture.name}: Spire upgrade preserves Nexus`);
  for (const tax of [0, 25]) {
    assertSpireMatchesUpgrade({
      ...WORKBOOK_SNAPSHOTS.hohmono, ...normalized,
      tax, harvestPotion: 171000, averageResourcePrice: 50,
      ambitiousCount: 2, starResourceBonusPercent: 4.4,
    }, upgraded.research, `${capture.name}, ${tax}% tax`);
  }
}

const pinnacleImbuedPlayer = normalizeImbuedPlayer({
  ...imbuedNexusPlayer,
  Constellation: { 49: 1 },
  TotalBoosts: { 30: 1 + (449185.792206 - 1) * 1.03924 },
});
assert.equal(pinnacleImbuedPlayer.nexusLevel, 23970, 'Pinnacle and the extra Imbued infusion work together');

// At zero Spire, Pinnacle contributes nothing; ordinary Spire still has its base 1x.
const smallPinnaclePlayer = {
  MiningLevel: 1, BaseBoosts: { 30: 100, 152: 0 }, TotalBoosts: { 30: 1.06 },
  Constellation: { 49: 1 },
  Equipment: {
    1: { Infusions: 0, Boosts: { 30: 100 } },
    2: { IsEquipped: false, Boosts: { 30: 100 } },
    3: { Boosts: { 31: 100, 121: 100 } },
  },
};
const smallPinnacle = normalizeImbuedPlayer(smallPinnaclePlayer);
assert.equal(smallPinnacle.nexusLevel, 100, 'Only equipped items with the relevant research stat count');
approximately(smallPinnacle.pinnacleResearchMultiplier, 1, 'Pinnacle at zero Spire has no bonus even with matching gear');
approximately(smallPinnacle.pinnacleResearchPerSpireLevel, 0.000005,
  'Only the matching equipped item contributes additional Pinnacle per Spire level');
assertSpireMatchesUpgrade({
  ...WORKBOOK_SNAPSHOTS.hohmono, ...smallPinnacle,
  averageResourcePrice: 50, harvestPotion: 171000,
}, (1 + (100 * 2 + 100 * 1.01) * 0.0002 * 1.000005) * 100,
'First Spire level with Pinnacle excludes the baseline and includes the cross-term');
const noPinnacle = normalizeImbuedPlayer({
  ...smallPinnaclePlayer, Constellation: { 49: 0 }, TotalBoosts: { 30: 1.06 },
});
assert.equal(noPinnacle.nexusLevel, 100, 'A locked Pinnacle perk does not change Nexus');
assert.equal(noPinnacle.pinnacleResearchMultiplier, 1, 'Locked Pinnacle has no multiplier');
assert.equal(noPinnacle.pinnacleResearchPerSpireLevel, 0, 'Locked Pinnacle adds no Spire scaling');
const noPinnacleEquipment = normalizeImbuedPlayer({
  ...smallPinnaclePlayer, Equipment: {}, TotalBoosts: { 30: 1.04 },
});
assert.equal(noPinnacleEquipment.nexusLevel, 100, 'Pinnacle without matching equipment has no effect');
assert.equal(noPinnacleEquipment.pinnacleResearchPerSpireLevel, 0, 'No matching gear means no added Pinnacle scaling');
assert.equal(Calc.calculate({ ...noPinnacleEquipment, averageResourcePrice: 50 }).roi.tser.spire,
  null, 'Spire has no resource payback without matching research equipment');

// Compare Shard ROI with the income difference from an independently reconstructed +1,000 snapshot.
const pinnacleShardInputs = {
  ...WORKBOOK_SNAPSHOTS.hohmono,
  nexusLevel: 25921, shardBoost: 8649032, research: (1 + (648856.4271074544 - 1) / 1.0606 * 1.0566) * 100,
  pinnacleResearchMultiplier: 1.0566,
};
const afterShardResearch = 100 + ((8649032 + 1000) * 260.21 + 808342733.4) * 0.02 * 1.0566;
const beforeShards = Calc.helpers.tserAtPotion(pinnacleShardInputs, pinnacleShardInputs.harvestPotion);
const afterShards = Calc.helpers.tserAtPotion(
  { ...pinnacleShardInputs, research: afterShardResearch }, pinnacleShardInputs.harvestPotion,
);
const addedShardIncome = (afterShards.pottedAfterEvent - beforeShards.pottedAfterEvent)
  * pinnacleShardInputs.averageResourcePrice;
let shardUpgradeCost = 0;
for (let level = 8649032; level <= 8650032; level++) {
  shardUpgradeCost += (0.000005 * level ** 2 + 2 * level) * pinnacleShardInputs.shardPrice;
}
const pinnacleShardRoi = Calc.calculate(pinnacleShardInputs).roi.tser.shards;
assert.ok(
  Math.abs(pinnacleShardRoi / (shardUpgradeCost / addedShardIncome) - 1) < 1e-9,
  'Shard ROI includes Pinnacle in the marginal research gain after correcting Nexus',
);

const distillationSigilPlayer = Calc.normalizeFromApis(
  { ...prefixPlayer, SigilBoost: Calc.C.DISTILLATION_SIGIL_BOOST_ID },
  { Buy: {}, Sell: {} },
  [],
  { username: 'DistillationTest', tax: 0, harvestPotion: 1000, resonancePotion: 1000 },
);
assert.equal(
  distillationSigilPlayer.hasNonDistillationSigil,
  false,
  'Distillation sigil does not trigger the warning',
);

const alternateSigilPlayer = Calc.normalizeFromApis(
  { ...prefixPlayer, SigilBoost: Calc.C.DISTILLATION_SIGIL_BOOST_ID + 1 },
  { Buy: {}, Sell: {} },
  [],
  { username: 'AlternateSigilTest', tax: 0, harvestPotion: 1000, resonancePotion: 1000 },
);
assert.equal(
  alternateSigilPlayer.hasNonDistillationSigil,
  true,
  'A non-Distillation sigil triggers the warning',
);

const liveConstructionPlayer = Calc.normalizeFromApis(
  {
    ...prefixPlayer,
    BaseBoosts: { 104: 75, 150: 640 },
    TotalBoosts: { 104: 715 },
    Pets: { 24: { Level: 13, Active: true } },
  },
  { Buy: {}, Sell: {} },
  [],
  { username: 'ConstructionTest', tax: 0, harvestPotion: 1000, resonancePotion: 1000 },
);
assert.equal(liveConstructionPlayer.workshopLevel, 640, 'Workshop level is read from API boost 150');
assert.equal(liveConstructionPlayer.constructionCodex, 75, 'Purchased Construction Codex is retained separately');
assert.equal(liveConstructionPlayer.constructionBoost, 715, 'Construction boost is read from API boost 104');
assert.equal(liveConstructionPlayer.constructionPetLevel, 13, 'Active construction pet level is read from pet 24');

const inactiveConstructionPetPlayer = Calc.normalizeFromApis(
  {
    ...prefixPlayer,
    BaseBoosts: { 104: 75, 150: 640 },
    TotalBoosts: { 104: 715 },
    Pets: { 24: { Level: 13, Active: false } },
  },
  { Buy: {}, Sell: {} },
  [],
  { username: 'InactiveConstructionPetTest', tax: 0, harvestPotion: 1000, resonancePotion: 1000 },
);
assert.equal(inactiveConstructionPetPlayer.constructionPetLevel, 0, 'Inactive construction pet is not applied');

const constructionRoiInputs = {
  ...WORKBOOK_SNAPSHOTS.hohmono,
  workshopLevel: liveConstructionPlayer.workshopLevel,
  constructionPetLevel: liveConstructionPlayer.constructionPetLevel,
  constructionBoost: liveConstructionPlayer.constructionBoost,
};
const liveConstructionRoi = Calc.calculate(constructionRoiInputs).roi.battler.workshopDustCollector;
const changedConstructionRoi = Calc.calculate({
  ...constructionRoiInputs,
  constructionBoost: constructionRoiInputs.constructionBoost + 100,
}).roi.battler.workshopDustCollector;
assert.ok(
  Number.isFinite(liveConstructionRoi) && liveConstructionRoi !== changedConstructionRoi,
  'Workshop to Dust Collector ROI responds to the live Construction boost',
);

const constellationConstruction = Calc.normalizeFromApis({
  BaseBoosts: { 104: 100, 150: 1000 }, TotalBoosts: { 104: 1100 },
  Pets: { 24: { Level: 12, Active: true } }, Constellation: { 6: 3 },
}, {}, [], {});
assert.equal(constellationConstruction.ambidextrousLevel, 3, 'Ambidextrous reads constellation effect 6');
assert.equal(constellationConstruction.constructionBoost, 1100, 'Ambidextrous is not added to Construction Boost');
const ambidextrousInputs = { ...WORKBOOK_SNAPSHOTS.emilia,
  constructionCodex: constellationConstruction.constructionCodex,
  constructionBoost: constellationConstruction.constructionBoost,
  constructionPetLevel: constellationConstruction.constructionPetLevel,
  workshopLevel: constellationConstruction.workshopLevel,
  ambidextrousLevel: constellationConstruction.ambidextrousLevel,
};
const ambidextrousBreakdown = Calc.helpers.workshopDustCollectorRoiBreakdown(ambidextrousInputs);
const noAmbidextrousBreakdown = Calc.helpers.workshopDustCollectorRoiBreakdown({ ...ambidextrousInputs, ambidextrousLevel: 0 });
approximately(ambidextrousBreakdown.ambidextrousChancePercent, 3, '100 Codex and three ranks give 3% extra-tick chance');
approximately(ambidextrousBreakdown.ambidextrousExtraSecondsPerTick, 0.09, 'Expected extra timer reduction is 0.09 seconds per tick');
approximately(ambidextrousBreakdown.constructionTickMultiplier, 1.27, 'Pet and Codex proc contributions add rather than multiply');
approximately(ambidextrousBreakdown.currentConstructionMultiplier, 12 * 1.27, 'Current construction includes Ambidextrous once');
approximately(ambidextrousBreakdown.nextConstructionMultiplier, 12.01 * 1.27, 'Workshop upgrade leaves purchased Codex and proc chance fixed');
approximately(ambidextrousBreakdown.roi / noAmbidextrousBreakdown.roi, Math.sqrt(1.24 / 1.27), 'Ambidextrous improves the existing cumulative Workshop payback');
assert.equal(ambidextrousBreakdown.workshopCost, noAmbidextrousBreakdown.workshopCost, 'Ambidextrous does not change building costs');
const withoutPet = Calc.helpers.workshopDustCollectorRoiBreakdown({ ...ambidextrousInputs, constructionPetLevel: 0 });
approximately(withoutPet.constructionTickMultiplier, 1.03, 'Ambidextrous works without an active pet');
const withoutCodex = Calc.helpers.workshopDustCollectorRoiBreakdown({ ...ambidextrousInputs, constructionCodex: 0 });
approximately(withoutCodex.constructionTickMultiplier, 1.24, 'Workshop levels are not substituted for purchased Codex levels');
assert.equal(liveConstructionPlayer.ambidextrousLevel, 0, 'Older API responses default to no Ambidextrous');

const cappedPrefixPlayer = Calc.normalizeFromApis(
  {
    ...prefixPlayer,
    Equipment: Object.fromEntries(
      Array.from({ length: 9 }, (_, index) => [index + 1, { Name: `Ambitious Item ${index + 1}` }]),
    ),
  },
  { Buy: {}, Sell: {} },
  [],
  { username: 'PrefixCapTest', tax: 0, harvestPotion: 1000, resonancePotion: 1000 },
);
assert.equal(cappedPrefixPlayer.ambitiousCount, 8, 'Ambitious prefix count is capped at eight');

console.log('Validated action counts, potion analysis, sigils, equipment prefixes, Nexus inference, and live construction data.');
