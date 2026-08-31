(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ManarionCalculator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const C = Object.freeze({
    BATTLE_HOURS_PER_DAY: 22.4,
    BATTLE_ACTIONS_PER_HOUR: 1200,
    GATHER_ACTIONS_PER_DAY: 26880,
    TS_UNPOTTED_ACTIONS: 26880,
    TS_POTTED_ACTIONS: 26880,
    FARM_DUST_PER_HERB: 50000,
    TS_EVENT_RESEARCH_BONUS: 604.42,
    FARM_UPGRADE_SIZE: 1000,
    BASE_RES_UPGRADE_SIZE: 5000,
    SHARD_UPGRADE_SIZE: 1000,
    HEDGE_COST_PER_LEVEL: 1_000_000_000_000,
    HEDGE_DISCOUNT_PER_HOUR: 1_000_000_000,
    HEDGE_ROI_DAYS: 1_000_000_000_000 / (1_000_000_000 * 24),
    MAX_TSER_POTION: 1_000_000,
    POTION_SEARCH_STEP: 1_000,
    MAX_AMBITIOUS_PREFIXES: 8,
    DISTILLATION_SIGIL_BOOST_ID: 110,
  });

  const finite = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const pctAfterTax = (tax) => 1 - finite(tax) / 100;
  const safeDiv = (a, b) => (Number.isFinite(a) && Number.isFinite(b) && Math.abs(b) > 1e-12) ? a / b : null;

  function buildingCost(level, averageResourcePrice) {
    const n = finite(level) + 1;
    return 7_500_000 * n ** 3 + ((10_000 * n ** 3 * 3) * finite(averageResourcePrice));
  }

  function herbsPerHour(p) {
    return 2.5
      * (1 + finite(p.golems) / 100) ** 0.9
      * (1 + finite(p.fertilizer) / 100) ** 0.9
      * (1 + finite(p.plots) / 100) ** 0.9;
  }

  function harvestHerbsPerPot(level) {
    const x = finite(level);
    return (x * (x + 1) / 2) + (0.0002 * x ** 3);
  }

  function resonanceHerbsPerPot(level) {
    const x = finite(level);
    return (((x * (x + 1) / 2) + (0.0002 * x ** 3)) * 2);
  }

  function herbsPerHourFromPotion(amountPerPot, potDurationBoost) {
    return amountPerPot / ((finite(potDurationBoost) + 100) / 100);
  }

  function potionBaseResourceBonus(harvestPotion, potionBoost) {
    return finite(harvestPotion) * 0.1 * (1 + finite(potionBoost) / 100);
  }

  function ambitiousResourceMultiplier(d) {
    const prefixCount = Math.min(
      Math.max(Math.trunc(finite(d.ambitiousCount)), 0),
      C.MAX_AMBITIOUS_PREFIXES,
    );
    return 1 - prefixCount / 100;
  }

  function grossUnpottedResourcePerAction(d) {
    return (1 + finite(d.level) * 0.03 + finite(d.baseRes))
      * (1 + finite(d.baseResResearch) / 100)
      * (1 + finite(d.research) / 100)
      * ambitiousResourceMultiplier(d);
  }

  function grossPottedResourcePerAction(d, harvestPotion, researchEventBonus = C.TS_EVENT_RESEARCH_BONUS) {
    const potBase = potionBaseResourceBonus(harvestPotion, d.potionBoost);
    return (1 + finite(d.level) * 0.03 + potBase + finite(d.baseRes))
      * (1 + finite(d.baseResResearch) / 100)
      * ((finite(d.research) + finite(researchEventBonus)) / 100)
      * ambitiousResourceMultiplier(d);
  }

  function dustPerBattleBase(enemy) {
    const e = finite(enemy) + 150;
    return (0.0001 * e ** 2 + e ** 1.2 + 10 * e)
      * (finite(enemy) > 150000 ? 1.01 ** ((finite(enemy) - 150000) / 2000) : 1);
  }

  function dustPerBattle(d, collectorDeltaPct = 0, taxed = false) {
    const collectorPct = finite(d.dustCollector) * 0.2 + collectorDeltaPct;
    let amount = dustPerBattleBase(d.currentEnemy)
      * (1 + collectorPct / 100)
      * (1 + finite(d.dustCodex) / 100)
      * (1 + finite(d.dustEquipment) / 100);
    if (taxed) amount *= pctAfterTax(d.tax);
    return amount;
  }

  function dustDaily(d, taxed = false, collectorDeltaPct = 0) {
    return dustPerBattle(d, collectorDeltaPct, taxed) * C.TS_POTTED_ACTIONS;
  }

  function farmTotals(d, harvestPotion) {
    const herbHr = herbsPerHour(d);
    const herbDaily = herbHr * 24;
    const bloomDaily = herbDaily / 2;
    const sageDaily = herbDaily / 2;
    const harvestPerPot = harvestHerbsPerPot(harvestPotion);
    const harvestHr = herbsPerHourFromPotion(harvestPerPot, d.potDuration);
    const resPerPot = resonanceHerbsPerPot(d.resonancePotion);
    const resHr = herbsPerHourFromPotion(resPerPot, d.potDuration);
    return { herbHr, herbDaily, bloomDaily, sageDaily, harvestPerPot, harvestHr, resPerPot, resHr };
  }

  function battlerAtPotion(d, harvestPotion) {
    const f = farmTotals(d, harvestPotion);
    const leftoverBloom = f.bloomDaily - ((f.resHr * C.BATTLE_HOURS_PER_DAY) / 2);
    const leftoverSage = f.sageDaily - ((f.harvestHr * C.BATTLE_HOURS_PER_DAY) + ((f.resHr / 2) * C.BATTLE_HOURS_PER_DAY));
    const leftoverSold = leftoverBloom * finite(d.bloomwellPrice) + leftoverSage * finite(d.sagerootPrice);
    const farmTax = (leftoverSold - f.herbDaily * C.FARM_DUST_PER_HERB) + finite(d.farmDiscount) * 1_000_000_000 * 24;
    const mdEarned = dustDaily(d, true);
    return {
      ...f,
      leftoverBloom,
      leftoverSage,
      leftoverSold,
      farmTax,
      mdEarned,
      fullIncome: farmTax + mdEarned,
    };
  }

  function battler(d) {
    return battlerAtPotion(d, d.harvestPotion);
  }

  function tserAtPotion(d, harvestPotion) {
    const f = farmTotals(d, harvestPotion);
    const leftoverBloom = f.bloomDaily - ((f.harvestHr * C.BATTLE_HOURS_PER_DAY) + ((f.resHr / 2) * C.BATTLE_HOURS_PER_DAY));
    const leftoverSage = f.sageDaily - ((f.resHr * C.BATTLE_HOURS_PER_DAY) / 2);
    const leftoverSold = leftoverBloom * finite(d.bloomwellPrice) + leftoverSage * finite(d.sagerootPrice);
    const farmTax = (leftoverSold - f.herbDaily * C.FARM_DUST_PER_HERB) + finite(d.farmDiscount) * 1_000_000_000 * 24;

    const grossUnpotted = grossUnpottedResourcePerAction(d);
    const taxedUnpotted = grossUnpotted * pctAfterTax(d.tax);
    const unpottedAfterEvent = taxedUnpotted * C.TS_UNPOTTED_ACTIONS;

    const grossPotted = grossPottedResourcePerAction(d, harvestPotion);
    const taxedPotted = grossPotted * pctAfterTax(d.tax);
    const pottedAfterEvent = taxedPotted * C.TS_POTTED_ACTIONS;

    const extraResValue = finite(d.averageResourcePrice) * (pottedAfterEvent - unpottedAfterEvent);
    const farmPlusPotIncome = farmTax + extraResValue;
    const fullIncome = farmPlusPotIncome + finite(d.averageResourcePrice) * unpottedAfterEvent;

    return {
      ...f,
      leftoverBloom,
      leftoverSage,
      leftoverSold,
      farmTax,
      grossUnpotted,
      taxedUnpotted,
      unpottedAfterEvent,
      grossPotted,
      taxedPotted,
      pottedAfterEvent,
      extraResValue,
      farmPlusPotIncome,
      fullIncome,
    };
  }

  function optimizeTserPotion(d, { min = 0, max = C.MAX_TSER_POTION, step = C.POTION_SEARCH_STEP } = {}) {
    let bestPotion = min;
    let bestIncome = -Infinity;
    for (let potion = min; potion <= max; potion += step) {
      const income = tserAtPotion(d, potion).farmPlusPotIncome;
      if (income > bestIncome) {
        bestIncome = income;
        bestPotion = potion;
      }
    }
    if ((max - min) % step !== 0) {
      const maxIncome = tserAtPotion(d, max).farmPlusPotIncome;
      if (maxIncome > bestIncome) {
        bestIncome = maxIncome;
        bestPotion = max;
      }
    }
    return { bestPotion, bestIncome };
  }

  function maxSustainablePotion(d, totalsAtPotion, { step = C.POTION_SEARCH_STEP } = {}) {
    const increment = Math.max(1, Math.trunc(finite(step, C.POTION_SEARCH_STEP)));
    const canSustain = (potion) => {
      const totals = totalsAtPotion(d, potion);
      return totals.leftoverBloom + totals.leftoverSage >= 0;
    };

    if (!canSustain(0)) return 0;

    let sustainableUnits = 0;
    let unsustainableUnits = 1;
    while (canSustain(unsustainableUnits * increment)) {
      sustainableUnits = unsustainableUnits;
      if (unsustainableUnits > Number.MAX_SAFE_INTEGER / 2 / increment) {
        return sustainableUnits * increment;
      }
      unsustainableUnits *= 2;
    }

    while (sustainableUnits + 1 < unsustainableUnits) {
      const midpoint = Math.floor((sustainableUnits + unsustainableUnits) / 2);
      if (canSustain(midpoint * increment)) sustainableUnits = midpoint;
      else unsustainableUnits = midpoint;
    }

    return sustainableUnits * increment;
  }

  function maxSustainableTserPotion(d, options) {
    return maxSustainablePotion(d, tserAtPotion, options);
  }

  function maxSustainableBattlerPotion(d, options) {
    return maxSustainablePotion(d, battlerAtPotion, options);
  }

  function labRoiBreakdown(d, role) {
    const f = farmTotals(d, d.harvestPotion);
    const nextHarvestHr = herbsPerHourFromPotion(f.harvestPerPot, finite(d.potDuration) + 1);
    const nextResHr = herbsPerHourFromPotion(f.resPerPot, finite(d.potDuration) + 1);
    const harvestHerbsSavedPerDay = (f.harvestHr - nextHarvestHr) * C.BATTLE_HOURS_PER_DAY;
    const resonanceHerbsSavedPerDay = (f.resHr - nextResHr) * C.BATTLE_HOURS_PER_DAY;
    const harvestHerbPrice = role === 'tser' ? d.bloomwellPrice : d.sagerootPrice;
    const harvestSavingsValuePerDay = harvestHerbsSavedPerDay * finite(harvestHerbPrice);
    const resonanceSavingsValuePerDay = resonanceHerbsSavedPerDay
      * ((finite(d.bloomwellPrice) + finite(d.sagerootPrice)) / 2);
    const totalSavingsValuePerDay = Math.abs(
      harvestSavingsValuePerDay + resonanceSavingsValuePerDay,
    );
    const nextLevelCost = buildingCost(d.labLevel, d.averageResourcePrice);

    return {
      nextLevelCost,
      eventHours: C.BATTLE_HOURS_PER_DAY,
      harvestHerbsPerHour: f.harvestHr,
      nextHarvestHerbsPerHour: nextHarvestHr,
      harvestHerbsSavedPerHour: f.harvestHr - nextHarvestHr,
      harvestHerbsSavedPerDay,
      harvestHerbPrice: finite(harvestHerbPrice),
      resonanceHerbsPerHour: f.resHr,
      nextResonanceHerbsPerHour: nextResHr,
      resonanceHerbsSavedPerHour: f.resHr - nextResHr,
      resonanceHerbsSavedPerDay,
      averageHerbPrice: (finite(d.bloomwellPrice) + finite(d.sagerootPrice)) / 2,
      harvestSavingsValuePerDay,
      resonanceSavingsValuePerDay,
      totalSavingsValuePerDay,
      roi: safeDiv(nextLevelCost, totalSavingsValuePerDay),
    };
  }

  function labROI(d, role) {
    return labRoiBreakdown(d, role).roi;
  }

  function mdIncomeBreakdown(d) {
    const basePerBattle = dustPerBattleBase(d.currentEnemy);
    const afterDustCollector = basePerBattle
      * (1 + (finite(d.dustCollector) * 0.2) / 100);
    const afterBaseAndEquipment = afterDustCollector
      * (1 + finite(d.dustCodex) / 100)
      * (1 + finite(d.dustEquipment) / 100);
    const afterTax = afterBaseAndEquipment * pctAfterTax(d.tax);

    return {
      basePerBattle,
      afterDustCollector,
      afterBaseAndEquipment,
      afterTax,
      dailyActions: C.TS_POTTED_ACTIONS,
      dailyTotal: afterTax * C.TS_POTTED_ACTIONS,
    };
  }

  function spireROI(d) {
    const currentEquipmentResearch = finite(d.equipmentResearch);
    const extraResearch = currentEquipmentResearch * 0.01; // +1 Spire level changes the multiplier by 0.01x.
    if (!extraResearch) return null;
    const potBase = potionBaseResourceBonus(d.harvestPotion, d.potionBoost);
    const baseFactor = (1 + finite(d.level) * 0.03 + potBase + finite(d.baseRes))
      * (1 + finite(d.baseResResearch) / 100);
    const current = baseFactor * (finite(d.research) / 100) * C.GATHER_ACTIONS_PER_DAY;
    const upgraded = baseFactor * ((finite(d.research) + extraResearch) / 100) * C.GATHER_ACTIONS_PER_DAY;
    const grossExtra = upgraded - current;
    const taxedExtra = grossExtra * pctAfterTax(d.tax);
    const valuePerDay = taxedExtra * finite(d.averageResourcePrice)
      * ambitiousResourceMultiplier(d);
    return safeDiv(buildingCost(d.spire, d.averageResourcePrice), valuePerDay);
  }

  function potionBoostROI(d) {
    const current = finite(d.potionBoost);
    const currentPotBase = potionBaseResourceBonus(d.harvestPotion, current);
    const nextPotBase = potionBaseResourceBonus(d.harvestPotion, current + 1);
    const common = (1 + finite(d.baseResResearch) / 100) * (finite(d.research) / 100);
    const currentRes = (1 + finite(d.level) * 0.03 + currentPotBase + finite(d.baseRes)) * common;
    const nextRes = (1 + finite(d.level) * 0.03 + nextPotBase + finite(d.baseRes)) * common;
    const valuePerDay = (nextRes - currentRes) * C.TS_POTTED_ACTIONS
      * finite(d.averageResourcePrice) * pctAfterTax(d.tax)
      * ambitiousResourceMultiplier(d);
    const cost = Math.floor(10_000_000 * 1.1 ** current);
    return safeDiv(cost, valuePerDay);
  }

  function baseResourceROI(d, upgrades = C.BASE_RES_UPGRADE_SIZE) {
    const start = finite(d.baseResAmount);
    const n = finite(upgrades);
    const s2 = (x) => x * (x + 1) * (2 * x + 1);
    const cost = 5 * (s2(start + n) - s2(start)) / 6;
    const extraBase = n / 100;
    const potBase = potionBaseResourceBonus(d.harvestPotion, d.potionBoost);
    const common = (1 + finite(d.baseResResearch) / 100) * (finite(d.research) / 100) * C.TS_POTTED_ACTIONS;
    const current = (1 + finite(d.level) * 0.03 + potBase + finite(d.baseRes)) * common;
    const upgraded = (1 + finite(d.level) * 0.03 + potBase + finite(d.baseRes) + extraBase) * common;
    const valuePerDay = (upgraded - current) * pctAfterTax(d.tax)
      * finite(d.averageResourcePrice) * ambitiousResourceMultiplier(d);
    return safeDiv(cost, valuePerDay);
  }

  function shardROI(d, upgrades = C.SHARD_UPGRADE_SIZE) {
    const current = finite(d.shardBoost, NaN);
    const n = finite(upgrades);
    const nexus = d.nexusLevel == null ? NaN : Number(d.nexusLevel);
    const shardPrice = d.shardPrice == null ? NaN : Number(d.shardPrice);
    if (![current, nexus, shardPrice].every(Number.isFinite)) return null;

    const sumSquaresThrough = (x) => x * (x + 1) * (2 * x + 1) / 6;
    const sumThrough = (x) => x * (x + 1) / 2;
    const end = current + n;
    const previous = current - 1;
    const shardsNeeded = 0.000005 * (sumSquaresThrough(end) - sumSquaresThrough(previous))
      + 2 * (sumThrough(end) - sumThrough(previous));
    const cost = shardsNeeded * shardPrice;
    const addedResearch = n * (0.0002 * nexus + 0.02);

    const potBase = potionBaseResourceBonus(d.harvestPotion, d.potionBoost);
    const baseFactor = (1 + finite(d.level) * 0.03 + potBase + finite(d.baseRes))
      * (1 + finite(d.baseResResearch) / 100);
    const currentRes = baseFactor * (finite(d.research) / 100) * C.TS_POTTED_ACTIONS;
    const upgradedRes = baseFactor * ((finite(d.research) + addedResearch) / 100) * C.TS_POTTED_ACTIONS;
    const valuePerDay = (upgradedRes - currentRes) * pctAfterTax(d.tax)
      * finite(d.averageResourcePrice) * ambitiousResourceMultiplier(d);
    return safeDiv(cost, valuePerDay);
  }

  function farmUpgradeStats(d) {
    const currentHerbs = herbsPerHour(d);
    const avgHerbPrice = (finite(d.bloomwellPrice) + finite(d.sagerootPrice)) / 2;
    const rows = [
      ['Golems', 'golems'],
      ['Fertilizer', 'fertilizer'],
      ['Plots', 'plots'],
    ].map(([label, key]) => {
      const next = { ...d, [key]: finite(d[key]) + C.FARM_UPGRADE_SIZE };
      const extraHerbsHr = herbsPerHour(next) - currentHerbs;
      const level = finite(d[key]);
      const cost = (1000 * level ** 2 + 1_001_000 * level + 333_833_500 + 208_500)
        * finite(d.averageResourcePrice);
      const taxDenominator = extraHerbsHr * 24 * avgHerbPrice - extraHerbsHr * 24 * C.FARM_DUST_PER_HERB;
      const noTaxDenominator = extraHerbsHr * 24 * avgHerbPrice;
      return {
        label,
        key,
        extraHerbsHr,
        cost,
        taxedROI: safeDiv(cost, taxDenominator),
        noTaxROI: safeDiv(cost, noTaxDenominator),
      };
    });
    return rows;
  }

  function farmNoHedgeRoiBreakdown(d) {
    const rows = farmUpgradeStats(d);
    const valid = rows.filter(row => Number.isFinite(row.taxedROI));
    const averageHerbPrice = (finite(d.bloomwellPrice) + finite(d.sagerootPrice)) / 2;
    if (!valid.length) {
      return {
        bestUpgrade: null,
        upgradeSize: C.FARM_UPGRADE_SIZE,
        averageHerbPrice,
        extraHerbsPerDay: null,
        grossHerbValuePerDay: null,
        farmTaxPerDay: null,
        netDailyBenefit: null,
        cost: null,
        roi: null,
      };
    }

    const best = valid.reduce((currentBest, row) => (
      row.taxedROI < currentBest.taxedROI ? row : currentBest
    ));
    const extraHerbsPerDay = best.extraHerbsHr * 24;
    const grossHerbValuePerDay = extraHerbsPerDay * averageHerbPrice;
    const farmTaxPerDay = extraHerbsPerDay * C.FARM_DUST_PER_HERB;
    const netDailyBenefit = grossHerbValuePerDay - farmTaxPerDay;

    return {
      bestUpgrade: best.label,
      upgradeSize: C.FARM_UPGRADE_SIZE,
      averageHerbPrice,
      extraHerbsPerDay,
      grossHerbValuePerDay,
      farmTaxPerDay,
      netDailyBenefit,
      cost: best.cost,
      roi: best.taxedROI,
    };
  }

  function battlerFarmROI(d) {
    return farmNoHedgeRoiBreakdown(d).roi;
  }

  function farmHedgeRoiBreakdown(d) {
    const rows = farmUpgradeStats(d);
    const averageHerbPrice = (finite(d.bloomwellPrice) + finite(d.sagerootPrice)) / 2;
    const combinations = rows.map((row) => {
      const extraHerbsPerDay = row.extraHerbsHr * 24;
      const grossHerbValuePerDay = extraHerbsPerDay * averageHerbPrice;
      const addedFarmTaxPerHour = row.extraHerbsHr * C.FARM_DUST_PER_HERB;
      const farmTaxAvoidedPerDay = addedFarmTaxPerHour * 24;
      const hedgeLevelsNeeded = Math.ceil(Math.max(addedFarmTaxPerHour, 0)
        / C.HEDGE_DISCOUNT_PER_HOUR);
      const hedgeCost = hedgeLevelsNeeded * C.HEDGE_COST_PER_LEVEL;
      const hedgeDiscountPerHour = hedgeLevelsNeeded * C.HEDGE_DISCOUNT_PER_HOUR;
      const combinedCost = row.cost + hedgeCost;
      const combinedDailyBenefit = grossHerbValuePerDay + farmTaxAvoidedPerDay;
      return {
        ...row,
        extraHerbsPerDay,
        grossHerbValuePerDay,
        addedFarmTaxPerHour,
        farmTaxAvoidedPerDay,
        hedgeLevelsNeeded,
        hedgeCost,
        hedgeDiscountPerHour,
        combinedCost,
        combinedDailyBenefit,
        roi: safeDiv(combinedCost, combinedDailyBenefit),
      };
    });
    const valid = combinations.filter(row => Number.isFinite(row.roi));
    if (!valid.length) {
      return {
        bestUpgrade: null,
        upgradeSize: C.FARM_UPGRADE_SIZE,
        averageHerbPrice,
        extraHerbsPerDay: null,
        grossHerbValuePerDay: null,
        addedFarmTaxPerHour: null,
        farmTaxAvoidedPerDay: null,
        hedgeLevelsNeeded: null,
        hedgeCost: null,
        hedgeDiscountPerHour: null,
        hedgeStandaloneRoiDays: C.HEDGE_ROI_DAYS,
        farmUpgradeCost: null,
        combinedCost: null,
        combinedDailyBenefit: null,
        roi: null,
      };
    }

    const best = valid.reduce((currentBest, row) => (
      row.roi < currentBest.roi ? row : currentBest
    ));
    return {
      bestUpgrade: best.label,
      upgradeSize: C.FARM_UPGRADE_SIZE,
      averageHerbPrice,
      extraHerbsPerDay: best.extraHerbsPerDay,
      grossHerbValuePerDay: best.grossHerbValuePerDay,
      addedFarmTaxPerHour: best.addedFarmTaxPerHour,
      farmTaxAvoidedPerDay: best.farmTaxAvoidedPerDay,
      hedgeLevelsNeeded: best.hedgeLevelsNeeded,
      hedgeCost: best.hedgeCost,
      hedgeDiscountPerHour: best.hedgeDiscountPerHour,
      hedgeStandaloneRoiDays: C.HEDGE_ROI_DAYS,
      farmUpgradeCost: best.cost,
      combinedCost: best.combinedCost,
      combinedDailyBenefit: best.combinedDailyBenefit,
      roi: best.roi,
    };
  }

  function battlerFarmHedgeROI(d) {
    return farmHedgeRoiBreakdown(d).roi;
  }

  function tomeTotalCost(level) {
    const n = finite(level);
    return 200 * n ** 5 + 250_250 * n ** 4 + (1_499_500 / 3) * n ** 3
      + 249_750 * n ** 2 - (100 / 3) * n;
  }

  function tomeDropRoiBreakdown(d) {
    const tomes = [
      { name: 'Nature', level: finite(d.natureTomeLevel), price: finite(d.natureTomePrice) },
      { name: 'Water', level: finite(d.waterTomeLevel), price: finite(d.waterTomePrice) },
      { name: 'Fire', level: finite(d.fireTomeLevel), price: finite(d.fireTomePrice) },
    ];
    const highest = tomes.reduce((a, b) => b.level > a.level ? b : a);
    const upgradeResources = tomeTotalCost(highest.level + 1) - tomeTotalCost(highest.level);
    const averageResourcePrice = finite(d.averageResourcePrice);
    const upgradeCostDust = upgradeResources * averageResourcePrice;

    const baseDropChance = 0.005;
    const dropBoostPercent = finite(d.dropBoost);
    const effectiveDropChance = baseDropChance * ((dropBoostPercent + 100) / 100);
    const enemyBoost = Math.floor((finite(d.highestEnemy) + 150) / 1000);
    const levelBoost = highest.level;
    const maxBoost = enemyBoost + levelBoost;
    const minBoost = levelBoost;
    const successfulDropsPerHour = C.BATTLE_ACTIONS_PER_HOUR * effectiveDropChance;
    const guildDropAmountBoost = 100 * (Math.log2(1 + 0.006 * finite(d.guildLevel)));

    const avgDrop = ((minBoost + maxBoost) / 2) + 1;
    const nextAvgDrop = ((minBoost + maxBoost + 2) / 2) + 1;
    const avgWithGuild = avgDrop * ((guildDropAmountBoost + 100) / 100);
    const nextAvgWithGuild = nextAvgDrop * ((guildDropAmountBoost + 100) / 100);
    const successfulDropsPerDay = successfulDropsPerHour * C.BATTLE_HOURS_PER_DAY;
    const perDay = successfulDropsPerDay * avgWithGuild;
    const nextPerDay = successfulDropsPerDay * nextAvgWithGuild;
    const extraTomesPerDay = nextPerDay - perDay;
    const extraValuePerDay = extraTomesPerDay * highest.price;
    return {
      tomeName: highest.name,
      currentLevel: highest.level,
      nextLevel: highest.level + 1,
      upgradeResources,
      averageResourcePrice,
      upgradeCost: upgradeCostDust,
      baseDropChance,
      dropBoostPercent,
      effectiveDropChance,
      enemyBoost,
      guildDropAmountBoost,
      successfulDropsPerDay,
      currentAverageDropAmount: avgWithGuild,
      nextAverageDropAmount: nextAvgWithGuild,
      currentTomesPerDay: perDay,
      nextTomesPerDay: nextPerDay,
      extraTomesPerDay,
      tomeSellPrice: highest.price,
      extraValuePerDay,
      roi: safeDiv(upgradeCostDust, extraValuePerDay),
    };
  }

  function tomeDropROI(d) {
    return tomeDropRoiBreakdown(d).roi;
  }

  function dustCollectorRoiBreakdown(d) {
    const currentLevel = finite(d.dustCollector);
    const currentBoostPercent = currentLevel * 0.2;
    const nextBoostPercent = currentBoostPercent + 0.2;
    const cost = buildingCost(d.dustCollector, d.averageResourcePrice);
    const currentDailyMd = dustDaily(d, true, 0);
    const upgradedDailyMd = dustDaily(d, true, 0.2);
    const extraDailyMd = upgradedDailyMd - currentDailyMd;

    return {
      currentLevel,
      nextLevel: currentLevel + 1,
      currentBoostPercent,
      nextBoostPercent,
      cost,
      currentDailyMd,
      upgradedDailyMd,
      extraDailyMd,
      roi: safeDiv(cost, extraDailyMd),
    };
  }

  function dustCollectorROI(d) {
    return dustCollectorRoiBreakdown(d).roi;
  }

  function workshopDustCollectorRoiBreakdown(d) {
    const workshop = finite(d.workshopLevel);
    const pet = finite(d.constructionPetLevel);
    const constructionBoost = d.constructionBoost == null
      ? workshop + finite(d.constructionCodex)
      : finite(d.constructionBoost);
    const speed = finite(d.buildSpeed, 1) || 1;
    const petEffective = (((1 - 0.02 * pet) * 3) + ((pet * 0.02) * 6)) / 3;
    const buildSeconds = ((1 + constructionBoost / 100) * petEffective) * speed;
    const nextConstructionMultiplier = ((1 + (constructionBoost + 1) / 100)
      * petEffective) * speed;
    const buildsPerDay = (86400 / buildSeconds) * speed;
    const timeSavePerBuild = buildsPerDay
      * (1 - ((1 + constructionBoost / 100) / (1 + (constructionBoost + 1) / 100))
      ) / speed;
    const collectorDailyValue = dustDaily(d, true, 0.2) - dustDaily(d, true, 0);
    const dustTowerValuePerSecond = collectorDailyValue * buildSeconds / 86400;
    const valuePerFutureBuild = timeSavePerBuild * dustTowerValuePerSecond;
    const dailyCumulativeValue = valuePerFutureBuild * buildSeconds;
    const workshopCost = buildingCost(workshop, d.averageResourcePrice);
    const denominator = 0.5 * dailyCumulativeValue;
    const numerator = collectorDailyValue + workshopCost * speed;
    return {
      workshopCost,
      constructionBoost,
      constructionPetLevel: pet,
      constructionPetMultiplier: petEffective,
      buildSpeed: speed,
      currentConstructionMultiplier: buildSeconds,
      nextConstructionMultiplier,
      buildsPerDay,
      timeSavePerBuild,
      collectorDailyValue,
      dustTowerValuePerSecond,
      valuePerFutureBuild,
      dailyCumulativeValue,
      paybackNumerator: numerator,
      paybackDenominator: denominator,
      roi: denominator > 0 ? Math.sqrt(numerator / denominator) : null,
    };
  }

  function workshopDustCollectorROI(d) {
    return workshopDustCollectorRoiBreakdown(d).roi;
  }

  function calculate(d) {
    const battlerTotals = battler(d);
    const tserTotals = tserAtPotion(d, d.harvestPotion);
    const opt = optimizeTserPotion(d);
    const loss = opt.bestIncome - tserTotals.farmPlusPotIncome;
    const lossPct = safeDiv(loss, opt.bestIncome);
    const ambitiousPenaltyPercent = (1 - ambitiousResourceMultiplier(d)) * 100;
    const netHerbs = tserTotals.leftoverBloom + tserTotals.leftoverSage;
    const maxSustainablePotion = maxSustainableTserPotion(d);
    const battlerNetHerbs = battlerTotals.leftoverBloom + battlerTotals.leftoverSage;
    const battlerMaxSustainablePotion = maxSustainableBattlerPotion(d);

    const result = {
      battler: {
        ...battlerTotals,
        netHerbs: battlerNetHerbs,
        maxSustainablePotion: battlerMaxSustainablePotion,
      },
      tser: {
        ...tserTotals,
        bestPotion: opt.bestPotion,
        bestIncome: opt.bestIncome,
        lossFromCurrentPotion: loss,
        percentLoss: lossPct == null ? null : lossPct * 100,
        ambitiousPenaltyPercent,
        netHerbs,
        maxSustainablePotion,
      },
      roi: {
        battler: {
          lab: labROI(d, 'battler'),
          dustCollector: dustCollectorROI(d),
          farmNoHedge: battlerFarmROI(d),
          farmHedge: battlerFarmHedgeROI(d),
          tomeDrop: tomeDropROI(d),
          workshopDustCollector: workshopDustCollectorROI(d),
        },
        tser: {
          lab: labROI(d, 'tser'),
          spire: spireROI(d),
          potionBoost: potionBoostROI(d),
          baseRes: baseResourceROI(d),
          shards: shardROI(d),
          // Both roles use the same farm-upgrade calculations.
          farmNoHedge: battlerFarmROI(d),
          farmHedge: battlerFarmHedgeROI(d),
          // TSer Tome Drop uses the same ROI as the Battler Tome Drop row (K31 = G148).
          tomeDrop: tomeDropROI(d),
        },
      },
    };
    return result;
  }

  function normalizeFromApis(playerData, marketData, guilds, userInputs) {
    const totalBoosts = playerData?.TotalBoosts || {};
    const baseBoosts = playerData?.BaseBoosts || {};
    const equipment = playerData?.Equipment || {};
    const equipmentItems = Object.values(equipment);
    const getNum = (obj, key, fallback = 0) => finite(obj?.[key], fallback);

    const prefixName = (item) => {
      const prefix = item?.Prefix ?? item?.prefix ?? item?.PrefixName ?? item?.prefixName;
      if (typeof prefix === 'string') return prefix;
      if (prefix && typeof prefix === 'object') {
        return prefix.Name ?? prefix.name ?? prefix.Label ?? prefix.label ?? '';
      }
      return '';
    };
    const hasAmbitiousPrefix = (item) => {
      if (!item || item.IsEquipped === false || item.isEquipped === false) return false;
      const name = String(item.Name ?? item.name ?? '').trim();
      const explicitPrefix = String(prefixName(item)).trim();
      return /^Ambitious(?:\s|$)/i.test(name) || /^Ambitious$/i.test(explicitPrefix);
    };
    const ambitiousCount = Math.min(
      equipmentItems.filter(hasAmbitiousPrefix).length,
      C.MAX_AMBITIOUS_PREFIXES,
    );

    const mining = finite(playerData?.MiningLevel);
    const fishing = finite(playerData?.FishingLevel);
    const woodcutting = finite(playerData?.WoodcuttingLevel);
    const gatheringId = mining >= fishing && mining >= woodcutting ? '30'
      : fishing >= mining && fishing >= woodcutting ? '31' : '32';

    let equipmentResearch = 0;
    let equipmentBaseRes = 0;
    for (const item of equipmentItems) {
      if (!item || !item.Boosts) continue;
      const infusionMultiplier = 1 + 0.05 * finite(item.Infusions);
      if (item.Boosts[gatheringId] != null) {
        equipmentResearch += finite(item.Boosts[gatheringId]) * infusionMultiplier / 50;
      }
      if (item.Boosts['124'] != null) {
        equipmentBaseRes += (finite(item.Boosts['124']) / 100) * infusionMultiplier;
      }
    }

    let nexusLevel = null;
    try {
      const totalResearchBoost = finite(totalBoosts[gatheringId], NaN);
      const baseResearchBoost = finite(baseBoosts[gatheringId], NaN);
      const spireBase = finite(baseBoosts['152']);
      const equipmentTerm = Object.values(equipment).reduce((acc, item) => {
        const b = item?.Boosts?.[gatheringId];
        if (b == null) return acc;
        return acc + Math.floor(finite(b) * (1 + finite(item.Infusions) / 20)) * (1 + spireBase / 100);
      }, 0);
      const x = ((((totalResearchBoost - 1) * 100) / 0.02 - equipmentTerm) / baseResearchBoost - 1) * 100;
      if (Number.isFinite(x)) nexusLevel = Math.round(x);
    } catch (_) {}

    let guildLevel = 0;
    const guildId = playerData?.GuildID;
    if (Array.isArray(guilds)) {
      const guild = guilds.find(g => String(g?.ID ?? g?.id) === String(guildId));
      guildLevel = finite(guild?.Level ?? guild?.level);
    } else if (guilds && guildId != null) {
      guildLevel = finite(guilds[guildId]?.Level ?? guilds[guildId]?.level);
    }

    const sell = marketData?.Sell || {};
    const buy = marketData?.Buy || {};
    const averageRes = Math.round((getNum(sell, '8') + getNum(sell, '7') + getNum(sell, '9')) / 3);
    const averageMarketPrice = (id) => Math.round((getNum(buy, String(id)) + getNum(sell, String(id))) / 2);
    const research = Math.max(getNum(totalBoosts, '30'), getNum(totalBoosts, '31'), getNum(totalBoosts, '32')) * 100;
    const sigilBoost = finite(playerData?.SigilBoost);
    const pets = playerData?.Pets || {};
    const constructionPet = pets?.['24'] ?? Object.values(pets).find(
      pet => String(pet?.ID ?? pet?.id ?? '') === '24',
    );
    const constructionPetActive = constructionPet?.Active ?? constructionPet?.active ?? true;
    const workshopLevel = getNum(baseBoosts, '150');
    const constructionCodex = getNum(baseBoosts, '104');
    const apiConstructionBoost = getNum(totalBoosts, '104', NaN);
    const constructionBoost = Number.isFinite(apiConstructionBoost)
      ? apiConstructionBoost
      : workshopLevel + constructionCodex;

    return {
      username: userInputs.username,
      tax: finite(userInputs.tax),
      harvestPotion: finite(userInputs.harvestPotion),
      resonancePotion: finite(userInputs.resonancePotion),
      potDuration: getNum(totalBoosts, '110'),
      bloomwellPrice: getNum(sell, '41'),
      sagerootPrice: getNum(sell, '40'),
      golems: getNum(totalBoosts, '130'),
      fertilizer: getNum(totalBoosts, '131'),
      plots: getNum(totalBoosts, '132'),
      level: Math.max(mining, fishing, woodcutting),
      potionBoost: getNum(totalBoosts, '108'),
      baseRes: getNum(totalBoosts, '124') / 100,
      baseResResearch: getNum(totalBoosts, '106'),
      research,
      averageResourcePrice: averageRes,
      farmDiscount: getNum(baseBoosts, '134'),
      spire: getNum(totalBoosts, '152'),
      equipmentBaseRes,
      equipmentResearch,
      ambitiousCount,
      sigilBoost,
      hasNonDistillationSigil: sigilBoost > 0 && sigilBoost !== C.DISTILLATION_SIGIL_BOOST_ID,
      powerOrbPrice: averageMarketPrice(35),
      perfectOrbPrice: averageMarketPrice(50),
      divineEssencePrice: averageMarketPrice(47),
      elementiumPrice: averageMarketPrice(46),
      baseResAmount: getNum(baseBoosts, '124'),
      labLevel: getNum(baseBoosts, '160'),
      shardBoost: getNum(baseBoosts, gatheringId),
      shardPrice: getNum(buy, '2'),
      nexusLevel,
      natureTomePrice: getNum(sell, '15'),
      waterTomePrice: getNum(sell, '14'),
      fireTomePrice: getNum(sell, '13'),
      dropBoost: getNum(totalBoosts, '102'),
      natureTomeLevel: getNum(baseBoosts, '27'),
      waterTomeLevel: getNum(baseBoosts, '26'),
      fireTomeLevel: getNum(baseBoosts, '25'),
      guildLevel,
      highestEnemy: finite(playerData?.HighestEnemy),
      dustCollector: getNum(totalBoosts, '161'),
      dustCodex: getNum(totalBoosts, '101'),
      dustEquipment: getNum(totalBoosts, '121'),
      currentEnemy: finite(playerData?.Enemy),
      workshopLevel,
      constructionPetLevel: constructionPet && constructionPetActive
        ? finite(constructionPet.Level ?? constructionPet.level)
        : 0,
      constructionBoost,
    };
  }

  return {
    C,
    calculate,
    normalizeFromApis,
    helpers: {
      buildingCost, herbsPerHour, harvestHerbsPerPot, resonanceHerbsPerPot,
      ambitiousResourceMultiplier, battlerAtPotion, tserAtPotion, optimizeTserPotion,
      maxSustainableBattlerPotion, maxSustainableTserPotion,
      tomeTotalCost, tomeDropRoiBreakdown, farmUpgradeStats, labRoiBreakdown, mdIncomeBreakdown,
      dustCollectorRoiBreakdown, workshopDustCollectorRoiBreakdown,
      farmNoHedgeRoiBreakdown, farmHedgeRoiBreakdown,
    },
  };
});
