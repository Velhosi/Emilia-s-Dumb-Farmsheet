'use strict';

const Calc = window.ManarionCalculator;

const SNAPSHOT_EMILIA = {
  username: 'Emilia',
  tax: 25,
  harvestPotion: 120000,
  resonancePotion: 62000,
  potDuration: 1673,
  bloomwellPrice: 129997,
  sagerootPrice: 117625,
  golems: 490000,
  fertilizer: 480000,
  plots: 480000,
  level: 79413,
  potionBoost: 235,
  baseRes: 7100.13,
  baseResResearch: 1305.7127018642018,
  research: 1332400.0000000002,
  averageResourcePrice: 35,
  farmDiscount: 1108061,
  spire: 650,
  equipmentBaseRes: 0,
  equipmentResearch: 0,
  powerOrbPrice: 1365000000001,
  perfectOrbPrice: 2182801833446367,
  divineEssencePrice: 5339170286518,
  elementiumPrice: 13638428518,
  baseResAmount: 710013,
  labLevel: 525,
  shardBoost: 300000,
  shardPrice: 14806,
  nexusLevel: null,
  natureTomePrice: 6431250770,
  waterTomePrice: 6484023064,
  fireTomePrice: 6514199998,
  dropBoost: 192,
  natureTomeLevel: 268,
  waterTomeLevel: 350,
  fireTomeLevel: 100,
  guildLevel: 2018,
  highestEnemy: 593213,
  dustCollector: 915,
  dustCodex: 202,
  dustEquipment: 264794,
  currentEnemy: 582813,
  workshopLevel: 650,
  constructionPetLevel: 11,
  constructionCodex: 100,
  buildSpeed: 1,
};

const SNAPSHOT_HOHMONO = {
  username: 'Hohmono',
  tax: 40,
  harvestPotion: 171000,
  resonancePotion: 57000,
  potDuration: 2163,
  bloomwellPrice: 127401,
  sagerootPrice: 118814,
  golems: 655000,
  fertilizer: 655000,
  plots: 655000,
  level: 98647,
  potionBoost: 245,
  baseRes: 22252.63,
  baseResResearch: 1363.127527699864,
  research: 44426660.256400004,
  averageResourcePrice: 33,
  farmDiscount: 2517333,
  spire: 1022,
  equipmentBaseRes: 11952.67,
  equipmentResearch: 956202.99,
  powerOrbPrice: 1332090000000,
  perfectOrbPrice: 2057801833446367,
  divineEssencePrice: 5148657047400,
  elementiumPrice: 14025550002,
  baseResAmount: 1030000,
  labLevel: 1000,
  shardBoost: 7579389,
  shardPrice: 13053,
  nexusLevel: 22130,
  natureTomePrice: 6732000000,
  waterTomePrice: 7034667743,
  fireTomePrice: 6998999997,
  dropBoost: 192,
  natureTomeLevel: 0,
  waterTomeLevel: 425,
  fireTomeLevel: 0,
  guildLevel: 2020,
  highestEnemy: 389000,
  dustCollector: 0,
  dustCodex: 92,
  dustEquipment: 0,
  currentEnemy: 389000,
  workshopLevel: 650,
  constructionPetLevel: 11,
  constructionCodex: 100,
  buildSpeed: 1,
};

const WORKBOOK_SNAPSHOTS = {
  emilia: SNAPSHOT_EMILIA,
  hohmono: SNAPSHOT_HOHMONO,
};

const $ = (id) => document.getElementById(id);
const form = $('settings-form');
const statusEl = $('status');
const sourceEl = $('source');
const updatedEl = $('updated');

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatUnit(value, divisor, suffix, decimals = 2) {
  if (!Number.isFinite(value)) return 'N/A';
  return `${(value / divisor).toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals })} ${suffix}`;
}

function fmtB(v) { return formatUnit(v, 1e9, 'B', 2); }
function fmtT(v) { return formatUnit(v, 1e12, 'T', 2); }
function fmtQ(v) { return formatUnit(v, 1e15, 'Q', 2); }
function fmtDays(v) {
  return Number.isFinite(v) ? `${v.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })} d` : 'N/A';
}
function fmtInt(v) { return Number.isFinite(v) ? Math.round(v).toLocaleString() : 'N/A'; }
function fmtPct(v) { return Number.isFinite(v) ? `${v.toLocaleString(undefined, { maximumFractionDigits: 3 })}%` : 'N/A'; }

function setMetric(id, value, formatter, signAware = false) {
  const el = $(id);
  el.textContent = formatter(value);
  el.classList.remove('positive', 'negative');
  if (signAware && Number.isFinite(value)) el.classList.add(value >= 0 ? 'positive' : 'negative');
}

