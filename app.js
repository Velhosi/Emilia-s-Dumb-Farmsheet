'use strict';

const Calc = window.ManarionCalculator;
const INPUT_STORAGE_KEY = 'emilia-farm-sheet-inputs-v1';
const SHOW_GUILD_POTION = false; // Set to true to restore the TSer guild potion card.
let hasRenderedResults = false;
const infoPanels = new Map();

const $ = (id) => document.getElementById(id);
const elements = Object.freeze({
  form: $('settings-form'),
  status: $('status'),
  role: $('role'),
  overview: $('overview'),
  results: $('results'),
  resultGrid: $('result-grid'),
  resultsTitle: $('results-title'),
  sigilWarning: $('sigil-warning'),
  battlerPanels: [...document.querySelectorAll('.battler-result-panel')],
  tserPanels: [...document.querySelectorAll('.tser-result-panel')],
  guildPotionPanel: $('tser-guild-potion-panel'),
  battlerSummaries: [...document.querySelectorAll('.battler-only')],
  tserSummaries: [...document.querySelectorAll('.tser-only')],
  updateButton: $('update-btn'),
  updateButtonLabel: $('update-btn').querySelector('.btn-label'),
});

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCompact(value, digits = 2) {
  if (!Number.isFinite(value)) return 'N/A';

  const tiers = [
    [1e33, 'Dc'],
    [1e30, 'No'],
    [1e27, 'Oc'],
    [1e24, 'Sp'],
    [1e21, 'Sx'],
    [1e18, 'Qi'],
    [1e15, 'Q'],
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  const tier = tiers.find(([divisor]) => Math.abs(value) >= divisor);
  if (!tier) return Math.round(value).toLocaleString();

  const [divisor, suffix] = tier;
  const formatted = (value / divisor).toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
  return `${formatted}${suffix}`;
}

function formatSignedCompact(value) {
  if (!Number.isFinite(value)) return 'N/A';
  if (value === 0) return '0';
  return `${value > 0 ? '+' : '−'}${formatCompact(Math.abs(value))}`;
}

function formatDebit(value) {
  if (!Number.isFinite(value)) return 'N/A';
  if (value === 0) return '0';
  return `−${formatCompact(Math.abs(value))}`;
}

function formatFull(value) {
  return Number.isFinite(value)
    ? value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })
    : 'N/A';
}

function infoTone(value) {
  if (!Number.isFinite(value) || value === 0) return '';
  return value > 0 ? 'positive' : 'negative';
}

const formatters = Object.freeze({
  compact: formatCompact,
  days: (value) => Number.isFinite(value)
    ? (value > 0 && value < 0.005 ? '<0.01'
      : value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 }))
    : 'N/A',
  integer: (value) => Number.isFinite(value) ? Math.round(value).toLocaleString() : 'N/A',
  percent: (value, options = {}) => Number.isFinite(value)
    ? `${value.toLocaleString(undefined, { maximumFractionDigits: 3, ...options })}%`
    : 'N/A',
});

function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = value;
}

function setMetric(id, value, formatter, signAware = false) {
  const element = $(id);
  if (!element) return;

  element.textContent = formatter(value);
  element.classList.remove('positive', 'negative');
  if (signAware && Number.isFinite(value)) {
    element.classList.add(value >= 0 ? 'positive' : 'negative');
  }
}

function setRoi(prefix, values) {
  const finiteValues = Object.values(values).filter(Number.isFinite);
  const best = finiteValues.length ? Math.min(...finiteValues) : null;

  for (const [key, value] of Object.entries(values)) {
    const element = $(`${prefix}-${key}`);
    if (!element) continue;

    element.textContent = formatters.days(value);
    element.closest('.roi-row')?.classList.toggle(
      'best',
      Number.isFinite(value) && value === best,
    );
  }
}

function setStatus(message, state) {
  elements.status.textContent = message;
  elements.status.dataset.state = state;
}

function createInfoElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

function setInfoPanel(key, { title, description, rows, note }) {
  const entry = infoPanels.get(key);
  if (!entry) return;

  const content = document.createDocumentFragment();
  content.append(createInfoElement('span', 'info-title', title));
  if (description) content.append(createInfoElement('span', 'info-copy', description));

  const rowGroup = createInfoElement('span', 'info-rows');
  rows.forEach((row) => {
    if (row.section) {
      rowGroup.append(createInfoElement('span', 'info-section-label', row.section));
      return;
    }
    const rowElement = createInfoElement(
      'span',
      `info-row${row.total ? ' info-row-total' : ''}${row.tone ? ` info-row-${row.tone}` : ''}`,
    );
    rowElement.append(createInfoElement('span', 'info-row-label', row.label));
    rowElement.append(createInfoElement('strong', 'info-row-value', row.value));
    rowGroup.append(rowElement);
  });
  content.append(rowGroup);

  if (note) content.append(createInfoElement('span', 'info-note', note));
  entry.panel.replaceChildren(content);
}

function closeInfoPanels(exceptKey = null) {
  for (const [key, entry] of infoPanels) {
    if (key === exceptKey) continue;
    entry.wrapper.dataset.open = 'false';
    entry.button.setAttribute('aria-expanded', 'false');
  }
}

function placeInfoPanel(entry) {
  if (window.matchMedia('(max-width: 540px)').matches) {
    entry.wrapper.dataset.placement = 'center';
    entry.wrapper.dataset.horizontal = 'start';
    entry.panel.style.maxHeight = '';
    return;
  }

  entry.wrapper.dataset.placement = 'bottom';
  entry.wrapper.dataset.horizontal = 'start';
  entry.panel.style.maxHeight = '';

  const buttonRect = entry.button.getBoundingClientRect();
  const panelHeight = entry.panel.scrollHeight;
  const panelWidth = entry.panel.offsetWidth;
  const gap = 12;
  const roomBelow = window.innerHeight - buttonRect.bottom - gap;
  const roomAbove = buttonRect.top - gap;
  const openUpward = panelHeight > roomBelow && roomAbove > roomBelow;
  const availableHeight = openUpward ? roomAbove : roomBelow;

  entry.wrapper.dataset.placement = openUpward ? 'top' : 'bottom';
  entry.wrapper.dataset.horizontal = buttonRect.left - 8 + panelWidth > window.innerWidth - gap
    ? 'end'
    : 'start';
  entry.panel.style.maxHeight = `${Math.max(80, Math.floor(availableHeight))}px`;
}

function setupInfoPanels() {
  document.querySelectorAll('.info-button[data-info]').forEach((button) => {
    const key = button.dataset.info;
    const wrapper = button.closest('.info-popover');
    const panel = createInfoElement('span', 'info-panel');
    panel.id = `info-${key}`;
    panel.setAttribute('role', 'tooltip');
    panel.textContent = 'Calculation details appear after the player is updated.';
    wrapper.append(panel);
    wrapper.dataset.open = 'false';
    button.setAttribute('aria-controls', panel.id);
    button.setAttribute('aria-describedby', panel.id);
    button.setAttribute('aria-expanded', 'false');
    const entry = { button, panel, wrapper };
    infoPanels.set(key, entry);

    wrapper.addEventListener('mouseenter', () => placeInfoPanel(entry));
    wrapper.addEventListener('focusin', () => placeInfoPanel(entry));

    button.addEventListener('click', (event) => {
      event.stopPropagation();
      placeInfoPanel(entry);
      const shouldOpen = wrapper.dataset.open !== 'true';
      closeInfoPanels(shouldOpen ? key : null);
      wrapper.dataset.open = String(shouldOpen);
      button.setAttribute('aria-expanded', String(shouldOpen));
    });
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.info-popover')) closeInfoPanels();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeInfoPanels();
      document.activeElement?.closest?.('.info-popover')?.querySelector('.info-button')?.focus();
    }
  });
  window.addEventListener('resize', () => {
    for (const entry of infoPanels.values()) placeInfoPanel(entry);
  });
}

