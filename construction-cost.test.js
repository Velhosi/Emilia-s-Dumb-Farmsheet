'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Calc = require('./calculator.js');
const { WORKBOOK_SNAPSHOTS } = require('./data.js');
const H = Calc.helpers;
const d = WORKBOOK_SNAPSHOTS.hohmono;
const close = (actual, expected) => assert.ok(
  Math.abs(actual - expected) <= Math.max(1e-10, Math.abs(expected) * 1e-10),
  `${actual} != ${expected}`,
);

test('construction multiplier scales both MD and all three resource costs', () => {
  const nextLevel = d.labLevel + 1;
  const mdCost = 7_500_000 * nextLevel ** 3;
  const eachResource = 10_000 * nextLevel ** 3;
  for (const multiplier of [0.1, 0.5, 1, 2, 2.75, 50]) {
    close(H.buildingCost(d.labLevel, d.averageResourcePrice, multiplier),
      mdCost * multiplier + eachResource * multiplier * 3 * d.averageResourcePrice);
  }
  assert.equal(H.buildingCost(d.labLevel, d.averageResourcePrice),
    H.buildingCost(d.labLevel, d.averageResourcePrice, 1));
});

test('building cost changes ROI, holding income, upgrade benefits and construction speed fixed', () => {
  const base = Calc.calculate(d);
  const baseWorkshop = H.workshopDustCollectorRoiBreakdown(d);
  for (const multiplier of [0.1, 0.5, 2, 50]) {
    const input = { ...d, constructionCostMultiplier: multiplier };
    const updated = Calc.calculate(input);
    const partial = H.constructionROI(input);
    for (const [role, buildings] of [['battler', ['lab', 'dustCollector']], ['tser', ['lab', 'spire']]]) {
      for (const key of buildings) {
        close(updated.roi[role][key], base.roi[role][key] * multiplier);
        assert.equal(updated.roi[role][key], partial[role][key]);
      }
      assert.deepEqual(updated[role], base[role]);
      for (const key of ['farmNoHedge', 'farmHedge', 'tomeDrop', 'nodeYield']) {
        assert.equal(updated.roi[role][key], base.roi[role][key]);
      }
    }
    for (const key of ['potionBoost', 'baseRes', 'shards']) {
      assert.equal(updated.roi.tser[key], base.roi.tser[key]);
    }
    const workshop = H.workshopDustCollectorRoiBreakdown(input);
    close(workshop.workshopCost, baseWorkshop.workshopCost * multiplier);
    for (const key of ['currentConstructionMultiplier', 'nextConstructionMultiplier',
      'timeSavePerBuild', 'collectorDailyValue', 'dailyCumulativeValue']) {
      assert.equal(workshop[key], baseWorkshop[key]);
    }
    close(workshop.roi, Math.sqrt((baseWorkshop.collectorDailyValue
      + baseWorkshop.workshopCost * multiplier * baseWorkshop.buildSpeed) / baseWorkshop.paybackDenominator));
    assert.equal(updated.roi.battler.workshopDustCollector, partial.battler.workshopDustCollector);
  }
});

test('cost setting survives API normalization and stays within the supported range', () => {
  for (const [value, expected] of [[undefined, 1], [null, 1], ['', 1], [NaN, 1],
    [Infinity, 1], [-2, 0.1], [0, 0.1], [0.1, 0.1], [0.625, 0.625], [50, 50], [100, 50]]) {
    assert.equal(H.constructionCostMultiplier(value), expected);
    assert.equal(Calc.normalizeFromApis({}, {}, [], { constructionCostMultiplier: value }).constructionCostMultiplier, expected);
  }
});
