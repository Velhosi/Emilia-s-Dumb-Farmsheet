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

// A simple independent case: average drop 150, 342.5 drops/day, +5 percentage points
// from +1 Potion Boost at Resonance 100 = 2,568.75 extra shards; keep 256.875 at 90% tax.
const shardInputs = { battleLevel: 0, miningLevel: 0, fishingLevel: 0, woodcuttingLevel: 0,
  dropBoost: 0, resonancePotion: 100, potionBoost: 200, equipmentShardBonus: 500,
  shardSellPrice: 10, tax: 25 };
const shardValue = H.resonanceUpgradeValue(shardInputs);
assert.equal(Calc.C.NON_EVENT_BATTLES_PER_DAY, 27400);
assert.equal(Calc.C.NON_EVENT_BATTLES_PER_DAY, Calc.C.TS_POTTED_ACTIONS,
  'Resonance uses the shared daily action allowance after accounting for events');
assert.equal(shardValue.minimumBaseDrop, 100);
assert.equal(shardValue.averageBaseDrop, 150);
assert.equal(shardValue.effectiveDropChance, 1 / 80);
assert.equal(shardValue.dropsPerDay, 342.5);
assert.equal(shardValue.currentResonanceBonus, 1500);
assert.equal(shardValue.nextResonanceBonus, 1505);
assert.equal(shardValue.currentAverageDrop, 3150);
assert.equal(shardValue.nextAverageDrop, 3157.5);
assert.equal(shardValue.extraShardsPerDay, 2568.75);
assert.equal(shardValue.nextShardsPerDay - shardValue.currentShardsPerDay, 2568.75);
assert.equal(shardValue.retainedExtraShardsPerDay, 256.875);
assert.equal(shardValue.valuePerDay, 2568.75);
assert.equal(shardValue.valuePerDay * 3, shardValue.extraShardsPerDay * 10 * 0.3,
  '70% shard tax retains three 10% portions');
assert.equal(H.resonanceUpgradeValue({ ...shardInputs, tax: 90 }).valuePerDay, shardValue.valuePerDay,
  'The resource/MD tax input does not set guild shard tax');
assert.equal(H.resonanceUpgradeValue({ ...shardInputs, equipmentShardBonus: 10000 }).valuePerDay, shardValue.valuePerDay,
  'Unchanged additive gear contributes no extra shards from a Potion Boost upgrade');
assert.equal(H.resonanceUpgradeValue({ ...shardInputs, potionBoost: 300 }).valuePerDay, shardValue.valuePerDay,
  'A one-point Potion Boost upgrade adds the same absolute Resonance bonus at any starting boost');
assert.equal(H.resonanceUpgradeValue({ ...shardInputs, resonancePotion: 200 }).valuePerDay, shardValue.valuePerDay * 2);
assert.equal(H.resonanceUpgradeValue({ ...shardInputs, dropBoost: 100 }).valuePerDay, shardValue.valuePerDay * 2);
assert.equal(H.resonanceUpgradeValue({ ...shardInputs, shardSellPrice: 20 }).valuePerDay, shardValue.valuePerDay * 2);
assert.equal(H.resonanceUpgradeValue({ ...shardInputs, resonancePotion: 0 }).valuePerDay, 0);
assert.equal(H.resonanceUpgradeValue({ ...shardInputs, shardSellPrice: 0 }).valuePerDay, 0);
assert.equal(H.resonanceUpgradeValue({ ...shardInputs, battleLevel: undefined }), null);
assert.equal(H.resonanceUpgradeValue({ ...shardInputs, shardSellPrice: NaN }), null);

const shardPlayer = { Level: 93780, MiningLevel: 52950, FishingLevel: 52950, WoodcuttingLevel: 79413,
  BaseBoosts: { 108: 238 }, TotalBoosts: { 102: 194, 108: 238, 122: 750 } };
const normalizedShards = Calc.normalizeFromApis(shardPlayer, { Buy: { 2: 11727 }, Sell: { 2: 13206 } }, [],
  { username: 'Emilia', tax: 25, harvestPotion: 105000, resonancePotion: 40000 });
assert.equal(normalizedShards.battleLevel, 93780);
assert.equal(normalizedShards.miningLevel, 52950);
assert.equal(normalizedShards.fishingLevel, 52950);
assert.equal(normalizedShards.woodcuttingLevel, 79413);
assert.equal(normalizedShards.level, 79413, 'Existing TSer level selection is preserved');
assert.equal(normalizedShards.equipmentShardBonus, 750);
assert.equal(normalizedShards.shardSellPrice, 13206);
const emiliaResonance = H.resonanceUpgradeValue(normalizedShards);
assert.equal(emiliaResonance.weightedLevel, 466653);
assert.ok(Math.abs(emiliaResonance.minimumBaseDrop - 211771.26449518432) < 1e-8);
assert.ok(Math.abs(emiliaResonance.valuePerDay - 8448264136769.767) < 0.01);
assert.ok(H.resonanceUpgradeValue({ ...normalizedShards, battleLevel: 93781 }).valuePerDay > emiliaResonance.valuePerDay);
assert.equal(H.battlerPotionAnalysis({ ...inputs, ...shardInputs }).resonanceValue.valuePerDay, shardValue.valuePerDay);
console.log('Validated Battler potion equivalence, sustainable thresholds, balanced farm costs, recommendations, and Resonance shard value.');