function netHerbsInfo(role, result) {
  const totals = result[role];
  const potionName = role === 'battler' ? 'Wisdom' : 'Harvest';
  return {
    title: 'Net herbs',
    description: `Combined herbs remaining after daily ${potionName} and Resonance potion use. Assumes Bloomwells and Sageroots can be traded 1:1.`,
    rows: [
      { label: 'Leftover Bloomwells', value: formatSignedCompact(totals.leftoverBloom) },
      { label: 'Leftover Sageroots', value: formatSignedCompact(totals.leftoverSage) },
      { label: 'Net herbs', value: formatSignedCompact(totals.netHerbs), tone: infoTone(totals.netHerbs), total: true },
    ],
  };
}

function sustainablePotionInfo(role, data, result) {
  const totals = result[role];
  const potionName = role === 'battler' ? 'Wisdom' : 'Harvest';
  const maxPotion = totals.maxSustainablePotion;
  const atMax = role === 'tser'
    ? Calc.helpers.tserAtPotion(data, maxPotion)
    : Calc.helpers.battlerAtPotion(data, maxPotion);
  const nextPotion = maxPotion + 1;
  const atCeiling = role === 'battler' && maxPotion >= Calc.C.MAX_WISDOM_POTION;
  const atNext = atCeiling ? null : role === 'tser'
    ? Calc.helpers.tserAtPotion(data, nextPotion)
    : Calc.helpers.battlerAtPotion(data, nextPotion);
  const resonanceConsumption = atMax.resHr * Calc.C.BATTLE_HOURS_PER_DAY;
  const availableForHarvest = atMax.herbDaily - resonanceConsumption;
  const harvestConsumption = atMax.harvestHr * Calc.C.BATTLE_HOURS_PER_DAY;
  const remaining = atMax.leftoverBloom + atMax.leftoverSage;
  const nextRemaining = atNext ? atNext.leftoverBloom + atNext.leftoverSage : null;
  const rows = [
    { label: 'Daily herbs produced', value: formatCompact(atMax.herbDaily) },
    { label: 'Resonance potion consumption', value: formatDebit(resonanceConsumption) },
    { label: `Available for ${potionName} potion`, value: formatCompact(availableForHarvest), total: true },
    { label: `${formatters.integer(maxPotion)} ${potionName} potion use`, value: formatDebit(harvestConsumption) },
    { label: 'Herbs remaining', value: formatSignedCompact(remaining), total: true },
  ];

  if (atCeiling) {
    rows.push({ label: 'Search ceiling reached', value: formatters.integer(maxPotion) });
  } else {
    rows.push({
      label: `Next tier: ${formatters.integer(nextPotion)}`,
      value: formatSignedCompact(nextRemaining),
    });
  }

  return {
    title: 'Maximum sustainable potion',
    description: 'The highest whole-level potion that keeps combined herbs at or above zero. Bloomwells and Sageroots are treated as tradable 1:1.',
    rows,
    note: 'Uses the entered Resonance potion and the player’s total Potion Duration, including Laboratory.',
  };
}

function sunpetalPotionInfo(analysis) {
  if (!analysis) return {
    title: 'Maximum sustainable Potion of Guidance',
    description: 'A sustainable tier is unavailable for these farm or Potion Duration values.',
    rows: [],
  };
  return {
    title: 'Maximum sustainable Potion of Guidance',
    description: 'Estimated sustainable Potion of Guidance tier, using the developer’s approximate Sunpetal production formula.',
    rows: [
      { label: 'Base farm herbs / hour', value: formatCompact(analysis.farmHerbsPerHour) },
      { label: 'Sunpetals / hour (estimated)', value: formatFull(analysis.sunpetalsPerHour) },
      { label: 'Sunpetals / day (estimated)', value: formatFull(analysis.sunpetalsPerDay) },
      { label: 'Potion duration', value: `${formatFull(analysis.durationHours)} hours` },
      { label: 'Potion use / day', value: `${formatFull(Calc.C.BATTLE_HOURS_PER_DAY)} hours` },
      { label: 'Sunpetals consumed / day', value: formatFull(analysis.sunpetalsConsumedPerDay) },
      ...(analysis.nextTierConsumptionPerDay == null ? [] : [
        { label: `Next tier: ${formatters.integer(analysis.maximumSustainablePotion + 1)} / day`, value: formatFull(analysis.nextTierConsumptionPerDay) },
      ]),
      { label: 'Maximum sustainable tier (estimated)', value: formatters.integer(analysis.maximumSustainablePotion), total: true },
    ],
    note: 'Estimated production = 0.05 × √(base hourly farm herbs), produced for 24 hours per day. Bloomwell and Sageroot nodes affect those herbs only. Potion cost = L(L + 1)/2 + 0.0002L³ Sunpetals. Uses your total Potion Duration and the same 27,400-action day as other potions. Assumes all Sunpetals go toward this potion, with none reserved for Renewal or dungeon skips.',
  };
}

function guildPotionInfo(data, analysis) {
  return {
    title: 'Most efficient guild potion',
    description: 'Maximizes the total daily value earned by you and your guild before resource tax, while accounting for potion herbs, farm tax, and Hedge Fund coverage.',
    rows: [
      { label: 'Recommended Harvest potion', value: formatters.integer(analysis.bestPotion) },
      { label: 'Gross resource value / day', value: formatCompact(analysis.grossResourceValue) },
      { label: `Gross resource value with your current ${formatters.integer(data.harvestPotion)} potion / day`, value: formatCompact(analysis.currentGrossResourceValue) },
      { label: 'Change from current potion / day', value: formatSignedCompact(analysis.grossResourceChange), tone: infoTone(analysis.grossResourceChange), total: true },
    ],
    note: 'Values are in MD and include baseline resources. The daily change compares gross resource value before tax and herb costs. The recommended tier still accounts for herb costs and searches Harvest tiers from 0 to 1,000,000 in 1,000-level steps using the entered Resonance potion.',
  };
}

