(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ManarionApi = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SOURCES = [
    { label: 'Cloudflare API relay', baseUrl: 'https://emilia-manarion-api.emilia-manarion-api.workers.dev' },
    { label: 'direct Manarion API', baseUrl: 'https://api.manarion.com' },
  ];

  async function fetchJson(path) {
    const errors = [];
    for (const source of SOURCES) {
      try {
        const response = await fetch(`${source.baseUrl}${path}`, {
          cache: 'no-store', headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return await response.json();
      } catch (error) {
        errors.push(`${source.label} failed (${error.message})`);
      }
    }
    throw new Error(errors.join('; '));
  }

  async function fetchUnlockedStars(player, request = fetchJson) {
    // StarsUnlocked includes unassigned stars. Prefer the profile's current count
    // to the leaderboard, which can lag behind recent unlocks.
    const assignedStars = Object.values(player.Constellation || {}).reduce((sum, ranks) => (
      sum + (Number.isFinite(Number(ranks)) ? Math.max(0, Math.trunc(Number(ranks))) : 0)
    ), 0);
    if (Number.isSafeInteger(player.StarsUnlocked) && player.StarsUnlocked >= assignedStars) {
      return player.StarsUnlocked;
    }
    // Older profiles can still use the leaderboard for bonuses that need stars.
    if (![1, 2, 3, 44].some(id => Number(player.Constellation?.[id]) > 0)) return null;
    const params = new URLSearchParams({ page: '1', gameMode: player.GameMode === 1 ? '1' : '0' });
    if (Number.isSafeInteger(player.GuildID) && player.GuildID > 0) {
      params.set('guild', String(player.GuildID));
    }
    const name = String(player.Name || '').trim().toLowerCase();
    if (!name) return null;
    for (let page = 1; page <= 100; page++) {
      params.set('page', String(page));
      const data = await request(`/leaderboards/stars_unlocked?${params}`);
      if (!Array.isArray(data?.Entries) || !Number.isSafeInteger(data.TotalPages)) return null;
      const entry = data.Entries.find(row => String(row.Name || '').trim().toLowerCase() === name);
      if (entry) return Number.isSafeInteger(entry.Score) && entry.Score >= 0 ? entry.Score : null;
      if (page >= data.TotalPages) return null;
    }
    return null;
  }

  async function fetchPlayerInputs(username, request = fetchJson) {
    const [playerData, marketData, guilds] = await Promise.all([
      request(`/players/${encodeURIComponent(username.trim())}`),
      request('/market'),
      request('/guilds'),
    ]);
    let unlockedStars = null;
    try {
      unlockedStars = await fetchUnlockedStars(playerData, request);
    } catch (_) {
      // Preserve the main API results; normalization flags the assigned-star fallback.
    }
    return { playerData, marketData, guilds, unlockedStars };
  }

  return { fetchPlayerInputs, fetchUnlockedStars };
});
