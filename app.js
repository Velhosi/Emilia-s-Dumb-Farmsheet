'use strict';

const Calc = window.ManarionCalculator;
const INPUT_STORAGE_KEY = 'emilia-farm-sheet-inputs-v1';
let hasRenderedResults = false;

const $ = (id) => document.getElementById(id);
const elements = Object.freeze({
  form: $('settings-form'),
  status: $('status'),
  role: $('role'),
  overview: $('overview'),
  results: $('results'),
  resultGrid: $('result-grid'),
  resultsTitle: $('results-title'),
  battlerPanel: $('battler-panel'),
  tserPanels: [...document.querySelectorAll('.tser-result-panel')],
  battlerSummary: $('summary-battler-card'),
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

const formatters = Object.freeze({
  compact: formatCompact,
  days: (value) => Number.isFinite(value)
    ? `${value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })} d`
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

function renderSummary(data, result) {
  setText('summary-battler', formatCompact(result.battler.fullIncome));
  setText('summary-tser', formatCompact(result.tser.fullIncome));
  setText('summary-potion', formatters.integer(result.tser.bestPotion));
  setText('summary-loss', formatters.percent(result.tser.percentLoss));
  setText(
    'summary-loss-label',
    `Loss compared to highest-income potion: ${formatters.integer(result.tser.bestPotion)}`,
  );

  const ambitiousCount = Math.min(Math.max(Math.trunc(num(data.ambitiousCount)), 0), 8);
  const ambitiousPenalty = Math.round(result.tser.ambitiousPenaltyPercent * 1000) / 1000;
  setText(
    'summary-ambitious',
    ambitiousPenalty > 0 ? `−${ambitiousPenalty.toLocaleString()}% res` : '0% res',
  );
  setText(
    'summary-ambitious-caption',
    `${ambitiousCount.toLocaleString()} equipped Ambitious ${ambitiousCount === 1 ? 'item' : 'items'}`,
  );
}

function applyRoleView(role) {
  const isTser = role === 'tser';
  const isBattler = role === 'battler';
  const hasRole = isTser || isBattler;
  const showResults = hasRole && hasRenderedResults;
  elements.overview.hidden = !showResults;
  elements.results.hidden = !showResults;
  elements.battlerSummary.hidden = !isBattler;
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

  setRoi('b-roi', result.roi.battler);
  setRoi('t-roi', result.roi.tser);
}

function render(data, result) {
  renderSummary(data, result);
  renderDetails(result);
  hasRenderedResults = true;
  applyRoleView(elements.role.value);
}

function clearResults() {
  hasRenderedResults = false;
  elements.overview.hidden = true;
  elements.results.hidden = true;
  elements.overview.querySelectorAll('.summary-value').forEach((element) => {
    element.textContent = '—';
  });
  elements.resultGrid.querySelectorAll('.value, .days').forEach((element) => {
    element.textContent = '—';
    element.classList.remove('positive', 'negative');
    element.closest('.roi-row')?.classList.remove('best');
  });
  setText('summary-loss-label', 'Loss compared to highest-income potion');
  setText('summary-ambitious-caption', 'equipped Ambitious items');
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
restoreInputs();
setStatus('', '');