function leftoverHerbInfo(role, herb, result) {
  const totals = result[role];
  const isBloom = herb === 'bloom';
  const harvestUsesThisHerb = (role === 'battler' && !isBloom) || (role === 'tser' && isBloom);
  const herbName = isBloom ? 'Bloomwells' : 'Sageroots';
  const resonanceName = isBloom ? 'Bloomwell' : 'Sageroot';
  const produced = isBloom ? totals.bloomDaily : totals.sageDaily;
  const resonanceConsumption = totals.resHr * Calc.C.BATTLE_HOURS_PER_DAY / 2;
  const harvestConsumption = totals.harvestHr * Calc.C.BATTLE_HOURS_PER_DAY;
  const leftover = isBloom ? totals.leftoverBloom : totals.leftoverSage;
  const potionName = role === 'battler' ? 'Wisdom' : 'Harvest';
  const bonusPercent = isBloom ? totals.bloomBonusPercent : totals.sageBonusPercent;
  const rows = [
    { label: `Base daily ${herbName}`, value: formatCompact(totals.baseHerbDaily / 2) },
    { label: 'Atlas harvest bonus', value: `+${formatters.percent(bonusPercent)}` },
    { label: `Daily ${herbName} produced`, value: formatCompact(produced) },
  ];

  if (harvestUsesThisHerb) {
    rows.push({ label: `${potionName} potion consumption`, value: formatDebit(harvestConsumption) });
  }
  rows.push({ label: `Resonance ${resonanceName} consumption`, value: formatDebit(resonanceConsumption) });
  rows.push({ label: `Leftover ${herbName}`, value: formatSignedCompact(leftover), tone: infoTone(leftover), total: true });

  let note;
  if (role === 'battler') {
    note = isBloom
      ? 'Battlers use Sageroots for their Wisdom potion, so only the Bloomwell half of the Resonance potion is deducted here.'
      : 'Battlers use Sageroots for their Wisdom potion. The Resonance potion is split evenly between both herbs.';
  } else {
    note = isBloom
      ? 'TSers use Bloomwells for their Harvest potion. The Resonance potion is split evenly between both herbs.'
      : 'TSers use Bloomwells for their Harvest potion, so only the Sageroot half of the Resonance potion is deducted here.';
  }

  return { title: `Leftover ${herbName}`, rows, note };
}

function leftoverValueInfo(role, data, result) {
  const totals = result[role];
  const bloomValue = totals.leftoverBloom * data.bloomwellPrice;
  const sageValue = totals.leftoverSage * data.sagerootPrice;
  return {
    title: 'Leftover herb value',
    description: 'Each leftover herb balance is valued at the midpoint of current Manarion buy and sell orders.',
    rows: [
      {
        label: `Bloomwells: ${formatSignedCompact(totals.leftoverBloom)} × ${formatFull(data.bloomwellPrice)}`,
        value: formatSignedCompact(bloomValue),
      },
      {
        label: `Sageroots: ${formatSignedCompact(totals.leftoverSage)} × ${formatFull(data.sagerootPrice)}`,
        value: formatSignedCompact(sageValue),
      },
      {
        label: `Sunpetals: ${formatSignedCompact(totals.leftoverSunpetals)} × ${formatFull(data.sunpetalPrice)}`,
        value: formatSignedCompact(totals.leftoverSunpetals * data.sunpetalPrice),
      },
      { label: 'Leftover herb value', value: formatSignedCompact(totals.leftoverSold), tone: infoTone(totals.leftoverSold), total: true },
    ],
    note: Number.isFinite(data.sunpetalPrice) ? '' : 'No Sunpetal quote is available, so Sunpetals are excluded from the value total.',
  };
}

function leftoverSunpetalsInfo(role, data, result) {
  const totals = result[role];
  return {
    title: 'Leftover Sunpetals',
    rows: [
      { label: 'Sunpetals produced / day', value: formatFull(totals.sunpetalsPerDay) },
      { label: 'Entered Potion of Guidance', value: formatters.integer(data.guidancePotion) },
      { label: 'Guidance consumption / day', value: formatDebit(totals.guidanceConsumedPerDay) },
      { label: 'Leftover Sunpetals / day', value: formatSignedCompact(totals.leftoverSunpetals), total: true },
    ],
    note: 'Production uses the developer’s estimate of 5% of the square root of base hourly farm output. Guidance uses 27,400 daily actions and your Potion Duration. Renewal and dungeon spending are not included.',
  };
}

function nodeYieldRoiInfo(analysis) {
  if (!analysis) return { title: 'T2 resource ROI', description: 'Player mastery or gathering levels are unavailable.', rows: [] };
  const a = analysis;
  return {
    title: `${a.name} ROI — 500 yield upgrades`,
    description: 'Payback for 500 yield upgrades, using expected daily T2 resources and buy/sell midpoint prices.',
    rows: [
      { section: 'Player and node bonuses' },
      { label: 'Resource selection', value: a.element ? `${a.element[0].toUpperCase()}${a.element.slice(1)} mastery` : `Highest skill: ${a.skill}` },
      { label: `${a.skill} level`, value: formatters.integer(a.skillLevel) },
      { label: 'Level yield multiplier', value: `${formatFull(a.levelMultiplier)}×` },
      { label: 'Gathering rate (all bonuses included)', value: `+${formatters.percent((a.rateMultiplier - 1) * 100)}` },
      { label: 'Effective node chance / action', value: formatters.percent(a.chance * 100, { minimumFractionDigits: 5, maximumFractionDigits: 5 }) },
      { label: 'Ticks per discovery', value: formatters.integer(a.duration) },
      { label: 'Node Yield bonus', value: `+${formatters.percent(a.nodeYieldBonusPercent)}` },
      { label: `Aquarius bonus (${formatters.integer(a.starCount)} stars)`, value: `+${formatters.percent(a.aquariusBonusPercent)}` },
      { label: 'Combined constellation yield', value: `${formatFull(a.constellationYieldMultiplier)}×` },
      { label: 'Double harvest chance', value: formatters.percent(a.doubleChance * 100) },
      { label: 'Leo / Gemini', value: `${a.leo ? 'Active' : 'Inactive'} / ${a.gemini ? 'Active' : 'Inactive'}` },
      { label: 'Common → Mythic starting odds (%)', value: a.gemini ? '0 / 90 / 6 / 3 / 0.8 / 0.2' : '75 / 15 / 6 / 3 / 0.8 / 0.2' },
      { section: '500-upgrade cost' },
      { label: 'Purchased yield level', value: `${formatters.integer(a.currentLevel)} → ${formatters.integer(a.nextLevel)}` },
      { label: `${a.costResource} required`, value: formatCompact(a.upgradeResources) },
      { label: `${a.costResource} buy/sell midpoint`, value: `${formatFull(a.costPrice)} MD` },
      { label: 'Total upgrade cost', value: `${formatCompact(a.upgradeCost)} MD` },
      { section: 'Expected daily benefit' },
      { label: 'Actions / day', value: formatters.integer(a.actionsPerDay) },
      { label: 'Time harvesting a node', value: formatters.percent(a.activeFraction * 100) },
      { label: 'Average active rarity (1–6)', value: formatFull(a.averageActiveRarity) },
      { label: `Current ${a.name} / day`, value: formatFull(a.currentDailyYield) },
      { label: `${a.name} / day after upgrading`, value: formatFull(a.nextDailyYield) },
      { label: `Extra ${a.name} / day`, value: formatFull(a.extraDailyYield) },
      { label: `${a.name} buy/sell midpoint`, value: `${formatFull(a.price)} MD` },
      { label: 'Extra value / day (untaxed)', value: `${formatCompact(a.extraValuePerDay)} MD` },
      { label: 'ROI', value: Number.isFinite(a.roi) ? `${formatters.days(a.roi)} days` : 'N/A', total: true },
    ],
    note: a.starCountEstimated
      ? 'Aquarius uses assigned stars as a fallback; unassigned stars could increase the yield.' : '',
  };
}

