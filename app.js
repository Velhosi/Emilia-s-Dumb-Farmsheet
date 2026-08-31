'use strict';

const Calc = window.ManarionCalculator;
const INPUT_STORAGE_KEY = 'emilia-farm-sheet-inputs-v1';
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
  battlerPanel: $('battler-panel'),
  tserPanels: [...document.querySelectorAll('.tser-result-panel')],
  battlerSummaries: [...document.querySelectorAll('.battler-only')],
  tserSummaries: [...document.querySelectorAll('.tser-only')],
  updateButton: $('update-btn'),
  updateButtonLabel: $('update-btn').querySelector('.btn-label'),
});

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCompact(value) {
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
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
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

function infoTone(value) {
  if (!Number.isFinite(value) || value === 0) return '';
  return value > 0 ? 'positive' : 'negative';
}

const formatters = Object.freeze({
  compact: formatCompact,
  days: (value) => Number.isFinite(value)
    ? value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })
    : 'N/A',
  integer: (value) => Number.isFinite(value) ? Math.round(value).toLocaleString() : 'N/A',
  percent: (value) => Number.isFinite(value)
    ? `${value.toLocaleString(undefined, { maximumFractionDigits: 3 })}%`
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
    infoPanels.set(key, { button, panel, wrapper });

    button.addEventListener('click', (event) => {
      event.stopPropagation();
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
}

function netHerbsInfo(role, result) {
  const totals = result[role];
  const potionName = role === 'battler' ? 'Wisdom' : 'Harvest';
  return {
    title: 'Net herbs',
    description: `Combined herbs remaining after daily ${potionName} and Resonance potion use. Assumes Bloomwells and Sageroots can be traded 1:1.`,
    rows: [
      { label: 'Leftover Bloomwells', value: formatSignedCompact(totals.leftoverBloom), tone: infoTone(totals.leftoverBloom) },
      { label: 'Leftover Sageroots', value: formatSignedCompact(totals.leftoverSage), tone: infoTone(totals.leftoverSage) },
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
  const nextPotion = maxPotion + Calc.C.POTION_SEARCH_STEP;
  const atCeiling = maxPotion >= Calc.C.MAX_TSER_POTION;
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
    { label: 'Resonance potion consumption', value: formatDebit(resonanceConsumption), tone: resonanceConsumption > 0 ? 'negative' : '' },
    { label: `Available for ${potionName} potion`, value: formatCompact(availableForHarvest), tone: infoTone(availableForHarvest), total: true },
    { label: `${formatters.integer(maxPotion)} ${potionName} potion use`, value: formatDebit(harvestConsumption), tone: harvestConsumption > 0 ? 'negative' : '' },
    { label: 'Herbs remaining', value: formatSignedCompact(remaining), tone: infoTone(remaining), total: true },
  ];

  if (atCeiling) {
    rows.push({ label: 'Search ceiling reached', value: formatters.integer(maxPotion) });
  } else {
    rows.push({
      label: `Next tier: ${formatters.integer(nextPotion)}`,
      value: formatSignedCompact(nextRemaining),
      tone: infoTone(nextRemaining),
    });
  }

  return {
    title: 'Maximum sustainable potion',
    description: 'The highest 1,000-level potion that keeps combined herbs at or above zero. Bloomwells and Sageroots are treated as tradable 1:1.',
    rows,
    note: 'Uses the entered Resonance potion and the player’s total Potion Duration, including Laboratory.',
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
  const rows = [{ label: `Daily ${herbName} produced`, value: formatCompact(produced) }];

  if (harvestUsesThisHerb) {
    rows.push({ label: `${potionName} potion consumption`, value: formatDebit(harvestConsumption), tone: harvestConsumption > 0 ? 'negative' : '' });
  }
  rows.push({ label: `Resonance ${resonanceName} consumption`, value: formatDebit(resonanceConsumption), tone: resonanceConsumption > 0 ? 'negative' : '' });
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
    description: 'Each leftover herb balance is multiplied by its current Manarion sell price.',
    rows: [
      {
        label: `Bloomwells: ${formatSignedCompact(totals.leftoverBloom)} × ${formatters.integer(data.bloomwellPrice)}`,
        value: formatSignedCompact(bloomValue),
        tone: infoTone(bloomValue),
      },
      {
        label: `Sageroots: ${formatSignedCompact(totals.leftoverSage)} × ${formatters.integer(data.sagerootPrice)}`,
        value: formatSignedCompact(sageValue),
        tone: infoTone(sageValue),
      },
      { label: 'Leftover herb value', value: formatSignedCompact(totals.leftoverSold), tone: infoTone(totals.leftoverSold), total: true },
    ],
  };
}

function farmTaxInfo(role, data, result) {
  const totals = result[role];
  const productionTax = totals.herbDaily * Calc.C.FARM_DUST_PER_HERB;
  const hedgeDiscount = data.farmDiscount * 1_000_000_000 * 24;
  return {
    title: 'Farm tax taken',
    description: 'The farm charges 50,000 MD for every herb produced. Hedge Fund’s permanent Farm Discount offsets that charge when the player has it.',
    rows: [
      { label: 'Leftover herb value', value: formatSignedCompact(totals.leftoverSold), tone: infoTone(totals.leftoverSold) },
      { label: 'Herb production tax', value: formatDebit(productionTax), tone: productionTax > 0 ? 'negative' : '' },
      { label: 'Hedge Fund Farm Discount', value: formatSignedCompact(hedgeDiscount), tone: infoTone(hedgeDiscount) },
      { label: 'Farm tax taken', value: formatSignedCompact(totals.farmTax), tone: infoTone(totals.farmTax), total: true },
    ],
  };
}

function mdIncomeInfo(data) {
  const breakdown = Calc.helpers.mdIncomeBreakdown(data);
  return {
    title: 'MD earned daily',
    description: 'Base MD scales with the player’s current enemy, including the extra scaling above enemy 150,000. Boosts are applied before tax.',
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
  return {
    title: 'Laboratory ROI',
    description: 'The next Laboratory level adds 1 Potion Duration. ROI compares its cost with the daily value of the herbs that extra duration saves.',
    rows: [
      { label: 'Next Laboratory level cost', value: formatCompact(breakdown.nextLevelCost) },
      { label: `${potionName} savings value / day`, value: formatCompact(breakdown.harvestSavingsValuePerDay), tone: infoTone(breakdown.harvestSavingsValuePerDay) },
      { label: 'Resonance savings value / day', value: formatCompact(breakdown.resonanceSavingsValuePerDay), tone: infoTone(breakdown.resonanceSavingsValuePerDay) },
      { label: 'Total savings / day', value: formatCompact(breakdown.totalSavingsValuePerDay), tone: infoTone(breakdown.totalSavingsValuePerDay), total: true },
      { label: 'ROI', value: `${formatters.days(breakdown.roi)} days`, total: true },
    ],
    note: `${role === 'battler' ? 'Battler Wisdom' : 'TSer Harvest'} savings use the ${roleHerb} sell price. Resonance savings value both herb halves across the full 22.4-hour day.`,
  };
}

function renderInfoPanels(data, result) {
  setInfoPanel('battler-net-herbs', netHerbsInfo('battler', result));
  setInfoPanel('tser-net-herbs', netHerbsInfo('tser', result));
  setInfoPanel('battler-max-potion', sustainablePotionInfo('battler', data, result));
  setInfoPanel('tser-max-potion', sustainablePotionInfo('tser', data, result));
  setInfoPanel('battler-left-bloom', leftoverHerbInfo('battler', 'bloom', result));
  setInfoPanel('battler-left-sage', leftoverHerbInfo('battler', 'sage', result));
  setInfoPanel('tser-left-bloom', leftoverHerbInfo('tser', 'bloom', result));
  setInfoPanel('tser-left-sage', leftoverHerbInfo('tser', 'sage', result));
  setInfoPanel('battler-leftover-value', leftoverValueInfo('battler', data, result));
  setInfoPanel('tser-leftover-value', leftoverValueInfo('tser', data, result));
  setInfoPanel('battler-farm-tax', farmTaxInfo('battler', data, result));
  setInfoPanel('tser-farm-tax', farmTaxInfo('tser', data, result));
  setInfoPanel('battler-md', mdIncomeInfo(data));
  setInfoPanel('battler-lab-roi', labRoiInfo('battler', data));
  setInfoPanel('tser-lab-roi', labRoiInfo('tser', data));
}

function renderSummary(result) {
  setText('summary-battler', formatCompact(result.battler.fullIncome));
  setMetric('summary-battler-net-herbs', result.battler.netHerbs, formatSignedCompact, true);
  setText('summary-battler-max-potion', formatters.integer(result.battler.maxSustainablePotion));
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
  elements.battlerPanel.hidden = !isBattler;
  elements.tserPanels.forEach((element) => { element.hidden = !isTser; });
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
  setMetric('b-left-bloom', result.battler.leftoverBloom, formatters.compact, true);
  setMetric('b-left-sage', result.battler.leftoverSage, formatters.compact, true);
  setMetric('b-dust', result.battler.leftoverSold, formatters.compact, true);
  setMetric('b-tax', result.battler.farmTax, formatters.compact, true);
  setMetric('b-md', result.battler.mdEarned, formatters.compact, true);
  setMetric('b-total', result.battler.fullIncome, formatters.compact, true);

  setMetric('t-left-bloom', result.tser.leftoverBloom, formatters.compact, true);
  setMetric('t-left-sage', result.tser.leftoverSage, formatters.compact, true);
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

  setRoi('b-roi', result.roi.battler);
  setRoi('t-roi', result.roi.tser);
}

function render(data, result) {
  renderSummary(result);
  renderDetails(result);
  renderInfoPanels(data, result);
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

async function requestJson(url, headers = {}) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'application/json', ...headers },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function fetchJson(url) {
  try {
    return await requestJson(url);
  } catch (directError) {
    const readerUrl = `https://r.jina.ai/${url}`;
    try {
      const envelope = await requestJson(readerUrl, {
        'X-Engine': 'direct',
        'X-No-Cache': 'true',
      });
      const content = envelope?.data?.content;
      if (typeof content !== 'string') throw new Error('response did not contain API data');
      return JSON.parse(content);
    } catch (readerError) {
      throw new Error(
        `direct request failed (${directError.message}); live relay failed (${readerError.message})`,
      );
    }
  }
}

async function getLiveData(inputs) {
  const name = encodeURIComponent(inputs.username.trim());
  const [playerData, marketData, guilds] = await Promise.all([
    fetchJson(`https://api.manarion.com/players/${name}`),
    fetchJson('https://api.manarion.com/market'),
    fetchJson('https://api.manarion.com/guilds'),
  ]);

  return Calc.normalizeFromApis(playerData, marketData, guilds, inputs);
}

function getInputs() {
  return {
    username: $('username').value.trim(),
    tax: num($('tax').value),
    harvestPotion: num($('harvest').value),
    resonancePotion: num($('resonance').value),
    role: elements.role.value,
  };
}

function getInputValues() {
  return {
    username: $('username').value.trim(),
    tax: $('tax').value,
    harvestPotion: $('harvest').value,
    resonancePotion: $('resonance').value,
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
    setStatus('Updated from the live Manarion API.', 'ok');
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
