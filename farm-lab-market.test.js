'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Calc = require('./calculator.js');
const { WORKBOOK_SNAPSHOTS } = require('./data.js');
const H = Calc.helpers;
const base = WORKBOOK_SNAPSHOTS.hohmono;
const close = (actual, expected) => assert.ok(
  Math.abs(actual - expected) <= Math.max(1e-10, Math.abs(expected) * 1e-10),
  `${actual} != ${expected}`,
);
const normalize = (player = {}, market = {}, inputs = {}) => Calc.normalizeFromApis(player, market, [], inputs);

test('Sunpetal leftovers use entered Guidance and reconcile daily income, Laboratory and Farm ROI', () => {
  const d = { ...base, guidancePotion: 437, sunpetalPrice: 50_000_000_000 };
  const production = 0.05 * Math.sqrt(H.herbsPerHour(d)) * 24;
  const used = (437 * 438 / 2 + 0.0002 * 437 ** 3) * (27400 / 1200) / (1 + d.potDuration / 100);
  for (const role of ['battler', 'tser']) {
    const totalsAt = H[`${role}AtPotion`];
    const old = totalsAt(base, base.harvestPotion);
    const current = totalsAt(d, d.harvestPotion);
    close(current.leftoverSunpetals, production - used);
    close(current.leftoverSold - old.leftoverSold, (production - used) * d.sunpetalPrice);
    close(current.fullIncome - old.fullIncome, (production - used) * d.sunpetalPrice);
    const afterLab = totalsAt({ ...d, potDuration: d.potDuration + 1 }, d.harvestPotion);
    close(afterLab.fullIncome - current.fullIncome, H.labRoiBreakdown(d, role).totalSavingsValuePerDay);
    // "Farm — no hedge" deliberately compares production with no Hedge Fund.
    const noHedgeInputs = { ...d, farmDiscount: 0 };
    const beforeNoHedge = totalsAt(noHedgeInputs, d.harvestPotion);
    for (const row of H.farmUpgradeStats(d)) {
      const afterFarm = totalsAt({ ...noHedgeInputs, [row.key]: d[row.key] + 1000 }, d.harvestPotion);
      close(row.taxedROI, row.cost / (afterFarm.fullIncome - beforeNoHedge.fullIncome));
    }
    const noGuidance = totalsAt({ ...d, guidancePotion: 0 }, d.harvestPotion);
    close(noGuidance.leftoverSunpetals, production);
    const oversized = totalsAt({ ...d, guidancePotion: 999999 }, d.harvestPotion);
    assert.ok(oversized.leftoverSunpetals < 0);
  }
  const noHedge = H.farmNoHedgeRoiBreakdown(d);
  close(noHedge.roi, noHedge.cost / noHedge.netDailyBenefit);
  const hedge = H.farmHedgeRoiBreakdown(d);
  close(hedge.roi, hedge.combinedCost / hedge.grossHerbValuePerDay);
  close(hedge.grossHerbValuePerDay, hedge.extraHerbsPerDay * hedge.averageHerbPrice + hedge.extraSunpetalValue);
});

test('Atlas herb ranks multiply their own harvest, with unchanged base upkeep and Sunpetals', () => {
  for (const [bloomRanks, sageRanks] of [[1, 1], [5, 0], [0, 3], [5, 5]]) {
    const bonuses = normalize({ Constellation: { 9: sageRanks, 10: bloomRanks } });
    assert.equal(bonuses.bloomwellConstellationLevel, bloomRanks);
    assert.equal(bonuses.sagerootConstellationLevel, sageRanks);
    const d = { ...base, bloomwellConstellationLevel: bonuses.bloomwellConstellationLevel,
      sagerootConstellationLevel: bonuses.sagerootConstellationLevel };
    for (const role of ['battler', 'tser']) {
      const before = H[`${role}AtPotion`](base, base.harvestPotion);
      const after = H[`${role}AtPotion`](d, d.harvestPotion);
      const extraBloom = before.bloomDaily * 0.02 * bloomRanks;
      const extraSage = before.sageDaily * 0.02 * sageRanks;
      close(after.bloomDaily, before.bloomDaily + extraBloom);
      close(after.sageDaily, before.sageDaily + extraSage);
      close(after.herbDaily, after.bloomDaily + after.sageDaily);
      close(after.leftoverBloom - before.leftoverBloom, extraBloom);
      close(after.leftoverSage - before.leftoverSage, extraSage);
      close(after.fullIncome - before.fullIncome, extraBloom * d.bloomwellPrice + extraSage * d.sagerootPrice);
      assert.equal(after.baseHerbDaily, before.baseHerbDaily);
    }
    assert.deepEqual(H.sunpetalPotionAnalysis(d), H.sunpetalPotionAnalysis(base));
    const maximum = H.maxSustainableBattlerPotion(d);
    const sustainable = H.battlerAtPotion(d, maximum);
    const next = H.battlerAtPotion(d, maximum + 1);
    assert.ok(sustainable.leftoverBloom + sustainable.leftoverSage >= 0);
    assert.ok(next.leftoverBloom + next.leftoverSage < 0);
  }
  assert.equal(normalize().bloomwellConstellationLevel, 0);
  assert.equal(normalize().sagerootConstellationLevel, 0);
});

