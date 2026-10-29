(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ManarionCalculator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const EVENT_ACTIONS_PER_DAY = 27400;
  const BATTLE_ACTIONS_PER_HOUR = 1200;

  const C = Object.freeze({
    // Potion use and hourly rewards must cover the same event actions as daily income.
    BATTLE_HOURS_PER_DAY: EVENT_ACTIONS_PER_DAY / BATTLE_ACTIONS_PER_HOUR,
    BATTLE_ACTIONS_PER_HOUR,
    NON_EVENT_BATTLES_PER_DAY: EVENT_ACTIONS_PER_DAY,
    BASE_SHARD_DROP_CHANCE: 1 / 80,
    SHARD_RETAINED_FRACTION: 0.1,
    GATHER_ACTIONS_PER_DAY: EVENT_ACTIONS_PER_DAY,
    TS_UNPOTTED_ACTIONS: EVENT_ACTIONS_PER_DAY,
    TS_POTTED_ACTIONS: EVENT_ACTIONS_PER_DAY,
    FARM_DUST_PER_HERB: 50000,
    TS_EVENT_RESEARCH_BONUS: 604.42,
    FARM_UPGRADE_SIZE: 1000,
    BASE_RES_UPGRADE_SIZE: 5000,
    SHARD_UPGRADE_SIZE: 1000,
    NODE_YIELD_UPGRADE_SIZE: 500,
    NODE_RARITY_CHANCES: Object.freeze([0.75, 0.15, 0.06, 0.03, 0.008, 0.002]),
    HEDGE_COST_PER_LEVEL: 1_000_000_000_000,
    HEDGE_DISCOUNT_PER_HOUR: 1_000_000_000,
    HEDGE_ROI_DAYS: 1_000_000_000_000 / (1_000_000_000 * 24),
    MAX_TSER_POTION: 1_000_000,
    MAX_WISDOM_POTION: 999_999,
    MAX_SUNPETAL_POTION: 999_999,
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

  function farmHerbBonuses(d) {
    const bloomBonusPercent = 2 * Math.max(0, finite(d.bloomwellConstellationLevel));
    const sageBonusPercent = 2 * Math.max(0, finite(d.sagerootConstellationLevel));
    const bloomMultiplier = 1 + bloomBonusPercent / 100;
    const sageMultiplier = 1 + sageBonusPercent / 100;
    return { bloomBonusPercent, sageBonusPercent, bloomMultiplier, sageMultiplier,
      totalMultiplier: (bloomMultiplier + sageMultiplier) / 2 };
  }

  function averageFarmHerbPrice(d) {
    const { bloomMultiplier, sageMultiplier } = farmHerbBonuses(d);
    return (bloomMultiplier * finite(d.bloomwellPrice) + sageMultiplier * finite(d.sagerootPrice))
      / (bloomMultiplier + sageMultiplier);
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

  function starResourceMultiplier(d) {
    return 1 + Math.max(0, finite(d.starResourceBonusPercent)) / 100;
  }

  function grossUnpottedResourcePerAction(d) {
    return (1 + finite(d.level) * 0.03 + finite(d.baseRes))
      * (1 + finite(d.baseResResearch) / 100)
      * (1 + finite(d.research) / 100)
      * ambitiousResourceMultiplier(d) * starResourceMultiplier(d);
  }

  function grossPottedResourcePerAction(d, harvestPotion, researchEventBonus = C.TS_EVENT_RESEARCH_BONUS) {
    const potBase = potionBaseResourceBonus(harvestPotion, d.potionBoost);
    return (1 + finite(d.level) * 0.03 + potBase + finite(d.baseRes))
      * (1 + finite(d.baseResResearch) / 100)
      * ((finite(d.research) + finite(researchEventBonus)) / 100)
      * ambitiousResourceMultiplier(d) * starResourceMultiplier(d);
  }

  function dustPerBattleBase(enemy) {
    const e = finite(enemy) + 150;
    // The API excludes 150 starter enemies; both reward terms include them.
    return (0.0001 * e ** 2 + e ** 1.2 + 10 * e)
      * (e > 150000 ? 1.01 ** ((e - 150000) / 2000) : 1);
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
    const baseHerbHr = herbsPerHour(d);
    const baseHerbDaily = baseHerbHr * 24;
    const bonuses = farmHerbBonuses(d);
    const bloomDaily = baseHerbDaily / 2 * bonuses.bloomMultiplier;
    const sageDaily = baseHerbDaily / 2 * bonuses.sageMultiplier;
    const herbHr = baseHerbHr * bonuses.totalMultiplier;
    const herbDaily = bloomDaily + sageDaily;
    const harvestPerPot = harvestHerbsPerPot(harvestPotion);
    const harvestHr = herbsPerHourFromPotion(harvestPerPot, d.potDuration);
    const resPerPot = resonanceHerbsPerPot(d.resonancePotion);
    const resHr = herbsPerHourFromPotion(resPerPot, d.potDuration);
    const sunpetalsPerDay = 0.05 * Math.sqrt(baseHerbHr) * 24;
    const guidanceConsumedPerDay = herbsPerHourFromPotion(
      harvestHerbsPerPot(d.guidancePotion), d.potDuration,
    ) * C.BATTLE_HOURS_PER_DAY;
    const leftoverSunpetals = sunpetalsPerDay - guidanceConsumedPerDay;
    return { baseHerbHr, baseHerbDaily, herbHr, herbDaily, bloomDaily, sageDaily,
      bloomBonusPercent: bonuses.bloomBonusPercent, sageBonusPercent: bonuses.sageBonusPercent,
      sunpetalsPerDay, guidanceConsumedPerDay, leftoverSunpetals,
      harvestPerPot, harvestHr, resPerPot, resHr };
  }

  function battlerAtPotion(d, harvestPotion) {
    const f = farmTotals(d, harvestPotion);
    const leftoverBloom = f.bloomDaily - ((f.resHr * C.BATTLE_HOURS_PER_DAY) / 2);
    const leftoverSage = f.sageDaily - ((f.harvestHr * C.BATTLE_HOURS_PER_DAY) + ((f.resHr / 2) * C.BATTLE_HOURS_PER_DAY));
    const leftoverSold = leftoverBloom * finite(d.bloomwellPrice) + leftoverSage * finite(d.sagerootPrice)
      + f.leftoverSunpetals * finite(d.sunpetalPrice);
    const farmTax = (leftoverSold - f.baseHerbDaily * C.FARM_DUST_PER_HERB) + finite(d.farmDiscount) * 1_000_000_000 * 24;
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
    const leftoverSold = leftoverBloom * finite(d.bloomwellPrice) + leftoverSage * finite(d.sagerootPrice)
      + f.leftoverSunpetals * finite(d.sunpetalPrice);
    const farmTax = (leftoverSold - f.baseHerbDaily * C.FARM_DUST_PER_HERB) + finite(d.farmDiscount) * 1_000_000_000 * 24;

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

  function tserGuildPotionAnalysis(d) {
    // Resource tax transfers value to the guild; herb and farm costs still apply.
    const guildInputs = { ...d, tax: 0 };
    const optimum = optimizeTserPotion(guildInputs);
    const best = tserAtPotion(guildInputs, optimum.bestPotion);
    const current = tserAtPotion(guildInputs, d.harvestPotion);
    const grossResourceValue = best.pottedAfterEvent * finite(d.averageResourcePrice);
    const currentGrossResourceValue = current.pottedAfterEvent * finite(d.averageResourcePrice);
    return {
      bestPotion: optimum.bestPotion,
      grossResourceValue,
      currentGrossResourceValue,
      grossResourceChange: grossResourceValue - currentGrossResourceValue,
      farmIncome: best.farmTax,
      dailyIncome: best.fullIncome,
      currentDailyIncome: current.fullIncome,
      changeFromCurrent: best.fullIncome - current.fullIncome,
    };
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
    return maxSustainablePotion(d, tserAtPotion, { step: 1, ...options });
  }

  function maxSustainableBattlerPotion(d, options) {
    return Math.min(
      C.MAX_WISDOM_POTION,
      maxSustainablePotion(d, battlerAtPotion, { step: 1, ...options }),
    );
  }

  function sunpetalPotionAnalysis(d) {
    const farmHerbsPerHour = herbsPerHour(d);
    // Developer estimate: hourly Sunpetals are 5% of the square root of farm output.
    const sunpetalsPerHour = 0.05 * Math.sqrt(farmHerbsPerHour);
    const sunpetalsPerDay = sunpetalsPerHour * 24;
    const durationHours = 1 + finite(d.potDuration) / 100;
    if (!Number.isFinite(sunpetalsPerDay) || sunpetalsPerDay < 0
      || !Number.isFinite(durationHours) || durationHours <= 0) return null;

    const dailyConsumption = tier => harvestHerbsPerPot(tier) * C.BATTLE_HOURS_PER_DAY / durationHours;
    let low = 0;
    let high = C.MAX_SUNPETAL_POTION;
    while (low < high) {
      const middle = Math.floor((low + high + 1) / 2);
      if (dailyConsumption(middle) <= sunpetalsPerDay) low = middle;
      else high = middle - 1;
    }
    return {
      maximumSustainablePotion: low,
      farmHerbsPerHour, sunpetalsPerHour, sunpetalsPerDay, durationHours,
      sunpetalsPerPotion: harvestHerbsPerPot(low),
      sunpetalsConsumedPerDay: dailyConsumption(low),
      nextTierConsumptionPerDay: low < C.MAX_SUNPETAL_POTION ? dailyConsumption(low + 1) : null,
    };
  }

  function farmUpgradeResources(level, upgrades) {
    const n = Math.max(0, Math.trunc(upgrades));
    // Sum the resource cost (level + 1)^2 through (level + n)^2.
    return n * level ** 2 + level * n * (n + 1) + n * (n + 1) * (2 * n + 1) / 6;
  }

  function balancedFarmLevels(d, upgrades) {
    const levels = ['golems', 'fertilizer', 'plots']
      .map(key => ({ key, level: Math.max(0, Math.trunc(finite(d[key]))) }))
      .sort((a, b) => a.level - b.level);
    let remaining = upgrades;
    // Catch up the lowest stats, then distribute further levels evenly.
    for (let count = 1; count <= levels.length; count += 1) {
      const nextLevel = levels[count]?.level ?? Infinity;
      const catchUp = (nextLevel - levels[0].level) * count;
      if (remaining >= catchUp) {
        for (let i = 0; i < count; i += 1) levels[i].level = nextLevel;
        remaining -= catchUp;
      } else {
        const each = Math.floor(remaining / count);
        const remainder = remaining % count;
        for (let i = 0; i < count; i += 1) levels[i].level += each + (i < remainder ? 1 : 0);
        break;
      }
    }
    return Object.fromEntries(levels.map(({ key, level }) => [key, level]));
  }

  function farmForDailyHerbs(d, requiredHerbsPerDay) {
    if (!Number.isFinite(requiredHerbsPerDay)) return null;
    const harvestMultiplier = farmHerbBonuses(d).totalMultiplier;
    const dailyHerbsAt = upgrades => herbsPerHour({ ...d, ...balancedFarmLevels(d, upgrades) }) * 24 * harvestMultiplier;
    let low = 0;
    let high = 0;
    if (dailyHerbsAt(0) < requiredHerbsPerDay) {
      high = 1;
      while (dailyHerbsAt(high) < requiredHerbsPerDay) {
        if (high > Number.MAX_SAFE_INTEGER / 2) return null;
        high *= 2;
      }
      while (low < high) {
        const middle = low + Math.floor((high - low) / 2);
        if (dailyHerbsAt(middle) >= requiredHerbsPerDay) high = middle;
        else low = middle + 1;
      }
    }
    const levels = balancedFarmLevels(d, high);
    const upgrades = [
      ['Golems', 'golems', 'Iron'],
      ['Fertilizer', 'fertilizer', 'Fish'],
      ['Plots', 'plots', 'Wood'],
    ].map(([label, key, resource]) => {
      const currentLevel = Math.max(0, Math.trunc(finite(d[key])));
      const addedLevels = levels[key] - currentLevel;
      return { label, key, resource, currentLevel, nextLevel: levels[key], addedLevels,
        resources: farmUpgradeResources(currentLevel, addedLevels) };
    });
    const extraBaseHerbsPerDay = (herbsPerHour({ ...d, ...levels }) - herbsPerHour(d)) * 24;
    const extraHerbsPerDay = extraBaseHerbsPerDay * harvestMultiplier;
    const addedFarmTaxPerHour = extraBaseHerbsPerDay / 24 * C.FARM_DUST_PER_HERB;
    const hedgeLevelsNeeded = Math.ceil(Math.max(0, addedFarmTaxPerHour) / C.HEDGE_DISCOUNT_PER_HOUR);
    const resourcesNeeded = upgrades.reduce((sum, upgrade) => sum + upgrade.resources, 0);
    const farmCost = resourcesNeeded * finite(d.averageResourcePrice);
    const hedgeCost = hedgeLevelsNeeded * C.HEDGE_COST_PER_LEVEL;
    return { upgrades, totalAddedLevels: high, extraHerbsPerDay, resourcesNeeded, farmCost,
      hedgeLevelsNeeded, hedgeCost, addedFarmTaxPerHour, cost: farmCost + hedgeCost };
  }

  function resonanceUpgradeValue(d) {
    const required = [d.battleLevel, d.miningLevel, d.fishingLevel, d.woodcuttingLevel,
      d.dropBoost, d.resonancePotion, d.potionBoost, d.shardMarketPrice];
    if (!required.every(value => Number.isFinite(value) && value >= 0)) return null;

    const weightedLevel = 3 * d.battleLevel + d.miningLevel + d.fishingLevel + d.woodcuttingLevel;
    const minimumBaseDrop = 100 * (1 + weightedLevel / 10)
      ** (1 - 0.3 * weightedLevel / (weightedLevel + 20000));
    const averageBaseDrop = minimumBaseDrop * 1.5;
    const effectiveDropChance = Math.min(1, C.BASE_SHARD_DROP_CHANCE * (1 + d.dropBoost / 100));
    const dropsPerDay = C.NON_EVENT_BATTLES_PER_DAY * effectiveDropChance;
    const equipmentShardBonus = Math.max(0, finite(d.equipmentShardBonus));
    const shardConstellationBonusPercent = 3 * Math.max(0, finite(d.shardConstellationLevel));
    const shardConstellationMultiplier = 1 + shardConstellationBonusPercent / 100;
    const currentResonanceBonus = 5 * d.resonancePotion * (1 + d.potionBoost / 100);
    // Equipment and Resonance add to the same shard-amount bonus. Only the potion changes.
    const extraResonanceBonus = 5 * d.resonancePotion / 100;
    const nextResonanceBonus = currentResonanceBonus + extraResonanceBonus;
    const currentAverageDrop = averageBaseDrop
      * (1 + (equipmentShardBonus + currentResonanceBonus) / 100) * shardConstellationMultiplier;
    const nextAverageDrop = averageBaseDrop
      * (1 + (equipmentShardBonus + nextResonanceBonus) / 100) * shardConstellationMultiplier;
    const currentShardsPerDay = dropsPerDay * currentAverageDrop;
    const extraShardsPerDay = dropsPerDay * averageBaseDrop * extraResonanceBonus / 100
      * shardConstellationMultiplier;
    const retainedExtraShardsPerDay = extraShardsPerDay * C.SHARD_RETAINED_FRACTION;
    const valuePerDay = retainedExtraShardsPerDay * d.shardMarketPrice;
    if (!Number.isFinite(valuePerDay)) return null;

    return { weightedLevel, minimumBaseDrop, averageBaseDrop, effectiveDropChance, dropsPerDay,
      shardConstellationBonusPercent, shardConstellationMultiplier,
      equipmentShardBonus, currentResonanceBonus, nextResonanceBonus, extraResonanceBonus,
      currentAverageDrop, nextAverageDrop,
      currentShardsPerDay, nextShardsPerDay: currentShardsPerDay + extraShardsPerDay,
      extraShardsPerDay, retainedExtraShardsPerDay, shardMarketPrice: d.shardMarketPrice, valuePerDay };
  }

  function battlerPotionAnalysis(d, maximumSustainablePotion = maxSustainableBattlerPotion(d)) {
    const potionBoost = Math.max(0, finite(d.potionBoost));
    const potionBoostLevel = Math.max(0, finite(d.potionBoostLevel, potionBoost));
    const potionBoostCost = Math.floor(10_000_000 * 1.1 ** potionBoostLevel);
    const potionBoostGainPercent = 100 / (100 + potionBoost);
    const comparison = {
      maximumSustainablePotion, potionBoost, potionBoostLevel, nextPotionBoost: potionBoost + 1,
      potionBoostCost: Number.isFinite(potionBoostCost) ? potionBoostCost : null,
      potionBoostGainPercent, matchingWisdomPotion: null, extraHerbsConsumedPerDay: null,
      resonanceValue: resonanceUpgradeValue(d),
      farmGainPercent: null, farm: null, preferredOption: null,
      status: 'no-sustainable-potion',
    };
    if (maximumSustainablePotion <= 0) return comparison;
    const matchingWisdomPotion = Math.ceil(
      maximumSustainablePotion * (101 + potionBoost) / (100 + potionBoost),
    );
    if (matchingWisdomPotion > C.MAX_WISDOM_POTION) {
      return { ...comparison, status: 'potion-limit',
        preferredOption: comparison.potionBoostCost == null ? null : 'potionBoost' };
    }
    const current = farmTotals(d, maximumSustainablePotion);
    const target = farmTotals(d, matchingWisdomPotion);
    const extraHerbsConsumedPerDay = (target.harvestHr - current.harvestHr) * C.BATTLE_HOURS_PER_DAY;
    const requiredHerbsPerDay = (target.harvestHr + target.resHr) * C.BATTLE_HOURS_PER_DAY;
    const farm = farmForDailyHerbs(d, requiredHerbsPerDay);
    const farmGainPercent = (matchingWisdomPotion / maximumSustainablePotion - 1) * 100;
    const boostCostPerPercent = safeDiv(comparison.potionBoostCost, potionBoostGainPercent);
    const farmCostPerPercent = safeDiv(farm?.cost, farmGainPercent);
    let preferredOption = null;
    if (boostCostPerPercent != null && farmCostPerPercent != null) {
      preferredOption = boostCostPerPercent === farmCostPerPercent ? 'equal'
        : boostCostPerPercent < farmCostPerPercent ? 'potionBoost' : 'farm';
    }
    return { ...comparison, matchingWisdomPotion, extraHerbsConsumedPerDay, farmGainPercent,
      farm, preferredOption, status: farm ? 'ready' : 'unavailable' };
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
    // Hold the entered Guidance tier fixed when valuing the duration upgrade.
    const guidancePotion = Math.max(0, Math.trunc(finite(d.guidancePotion)));
    const sunpetalsPerPotion = harvestHerbsPerPot(guidancePotion);
    const sunpetalsPerHour = herbsPerHourFromPotion(sunpetalsPerPotion, d.potDuration);
    const nextSunpetalsPerHour = herbsPerHourFromPotion(sunpetalsPerPotion, finite(d.potDuration) + 1);
    const sunpetalsSavedPerDay = (sunpetalsPerHour - nextSunpetalsPerHour) * C.BATTLE_HOURS_PER_DAY;
    const sunpetalPrice = finite(d.sunpetalPrice, NaN);
    const guidanceSavingsValuePerDay = guidancePotion === 0 ? 0 : sunpetalsSavedPerDay * sunpetalPrice;
    const totalSavingsValuePerDay = Math.abs(
      harvestSavingsValuePerDay + resonanceSavingsValuePerDay + guidanceSavingsValuePerDay,
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
      guidancePotion,
      sunpetalsPerHour,
      nextSunpetalsPerHour,
      sunpetalsSavedPerDay,
      sunpetalPrice,
      guidanceSavingsValuePerDay,
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
    const pinnacleMultiplier = finite(d.pinnacleResearchMultiplier, 1);
    const pinnacleIncrease = finite(d.pinnacleResearchPerSpireLevel);
    // API research includes Pinnacle already; its baseline 100% is not boosted.
    // Apply next level's multiplier to new equipment research and the multiplier
    // increase to the existing bonus. This includes the cross-term from both gains.
    const extraResearch = currentEquipmentResearch * 0.01 * (pinnacleMultiplier + pinnacleIncrease)
      + ((finite(d.research) - 100) / pinnacleMultiplier) * pinnacleIncrease;
    if (!extraResearch) return null;
    const potBase = potionBaseResourceBonus(d.harvestPotion, d.potionBoost);
    const baseFactor = (1 + finite(d.level) * 0.03 + potBase + finite(d.baseRes))
      * (1 + finite(d.baseResResearch) / 100);
    const current = baseFactor * (finite(d.research) / 100) * C.GATHER_ACTIONS_PER_DAY;
    const upgraded = baseFactor * ((finite(d.research) + extraResearch) / 100) * C.GATHER_ACTIONS_PER_DAY;
    const grossExtra = upgraded - current;
    const taxedExtra = grossExtra * pctAfterTax(d.tax);
    const valuePerDay = taxedExtra * finite(d.averageResourcePrice)
      * ambitiousResourceMultiplier(d) * starResourceMultiplier(d);
    return safeDiv(buildingCost(d.spire, d.averageResourcePrice), valuePerDay);
  }

  function potionBoostROI(d) {
    const current = finite(d.potionBoost);
    const purchasedLevel = finite(d.potionBoostLevel, current);
    const currentPotBase = potionBaseResourceBonus(d.harvestPotion, current);
    const nextPotBase = potionBaseResourceBonus(d.harvestPotion, current + 1);
    const common = (1 + finite(d.baseResResearch) / 100) * (finite(d.research) / 100);
    const currentRes = (1 + finite(d.level) * 0.03 + currentPotBase + finite(d.baseRes)) * common;
    const nextRes = (1 + finite(d.level) * 0.03 + nextPotBase + finite(d.baseRes)) * common;
    const valuePerDay = (nextRes - currentRes) * C.TS_POTTED_ACTIONS
      * finite(d.averageResourcePrice) * pctAfterTax(d.tax)
      * ambitiousResourceMultiplier(d) * starResourceMultiplier(d);
    const cost = Math.floor(10_000_000 * 1.1 ** purchasedLevel);
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
      * finite(d.averageResourcePrice) * ambitiousResourceMultiplier(d) * starResourceMultiplier(d);
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
    const addedResearch = n * (0.0002 * nexus + 0.02) * finite(d.pinnacleResearchMultiplier, 1);

    const potBase = potionBaseResourceBonus(d.harvestPotion, d.potionBoost);
    const baseFactor = (1 + finite(d.level) * 0.03 + potBase + finite(d.baseRes))
      * (1 + finite(d.baseResResearch) / 100);
    const currentRes = baseFactor * (finite(d.research) / 100) * C.TS_POTTED_ACTIONS;
    const upgradedRes = baseFactor * ((finite(d.research) + addedResearch) / 100) * C.TS_POTTED_ACTIONS;
    const valuePerDay = (upgradedRes - currentRes) * pctAfterTax(d.tax)
      * finite(d.averageResourcePrice) * ambitiousResourceMultiplier(d) * starResourceMultiplier(d);
    return safeDiv(cost, valuePerDay);
  }

  function farmUpgradeStats(d) {
    const currentHerbs = herbsPerHour(d);
    const avgHerbPrice = averageFarmHerbPrice(d);
    const harvestMultiplier = farmHerbBonuses(d).totalMultiplier;
    const rows = [
      ['Golems', 'golems'],
      ['Fertilizer', 'fertilizer'],
      ['Plots', 'plots'],
    ].map(([label, key]) => {
      const next = { ...d, [key]: finite(d[key]) + C.FARM_UPGRADE_SIZE };
      const extraBaseHerbsHr = herbsPerHour(next) - currentHerbs;
      const extraHerbsHr = extraBaseHerbsHr * harvestMultiplier;
      const extraSunpetalsPerDay = 0.05 * (Math.sqrt(herbsPerHour(next)) - Math.sqrt(currentHerbs)) * 24;
      const extraSunpetalValue = extraSunpetalsPerDay * finite(d.sunpetalPrice);
      const level = finite(d[key]);
      const cost = (1000 * level ** 2 + 1_001_000 * level + 333_833_500 + 208_500)
        * finite(d.averageResourcePrice);
      const noTaxDenominator = extraHerbsHr * 24 * avgHerbPrice + extraSunpetalValue;
      const taxDenominator = noTaxDenominator - extraBaseHerbsHr * 24 * C.FARM_DUST_PER_HERB;
      return {
        label,
        key,
        extraHerbsHr,
        extraBaseHerbsHr,
        extraSunpetalsPerDay,
        extraSunpetalValue,
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
    const averageHerbPrice = averageFarmHerbPrice(d);
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
    const grossHerbValuePerDay = extraHerbsPerDay * averageHerbPrice + best.extraSunpetalValue;
    const farmTaxPerDay = best.extraBaseHerbsHr * 24 * C.FARM_DUST_PER_HERB;
    const netDailyBenefit = grossHerbValuePerDay - farmTaxPerDay;

    return {
      bestUpgrade: best.label,
      upgradeSize: C.FARM_UPGRADE_SIZE,
      averageHerbPrice,
      extraHerbsPerDay,
      extraSunpetalsPerDay: best.extraSunpetalsPerDay,
      extraSunpetalValue: best.extraSunpetalValue,
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
    const averageHerbPrice = averageFarmHerbPrice(d);
    const combinations = rows.map((row) => {
      const extraHerbsPerDay = row.extraHerbsHr * 24;
      const grossHerbValuePerDay = extraHerbsPerDay * averageHerbPrice + row.extraSunpetalValue;
      const addedFarmTaxPerHour = row.extraBaseHerbsHr * C.FARM_DUST_PER_HERB;
      const hedgeLevelsNeeded = Math.ceil(Math.max(addedFarmTaxPerHour, 0)
        / C.HEDGE_DISCOUNT_PER_HOUR);
      const hedgeCost = hedgeLevelsNeeded * C.HEDGE_COST_PER_LEVEL;
      const hedgeDiscountPerHour = hedgeLevelsNeeded * C.HEDGE_DISCOUNT_PER_HOUR;
      const combinedCost = row.cost + hedgeCost;
      return {
        ...row,
        extraHerbsPerDay,
        grossHerbValuePerDay,
        addedFarmTaxPerHour,
        hedgeLevelsNeeded,
        hedgeCost,
        hedgeDiscountPerHour,
        combinedCost,
        roi: safeDiv(combinedCost, grossHerbValuePerDay),
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
        hedgeLevelsNeeded: null,
        hedgeCost: null,
        hedgeDiscountPerHour: null,
        hedgeStandaloneRoiDays: C.HEDGE_ROI_DAYS,
        farmUpgradeCost: null,
        combinedCost: null,
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
      extraSunpetalsPerDay: best.extraSunpetalsPerDay,
      extraSunpetalValue: best.extraSunpetalValue,
      grossHerbValuePerDay: best.grossHerbValuePerDay,
      addedFarmTaxPerHour: best.addedFarmTaxPerHour,
      hedgeLevelsNeeded: best.hedgeLevelsNeeded,
      hedgeCost: best.hedgeCost,
      hedgeDiscountPerHour: best.hedgeDiscountPerHour,
      hedgeStandaloneRoiDays: C.HEDGE_ROI_DAYS,
      farmUpgradeCost: best.cost,
      combinedCost: best.combinedCost,
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
      tomeMarketPrice: highest.price,
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
    const constructionCodex = Math.max(0, finite(d.constructionCodex));
    const ambidextrousLevel = Math.max(0, finite(d.ambidextrousLevel));
    const ambidextrousChancePercent = constructionCodex * ambidextrousLevel * 0.01;
    const ambidextrousExtraSecondsPerTick = 3 * ambidextrousChancePercent / 100;
    const constructionBoost = d.constructionBoost == null
      ? workshop + finite(d.constructionCodex)
      : finite(d.constructionBoost);
    const speed = finite(d.buildSpeed, 1) || 1;
    const petEffective = (((1 - 0.02 * pet) * 3) + ((pet * 0.02) * 6)) / 3;
    // The game's timer adds pet and Ambidextrous expected reductions to each tick.
    const constructionTickMultiplier = petEffective + ambidextrousChancePercent / 100;
    const buildSeconds = ((1 + constructionBoost / 100) * constructionTickMultiplier) * speed;
    const nextConstructionMultiplier = ((1 + (constructionBoost + 1) / 100)
      * constructionTickMultiplier) * speed;
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
      constructionCodex,
      ambidextrousLevel,
      ambidextrousChancePercent,
      ambidextrousExtraSecondsPerTick,
      constructionTickMultiplier,
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

  const nodeExpectationCache = new Map();

  // Renewal reward model: a cycle contains an idle period followed by one busy
  // node episode. Each overlapping discovery raises rarity, capped at Mythic.
  // Leo extends remaining work; otherwise a discovery refreshes the timer.
  // Once Mythic is reached, remaining busy time has a closed-form expectation.
  function nodeYieldExpectation(chance, ticks, leo = false, gemini = false) {
    const p = Math.min(1, Math.max(0, chance));
    const duration = Math.max(1, Math.round(ticks));
    if (!Number.isFinite(p) || !Number.isFinite(duration)) return null;
    const key = [p, duration, leo, gemini].join(':');
    if (nodeExpectationCache.has(key)) return nodeExpectationCache.get(key);
    if (p === 0) return { activeFraction: 0, averageActiveRarity: 0, baseYieldPerAction: 0 };
    if (duration === 1) {
      const averageActiveRarity = C.NODE_RARITY_CHANCES.reduce(
        (sum, probability, i) => sum + probability * Math.max(gemini ? 2 : 1, i + 1), 0,
      );
      return { activeFraction: p, averageActiveRarity, baseYieldPerAction: p * averageActiveRarity };
    }
    if (p === 1 || (leo && p * duration >= 1)) {
      // With Leo at/above capacity, long-run activity and rarity tend to 100%/6.
      return { activeFraction: 1, averageActiveRarity: 6, baseYieldPerAction: 6 };
    }
    const q = 1 - p;
    const logQ = Math.log1p(-p);
    const arrivalBeforeExpiry = w => -Math.expm1(w * logQ);
    const busyRemaining = w => leo ? w / (1 - p * duration)
      : arrivalBeforeExpiry(w) / (p * q ** (duration - 1));
    const memo = new Map();
    const rewardRemaining = (w, rarity) => {
      if (w <= 0) return 0;
      if (rarity === 6) return 6 * busyRemaining(w);
      const state = `${w}:${rarity}`;
      if (memo.has(state)) return memo.get(state);
      // Harvest at the old rarity on ticks before the next discovery.
      let reward = rarity * q * arrivalBeforeExpiry(w) / p;
      if (!leo) {
        reward += arrivalBeforeExpiry(w)
          * (rarity + 1 + rewardRemaining(duration - 1, rarity + 1));
      } else {
        let probability = p;
        for (let tick = 1; tick <= w; tick++) {
          reward += probability * (rarity + 1 + rewardRemaining(w - tick + duration, rarity + 1));
          probability *= q;
        }
      }
      memo.set(state, reward);
      return reward;
    };
    // Developer-confirmed odds. Gemini moves Common's 75% to Uncommon,
    // leaving the Rare through Mythic probabilities unchanged.
    let expectedReward = 0;
    for (let roll = 1; roll <= 6; roll++) {
      const rarity = gemini ? Math.max(2, roll) : roll;
      expectedReward += (rarity + rewardRemaining(duration - 1, rarity)) * C.NODE_RARITY_CHANCES[roll - 1];
    }
    const busyTicks = 1 + busyRemaining(duration - 1);
    const cycleTicks = q / p + busyTicks;
    const result = {
      activeFraction: busyTicks / cycleTicks,
      averageActiveRarity: expectedReward / busyTicks,
      baseYieldPerAction: expectedReward / cycleTicks,
    };
    if (nodeExpectationCache.size >= 32) nodeExpectationCache.clear();
    nodeExpectationCache.set(key, result);
    return result;
  }

  function nodeYieldRoiBreakdown(d, role) {
    const nodes = d.gatheringNodes;
    const selection = nodes?.[role];
    if (!selection) return null;
    const resource = nodes.resources[selection.resource];
    const rateMultiplier = nodes.rateMultiplier;
    const chance = Math.min(1, Math.max(0, rateMultiplier / 2400));
    const duration = 100 + 10 * nodes.durationRanks;
    const expectation = nodeYieldExpectation(chance, duration, nodes.leo, nodes.gemini);
    const levelMultiplier = 1 + selection.skillLevel * 0.001;
    const nodeYieldBonusPercent = nodes.yieldRanks * 10;
    const aquariusBonusPercent = nodes.aquarius ? nodes.starCount : 0;
    // Both perks add to the same base-yield bonus. Multiplying them separately
    // overstates harvests (checked against Hohmono's observed Rare-node ticks).
    const constellationYieldMultiplier = 1 + (nodeYieldBonusPercent + aquariusBonusPercent) / 100;
    const doubleChance = Math.min(1, nodes.doubleRanks * 0.1);
    const baseDailyYield = expectation?.baseYieldPerAction * C.GATHER_ACTIONS_PER_DAY
      * levelMultiplier * constellationYieldMultiplier * (1 + doubleChance);
    const currentDailyYield = baseDailyYield * (1 + resource.yieldPercent / 100);
    const upgradeSize = C.NODE_YIELD_UPGRADE_SIZE;
    const extraDailyYield = baseDailyYield * upgradeSize / 100;
    const upgradeResources = 1000 * farmUpgradeResources(resource.level, upgradeSize);
    const upgradeCost = upgradeResources * resource.costPrice;
    // T2 resources are untaxed; the Resource / MD tax does not apply.
    const extraValuePerDay = extraDailyYield * resource.price;
    const roi = extraValuePerDay > 0 && upgradeCost > 0
      ? safeDiv(upgradeCost, extraValuePerDay) : null;
    return {
      ...resource, ...selection, upgradeSize, currentLevel: resource.level,
      nextLevel: resource.level + upgradeSize, rateMultiplier, chance, duration,
      ...expectation, levelMultiplier, nodeYieldBonusPercent, aquariusBonusPercent, constellationYieldMultiplier,
      doubleChance, leo: nodes.leo, gemini: nodes.gemini,
      starCount: nodes.starCount, starCountEstimated: nodes.aquarius && nodes.starCountEstimated,
      actionsPerDay: C.GATHER_ACTIONS_PER_DAY, currentDailyYield,
      nextDailyYield: currentDailyYield + extraDailyYield, extraDailyYield,
      upgradeResources, upgradeCost, extraValuePerDay, roi,
    };
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
    const battlerNodes = nodeYieldRoiBreakdown(d, 'battler');
    const tserNodes = nodeYieldRoiBreakdown(d, 'tser');

    const result = {
      sunpetalPotion: sunpetalPotionAnalysis(d),
      battler: {
        ...battlerTotals,
        netHerbs: battlerNetHerbs,
        maxSustainablePotion: battlerMaxSustainablePotion,
        potionAnalysis: battlerPotionAnalysis(d, battlerMaxSustainablePotion),
        nodeYieldAnalysis: battlerNodes,
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
        guildPotionAnalysis: tserGuildPotionAnalysis(d),
        nodeYieldAnalysis: tserNodes,
      },
      roi: {
        battler: {
          lab: labROI(d, 'battler'),
          dustCollector: dustCollectorROI(d),
          farmNoHedge: battlerFarmROI(d),
          farmHedge: battlerFarmHedgeROI(d),
          tomeDrop: tomeDropROI(d),
          workshopDustCollector: workshopDustCollectorROI(d),
          nodeYield: battlerNodes?.roi ?? null,
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
          nodeYield: tserNodes?.roi ?? null,
        },
      },
    };
    return result;
  }

  function normalizeFromApis(playerData, marketData, guilds, userInputs, unlockedStars = null) {
    const totalBoosts = playerData?.TotalBoosts || {};
    const baseBoosts = playerData?.BaseBoosts || {};
    const constellation = playerData?.Constellation || {};
    const equipment = playerData?.Equipment || {};
    const equipmentItems = Object.values(equipment).filter(
      item => item && item.IsEquipped !== false && item.isEquipped !== false,
    );
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
    const effectiveInfusions = (item) => {
      // API Infusions excludes the extra infusion granted by Imbued (prefix 10).
      const isImbued = finite(item?.Prefix ?? item?.prefix, NaN) === 10
        || /^Imbued(?:\s|$)/i.test(String(item?.Name ?? item?.name ?? '').trim())
        || /^Imbued$/i.test(String(prefixName(item)).trim());
      return finite(item?.Infusions) + (isImbued ? 1 : 0);
    };

    const mining = finite(playerData?.MiningLevel);
    const fishing = finite(playerData?.FishingLevel);
    const woodcutting = finite(playerData?.WoodcuttingLevel);
    const gatheringId = mining >= fishing && mining >= woodcutting ? '30'
      : fishing >= mining && fishing >= woodcutting ? '31' : '32';
    const gatheringElementId = { 30: '1', 31: '2', 32: '3' }[gatheringId];
    const hasGatheringStarBonus = getNum(constellation, gatheringElementId) > 0;
    const assignedStars = Object.values(constellation).reduce(
      (sum, ranks) => sum + Math.max(0, Math.trunc(finite(ranks))), 0,
    );
    const profileStars = playerData?.StarsUnlocked;
    const exactStars = Number.isSafeInteger(profileStars) && profileStars >= assignedStars
      ? profileStars : unlockedStars;
    const hasUnlockedStarCount = Number.isSafeInteger(exactStars) && exactStars >= assignedStars;
    const resourceStarCount = hasUnlockedStarCount ? exactStars : assignedStars;
    const starResourceBonusPercent = hasGatheringStarBonus ? resourceStarCount / 10 : 0;
    const spireBase = finite(baseBoosts['152']);
    const pinnacleResearchItemCount = equipmentItems.filter(
      item => finite(item.Boosts?.[gatheringId]) > 0,
    ).length;
    // Live API totals use the full Spire factor (including its base 1x), per matching item.
    // Pinnacle multiplies the research bonus, leaving TotalBoosts' baseline 1 untouched.
    const pinnacleResearchMultiplier = getNum(constellation, '49') > 0
      ? 1 + pinnacleResearchItemCount * 0.0005 * (1 + spireBase / 100)
      : 1;
    const pinnacleResearchPerSpireLevel = getNum(constellation, '49') > 0
      ? pinnacleResearchItemCount * 0.000005
      : 0;

    let equipmentResearch = 0;
    let equipmentBaseRes = 0;
    for (const item of equipmentItems) {
      if (!item || !item.Boosts) continue;
      const infusionMultiplier = 1 + effectiveInfusions(item) / 20;
      if (item.Boosts[gatheringId] != null) {
        // Match the per-item rounding used by the API and Nexus inference.
        equipmentResearch += Math.floor(finite(item.Boosts[gatheringId]) * infusionMultiplier) / 50;
      }
      if (item.Boosts['124'] != null) {
        equipmentBaseRes += (finite(item.Boosts['124']) / 100) * infusionMultiplier;
      }
    }

    let nexusLevel = null;
    try {
      const totalResearchBoost = finite(totalBoosts[gatheringId], NaN);
      const baseResearchBoost = finite(baseBoosts[gatheringId], NaN);
      const equipmentTerm = equipmentItems.reduce((acc, item) => {
        const b = item?.Boosts?.[gatheringId];
        if (b == null) return acc;
        return acc + Math.floor(finite(b) * (1 + effectiveInfusions(item) / 20)) * (1 + spireBase / 100);
      }, 0);
      const researchWithoutPinnacle = (totalResearchBoost - 1) / pinnacleResearchMultiplier;
      const x = ((researchWithoutPinnacle * 100 / 0.02 - equipmentTerm) / baseResearchBoost - 1) * 100;
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
    const averageMarketPrice = (id, fallback = 0) => {
      const quotes = [buy[String(id)], sell[String(id)]].map(Number)
        .filter(value => Number.isFinite(value) && value > 0);
      return quotes.length ? quotes.reduce((sum, value) => sum + value, 0) / quotes.length : fallback;
    };
    const averageRes = (averageMarketPrice(8) + averageMarketPrice(7) + averageMarketPrice(9)) / 3;
    const gatheringSkills = [
      { skill: 'Mining', skillLevel: getNum(playerData, 'MiningLevel', NaN), resource: 'quartz' },
      { skill: 'Fishing', skillLevel: getNum(playerData, 'FishingLevel', NaN), resource: 'inkSac' },
      { skill: 'Woodcutting', skillLevel: getNum(playerData, 'WoodcuttingLevel', NaN), resource: 'resin' },
    ];
    const highestSkill = gatheringSkills.reduce((best, skill) => (
      Number.isFinite(skill.skillLevel) && (!best || skill.skillLevel > best.skillLevel) ? skill : best
    ), null);
    const masteries = [
      { element: 'fire', mastery: getNum(baseBoosts, '10'), ...gatheringSkills[0], resource: 'resin' },
      { element: 'water', mastery: getNum(baseBoosts, '11'), ...gatheringSkills[1], resource: 'quartz' },
      { element: 'nature', mastery: getNum(baseBoosts, '12'), ...gatheringSkills[2], resource: 'inkSac' },
    ];
    // Battler yield uses the element's skill, independently of the dropped
    // resource: Fire/Mining, Water/Fishing, Nature/Woodcutting. The resource
    // still selects its own yield investment, funding item and market price.
    // Equipped magic breaks mastery ties.
    const maxMastery = Math.max(...masteries.map(item => item.mastery));
    const candidates = masteries.filter(item => item.mastery === maxMastery);
    const battleSelection = candidates.find(item => item.element === playerData?.MagicType)
      ?? (maxMastery > 0 ? candidates[0] : null);
    const makeNodeResource = (name, boostId, itemId, costResource, costId) => ({
      name, level: Math.max(0, Math.trunc(getNum(baseBoosts, boostId))),
      yieldPercent: getNum(totalBoosts, boostId, getNum(baseBoosts, boostId)),
      price: averageMarketPrice(itemId, NaN), costResource,
      costPrice: averageMarketPrice(costId, NaN),
    });
    const gatheringNodes = {
      // The API stores a factor: 2.53 means +153%, not +2.53%.
      rateMultiplier: getNum(totalBoosts, '39', NaN),
      durationRanks: Math.max(0, Math.min(10, Math.trunc(getNum(constellation, '30')))),
      yieldRanks: Math.max(0, Math.min(10, Math.trunc(getNum(constellation, '32')))),
      doubleRanks: Math.max(0, Math.min(10, Math.trunc(getNum(constellation, '31')))),
      aquarius: getNum(constellation, '44') > 0,
      leo: getNum(constellation, '38') > 0,
      gemini: getNum(constellation, '36') > 0,
      starCount: resourceStarCount, starCountEstimated: !hasUnlockedStarCount,
      battler: battleSelection,
      tser: highestSkill,
      resources: {
        quartz: makeNodeResource('Quartz', '36', 69, 'Iron', 9),
        inkSac: makeNodeResource('Ink', '37', 70, 'Fish', 7),
        resin: makeNodeResource('Resin', '38', 71, 'Wood', 8),
      },
    };
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
      guidancePotion: Math.max(0, Math.min(C.MAX_SUNPETAL_POTION, Math.trunc(finite(userInputs.guidancePotion)))),
      potDuration: getNum(totalBoosts, '110'),
      bloomwellPrice: averageMarketPrice(41),
      sagerootPrice: averageMarketPrice(40),
      sunpetalPrice: averageMarketPrice(39, NaN),
      bloomwellConstellationLevel: Math.max(0, Math.trunc(getNum(constellation, '10'))),
      sagerootConstellationLevel: Math.max(0, Math.trunc(getNum(constellation, '9'))),
      golems: getNum(totalBoosts, '130'),
      fertilizer: getNum(totalBoosts, '131'),
      plots: getNum(totalBoosts, '132'),
      level: Math.max(mining, fishing, woodcutting),
      battleLevel: getNum(playerData, 'Level', NaN),
      miningLevel: getNum(playerData, 'MiningLevel', NaN),
      fishingLevel: getNum(playerData, 'FishingLevel', NaN),
      woodcuttingLevel: getNum(playerData, 'WoodcuttingLevel', NaN),
      equipmentShardBonus: getNum(totalBoosts, '122'),
      shardConstellationLevel: Math.max(0, Math.trunc(getNum(constellation, '14'))),
      shardMarketPrice: averageMarketPrice(2, NaN),
      potionBoost: getNum(totalBoosts, '108'),
      potionBoostLevel: getNum(baseBoosts, '108', getNum(totalBoosts, '108')),
      baseRes: getNum(totalBoosts, '124') / 100,
      baseResResearch: getNum(totalBoosts, '106'),
      research,
      unlockedStars: hasUnlockedStarCount ? exactStars : null,
      resourceStarCount,
      starResourceBonusPercent,
      starResourceBonusEstimated: hasGatheringStarBonus && !hasUnlockedStarCount,
      averageResourcePrice: averageRes,
      gatheringNodes,
      farmDiscount: getNum(baseBoosts, '134'),
      spire: getNum(totalBoosts, '152'),
      equipmentBaseRes,
      equipmentResearch,
      pinnacleResearchMultiplier,
      pinnacleResearchPerSpireLevel,
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
      shardPrice: averageMarketPrice(2),
      nexusLevel,
      natureTomePrice: averageMarketPrice(15),
      waterTomePrice: averageMarketPrice(14),
      fireTomePrice: averageMarketPrice(13),
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
      constructionCodex,
      ambidextrousLevel: Math.max(0, Math.trunc(getNum(constellation, '6'))),
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
      ambitiousResourceMultiplier, battlerAtPotion, tserAtPotion, optimizeTserPotion, tserGuildPotionAnalysis,
      maxSustainableBattlerPotion, maxSustainableTserPotion,
      sunpetalPotionAnalysis,
      farmUpgradeResources, balancedFarmLevels, farmForDailyHerbs, battlerPotionAnalysis, resonanceUpgradeValue,
      tomeTotalCost, tomeDropRoiBreakdown, farmUpgradeStats, labRoiBreakdown, mdIncomeBreakdown,
      dustCollectorRoiBreakdown, workshopDustCollectorRoiBreakdown,
      farmNoHedgeRoiBreakdown, farmHedgeRoiBreakdown,
      nodeYieldExpectation, nodeYieldRoiBreakdown,
    },
  };
});
