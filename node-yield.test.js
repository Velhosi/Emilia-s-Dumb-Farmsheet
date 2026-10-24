'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Calc = require('./calculator.js');
const Api = require('./api.js');
const H = Calc.helpers;
const close = (actual, expected, tolerance = 1e-10) => assert.ok(
  Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)),
  `${actual} != ${expected}`,
);
const market = { Buy: { 7: 40, 8: 50, 9: 60, 69: 100, 70: 200, 71: 300 },
  Sell: { 7: 41, 8: 51, 9: 61, 69: 101, 70: 201, 71: 301 } };
const player = { MiningLevel: 1000, FishingLevel: 2000, WoodcuttingLevel: 3000,
  BaseBoosts: { 10: 10, 11: 20, 12: 30, 36: 200, 37: 300, 38: 400 },
  TotalBoosts: { 36: 200, 37: 300, 38: 400, 39: 2.53 } };
const normalize = (p = player, stars = null, prices = market) => Calc.normalizeFromApis(p, prices, [], { tax: 25 }, stars);

// Independent stationary Markov chain. Enumerate every tick transition, rather
// than using the production renewal/closed-form calculation. The Leo tail at
// this test's subcritical rate is negligible by the measured mass check.
function markovNodeReward(p, duration, leo, gemini) {
  const cap = leo ? 90 : duration - 1;
  const size = 1 + 6 * cap;
  const index = (w, r) => w === 0 ? 0 : 1 + (r - 1) * cap + w - 1;
  let probabilities = new Float64Array(size);
  probabilities[0] = 1;
  let reward = 0;
  let active = 0;
  for (let iteration = 0; iteration < 3000; iteration++) {
    const next = new Float64Array(size);
    reward = 0;
    active = 0;
    next[0] += probabilities[0] * (1 - p);
    for (let roll = 1; roll <= 6; roll++) {
      const r = gemini ? Math.max(2, roll) : roll;
      const mass = probabilities[0] * p * [0.75, 0.15, 0.06, 0.03, 0.008, 0.002][roll - 1];
      next[index(duration - 1, r)] += mass;
      reward += mass * r;
      active += mass;
    }
    for (let r = 1; r <= 6; r++) {
      for (let w = 1; w <= cap; w++) {
        const mass = probabilities[index(w, r)];
        const upgradedRarity = Math.min(6, r + 1);
        const upgradedWork = leo ? w + duration - 1 : duration - 1;
        next[index(w - 1, r)] += mass * (1 - p);
        if (upgradedWork <= cap) next[index(upgradedWork, upgradedRarity)] += mass * p;
        reward += mass * ((1 - p) * r + p * upgradedRarity);
        active += mass;
      }
    }
    const difference = next.reduce((sum, value, i) => sum + Math.abs(value - probabilities[i]), 0);
    probabilities = next;
    if (difference < 1e-14) break;
  }
  close(probabilities.reduce((a, b) => a + b), 1, 1e-10);
  return { reward, active };
}

test('node overlap, rarity caps, Gemini and Leo match an independent stationary model', () => {
  for (const leo of [false, true]) {
    for (const gemini of [false, true]) {
      const expected = markovNodeReward(0.1, 4, leo, gemini);
      const actual = H.nodeYieldExpectation(0.1, 4, leo, gemini);
      close(actual.baseYieldPerAction, expected.reward);
      close(actual.activeFraction, expected.active);
      close(actual.averageActiveRarity, expected.reward / expected.active);
      close(actual.activeFraction, leo ? 0.4 : 1 - 0.9 ** 4);
    }
  }
  assert.equal(H.nodeYieldExpectation(0, 100).baseYieldPerAction, 0);
  assert.equal(H.nodeYieldExpectation(NaN, 100), null);
  close(H.nodeYieldExpectation(1, 1).baseYieldPerAction, 1.402);
  close(H.nodeYieldExpectation(1, 1, false, true).baseYieldPerAction, 2.152);
  for (const p of [0.01, 0.02, 1]) {
    close(H.nodeYieldExpectation(p, 100, true).baseYieldPerAction, 6);
  }
  const plain = H.nodeYieldExpectation(2.53 / 2400, 160, false, true);
  const leo = H.nodeYieldExpectation(2.53 / 2400, 160, true, true);
  assert.ok(leo.baseYieldPerAction > plain.baseYieldPerAction);
  assert.ok(leo.averageActiveRarity > plain.averageActiveRarity);
  close(leo.activeFraction, 2.53 / 2400 * 160);
});

