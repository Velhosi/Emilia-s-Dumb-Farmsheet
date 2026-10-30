'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Calc = require('./calculator.js');
const { WORKBOOK_SNAPSHOTS } = require('./data.js');
const close = (actual, expected) => assert.ok(
  Math.abs(actual - expected) <= Math.max(1e-8, Math.abs(expected) * 1e-10),
  `${actual} != ${expected}`,
);
const profile = { MiningLevel: 1000, FishingLevel: 2000, WoodcuttingLevel: 3000,
  BaseBoosts: { 12: 100, 37: 60000, 38: 50000 },
  TotalBoosts: { 37: 60000, 38: 50000, 39: 3 },
  StarsUnlocked: 60, Constellation: { 30: 4, 31: 2, 32: 1, 36: 1, 38: 1, 44: 1 } };
const market = { Buy: { 7: 40, 8: 50, 9: 60, 69: 100, 70: 200, 71: 300 },
  Sell: { 7: 42, 8: 52, 9: 62, 69: 110, 70: 210, 71: 310 } };
const d = { ...WORKBOOK_SNAPSHOTS.hohmono, guidancePotion: 437,
  sunpetalPrice: 50_000_000, gatheringNodes: Calc.normalizeFromApis(profile, market, [], {}).gatheringNodes };

test('income rows separate leftover herbs and farm tax, reconciling the total exactly once', () => {
  const result = Calc.calculate(d);
  for (const role of ['battler', 'tser']) {
    const totals = result[role];
    const income = totals.incomeBreakdown;
    const node = totals.nodeYieldAnalysis;
    close(income.herbsAmount, totals.leftoverBloom + totals.leftoverSage + totals.leftoverSunpetals);
    close(income.herbsValue, totals.leftoverBloom * d.bloomwellPrice
      + totals.leftoverSage * d.sagerootPrice + totals.leftoverSunpetals * d.sunpetalPrice);
    close(income.farmTaxValue, -Math.max(0, totals.baseHerbDaily * Calc.C.FARM_DUST_PER_HERB - d.farmDiscount * 1e9 * 24));
    close(income.herbsValue + income.farmTaxValue, totals.farmTax);
    close(income.mainAmount, role === 'battler' ? totals.mdEarned : totals.pottedAfterEvent);
    close(income.mainValue, role === 'battler' ? totals.mdEarned
      : totals.unpottedAfterEvent * d.averageResourcePrice + totals.extraResValue);
    close(income.nodeValue, node.currentDailyYield * node.price);
    assert.notEqual(income.nodeValue, node.extraValuePerDay);
    close(income.total, income.herbsValue + income.farmTaxValue + income.mainValue + income.nodeValue);
    close(income.total, totals.fullIncome + income.nodeValue);
  }
});

test('Resource / MD tax affects action income once and never taxes T2 output', () => {
  const untaxed = Calc.calculate({ ...d, tax: 0 });
  const taxed = Calc.calculate({ ...d, tax: 75 });
  for (const role of ['battler', 'tser']) {
    const before = untaxed[role].incomeBreakdown;
    const after = taxed[role].incomeBreakdown;
    close(after.mainAmount, before.mainAmount * .25);
    close(after.mainValue, before.mainValue * .25);
    assert.equal(after.herbsValue, before.herbsValue);
    assert.equal(after.farmTaxValue, before.farmTaxValue);
    assert.equal(after.nodeValue, before.nodeValue);
    close(after.total, before.total - before.mainValue * .75);
  }
});

test('Farm tax stops at zero and excess Hedge Fund discount never becomes income', () => {
  const base = Calc.calculate(d);
  for (const role of ['battler', 'tser']) {
    const totals = base[role];
    const upkeep = totals.baseHerbDaily * Calc.C.FARM_DUST_PER_HERB;
    for (const coveredFraction of [0, 0.5, 1, 1.2]) {
      const input = { ...d, farmDiscount: upkeep * coveredFraction / (1e9 * 24) };
      const income = Calc.helpers.dailyIncomeBreakdown(input, role, totals, totals.nodeYieldAnalysis);
      // At exact coverage, subtracting two ~Q-sized Number values can leave
      // a few MD of floating-point residue after converting the discount.
      const expectedTax = -Math.max(0, upkeep * (1 - coveredFraction));
      assert.ok(Math.abs(income.farmTaxValue - expectedTax)
        <= upkeep * Number.EPSILON * 4);
      assert.ok(income.farmTaxValue <= 0);
      if (coveredFraction > 1) assert.equal(income.farmTaxValue, 0);
      assert.equal(income.herbsValue, totals.leftoverSold);
      close(income.total, totals.leftoverSold + expectedTax
        + income.mainValue + income.nodeValue);
      const actualTotals = Calc.helpers[`${role}AtPotion`](input, input.harvestPotion);
      close(actualTotals.farmTax, actualTotals.leftoverSold + expectedTax);
      close(actualTotals.hedgeDiscountAppliedPerDay, Math.min(upkeep, upkeep * coveredFraction));
      close(actualTotals.baseFarmTaxPerDay - actualTotals.hedgeDiscountAppliedPerDay, actualTotals.farmUpkeepPerDay);
    }
  }
});

test('unused Hedge Fund coverage cannot increase income or potion optimizer results', () => {
  const upkeep = Calc.helpers.farmUpkeep(d).baseFarmTaxPerDay;
  const covered = Calc.calculate({ ...d, farmDiscount: upkeep * 2 / (1e9 * 24) });
  const excess = Calc.calculate({ ...d, farmDiscount: upkeep * 3 / (1e9 * 24) });
  for (const role of ['battler', 'tser']) {
    assert.equal(covered[role].farmUpkeepPerDay, 0);
    assert.equal(excess[role].farmUpkeepPerDay, 0);
    assert.equal(excess[role].farmTax, excess[role].leftoverSold);
    assert.equal(excess[role].fullIncome, covered[role].fullIncome);
    assert.deepEqual(excess[role].incomeBreakdown, covered[role].incomeBreakdown);
  }
  assert.equal(excess.tser.bestIncome, covered.tser.bestIncome);
  assert.equal(excess.tser.bestPotion, covered.tser.bestPotion);
  assert.deepEqual(excess.tser.guildPotionAnalysis, covered.tser.guildPotionAnalysis);
});

test('unavailable T2 data is distinct from a known zero-income node', () => {
  const result = Calc.calculate(d);
  for (const role of ['battler', 'tser']) {
    const totals = result[role];
    const node = totals.nodeYieldAnalysis;
    for (const missing of [null, { ...node, price: NaN }, { ...node, currentDailyYield: NaN }]) {
      const income = Calc.helpers.dailyIncomeBreakdown(d, role, totals, missing);
      assert.equal(income.nodeValue, null);
      assert.equal(income.total, null);
    }
    const zero = Calc.helpers.dailyIncomeBreakdown(d, role, totals, { ...node, currentDailyYield: 0 });
    assert.equal(zero.nodeAmount, 0);
    assert.equal(zero.nodeValue, 0);
    close(zero.total, totals.fullIncome);
  }
});
