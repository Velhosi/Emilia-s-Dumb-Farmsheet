'use strict';

const assert = require('node:assert/strict');
const Calc = require('./calculator.js');
const { WORKBOOK_SNAPSHOTS } = require('./data.js');
const analyze = Calc.helpers.sunpetalPotionAnalysis;
const cost = tier => tier * (tier + 1) / 2 + 0.0002 * tier ** 3;
const close = (actual, expected) => assert.ok(
  Math.abs(actual - expected) <= Math.max(1e-12, Math.abs(expected) * 1e-13),
  `${actual} != ${expected}`,
);

for (const [name, expectedTier] of [['emilia', 481], ['hohmono', 650]]) {
  const input = WORKBOOK_SNAPSHOTS[name];
  const result = analyze(input);
  const production = 0.05 * Math.sqrt(2.5 * (1 + input.golems / 100) ** 0.9
    * (1 + input.fertilizer / 100) ** 0.9 * (1 + input.plots / 100) ** 0.9) * 24;
  const duration = 1 + input.potDuration / 100;
  const used = tier => cost(tier) * (27400 / 1200) / duration;
  assert.equal(result.maximumSustainablePotion, expectedTier);
  close(result.sunpetalsPerDay, production);
  close(result.sunpetalsConsumedPerDay, used(expectedTier));
  close(result.nextTierConsumptionPerDay, used(expectedTier + 1));
  assert.ok(used(expectedTier) <= production, 'The suggested whole tier is sustainable');
  assert.ok(used(expectedTier + 1) > production, 'The next whole tier exceeds daily production');
  assert.deepEqual(Calc.calculate(input).sunpetalPotion, result, 'Both role views share the same analysis');
  assert.deepEqual(analyze({ ...input, harvestPotion: 0, resonancePotion: 0, tax: 0,
    potionBoost: 999, starResourceBonusPercent: 20, farmDiscount: 0 }), result,
  'Other potion use, taxes, Potion Boost, and the resource-star bonus do not consume or produce Sunpetals');
  assert.ok(analyze({ ...input, potDuration: input.potDuration + 100 }).maximumSustainablePotion > expectedTier);
  assert.ok(analyze({ ...input, golems: input.golems * 2 }).maximumSustainablePotion > expectedTier);
}

const smallFarm = { golems: 0, fertilizer: 0, plots: 0, potDuration: 0 };
assert.equal(analyze(smallFarm).maximumSustainablePotion, 0, 'An unsupported tier 1 displays zero');
assert.equal(analyze({ ...smallFarm, potDuration: 1300 }).maximumSustainablePotion, 1);
const capped = analyze({ golems: 1e15, fertilizer: 1e15, plots: 1e15, potDuration: 1000 });
assert.equal(capped.maximumSustainablePotion, Calc.C.MAX_SUNPETAL_POTION);
assert.equal(capped.nextTierConsumptionPerDay, null);
assert.equal(analyze({ ...smallFarm, potDuration: -100 }), null, 'Invalid duration is unavailable');

console.log('Validated estimated Sunpetal production, potion scaling, exact sustainable tiers, and duration.');