test('mastery selects battler drops, highest gathering level selects TSer drops', () => {
  for (const [mastery, resource, skill, skillLevel, costResource] of [
    [10, 'Resin', 'Woodcutting', 3000, 'Wood'],
    [11, 'Quartz', 'Mining', 1000, 'Iron'],
    [12, 'Ink Sac', 'Fishing', 2000, 'Fish'],
  ]) {
    const d = normalize({ ...player, BaseBoosts: { ...player.BaseBoosts, [mastery]: 100 } });
    const a = H.nodeYieldRoiBreakdown(d, 'battler');
    assert.equal(a.name, resource);
    assert.equal(a.skill, skill);
    assert.equal(a.skillLevel, skillLevel);
    assert.equal(a.costResource, costResource);
  }
  for (const [field, resource] of [['MiningLevel', 'Quartz'], ['FishingLevel', 'Ink Sac'], ['WoodcuttingLevel', 'Resin']]) {
    const a = H.nodeYieldRoiBreakdown(normalize({ ...player, [field]: 5000 }), 'tser');
    assert.equal(a.name, resource);
    assert.equal(a.skillLevel, 5000);
  }
  const tied = normalize({ ...player, BaseBoosts: { 10: 10, 11: 10, 12: 10 }, MagicType: 'nature' });
  assert.equal(tied.gatheringNodes.battler.element, 'nature');
  assert.equal(H.nodeYieldRoiBreakdown(normalize({}), 'battler'), null);
});

test('500 upgrades use their own funding resource midpoint and exact incremental square sum', () => {
  for (const role of ['battler', 'tser']) {
    const d = normalize();
    const a = H.nodeYieldRoiBreakdown(d, role);
    let resources = 0;
    for (let l = a.currentLevel + 1; l <= a.currentLevel + 500; l++) resources += 1000 * l * l;
    assert.equal(a.upgradeResources, resources);
    assert.equal(a.upgradeCost, resources * (role === 'battler' ? 40.5 : 50.5));
    assert.equal(a.price, role === 'battler' ? 200.5 : 300.5);
    const next = structuredClone(d);
    const resource = next.gatheringNodes.resources[a.resource];
    resource.level += 500;
    resource.yieldPercent += 500;
    const after = H.nodeYieldRoiBreakdown(next, role);
    close(after.currentDailyYield - a.currentDailyYield, a.extraDailyYield);
    close(a.roi, a.upgradeCost / (a.extraDailyYield * a.price));
    assert.equal(a.roi, H.nodeYieldRoiBreakdown({ ...d, tax: 100 }, role).roi);
  }
});

test('API total rate is not boosted twice; yield perks and unlocked stars scale the marginal gain', () => {
  const original = H.nodeYieldRoiBreakdown(normalize(), 'battler');
  const d = normalize({ ...player, Constellation: { 29: 10, 31: 3, 32: 2, 44: 1 } }, 60);
  const a = H.nodeYieldRoiBreakdown(d, 'battler');
  assert.equal(a.chance, 2.53 / 2400);
  close(a.extraDailyYield, original.extraDailyYield * 1.3 * 1.8);
  assert.equal(a.nodeYieldBonusPercent, 20);
  assert.equal(a.aquariusBonusPercent, 60);
  assert.equal(a.constellationYieldMultiplier, 1.8);
  assert.equal(a.starCountEstimated, false);
  const fallback = H.nodeYieldRoiBreakdown(normalize({ ...player, Constellation: { 44: 1, 32: 2 } }), 'battler');
  assert.equal(fallback.starCount, 3);
  assert.equal(fallback.starCountEstimated, true);
  const duration = H.nodeYieldRoiBreakdown(normalize({ ...player, Constellation: { 30: 6 } }), 'battler');
  assert.equal(duration.duration, 160);
});