test('Farm ROI values unequal herb bonuses and charges upkeep only on extra base production', () => {
  const d = { ...base, bloomwellConstellationLevel: 5, sagerootConstellationLevel: 1,
    bloomwellPrice: 220000, sagerootPrice: 180000 };
  const before = H.battlerAtPotion(d, d.harvestPotion);
  const beforeNoHedge = H.battlerAtPotion({ ...d, farmDiscount: 0 }, d.harvestPotion);
  for (const row of H.farmUpgradeStats(d)) {
    const after = H.battlerAtPotion({ ...d, farmDiscount: 0, [row.key]: d[row.key] + 1000 }, d.harvestPotion);
    close(row.taxedROI, row.cost / (after.fullIncome - beforeNoHedge.fullIncome));
    close(row.noTaxROI, row.cost / (after.leftoverSold - before.leftoverSold));
  }
  const hedge = H.farmHedgeRoiBreakdown(d);
  const row = H.farmUpgradeStats(d).find(candidate => candidate.label === hedge.bestUpgrade);
  close(hedge.addedFarmTaxPerHour, row.extraBaseHerbsHr * Calc.C.FARM_DUST_PER_HERB);
  assert.ok(hedge.hedgeDiscountPerHour >= hedge.addedFarmTaxPerHour);
  close(hedge.roi, hedge.combinedCost / hedge.grossHerbValuePerDay);
  const required = before.herbDaily * 1.01;
  const plan = H.farmForDailyHerbs(d, required);
  const levels = Object.fromEntries(plan.upgrades.map(upgrade => [upgrade.key, upgrade.nextLevel]));
  assert.ok(H.battlerAtPotion({ ...d, ...levels }, 0).herbDaily >= required);
  const prior = H.balancedFarmLevels(d, plan.totalAddedLevels - 1);
  assert.ok(H.battlerAtPotion({ ...d, ...prior }, 0).herbDaily < required);
  close(plan.addedFarmTaxPerHour, (H.herbsPerHour({ ...d, ...levels }) - H.herbsPerHour(d)) * Calc.C.FARM_DUST_PER_HERB);
});

test('All live market valuations use exact buy/sell midpoints, including half-unit prices', () => {
  const ids = [2, 7, 8, 9, 13, 14, 15, 35, 39, 40, 41, 46, 47, 50];
  const market = { Buy: Object.fromEntries(ids.map(id => [id, id * 10 + 1])),
    Sell: Object.fromEntries(ids.map(id => [id, id * 10 + 4])) };
  const d = normalize({}, market, { guidancePotion: 437 });
  for (const [field, id] of Object.entries({ bloomwellPrice: 41, sagerootPrice: 40,
    sunpetalPrice: 39, shardPrice: 2, shardMarketPrice: 2, fireTomePrice: 13,
    waterTomePrice: 14, natureTomePrice: 15, powerOrbPrice: 35, perfectOrbPrice: 50,
    divineEssencePrice: 47, elementiumPrice: 46 })) {
    assert.equal(d[field], id * 10 + 2.5, field);
  }
  assert.equal(d.averageResourcePrice, 82.5);
  assert.equal(d.guidancePotion, 437);
  assert.equal(normalize().guidancePotion, 0);
  assert.equal(normalize({}, { Buy: { 39: 100 }, Sell: { 39: 0 } }).sunpetalPrice, 100);
  assert.equal(normalize({}, { Sell: { 39: 200 } }).sunpetalPrice, 200);
  assert.ok(Number.isNaN(normalize().sunpetalPrice));
});

test('Laboratory saves Sunpetals at the entered fixed Guidance tier for either role', () => {
  const d = { ...base, guidancePotion: 437, sunpetalPrice: 57427249505 };
  const cost = 437 * 438 / 2 + 0.0002 * 437 ** 3;
  const saved = cost * (27400 / 1200) * (1 / (1 + d.potDuration / 100)
    - 1 / (1 + (d.potDuration + 1) / 100));
  for (const role of ['battler', 'tser']) {
    const previous = H.labRoiBreakdown(base, role);
    const current = H.labRoiBreakdown(d, role);
    close(current.sunpetalsSavedPerDay, saved);
    close(current.guidanceSavingsValuePerDay, saved * d.sunpetalPrice);
    close(current.totalSavingsValuePerDay, previous.totalSavingsValuePerDay + saved * d.sunpetalPrice);
    close(current.roi, current.nextLevelCost / current.totalSavingsValuePerDay);
    assert.ok(current.roi < previous.roi);
    assert.equal(H.labRoiBreakdown({ ...d, guidancePotion: 0 }, role).roi, previous.roi);
    assert.equal(H.labRoiBreakdown({ ...d, sunpetalPrice: NaN }, role).roi, null);
    assert.equal(H.labRoiBreakdown({ ...d, bloomwellConstellationLevel: 5 }, role).guidanceSavingsValuePerDay,
      current.guidanceSavingsValuePerDay, 'The entered tier is not replaced by a sustainability estimate');
  }
});
