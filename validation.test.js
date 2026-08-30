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

console.log(`Validated ${Object.keys(validatedOutputs).length + 2} workbook behaviors.`);