test('additive Node Yield and Aquarius match Hohmono Rare-node harvest observations', () => {
  // October 23 API capture. The user's 320.16K reading was taken shortly before
  // this pull; a few Fishing levels or compact-display rounding explain <10 units.
  const hohmono = { FishingLevel: 113527, MiningLevel: 84568, WoodcuttingLevel: 84568,
    BaseBoosts: { 37: 50000 }, TotalBoosts: { 37: 50000, 39: 2.76 },
    Constellation: { 30: 6, 31: 5, 32: 2, 36: 1, 38: 1, 44: 1 } };
  const a = H.nodeYieldRoiBreakdown(normalize(hohmono, 66), 'tser');
  close(a.constellationYieldMultiplier, 1.86);
  // Recover a non-double Rare tick from modeled daily output, removing average
  // rarity, active time and double expectation to check the actual income path.
  const rareTick = a.currentDailyYield / (a.actionsPerDay * a.activeFraction)
    / a.averageActiveRarity / (1 + a.doubleChance) * 3;
  close(rareTick, 320169.39066);
  assert.ok(Math.abs(rareTick - 320160) < 10);
  const oldSeparateMultipliers = 3 * 114.527 * 501 * 1.2 * 1.66;
  assert.ok(oldSeparateMultipliers - rareTick > 22000);
});

test('yield perks add together for both roles and each works on its own', () => {
  for (const role of ['battler', 'tser']) {
    const original = H.nodeYieldRoiBreakdown(normalize(), role);
    for (const [perks, factor] of [[{ 32: 2 }, 1.2], [{ 44: 1 }, 1.6], [{ 32: 2, 44: 1 }, 1.8]]) {
      const a = H.nodeYieldRoiBreakdown(normalize({ ...player, Constellation: perks }, 60), role);
      close(a.currentDailyYield, original.currentDailyYield * factor);
      close(a.extraDailyYield, original.extraDailyYield * factor);
      close(a.roi, original.roi / factor);
    }
  }
});

test('Emilia and Randramb Uncommon ticks use the dropped resource gathering level', () => {
  const captures = [
    {
      player: { MiningLevel: 52950, FishingLevel: 52950, WoodcuttingLevel: 79413,
        BaseBoosts: { 12: 82430727557442, 37: 40000 }, TotalBoosts: { 37: 40000, 39: 2.64 },
        Constellation: { 30: 6, 31: 1, 32: 2, 36: 1, 38: 1, 44: 1 } },
      stars: 60, skill: 'Fishing', expected: 77882.22, observed: 77882, tolerance: 1,
    },
    {
      player: { MiningLevel: 20159, FishingLevel: 20606, WoodcuttingLevel: 20002,
        BaseBoosts: { 10: 14363746665613, 38: 22500 }, TotalBoosts: { 38: 22500, 39: 2.22 },
        Constellation: { 36: 1, 44: 1 } },
      stars: 43, skill: 'Woodcutting', expected: 13574.85272, observed: 13570, tolerance: 5,
    },
  ];
  for (const capture of captures) {
    const a = H.nodeYieldRoiBreakdown(normalize(capture.player, capture.stars), 'battler');
    assert.equal(a.skill, capture.skill);
    const uncommonTick = a.currentDailyYield / (a.actionsPerDay * a.activeFraction)
      / a.averageActiveRarity / (1 + a.doubleChance) * 2;
    close(uncommonTick, capture.expected);
    assert.ok(Math.abs(uncommonTick - capture.observed) < capture.tolerance);
  }
});

test('missing prices or rate produce unavailable ROI instead of free upgrades', () => {
  for (const prices of [{}, { Buy: { 70: 200 } }, { Buy: { 7: 40 } }]) {
    assert.equal(H.nodeYieldRoiBreakdown(normalize(player, null, prices), 'battler').roi, null);
  }
  const missingRate = normalize({ ...player, TotalBoosts: { 37: 300 } });
  assert.equal(H.nodeYieldRoiBreakdown(missingRate, 'battler').roi, null);
  const zeroRate = normalize({ ...player, TotalBoosts: { 37: 300, 39: 0 } });
  assert.equal(H.nodeYieldRoiBreakdown(zeroRate, 'battler').roi, null);
});

test('Aquarius alone triggers the exact unlocked-star lookup', async () => {
  let requests = 0;
  const stars = await Api.fetchUnlockedStars({ Name: 'Aquarius', Constellation: { 44: 1 } }, async () => {
    requests++;
    return { Entries: [{ Name: 'Aquarius', Score: 60 }], TotalPages: 1 };
  });
  assert.equal(stars, 60);
  assert.equal(requests, 1);
});
