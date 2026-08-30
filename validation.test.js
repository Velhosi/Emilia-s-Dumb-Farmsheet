'use strict';

const assert = require('node:assert/strict');
const Calc = require('./calculator.js');
const { WORKBOOK_SNAPSHOTS } = require('./data.js');

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
  'TSer leftover herb sale value': [result.tser.leftoverSold, 11375268702757600],
  'TSer farm tax value': [result.tser.farmTax, 11375287843145432],
  'TSer extra resource value': [result.tser.extraResValue, 202318728651741920],
  'TSer farm + potion income': [result.tser.farmPlusPotIncome, 213694016494887360],
  'TSer full income': [result.tser.fullIncome, 302701639499193100],
  'TSer best-potion income': [result.tser.bestIncome, 236499920244061800],
  'TSer current-potion loss': [result.tser.lossFromCurrentPotion, 22805903749174430],
  'TSer percent loss': [result.tser.percentLoss, 9.64309151801799],
  'Lab ROI': [result.roi.tser.lab, 145.26139896059456],
  'Spire ROI': [result.roi.tser.spire, 135.2979061838294],
  'Potion boost ROI': [result.roi.tser.potionBoost, 233.98684992590225],
  'Base resources ROI': [result.roi.tser.baseRes, 154.07461517292992],
  'Shards ROI': [result.roi.tser.shards, 135.54217906353037],
  'Farm no hedge ROI': [result.roi.tser.farmNoHedge, 116.84620105889866],
  'Farm + hedge ROI': [result.roi.tser.farmHedge, 61.094962816571005],
  'Tome drop ROI': [result.roi.tser.tomeDrop, 291.9240132824413],
};

assert.equal(result.tser.bestPotion, 125000, 'Highest-income potion');
assert.equal(
  result.roi.tser.tomeDrop,
  result.roi.battler.tomeDrop,
  'Battler and TSer Tome Drop ROI must remain identical',
);

for (const [label, [actual, expected]] of Object.entries(validatedOutputs)) {
  approximately(actual, expected, label);
}

const fourAspirationResult = Calc.calculate({
  ...WORKBOOK_SNAPSHOTS.hohmono,
  aspirationCount: 4,
});

approximately(
  fourAspirationResult.tser.aspirationPenaltyPercent,
  4,
  'Four Aspiration prefixes apply a 4% total-resource penalty',
);
approximately(
  fourAspirationResult.tser.grossUnpotted,
  result.tser.grossUnpotted * 0.96,
  'Aspiration penalty applies to unpotted TSer resources',
);
approximately(
  fourAspirationResult.tser.grossPotted,
  result.tser.grossPotted * 0.96,
  'Aspiration penalty applies to potted TSer resources',
);
assert.equal(
  fourAspirationResult.battler.fullIncome,
  result.battler.fullIncome,
  'Aspiration prefixes do not change Battler income',
);

for (const key of ['spire', 'potionBoost', 'baseRes', 'shards']) {
  approximately(
    fourAspirationResult.roi.tser[key],
    result.roi.tser[key] / 0.96,
    `Aspiration penalty applies to ${key} ROI`,
  );
}

for (const key of ['lab', 'farmNoHedge', 'farmHedge', 'tomeDrop']) {
  assert.equal(
    fourAspirationResult.roi.tser[key],
    result.roi.tser[key],
    `Aspiration prefixes do not change ${key} ROI`,
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
    1: { Name: 'Aspiration Staff', IsEquipped: true },
    2: { Name: 'Plain Robes', Prefix: 'Aspiration', IsEquipped: true },
    3: { Name: 'Plain Sandals', prefix: { name: 'Aspiration' }, IsEquipped: true },
    4: { Name: 'aspiration Gloves', IsEquipped: true },
    5: { Name: 'Aspiration Hood', IsEquipped: false },
  },
};
const normalizedPrefixPlayer = Calc.normalizeFromApis(
  prefixPlayer,
  { Buy: {}, Sell: {} },
  [],
  { username: 'PrefixTest', tax: 0, harvestPotion: 1000, resonancePotion: 1000 },
);
assert.equal(normalizedPrefixPlayer.aspirationCount, 4, 'Aspiration prefixes are detected from API equipment');

const cappedPrefixPlayer = Calc.normalizeFromApis(
  {
    ...prefixPlayer,
    Equipment: Object.fromEntries(
      Array.from({ length: 9 }, (_, index) => [index + 1, { Name: `Aspiration Item ${index + 1}` }]),
    ),
  },
  { Buy: {}, Sell: {} },
  [],
  { username: 'PrefixCapTest', tax: 0, harvestPotion: 1000, resonancePotion: 1000 },
);
assert.equal(cappedPrefixPlayer.aspirationCount, 8, 'Aspiration prefix count is capped at eight');

console.log('Validated workbook parity, upgrade-aware potion search, and Aspiration-prefix behavior.');
