'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Calc = require('./calculator.js');
const Api = require('./api.js');
const { WORKBOOK_SNAPSHOTS } = require('./data.js');
const inputs = { username: 'Hohmono', tax: 40, harvestPotion: 171000, resonancePotion: 57000 };
const normalize = (player, stars = null) => Calc.normalizeFromApis(player, {}, [], inputs, stars);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) <= Math.max(1e-12, Math.abs(expected) * 1e-13), `${actual} != ${expected}`);

test('elemental bonus follows the modeled gathering skill and counts ranks, not perk types', () => {
  for (const [level, perk] of [['MiningLevel', 1], ['FishingLevel', 2], ['WoodcuttingLevel', 3]]) {
    const player = { [level]: 10, Constellation: { [perk]: 1, 11: 2, 49: 1 } };
    const exact = normalize(player, 7);
    assert.equal(exact.resourceStarCount, 7);
    assert.equal(exact.starResourceBonusPercent, 0.7);
    assert.equal(exact.starResourceBonusEstimated, false);
    for (const stars of [null, 3]) {
      const fallback = normalize(player, stars);
      assert.equal(fallback.resourceStarCount, 4);
      assert.equal(fallback.starResourceBonusPercent, 0.4);
      assert.equal(fallback.starResourceBonusEstimated, true);
    }
    const mismatch = normalize({ [level]: 10, Constellation: { [perk % 3 + 1]: 1 } }, 7);
    assert.equal(mismatch.starResourceBonusPercent, 0);
    assert.equal(mismatch.starResourceBonusEstimated, false);
  }
  assert.equal(normalize({ FishingLevel: 10 }, 39).starResourceBonusPercent, 0);
});

test('star harvest scales resource income and resource ROI, leaving herbs and battlers unchanged', () => {
  const base = WORKBOOK_SNAPSHOTS.hohmono;
  const original = Calc.calculate(base);
  const boosted = Calc.calculate({ ...base, starResourceBonusPercent: 3.9 });
  for (const field of ['grossPotted', 'grossUnpotted', 'pottedAfterEvent', 'unpottedAfterEvent', 'extraResValue']) {
    close(boosted.tser[field], original.tser[field] * 1.039);
  }
  close(boosted.tser.fullIncome, original.tser.farmTax + (original.tser.fullIncome - original.tser.farmTax) * 1.039);
  for (const field of ['spire', 'potionBoost', 'baseRes', 'shards']) {
    close(boosted.roi.tser[field], original.roi.tser[field] / 1.039);
  }
  for (const field of ['lab', 'farmNoHedge', 'farmHedge', 'tomeDrop']) {
    assert.equal(boosted.roi.tser[field], original.roi.tser[field]);
  }
  assert.deepEqual(boosted.battler, original.battler);
  assert.deepEqual(boosted.roi.battler, original.roi.battler);
  assert.equal(boosted.tser.farmTax, original.tser.farmTax);
  assert.equal(boosted.tser.maxSustainablePotion, original.tser.maxSustainablePotion);
});

test('personal and guild optimizers value the star harvest gain at every potion tier', () => {
  for (const tax of [40, 0]) {
    const base = { ...WORKBOOK_SNAPSHOTS.hohmono, tax };
    let bestPotion = 0;
    let bestIncome = -Infinity;
    for (let potion = 0; potion <= 1_000_000; potion += 1000) {
      const original = Calc.helpers.tserAtPotion(base, potion);
      const income = original.farmTax + original.extraResValue * 1.039;
      if (income > bestIncome) { bestIncome = income; bestPotion = potion; }
    }
    const boosted = { ...base, starResourceBonusPercent: 3.9 };
    assert.equal(Calc.helpers.optimizeTserPotion(boosted).bestPotion, bestPotion);
    if (!tax) assert.equal(Calc.helpers.tserGuildPotionAnalysis(boosted).bestPotion, bestPotion);
  }
});

test('leaderboard lookup includes unassigned stars, paginates, and matches names exactly', async () => {
  const paths = [];
  const stars = await Api.fetchUnlockedStars({ Name: 'Hohmono', GuildID: 5, Constellation: { 2: 1 } }, async path => {
    paths.push(path);
    return paths.length === 1
      ? { Entries: [{ Name: 'Hohmono2', Score: 99 }], TotalPages: 2 }
      : { Entries: [{ Name: 'hohmono', Score: 39 }], TotalPages: 2 };
  });
  assert.equal(stars, 39);
  assert.deepEqual(paths, [
    '/leaderboards/stars_unlocked?page=1&gameMode=0&guild=5',
    '/leaderboards/stars_unlocked?page=2&gameMode=0&guild=5',
  ]);
});

test('missing star data does not fabricate an exact zero or break primary API results', async () => {
  assert.equal(await Api.fetchUnlockedStars({ Constellation: {} }, () => assert.fail('No elemental perk needs no request')), null);
  const player = { Name: 'Example', GameMode: 1, WoodcuttingLevel: 10, Constellation: { 3: 1 } };
  for (const reply of [{ Entries: [], TotalPages: 1 }, { Entries: [{ Name: 'Example', Score: null }], TotalPages: 1 }]) {
    assert.equal(await Api.fetchUnlockedStars(player, async path => {
      assert.equal(path, '/leaderboards/stars_unlocked?page=1&gameMode=1');
      return reply;
    }), null);
  }
  const raw = await Api.fetchPlayerInputs('Example', async path => {
    if (path === '/players/Example') return player;
    if (path.startsWith('/leaderboards/')) throw new Error('Unavailable');
    return {};
  });
  assert.equal(raw.playerData, player);
  assert.equal(raw.unlockedStars, null);
  assert.equal(normalize(raw.playerData, raw.unlockedStars).starResourceBonusEstimated, true);
});

test('live-data requests retain relay fallback and never reuse cached responses', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(String(url));
    assert.equal(options.cache, 'no-store');
    if (String(url).includes('workers.dev')) return new Response('', { status: 502 });
    if (String(url).includes('/players/')) return Response.json({ Name: 'A Player', Constellation: { 2: 1 } });
    if (String(url).includes('/leaderboards/')) return Response.json({ Entries: [{ Name: 'A Player', Score: 8 }], TotalPages: 1 });
    return Response.json({});
  };
  try {
    const raw = await Api.fetchPlayerInputs(' A Player ');
    assert.equal(raw.unlockedStars, 8);
    assert.ok(calls.includes('https://api.manarion.com/players/A%20Player'));
    assert.equal(calls.length, 8);
  } finally { globalThis.fetch = originalFetch; }
});