function setRoi(prefix, values) {
  const entries = Object.entries(values).filter(([, v]) => Number.isFinite(v));
  const best = entries.length ? Math.min(...entries.map(([, v]) => v)) : null;
  for (const [key, value] of Object.entries(values)) {
    const el = $(`${prefix}-${key}`);
    if (!el) continue;
    el.textContent = fmtDays(value);
    el.closest('.roi-row')?.classList.toggle('best', Number.isFinite(value) && value === best);
  }
}

function render(data, result, sourceKind) {
  setMetric('b-left-bloom', result.battler.leftoverBloom, fmtB, true);
  setMetric('b-left-sage', result.battler.leftoverSage, fmtB, true);
  setMetric('b-dust', result.battler.leftoverSold, fmtT, true);
  setMetric('b-tax', result.battler.farmTax, fmtT, true);
  setMetric('b-md', result.battler.mdEarned, fmtQ, true);
  setMetric('b-total', result.battler.fullIncome, fmtT, true);

  setMetric('t-left-bloom', result.tser.leftoverBloom, fmtB, true);
  setMetric('t-left-sage', result.tser.leftoverSage, fmtB, true);
  setMetric('t-dust', result.tser.leftoverSold, fmtT, true);
  setMetric('t-tax', result.tser.farmTax, fmtT, true);
  setMetric('t-extra', result.tser.extraResValue, fmtT, true);
  setMetric('t-farm-pot', result.tser.farmPlusPotIncome, fmtT, true);
  setMetric('t-total', result.tser.fullIncome, fmtT, true);
  setMetric('t-best-pot', result.tser.bestPotion, fmtInt);
  setMetric('t-best-income', result.tser.bestIncome, fmtT, true);
  setMetric('t-loss', result.tser.lossFromCurrentPotion, fmtT, true);
  setMetric('t-loss-pct', result.tser.percentLoss, fmtPct, true);

  setRoi('b-roi', result.roi.battler);

  const tserRoi = { ...result.roi.tser };
  setRoi('t-roi', tserRoi);

  $('username-label').textContent = data.username || 'Player';
  sourceEl.textContent = sourceKind === 'live' ? 'Live Manarion API' : 'Workbook snapshot';
  sourceEl.dataset.kind = sourceKind;
  updatedEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const unresolved = [];
  if (!Number.isFinite(result.roi.tser.shards)) unresolved.push('Shard ROI');
  $('note').textContent = unresolved.length
    ? `${unresolved.join(' and ')} ${unresolved.length === 1 ? 'is' : 'are'} shown as N/A until its missing workbook logic is reconstructed.`
    : 'All displayed values are calculated dynamically.';
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
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
  };
}

function snapshotForInputs(inputs) {
  const key = (inputs.username || 'Emilia').trim().toLowerCase();
  const base = WORKBOOK_SNAPSHOTS[key];
  if (!base) return null;
  return {
    ...base,
    username: inputs.username || base.username,
    tax: inputs.tax,
    harvestPotion: inputs.harvestPotion,
    resonancePotion: inputs.resonancePotion,
  };
}

async function update() {
  const inputs = getInputs();
  if (!inputs.username) {
    statusEl.textContent = 'Enter a username.';
    statusEl.dataset.state = 'error';
    return;
  }

  const button = $('update-btn');
  button.disabled = true;
  button.textContent = 'Updating…';
  statusEl.textContent = 'Fetching player, market, and guild data…';
  statusEl.dataset.state = 'working';

  try {
    const live = await getLiveData(inputs);
    const result = Calc.calculate(live);
    render(live, result, 'live');
    statusEl.textContent = 'Updated from the live Manarion API.';
    statusEl.dataset.state = 'ok';
  } catch (error) {
    // GitHub Pages can only call the API directly if the API allows browser CORS.
    // The supplied workbook snapshot keeps the prototype usable while we test that.
    const snapshot = snapshotForInputs(inputs);
    if (snapshot) {
      render(snapshot, Calc.calculate(snapshot), 'snapshot');
      statusEl.textContent = `Live API request was blocked/unavailable; showing the ${snapshot.username} workbook snapshot. (${error.message})`;
      statusEl.dataset.state = 'warn';
    } else {
      statusEl.textContent = `Could not reach the Manarion API from this browser: ${error.message}`;
      statusEl.dataset.state = 'error';
    }
  } finally {
    button.disabled = false;
    button.textContent = 'Update';
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  update();
});

$('demo-btn').addEventListener('click', () => {
  $('username').value = 'Emilia';
  $('tax').value = '25';
  $('harvest').value = '120000';
  $('resonance').value = '62000';
  const snapshot = snapshotForInputs(getInputs());
  render(snapshot, Calc.calculate(snapshot), 'snapshot');
  statusEl.textContent = 'Loaded the workbook snapshot.';
  statusEl.dataset.state = 'ok';
});

// Show a useful first screen immediately.
const initial = snapshotForInputs(getInputs());
render(initial, Calc.calculate(initial), 'snapshot');
statusEl.textContent = 'Prototype loaded from the supplied workbook. Click Update to try the live API.';
statusEl.dataset.state = 'ok';
