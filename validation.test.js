'use strict';

const assert = require('node:assert/strict');
const Calc = require('./calculator.js');
const { WORKBOOK_SNAPSHOTS } = require('./data.js');

assert.equal(Calc.C.GATHER_ACTIONS_PER_DAY, 26880, 'Daily gathering actions');
assert.equal(Calc.C.TS_UNPOTTED_ACTIONS, 26880, 'Daily unpotted TSer actions');
assert.equal(Calc.C.TS_POTTED_ACTIONS, 26880, 'Daily potted TSer actions');
approximately(Calc.C.HEDGE_ROI_DAYS, 41.666666666666664, 'Standalone Hedge Fund ROI');

const result = Calc.calculate(WORKBOOK_SNAPSHOTS.hohmono);

function approximately(actual, expected, label) {
  const tolerance = Math.max(Math.abs(expected) * 1e-15, 1e-12);
  const difference = Math.abs(actual - expected);
  assert.ok(
    difference <= tolerance,
    `${label}: expected ${expected}, received ${actual} (difference ${difference})`,
  );
}

const validatedOutputs = {
  'Battler net herbs': [result.battler.netHerbs, 127428845084.422],
  'TSer leftover Bloomwells': [result.tser.leftoverBloom, -438460707709.667],
  'TSer leftover Sageroots': [result.tser.leftoverSage, 565889552794.089],
  'TSer net herbs': [result.tser.netHerbs, 127428845084.422],
  'TSer leftover herb sale value': [result.tser.leftoverSold, 11375268702757600],
  'TSer farm tax value': [result.tser.farmTax, 11375287843145432],
  'TSer extra resource value': [result.tser.extraResValue, 204100244019759840],
  'TSer farm + potion income': [result.tser.farmPlusPotIncome, 215475531862905280],
  'TSer full income': [result.tser.fullIncome, 302701639499193100],
  'TSer best-potion income': [result.tser.bestIncome, 238281435612079680],
  'TSer current-potion loss': [result.tser.lossFromCurrentPotion, 22805903749174400],
  'TSer percent loss': [result.tser.percentLoss, 9.570994773718853],
  'Battler Lab ROI': [result.roi.battler.lab, 149.73629689267887],
  'TSer Lab ROI': [result.roi.tser.lab, 140.3361029296493],
  'Spire ROI': [result.roi.tser.spire, 144.96204233977448],
  'Potion boost ROI': [result.roi.tser.potionBoost, 233.98684992590225],
  'Base resources ROI': [result.roi.tser.baseRes, 154.07461517292992],
  'Shards ROI': [result.roi.tser.shards, 135.54217906353037],
  'Farm no hedge ROI': [result.roi.tser.farmNoHedge, 116.84620105889435],
  'Farm + hedge ROI': [result.roi.tser.farmHedge, 61.38489854586301],
  'Tome drop ROI': [result.roi.tser.tomeDrop, 279.36393433409705],
};

assert.equal(result.tser.bestPotion, 125000, 'Highest-income potion');
assert.equal(result.battler.maxSustainablePotion, 177000, 'Battler maximum sustainable potion');
assert.equal(result.tser.maxSustainablePotion, 177000, 'Maximum sustainable potion');
assert.equal(
  result.battler.maxSustainablePotion,
  result.tser.maxSustainablePotion,
  'Herb trading gives Battler and TSer the same maximum sustainable potion',
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
  result.battler.maxSustainablePotion + Calc.C.POTION_SEARCH_STEP,
);
const nextPotionTotals = Calc.helpers.tserAtPotion(
  WORKBOOK_SNAPSHOTS.hohmono,
  result.tser.maxSustainablePotion + Calc.C.POTION_SEARCH_STEP,
);
assert.ok(
  sustainableTotals.leftoverBloom + sustainableTotals.leftoverSage >= 0,
  'Maximum sustainable potion has nonnegative combined herbs',
);
assert.ok(
  nextPotionTotals.leftoverBloom + nextPotionTotals.leftoverSage < 0,
  'The next potion tier has negative combined herbs',
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
assert.equal(tomeDropBreakdown.tomeName, 'Water', 'Tome Drop selects the highest-level tome');
assert.equal(tomeDropBreakdown.currentLevel, 425, 'Tome Drop reports the selected tome level');
approximately(
  tomeDropBreakdown.tomeSellPrice,
  WORKBOOK_SNAPSHOTS.hohmono.waterTomePrice,
  'Tome Drop values added drops with the selected tome sell price',
);
approximately(
  tomeDropBreakdown.extraValuePerDay,
  tomeDropBreakdown.extraTomesPerDay * tomeDropBreakdown.tomeSellPrice,
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
assert.notEqual(
  battlerLabBreakdown.harvestSavingsValuePerDay,
  tserLabBreakdown.harvestSavingsValuePerDay,
  'Role-specific Lab ROI values Harvest savings with the herb consumed by that role',
);

const mdIncomeBreakdown = Calc.helpers.mdIncomeBreakdown(WORKBOOK_SNAPSHOTS.hohmono);
approximately(
  mdIncomeBreakdown.dailyTotal,
  result.battler.mdEarned,
  'MD information panel breakdown matches Battler daily MD',
);

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
  farmHedgeBreakdown.combinedCost / farmHedgeBreakdown.combinedDailyBenefit,
  'Farm with Hedge Fund uses the combined daily benefit for payback',
);
approximately(
  farmHedgeBreakdown.combinedDailyBenefit,
  farmHedgeBreakdown.grossHerbValuePerDay + farmHedgeBreakdown.farmTaxAvoidedPerDay,
  'Farm with Hedge Fund includes both herb value and avoided farm tax',
);

for (const [label, [actual, expected]] of Object.entries(validatedOutputs)) {
  approximately(actual, expected, label);
}

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

console.log('Validated action counts, potion analysis, sigils, Ambitious prefixes, and live construction data.');