function farmTaxInfo(role, data, result) {
  const totals = result[role];
  const productionTax = totals.baseHerbDaily * Calc.C.FARM_DUST_PER_HERB;
  const hedgeDiscount = data.farmDiscount * 1_000_000_000 * 24;
  return {
    title: 'Farm tax taken',
    description: 'Farm upkeep is 50,000 MD per base herb, before Atlas harvest bonuses. Hedge Fund’s permanent Farm Discount offsets that charge.',
    rows: [
      { label: 'Leftover herb value', value: formatSignedCompact(totals.leftoverSold) },
      { label: 'Herb production tax', value: formatDebit(productionTax) },
      { label: 'Hedge Fund Farm Discount', value: formatSignedCompact(hedgeDiscount) },
      { label: 'Farm tax taken', value: formatSignedCompact(totals.farmTax), tone: infoTone(totals.farmTax), total: true },
    ],
  };
}

function mdIncomeInfo(data) {
  const breakdown = Calc.helpers.mdIncomeBreakdown(data);
  return {
    title: 'MD earned daily',
    description: 'The 150 starter enemies are included in both the base reward and the extra scaling above enemy level 150,000. Boosts are applied before tax.',
    rows: [
      { label: 'Base MD per battle from current enemy', value: formatCompact(breakdown.basePerBattle) },
      { label: 'After Dust Collector boost', value: formatCompact(breakdown.afterDustCollector) },
      { label: 'After Base Mana Dust and equipment boosts', value: formatCompact(breakdown.afterBaseAndEquipment) },
      { label: 'After Resource / MD tax', value: formatCompact(breakdown.afterTax) },
      { label: 'Daily battle actions', value: `× ${formatters.integer(breakdown.dailyActions)}` },
      { label: 'MD earned daily', value: formatCompact(breakdown.dailyTotal), tone: infoTone(breakdown.dailyTotal), total: true },
    ],
  };
}

function labRoiInfo(role, data) {
  const breakdown = Calc.helpers.labRoiBreakdown(data, role);
  const roleHerb = role === 'battler' ? 'Sageroot' : 'Bloomwell';
  const potionName = role === 'battler' ? 'Wisdom' : 'Harvest';
  const eventHours = formatters.days(breakdown.eventHours);
  return {
    title: 'Laboratory ROI',
    description: 'The next Laboratory level adds 1 Potion Duration. ROI compares its cost with the daily value of the herbs that extra duration saves.',
    rows: [
      { section: 'Laboratory cost' },
      { label: 'Total Laboratory cost', value: formatCompact(breakdown.nextLevelCost) },
      { section: `${potionName} potion — ${roleHerb}s` },
      { label: 'Current herb use / hour', value: formatFull(breakdown.harvestHerbsPerHour) },
      { label: 'Use / hour with +1 duration', value: formatFull(breakdown.nextHarvestHerbsPerHour) },
      { label: 'Herbs saved / hour', value: formatFull(breakdown.harvestHerbsSavedPerHour) },
      { label: `Daily herbs saved (${formatCompact(breakdown.harvestHerbsSavedPerHour)} × ${eventHours}h)`, value: formatCompact(breakdown.harvestHerbsSavedPerDay) },
      { label: `Daily value (${formatCompact(breakdown.harvestHerbsSavedPerDay)} × ${formatCompact(breakdown.harvestHerbPrice)})`, value: formatCompact(breakdown.harvestSavingsValuePerDay) },
      { section: 'Resonance potion — combined herbs' },
      { label: 'Current herb use / hour', value: formatFull(breakdown.resonanceHerbsPerHour) },
      { label: 'Use / hour with +1 duration', value: formatFull(breakdown.nextResonanceHerbsPerHour) },
      { label: 'Herbs saved / hour', value: formatFull(breakdown.resonanceHerbsSavedPerHour) },
      { label: `Daily herbs saved (${formatCompact(breakdown.resonanceHerbsSavedPerHour)} × ${eventHours}h)`, value: formatCompact(breakdown.resonanceHerbsSavedPerDay) },
      { label: `Daily value (${formatCompact(breakdown.resonanceHerbsSavedPerDay)} × ${formatCompact(breakdown.averageHerbPrice)})`, value: formatCompact(breakdown.resonanceSavingsValuePerDay) },
      { section: 'Potion of Guidance — Sunpetals' },
      { label: 'Entered potion tier', value: formatters.integer(breakdown.guidancePotion) },
      { label: 'Current Sunpetal use / hour', value: formatFull(breakdown.sunpetalsPerHour) },
      { label: 'Use / hour with +1 duration', value: formatFull(breakdown.nextSunpetalsPerHour) },
      { label: 'Sunpetals saved / day', value: formatFull(breakdown.sunpetalsSavedPerDay) },
      { label: 'Sunpetal buy/sell midpoint', value: `${formatFull(breakdown.sunpetalPrice)} MD` },
      { label: 'Guidance savings / day', value: formatCompact(breakdown.guidanceSavingsValuePerDay) },
      { section: 'Payback' },
      { label: 'Total savings / day', value: formatCompact(breakdown.totalSavingsValuePerDay), total: true },
      { label: 'Calculation', value: `${formatCompact(breakdown.nextLevelCost)} ÷ ${formatCompact(breakdown.totalSavingsValuePerDay)}` },
      { label: 'ROI', value: `${formatters.days(breakdown.roi)} days`, tone: infoTone(breakdown.roi), total: true },
    ],
    note: `All savings use buy/sell midpoint prices over the ${eventHours}-hour event day. Each entered potion tier stays fixed when comparing durations. Guidance is excluded when its input is blank or zero.`,
  };
}

function dustCollectorRoiInfo(data) {
  const breakdown = Calc.helpers.dustCollectorRoiBreakdown(data);
  return {
    title: 'Dust Collector ROI',
    description: 'The next Dust Collector level adds 0.2 percentage points to MD earned per battle.',
    rows: [
      { section: 'Upgrade' },
      { label: 'Next-level cost', value: formatCompact(breakdown.cost) },
      { section: 'Daily benefit' },
      { label: 'Current Dust Collector boost', value: formatters.percent(breakdown.currentBoostPercent) },
      { label: 'Boost after upgrading', value: formatters.percent(breakdown.nextBoostPercent) },
      { label: 'Current MD earned daily', value: formatCompact(breakdown.currentDailyMd) },
      { label: 'MD earned daily after upgrading', value: formatCompact(breakdown.upgradedDailyMd) },
      { label: 'Extra MD earned daily', value: formatCompact(breakdown.extraDailyMd) },
      { section: 'Payback' },
      { label: 'Calculation', value: `${formatCompact(breakdown.cost)} ÷ ${formatCompact(breakdown.extraDailyMd)}` },
      { label: 'Dust Collector ROI', value: `${formatters.days(breakdown.roi)} days`, tone: infoTone(breakdown.roi), total: true },
    ],
    note: 'Divides the next Dust Collector level’s building cost by its additional daily MD benefit to calculate ROI in days.',
  };
}

