'use strict';

const Calc = window.ManarionCalculator;

const $ = (id) => document.getElementById(id);
const elements = Object.freeze({
  form: $('settings-form'),
  status: $('status'),
  role: $('role'),
  overview: $('overview'),
  resultGrid: $('result-grid'),
  resultsTitle: $('results-title'),
  battlerPanel: $('battler-panel'),
  tserPanel: $('tser-panel'),
  battlerSummary: $('summary-battler-card'),
  tserSummaries: [...document.querySelectorAll('.tser-only')],
  updateButton: $('update-btn'),
  updateButtonLabel: $('update-btn').querySelector('.btn-label'),
});

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatUnit(value, divisor, suffix, decimals = 2) {
  if (!Number.isFinite(value)) return 'N/A';
  const formatted = (value / divisor).toLocaleString(undefined, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
  return `${formatted} ${suffix}`;
}

function formatCompact(value) {
  const magnitude = Math.abs(value);
  if (magnitude >= 1e15) return formatUnit(value, 1e15, 'Q');
  if (magnitude >= 1e12) return formatUnit(value, 1e12, 'T');
  if (magnitude >= 1e9) return formatUnit(value, 1e9, 'B');
  return Number.isFinite(value) ? Math.round(value).toLocaleString() : 'N/A';
}

const formatters = Object.freeze({
  billions: (value) => formatUnit(value, 1e9, 'B'),
  trillions: (value) => formatUnit(value, 1e12, 'T'),
  quadrillions: (value) => formatUnit(value, 1e15, 'Q'),
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
  elements.battlerSummary.hidden = isTser;
  elements.tserSummaries.forEach((element) => { element.hidden = !isTser; });
  elements.battlerPanel.hidden = isTser;
  elements.tserPanel.hidden = !isTser;
  elements.overview.dataset.role = isTser ? 'tser' : 'battler';
  elements.resultGrid.dataset.role = isTser ? 'tser' : 'battler';
  elements.resultsTitle.textContent = isTser ? 'TSer breakdown' : 'Battler breakdown';
  elements.overview.setAttribute(
    'aria-label',
    isTser ? 'Current TSer calculation summary' : 'Current Battler calculation summary',
  );
}

function renderDetails(result) {
  setMetric('b-left-bloom', result.battler.leftoverBloom, formatters.billions, true);
  setMetric('b-left-sage', result.battler.leftoverSage, formatters.billions, true);
  setMetric('b-dust', result.battler.leftoverSold, formatters.trillions, true);
  setMetric('b-tax', result.battler.farmTax, formatters.trillions, true);
  setMetric('b-md', result.battler.mdEarned, formatters.quadrillions, true);
  setMetric('b-total', result.battler.fullIncome, formatters.trillions, true);

  setMetric('t-left-bloom', result.tser.leftoverBloom, formatters.billions, true);
  setMetric('t-left-sage', result.tser.leftoverSage, formatters.billions, true);
  setMetric('t-dust', result.tser.leftoverSold, formatters.trillions, true);
  setMetric('t-tax', result.tser.farmTax, formatters.trillions, true);
  setMetric('t-extra', result.tser.extraResValue, formatters.trillions, true);
  setMetric('t-farm-pot', result.tser.farmPlusPotIncome, formatters.trillions, true);
  setMetric('t-total', result.tser.fullIncome, formatters.trillions, true);
  setMetric('t-best-pot', result.tser.bestPotion, formatters.integer);
  setMetric('t-best-income', result.tser.bestIncome, formatters.trillions, true);
  setMetric('t-loss', result.tser.lossFromCurrentPotion, formatters.trillions, true);
  setMetric('t-loss-pct', result.tser.percentLoss, formatters.percent, true);

  setRoi('b-roi', result.roi.battler);
  setRoi('t-roi', result.roi.tser);
}

function render(data, result) {
  renderSummary(data, result);
  renderDetails(result);
  applyRoleView(elements.role.value);
}

function clearResults() {
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

async function fetchJson(url) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
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
  $('username').value = 'Emilia';
  $('tax').value = '25';
  $('harvest').value = '120000';
  $('resonance').value = '62000';
  elements.role.value = 'tser';
  applyRoleView(elements.role.value);
  update();
}

elements.form.addEventListener('submit', (event) => {
  event.preventDefault();
  update();
});

$('demo-btn').addEventListener('click', resetInputs);
elements.role.addEventListener('change', () => applyRoleView(elements.role.value));

applyRoleView(elements.role.value);
update();
