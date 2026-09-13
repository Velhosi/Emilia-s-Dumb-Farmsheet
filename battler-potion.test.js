'use strict';

const assert = require('node:assert/strict');
const Calc = require('./calculator.js');
const H = Calc.helpers;
const inputs = {
  golems: 540000, fertilizer: 540000, plots: 530000,
  potDuration: 631, potionBoost: 235, potionBoostLevel: 235,
  harvestPotion: 100000, resonancePotion: 40000, tax: 25,
  averageResourcePrice: 33,
};
const analysis = H.battlerPotionAnalysis(inputs);
assert.equal(analysis.maximumSustainablePotion, 98952);
assert.equal(analysis.matchingWisdomPotion, 99248);
assert.equal(analysis.preferredOption, 'potionBoost');
assert.equal(analysis.potionBoostCost, Math.floor(1e7 * 1.1 ** 235));
assert.deepEqual(analysis.farm.upgrades.map(upgrade => upgrade.addedLevels), [0, 0, 4614]);
assert.equal(analysis.farm.resourcesNeeded, 1307390966421115);
assert.equal(analysis.farm.hedgeLevelsNeeded, 11510);
assert.equal(analysis.farm.cost, analysis.farm.resourcesNeeded * 33 + analysis.farm.hedgeCost);

const netHerbs = (d, potion) => {
  const result = H.battlerAtPotion(d, potion);
  return result.leftoverBloom + result.leftoverSage;
};
assert.ok(netHerbs(inputs, analysis.maximumSustainablePotion) >= 0);
assert.ok(netHerbs(inputs, analysis.maximumSustainablePotion + 1) < 0);
const desiredWisdom = analysis.maximumSustainablePotion * (101 + inputs.potionBoost);
assert.ok(analysis.matchingWisdomPotion * (100 + inputs.potionBoost) >= desiredWisdom);
assert.ok((analysis.matchingWisdomPotion - 1) * (100 + inputs.potionBoost) < desiredWisdom);
assert.ok(netHerbs({ ...inputs, plots: 534614 }, analysis.matchingWisdomPotion) >= 0);
assert.ok(netHerbs({ ...inputs, plots: 534613 }, analysis.matchingWisdomPotion) < 0);
assert.ok(analysis.farm.hedgeLevelsNeeded * Calc.C.HEDGE_DISCOUNT_PER_HOUR >= analysis.farm.addedFarmTaxPerHour);
assert.ok((analysis.farm.hedgeLevelsNeeded - 1) * Calc.C.HEDGE_DISCOUNT_PER_HOUR < analysis.farm.addedFarmTaxPerHour);

// A lower stat catches up first; tied stats subsequently grow together.
assert.deepEqual(H.balancedFarmLevels({ golems: 100, fertilizer: 100, plots: 95 }, 3),
  { golems: 100, fertilizer: 100, plots: 98 });
assert.deepEqual(H.balancedFarmLevels({ golems: 100, fertilizer: 100, plots: 95 }, 8),
  { golems: 101, fertilizer: 101, plots: 101 });
const balanced = H.balancedFarmLevels({ golems: 100, fertilizer: 100, plots: 100 }, 7);
assert.equal(Object.values(balanced).reduce((sum, level) => sum + level, 0), 307);
assert.equal(Math.max(...Object.values(balanced)) - Math.min(...Object.values(balanced)), 1);
// Independently enumerate small allocations: balancing maximizes production and minimizes resources.
const small = { golems: 4, fertilizer: 4, plots: 0 };
const chosen = H.balancedFarmLevels(small, 6);
const chosenCost = ['golems', 'fertilizer', 'plots'].reduce((sum, key) =>
  sum + H.farmUpgradeResources(small[key], chosen[key] - small[key]), 0);
for (let g = 0; g <= 6; g += 1) for (let f = 0; f <= 6 - g; f += 1) {
  const p = 6 - g - f;
  const alternative = { golems: small.golems + g, fertilizer: small.fertilizer + f, plots: p };
  const cost = H.farmUpgradeResources(4, g) + H.farmUpgradeResources(4, f) + H.farmUpgradeResources(0, p);
  assert.ok(H.herbsPerHour(chosen) >= H.herbsPerHour(alternative) - 1e-12);
  assert.ok(chosenCost <= cost);
}
assert.equal(H.farmUpgradeResources(2, 3), 3 ** 2 + 4 ** 2 + 5 ** 2);
assert.equal(H.farmUpgradeResources(2, 0), 0);
assert.deepEqual(H.battlerPotionAnalysis({ ...inputs, harvestPotion: 1000 }), analysis,
  'The comparison starts at sustainability, independently of the entered Wisdom tier');
assert.equal(H.battlerPotionAnalysis({ ...inputs, averageResourcePrice: 0 }).preferredOption, 'farm');
assert.equal(H.battlerPotionAnalysis({ ...inputs, potionBoost: 335 }).potionBoostCost, analysis.potionBoostCost,
  'Extra equipment or event Potion Boost does not increase the purchased upgrade price');
const normalized = Calc.normalizeFromApis({ BaseBoosts: { 108: 235 }, TotalBoosts: { 108: 335 } }, {}, [], {});
assert.equal(normalized.potionBoostLevel, 235);
assert.equal(normalized.potionBoost, 335);
assert.equal(H.battlerPotionAnalysis({ ...inputs, resonancePotion: 999999 }).status, 'no-sustainable-potion');
assert.equal(H.battlerPotionAnalysis({ ...inputs, golems: 1e8, fertilizer: 1e8, plots: 1e8 }).status, 'potion-limit');
console.log('Validated Battler potion equivalence, sustainable thresholds, balanced farm costs, and recommendations.');