function farmNoHedgeRoiInfo(data) {
  const breakdown = Calc.helpers.farmNoHedgeRoiBreakdown(data);
  const upgradeLabel = breakdown.bestUpgrade
    ? `${breakdown.bestUpgrade} +${formatters.integer(breakdown.upgradeSize)}`
    : 'Best upgrade unavailable';
  return {
    title: 'Farm — no hedge ROI',
    description: 'Finds the lowest ROI among 1,000-level Golems, Fertilizer, and Plots upgrades. Hedge Fund’s discount is not included.',
    rows: [
      { section: `Best upgrade: ${upgradeLabel}` },
      { label: 'Upgrade cost', value: formatCompact(breakdown.cost) },
      { label: 'Additional herbs / day', value: formatCompact(breakdown.extraHerbsPerDay) },
      { label: 'Yield-weighted herb midpoint', value: `${formatCompact(breakdown.averageHerbPrice)} MD` },
      { label: 'Additional Sunpetal value / day', value: formatCompact(breakdown.extraSunpetalValue) },
      { label: 'Gross herb value / day', value: formatCompact(breakdown.grossHerbValuePerDay) },
      { label: 'Farm tax (extra base herbs × 50,000 MD)', value: formatDebit(breakdown.farmTaxPerDay) },
      { label: 'Daily benefit after tax', value: formatCompact(breakdown.netDailyBenefit) },
      { section: 'Payback' },
      { label: 'Calculation', value: `${formatCompact(breakdown.cost)} ÷ ${formatCompact(breakdown.netDailyBenefit)}` },
      { label: 'Farm — no hedge ROI', value: `${formatters.days(breakdown.roi)} days`, tone: infoTone(breakdown.roi), total: true },
    ],
    note: 'Divides the cost of the best-returning 1,000-level farm upgrade by its additional daily herb value after upkeep. Atlas bonuses increase each herb’s yield; upkeep charges 50,000 MD per base herb. Hedge Fund’s discount is not included.',
  };
}

function farmHedgeRoiInfo(data) {
  const breakdown = Calc.helpers.farmHedgeRoiBreakdown(data);
  const upgradeLabel = breakdown.bestUpgrade
    ? `${breakdown.bestUpgrade} +${formatters.integer(breakdown.upgradeSize)}`
    : 'Best upgrade unavailable';
  return {
    title: 'Farm + hedge ROI',
    description: 'Finds the lowest ROI after pairing each 1,000-level farm upgrade with enough permanent Hedge Fund increases to cover all of that upgrade’s added farm tax.',
    rows: [
      { section: `Best combination: ${upgradeLabel}` },
      { label: 'Farm upgrade cost', value: formatCompact(breakdown.farmUpgradeCost) },
      { label: 'Additional herbs / day', value: formatCompact(breakdown.extraHerbsPerDay) },
      { label: 'Yield-weighted herb midpoint', value: `${formatCompact(breakdown.averageHerbPrice)} MD` },
      { label: 'Additional Sunpetal value / day', value: formatCompact(breakdown.extraSunpetalValue) },
      { label: 'Full herb value / day', value: formatCompact(breakdown.grossHerbValuePerDay) },
      { section: 'Hedge Fund coverage' },
      { label: 'Added farm tax to cover / hour', value: formatCompact(breakdown.addedFarmTaxPerHour) },
      { label: 'Hedge Fund increases needed', value: formatters.integer(breakdown.hedgeLevelsNeeded) },
      { label: 'Permanent tax discount / hour', value: formatCompact(breakdown.hedgeDiscountPerHour) },
      { label: 'Hedge Fund cost', value: formatCompact(breakdown.hedgeCost) },
      { label: 'Standalone Hedge Fund rate', value: `${formatters.days(breakdown.hedgeStandaloneRoiDays)} days` },
      { section: 'Payback' },
      { label: 'Combined one-time cost', value: formatCompact(breakdown.combinedCost) },
      { label: 'Daily benefit after Hedge Fund', value: formatCompact(breakdown.grossHerbValuePerDay) },
      { label: 'Calculation', value: `${formatCompact(breakdown.combinedCost)} ÷ ${formatCompact(breakdown.grossHerbValuePerDay)}` },
      { label: 'Farm + hedge ROI', value: `${formatters.days(breakdown.roi)} days`, tone: infoTone(breakdown.roi), total: true },
    ],
    note: 'Once the Hedge Fund increases cover the added farm tax, the daily benefit is the full gross value of the added herbs. The tax reduction is not added again as a separate benefit. Each Hedge Fund increase costs 1T MD and removes 1B MD per hour of farm tax.',
  };
}

function tomeDropRoiInfo(data) {
  const breakdown = Calc.helpers.tomeDropRoiBreakdown(data);
  return {
    title: 'Tome Drop ROI',
    description: 'Upgrades the player’s highest-level tome and values the additional daily drops using that tome’s buy/sell midpoint.',
    rows: [
      { section: 'Upgrade' },
      { label: 'Tome being upgraded', value: breakdown.tomeName },
      { label: 'Current → next level', value: `${formatters.integer(breakdown.currentLevel)} → ${formatters.integer(breakdown.nextLevel)}` },
      { label: 'Upgrade resources required', value: formatCompact(breakdown.upgradeResources) },
      { label: 'Average resource price', value: `${formatCompact(breakdown.averageResourcePrice)} MD` },
      { label: 'Upgrade cost', value: formatCompact(breakdown.upgradeCost) },
      { section: 'Daily benefit' },
      { label: 'Effective drop chance', value: formatters.percent(breakdown.effectiveDropChance * 100) },
      { label: 'Successful drops / day', value: formatCompact(breakdown.successfulDropsPerDay) },
      { label: 'Current tomes / day', value: formatFull(breakdown.currentTomesPerDay) },
      { label: 'Tomes / day after upgrading', value: formatFull(breakdown.nextTomesPerDay) },
      { label: 'Extra tomes / day', value: formatCompact(breakdown.extraTomesPerDay) },
      { label: `${breakdown.tomeName} Tome buy/sell midpoint`, value: `${formatCompact(breakdown.tomeMarketPrice)} MD` },
      { label: 'Extra value / day', value: formatCompact(breakdown.extraValuePerDay) },
      { section: 'Payback' },
      { label: 'Calculation', value: `${formatCompact(breakdown.upgradeCost)} ÷ ${formatCompact(breakdown.extraValuePerDay)}` },
      { label: 'Tome Drop ROI', value: `${formatters.days(breakdown.roi)} days`, tone: infoTone(breakdown.roi), total: true },
    ],
    note: 'Drop quantity includes the player’s highest enemy and guild drop-amount bonus. Battler and TSer use the same Tome Drop calculation.',
  };
}

