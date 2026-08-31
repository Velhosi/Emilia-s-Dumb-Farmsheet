'use strict';

const assert = require('node:assert/strict');
const Calc = require('./calculator.js');
const { WORKBOOK_SNAPSHOTS } = require('./data.js');

assert.equal(Calc.C.GATHER_ACTIONS_PER_DAY, 26880, 'Daily gathering actions');
assert.equal(Calc.C.TS_UNPOTTED_ACTIONS, 26880, 'Daily unpotted TSer actions');
assert.equal(Calc.C.TS_POTTED_ACTIONS, 26880, 'Daily potted TSer actions');

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
  'Lab ROI': [result.roi.tser.lab, 145.26139896059456],
  'Spire ROI': [result.roi.tser.spire, 144.96204233977448],
  'Potion boost ROI': [result.roi.tser.potionBoost, 233.98684992590225],
  'Base resources ROI': [result.roi.tser.baseRes, 154.07461517292992],
  'Shards ROI': [result.roi.tser.shards, 135.54217906353037],
  'Farm no hedge ROI': [result.roi.tser.farmNoHedge, 116.84620105889866],
  'Farm + hedge ROI': [result.roi.tser.farmHedge, 61.094962816571005],
  'Tome drop ROI': [result.roi.tser.tomeDrop, 291.9240132824413],
};

assert.equal(result.tser.bestPotion, 125000, 'Highest-income potion');
assert.equal(result.tser.maxSustainablePotion, 141000, 'Maximum sustainable potion');
assert.ok(
  Calc.helpers.maxSustainableTserPotion({ ...WORKBOOK_SNAPSHOTS.hohmono, resonancePotion: 0 })
    > result.tser.maxSustainablePotion,
  'Maximum sustainable potion accounts for Resonance herb consumption',
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

console.log('Validated the action baseline, sustainable-potion analysis, sigil detection, and Ambitious-prefix behavior.');