function workshopDustCollectorRoiInfo(data) {
  const breakdown = Calc.helpers.workshopDustCollectorRoiBreakdown(data);
  return {
    title: 'Workshop → Dust Collector ROI',
    description: 'Estimates the payback from the next Workshop level making future Dust Collector construction complete sooner.',
    rows: [
      { section: 'Workshop upgrade' },
      { label: 'Workshop upgrade cost', value: formatCompact(breakdown.workshopCost) },
      { section: 'Construction speed' },
      { label: 'Total Construction Speed', value: formatters.percent(breakdown.constructionBoost) },
      { label: 'Active Construction pet level', value: formatters.integer(breakdown.constructionPetLevel) },
      { label: 'Construction pet multiplier', value: `${formatters.days(breakdown.constructionPetMultiplier)}×` },
      ...(breakdown.ambidextrousLevel > 0 ? [
        { label: 'Construction Codex level', value: formatters.integer(breakdown.constructionCodex) },
        { label: 'Ambidextrous ranks', value: formatters.integer(breakdown.ambidextrousLevel) },
        { label: 'Chance to remove another 3 seconds / tick', value: formatters.percent(breakdown.ambidextrousChancePercent) },
        { label: 'Expected extra seconds removed / tick', value: formatFull(breakdown.ambidextrousExtraSecondsPerTick) },
      ] : []),
      { label: 'Current combined multiplier', value: `${formatters.days(breakdown.currentConstructionMultiplier)}×` },
      { label: 'Multiplier after Workshop upgrade', value: `${formatters.days(breakdown.nextConstructionMultiplier)}×` },
      { section: 'Dust Collector value' },
      { label: 'Additional MD / day from Dust Collector', value: formatCompact(breakdown.collectorDailyValue) },
      { label: 'Estimated construction time saved', value: `${formatFull(breakdown.timeSavePerBuild)} seconds` },
      { label: 'Value gained / future build', value: formatCompact(breakdown.valuePerFutureBuild) },
      { label: 'Cumulative daily value', value: formatCompact(breakdown.dailyCumulativeValue) },
      { section: 'Payback' },
      { label: 'Calculation', value: `√(${formatCompact(breakdown.paybackNumerator)} ÷ ${formatCompact(breakdown.paybackDenominator)})` },
      { label: 'Workshop → Dust Collector ROI', value: `${formatters.days(breakdown.roi)} days`, tone: infoTone(breakdown.roi), total: true },
    ],
    note: 'Estimates how long the next Workshop level takes to repay its cost through the extra MD earned by completing future Dust Collector upgrades sooner. Total Construction Speed already includes Workshop and Codex boosts. Ambidextrous adds to the pet’s expected timer reduction using purchased Construction Codex levels; upgrading Workshop does not raise that chance.',
  };
}

function renderInfoPanels(data, result) {
  setInfoPanel('tser-resources', {
    title: 'Extra resource value',
    description: 'Resource income with your Harvest potion compared with unpotted income, after resource tax.',
    rows: [
      { label: data.unlockedStars == null ? 'Assigned stars (minimum)' : 'Unlocked stars', value: formatters.integer(data.resourceStarCount) },
      { label: 'Matching elemental star bonus', value: `+${formatters.percent(data.starResourceBonusPercent)}` },
      { label: 'Resources / day with potion, after tax', value: formatCompact(result.tser.pottedAfterEvent) },
      { label: 'Unpotted resources / day, after tax', value: formatCompact(result.tser.unpottedAfterEvent) },
      { label: 'Extra resource value / day', value: formatCompact(result.tser.extraResValue), total: true },
    ],
    note: data.starResourceBonusEstimated
      ? 'The unlocked-star count could not be confirmed. The bonus uses assigned stars and may be understated.'
      : 'Fire boosts Iron, Water boosts Fish, and Nature boosts Wood by 0.1% per unlocked star. The matching perk must be active. This multiplier applies to gathered resources, including Harvest potion gains.',
  });
  setInfoPanel('battler-net-herbs', netHerbsInfo('battler', result));
  setInfoPanel('tser-net-herbs', netHerbsInfo('tser', result));
  setInfoPanel('battler-max-potion', sustainablePotionInfo('battler', data, result));
  setInfoPanel('tser-max-potion', sustainablePotionInfo('tser', data, result));
  setInfoPanel('battler-sunpetal-potion', sunpetalPotionInfo(result.sunpetalPotion));
  setInfoPanel('tser-sunpetal-potion', sunpetalPotionInfo(result.sunpetalPotion));
  setInfoPanel('tser-guild-potion', guildPotionInfo(data, result.tser.guildPotionAnalysis));
  setInfoPanel('battler-left-bloom', leftoverHerbInfo('battler', 'bloom', result));
  setInfoPanel('battler-left-sage', leftoverHerbInfo('battler', 'sage', result));
  setInfoPanel('tser-left-bloom', leftoverHerbInfo('tser', 'bloom', result));
  setInfoPanel('tser-left-sage', leftoverHerbInfo('tser', 'sage', result));
  setInfoPanel('battler-left-sunpetals', leftoverSunpetalsInfo('battler', data, result));
  setInfoPanel('tser-left-sunpetals', leftoverSunpetalsInfo('tser', data, result));
  setInfoPanel('battler-node-yield-roi', nodeYieldRoiInfo(result.battler.nodeYieldAnalysis));
  setInfoPanel('tser-node-yield-roi', nodeYieldRoiInfo(result.tser.nodeYieldAnalysis));
  setInfoPanel('battler-leftover-value', leftoverValueInfo('battler', data, result));
  setInfoPanel('tser-leftover-value', leftoverValueInfo('tser', data, result));
  setInfoPanel('battler-farm-tax', farmTaxInfo('battler', data, result));
  setInfoPanel('tser-farm-tax', farmTaxInfo('tser', data, result));
  setInfoPanel('battler-md', mdIncomeInfo(data));
  setInfoPanel('battler-lab-roi', labRoiInfo('battler', data));
  setInfoPanel('battler-dust-collector-roi', dustCollectorRoiInfo(data));
  setInfoPanel('battler-farm-no-hedge-roi', farmNoHedgeRoiInfo(data));
  setInfoPanel('battler-farm-hedge-roi', farmHedgeRoiInfo(data));
  setInfoPanel('battler-tome-drop-roi', tomeDropRoiInfo(data));
  setInfoPanel('battler-workshop-dust-collector-roi', workshopDustCollectorRoiInfo(data));
  setInfoPanel('tser-lab-roi', labRoiInfo('tser', data));
  setInfoPanel('tser-farm-no-hedge-roi', farmNoHedgeRoiInfo(data));
  setInfoPanel('tser-farm-hedge-roi', farmHedgeRoiInfo(data));
  setInfoPanel('tser-tome-drop-roi', tomeDropRoiInfo(data));
}

function battlerPotionInfo(data, analysis) {
  const rows = [
    { label: 'Maximum sustainable Wisdom', value: formatters.integer(analysis.maximumSustainablePotion) },
    { label: 'Resonance potion', value: formatters.integer(data.resonancePotion) },
    { label: 'Potion Duration', value: formatters.percent(data.potDuration) },
    { label: 'Event hours / day', value: formatters.days(Calc.C.BATTLE_HOURS_PER_DAY) },
    { label: 'Purchased Potion Boost level', value: formatters.integer(analysis.potionBoostLevel) },
    { label: 'Total Potion Boost (including Potency)', value: formatters.percent(analysis.potionBoost) },
    { label: 'Potion Boost cost', value: formatCompact(analysis.potionBoostCost) },
  ];
  if (analysis.farm) {
    rows.push({ section: 'Farm + Hedge' });
    for (const upgrade of analysis.farm.upgrades.filter(upgrade => upgrade.addedLevels > 0)) {
      rows.push({ label: `${upgrade.label}: ${formatters.integer(upgrade.currentLevel)} → ${formatters.integer(upgrade.nextLevel)}`,
        value: `${formatCompact(upgrade.resources)} ${upgrade.resource}` });
    }
    rows.push(
      { label: 'Total resources needed', value: formatCompact(analysis.farm.resourcesNeeded) },
      { label: 'Average resource price', value: `${formatFull(data.averageResourcePrice)} MD` },
      { label: 'Resources valued in MD', value: formatCompact(analysis.farm.farmCost) },
      { label: 'Hedge Fund increases', value: formatters.integer(analysis.farm.hedgeLevelsNeeded) },
      { label: 'Hedge Fund cost', value: formatCompact(analysis.farm.hedgeCost) },
      { label: 'MD cost calculation', value: `${formatCompact(analysis.farm.resourcesNeeded)} × ${formatFull(data.averageResourcePrice)} + ${formatCompact(analysis.farm.hedgeCost)}` },
      { label: 'Farm + Hedge MD cost', value: formatCompact(analysis.farm.cost), total: true },
    );
  }
  return {
    title: 'Potion boost vs farm xp comparison',
    description: 'Starts at the highest sustainable whole-level Wisdom potion, with the entered Resonance potion and 1:1 herb trading. The stronger potion is rounded up to match the Wisdom effect of +1 Potion Boost.',
    rows,
    note: 'Farm upgrades catch up the lowest stat first, then raise tied stats together using whole levels. Resources use the average market price; new Hedge Fund increases cover all added farm tax. The recommendation compares MD cost per percentage-point increase in Wisdom’s potion effect. Other XP bonuses and Potion Boost’s additional Resonance benefit are not included in that comparison.',
  };
}

function formatWisdomGain(value) {
  return Number.isFinite(value)
    ? `+${value.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}%`
    : 'N/A';
}

function resonanceValueInfo(resonance) {
  if (!resonance) return {
    title: 'Resonance value per 10% tax free',
    description: 'The player levels or shard market price needed for this estimate are unavailable.',
    rows: [],
  };
  return {
    title: 'Resonance value per 10% tax free',
    description: 'Value given as 10% as an easy base rate, adjust to your own guild value.',
    rows: [
      { label: 'Weighted levels: 3 x Battling + gathering', value: formatters.integer(resonance.weightedLevel) },
      { label: 'Resonance shard bonus', value: `${formatters.percent(resonance.currentResonanceBonus)} → ${formatters.percent(resonance.nextResonanceBonus)}` },
      { label: 'Minimum shard drop', value: formatFull(resonance.minimumBaseDrop) },
      { label: 'Average base drop', value: formatFull(resonance.averageBaseDrop) },
      ...(resonance.shardConstellationBonusPercent > 0 ? [
        { label: 'Constellation shard amount bonus', value: `+${formatters.percent(resonance.shardConstellationBonusPercent)}` },
      ] : []),
      { label: 'Average drop including boost', value: `${formatCompact(resonance.currentAverageDrop, 3)} → ${formatCompact(resonance.nextAverageDrop, 3)}` },
      { label: 'Extra shards / day before tax', value: formatCompact(resonance.extraShardsPerDay) },
      { label: 'Extra shards retained with 90% tax', value: formatCompact(resonance.retainedExtraShardsPerDay) },
      { label: 'Shard buy/sell midpoint', value: `${formatFull(resonance.shardMarketPrice)} MD` },
      { label: 'Total extra MD value', value: formatCompact(resonance.valuePerDay), total: true },
    ],
  };
}

function renderBattlerPotionAnalysis(analysis) {
  setText('b-potion-max', formatters.integer(analysis.maximumSustainablePotion));
  setText('b-potion-boost-range', `${formatters.percent(analysis.potionBoost)} → ${formatters.percent(analysis.nextPotionBoost)}`);
  setText('b-potion-boost-cost', formatCompact(analysis.potionBoostCost));
  setText('b-potion-boost-gain', analysis.maximumSustainablePotion > 0 ? formatWisdomGain(analysis.potionBoostGainPercent) : 'N/A');
  setText('b-potion-resonance-value', analysis.resonanceValue
    ? `${formatCompact(analysis.resonanceValue.valuePerDay)} MD / day` : 'N/A');
  setText('b-potion-farm-target', formatters.integer(analysis.matchingWisdomPotion));
  setText('b-potion-farm-herbs', analysis.extraHerbsConsumedPerDay == null ? 'N/A' : `${formatCompact(analysis.extraHerbsConsumedPerDay, 3)} / day`);
  const upgrades = analysis.farm?.upgrades.filter(upgrade => upgrade.addedLevels > 0);
  let farmUpgradesText = upgrades
    ? upgrades.map(upgrade => `${upgrade.label} +${formatters.integer(upgrade.addedLevels)}`).join('\n') || 'None'
    : 'N/A';
  if (upgrades?.length === 3) {
    const maximum = Math.max(...upgrades.map(upgrade => upgrade.addedLevels));
    farmUpgradesText = `All farm sections +${formatters.integer(maximum)}`;
  }
  setText('b-potion-farm-upgrades', farmUpgradesText);
  setText('b-potion-farm-resources', formatCompact(analysis.farm?.resourcesNeeded));
  setText('b-potion-farm-cost', formatCompact(analysis.farm?.cost));
  let recommendation = 'A comparison is unavailable for these stats.';
  if (analysis.status === 'no-sustainable-potion') {
    recommendation = 'Your farm cannot currently sustain a Wisdom potion alongside this Resonance potion.';
  } else if (analysis.status === 'potion-limit') {
    recommendation = 'A matching Wisdom potion would exceed the 999,999 tier limit. Potion Boost can still increase its effect.';
  } else if (analysis.preferredOption === 'equal') {
    recommendation = 'Both options have the same MD cost per % Wisdom effect gained.';
  } else if (analysis.preferredOption) {
    const boostWins = analysis.preferredOption === 'potionBoost';
    const label = boostWins ? 'Potion Boost' : 'Farm + Hedge';
    const gain = boostWins ? analysis.potionBoostGainPercent : analysis.farmGainPercent;
    const cost = boostWins ? analysis.potionBoostCost : analysis.farm.cost;
    recommendation = `${label} is more cost-effective: ${formatWisdomGain(gain)} Wisdom effect for ${formatCompact(cost)} MD.`;
  }
  setText('b-potion-recommendation', recommendation);
}

function renderSummary(result) {
  setText('summary-battler', formatCompact(result.battler.fullIncome));
  setMetric('summary-battler-net-herbs', result.battler.netHerbs, formatSignedCompact, true);
  setText('summary-battler-max-potion', formatters.integer(result.battler.maxSustainablePotion));
  setText('summary-battler-guidance', result.sunpetalPotion
    ? formatters.integer(result.sunpetalPotion.maximumSustainablePotion) : 'N/A');
  setText('summary-tser', formatCompact(result.tser.fullIncome));
  setText('summary-potion', formatters.integer(result.tser.bestPotion));
  setText('summary-loss', formatters.percent(result.tser.percentLoss));
  setText(
    'summary-loss-label',
    `Loss compared to highest-income potion: ${formatters.integer(result.tser.bestPotion)}`,
  );
  setMetric('summary-net-herbs', result.tser.netHerbs, formatSignedCompact, true);
}

function applyRoleView(role) {
  const isTser = role === 'tser';
  const isBattler = role === 'battler';
  const hasRole = isTser || isBattler;
  const showResults = hasRole && hasRenderedResults;
  elements.overview.hidden = !showResults;
  elements.results.hidden = !showResults;
  elements.battlerSummaries.forEach((element) => { element.hidden = !isBattler; });
  elements.tserSummaries.forEach((element) => { element.hidden = !isTser; });
  elements.battlerPanels.forEach((element) => { element.hidden = !isBattler; });
  elements.tserPanels.forEach((element) => { element.hidden = !isTser; });
  elements.guildPotionPanel.hidden = !isTser || !SHOW_GUILD_POTION;
  elements.overview.dataset.role = role;
  elements.resultGrid.dataset.role = role;
  elements.resultsTitle.textContent = isTser ? 'TSer breakdown' : 'Battler breakdown';
  elements.overview.setAttribute(
    'aria-label',
    isTser
      ? 'Current TSer calculation summary'
      : isBattler ? 'Current Battler calculation summary' : 'Calculation summary',
  );
  closeInfoPanels();
}

function renderDetails(result) {
  renderBattlerPotionAnalysis(result.battler.potionAnalysis);
  const sunpetalTier = result.sunpetalPotion
    ? formatters.integer(result.sunpetalPotion.maximumSustainablePotion) : 'N/A';
  setText('t-sunpetal-max', sunpetalTier);
  setMetric('b-left-bloom', result.battler.leftoverBloom, formatters.compact, true);
  setMetric('b-left-sage', result.battler.leftoverSage, formatters.compact, true);
  setMetric('b-left-sunpetals', result.battler.leftoverSunpetals, formatters.compact, true);
  setMetric('b-dust', result.battler.leftoverSold, formatters.compact, true);
  setMetric('b-tax', result.battler.farmTax, formatters.compact, true);
  setMetric('b-md', result.battler.mdEarned, formatters.compact, true);
  setMetric('b-total', result.battler.fullIncome, formatters.compact, true);

  setMetric('t-left-bloom', result.tser.leftoverBloom, formatters.compact, true);
  setMetric('t-left-sage', result.tser.leftoverSage, formatters.compact, true);
  setMetric('t-left-sunpetals', result.tser.leftoverSunpetals, formatters.compact, true);
  setMetric('t-dust', result.tser.leftoverSold, formatters.compact, true);
  setMetric('t-tax', result.tser.farmTax, formatters.compact, true);
  setMetric('t-extra', result.tser.extraResValue, formatters.compact, true);
  setMetric('t-farm-pot', result.tser.farmPlusPotIncome, formatters.compact, true);
  setMetric('t-total', result.tser.fullIncome, formatters.compact, true);
  setMetric('t-best-pot', result.tser.bestPotion, formatters.integer);
  setMetric('t-best-income', result.tser.bestIncome, formatters.compact, true);
  setMetric('t-loss', result.tser.lossFromCurrentPotion, formatters.compact, true);
  setMetric('t-loss-pct', result.tser.percentLoss, formatters.percent, true);
  setMetric('t-max-sustainable-pot', result.tser.maxSustainablePotion, formatters.integer);
  const guildPotion = result.tser.guildPotionAnalysis;
  setMetric('t-guild-best-pot', guildPotion.bestPotion, formatters.integer);
  setMetric('t-guild-resource-value', guildPotion.grossResourceValue, formatters.compact, true);
  setMetric('t-guild-current-resource-value', guildPotion.currentGrossResourceValue, formatters.compact, true);
  setMetric('t-guild-change', guildPotion.grossResourceChange, formatSignedCompact, true);

  setRoi('b-roi', result.roi.battler);
  setRoi('t-roi', result.roi.tser);
  for (const [prefix, role] of [['b', 'battler'], ['t', 'tser']]) {
    const a = result[role].nodeYieldAnalysis;
    setText(`${prefix}-node-yield-name`, `${a?.name ?? 'T2 resource'} yield`);
  }
}

function render(data, result) {
  renderSummary(result);
  renderDetails(result);
  renderInfoPanels(data, result);
  setInfoPanel('battler-potion-analysis', battlerPotionInfo(data, result.battler.potionAnalysis));
  setInfoPanel('battler-resonance-value', resonanceValueInfo(result.battler.potionAnalysis.resonanceValue));
  elements.sigilWarning.hidden = !data.hasNonDistillationSigil;
  hasRenderedResults = true;
  applyRoleView(elements.role.value);
}

function clearResults() {
  hasRenderedResults = false;
  elements.overview.hidden = true;
  elements.results.hidden = true;
  elements.overview.querySelectorAll('.summary-value').forEach((element) => {
    element.textContent = '—';
    element.classList.remove('positive', 'negative');
  });
  elements.resultGrid.querySelectorAll('.value, .days').forEach((element) => {
    element.textContent = '—';
    element.classList.remove('positive', 'negative');
    element.closest('.roi-row')?.classList.remove('best');
  });
  setText('summary-loss-label', 'Loss compared to highest-income potion');
  elements.sigilWarning.hidden = true;
}

async function getLiveData(inputs) {
  const { playerData, marketData, guilds, unlockedStars } = await window.ManarionApi.fetchPlayerInputs(inputs.username);
  return Calc.normalizeFromApis(playerData, marketData, guilds, inputs, unlockedStars);
}

function getInputs() {
  return {
    username: $('username').value.trim(),
    tax: num($('tax').value),
    harvestPotion: num($('harvest').value),
    resonancePotion: num($('resonance').value),
    guidancePotion: num($('guidance').value),
    role: elements.role.value,
  };
}

function getInputValues() {
  return {
    username: $('username').value.trim(),
    tax: $('tax').value,
    harvestPotion: $('harvest').value,
    resonancePotion: $('resonance').value,
    guidancePotion: $('guidance').value,
    role: elements.role.value,
  };
}

function saveInputs() {
  try {
    localStorage.setItem(INPUT_STORAGE_KEY, JSON.stringify(getInputValues()));
  } catch (_) {}
}

function restoreInputs() {
  try {
    const saved = JSON.parse(localStorage.getItem(INPUT_STORAGE_KEY));
    if (!saved || typeof saved !== 'object') return;

    $('username').value = typeof saved.username === 'string' ? saved.username : '';
    $('tax').value = typeof saved.tax === 'string' ? saved.tax : '';
    $('harvest').value = typeof saved.harvestPotion === 'string' ? saved.harvestPotion : '';
    $('resonance').value = typeof saved.resonancePotion === 'string' ? saved.resonancePotion : '';
    $('guidance').value = typeof saved.guidancePotion === 'string' ? saved.guidancePotion : '';
    elements.role.value = ['tser', 'battler'].includes(saved.role) ? saved.role : '';
  } catch (_) {}
}

function setBusy(isBusy) {
  elements.updateButton.disabled = isBusy;
  elements.updateButton.setAttribute('aria-busy', String(isBusy));
  elements.updateButtonLabel.textContent = isBusy ? 'Updating…' : 'Update player';
}

async function update() {
  const inputs = getInputs();
  if (!inputs.username) {
    setStatus('Enter a username.', 'error');
    return;
  }

  clearResults();
  setBusy(true);
  setStatus('Fetching player, market, and guild data…', 'working');

  try {
    const live = await getLiveData(inputs);
    render(live, Calc.calculate(live));
    setStatus(live.starResourceBonusEstimated
      ? 'Updated. Star harvest bonus uses assigned stars; the unlocked-star count is unavailable.'
      : 'Updated from the live Manarion API.', live.starResourceBonusEstimated ? 'error' : 'ok');
  } catch (error) {
    setStatus(`Could not load live Manarion data: ${error.message}`, 'error');
  } finally {
    setBusy(false);
  }
}

function resetInputs() {
  try {
    localStorage.removeItem(INPUT_STORAGE_KEY);
  } catch (_) {}
  elements.form.reset();
  clearResults();
  applyRoleView(elements.role.value);
  setStatus('', '');
}

elements.form.addEventListener('submit', (event) => {
  event.preventDefault();
  saveInputs();
  update();
});

$('reset-btn').addEventListener('click', resetInputs);
elements.role.addEventListener('change', () => applyRoleView(elements.role.value));

clearResults();
setupInfoPanels();
restoreInputs();
setStatus('', '');
