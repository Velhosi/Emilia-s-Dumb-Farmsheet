import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const SITE_ORIGIN = 'https://velhosi.github.io';
const originalFetch = globalThis.fetch;

function request(path, options = {}) {
  const headers = new Headers(options.headers);
  if (!headers.has('Origin')) headers.set('Origin', SITE_ORIGIN);
  return new Request(`https://worker.example${path}`, { ...options, headers });
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('proxies only the supported player route and adds site CORS', async () => {
  let fetchedUrl = '';
  globalThis.fetch = async (url) => {
    fetchedUrl = String(url);
    return Response.json({ Name: 'A Player' });
  };

  const response = await worker.fetch(request('/players/A%20Player'));

  assert.equal(fetchedUrl, 'https://api.manarion.com/players/A%20Player');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), SITE_ORIGIN);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { Name: 'A Player' });
});

test('proxies the market and guild list endpoints', async () => {
  const fetchedUrls = [];
  globalThis.fetch = async (url) => {
    fetchedUrls.push(String(url));
    return Response.json([]);
  };

  assert.equal((await worker.fetch(request('/market'))).status, 200);
  assert.equal((await worker.fetch(request('/guilds'))).status, 200);
  assert.deepEqual(fetchedUrls, [
    'https://api.manarion.com/market',
    'https://api.manarion.com/guilds',
  ]);
});

test('answers CORS preflight without contacting Manarion', async () => {
  globalThis.fetch = async () => assert.fail('preflight should not contact the upstream API');

  const response = await worker.fetch(request('/market', { method: 'OPTIONS' }));

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), SITE_ORIGIN);
  assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET, OPTIONS');
});

test('proxies stars unlocked with validated pagination, game mode, and guild filtering', async () => {
  let fetchedUrl;
  globalThis.fetch = async url => {
    fetchedUrl = String(url);
    return Response.json({ Entries: [{ Name: 'Hohmono', Score: 39 }], TotalPages: 2 });
  };
  const response = await worker.fetch(request('/leaderboards/stars_unlocked?page=2&gameMode=0&guild=5'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), SITE_ORIGIN);
  assert.equal(fetchedUrl, 'https://api.manarion.com/leaderboards/stars_unlocked?page=2&gameMode=0&guild=5');
  assert.equal((await response.json()).Entries[0].Score, 39);
});

test('rejects other leaderboards and unsupported star leaderboard parameters', async () => {
  globalThis.fetch = async () => assert.fail('invalid routes must not reach the API');
  for (const path of [
    '/leaderboards/battle', '/leaderboards/stars_unlocked?page=0',
    '/leaderboards/stars_unlocked?page=101', '/leaderboards/stars_unlocked?gameMode=2',
    '/leaderboards/stars_unlocked?guild=-1', '/leaderboards/stars_unlocked?apikey=example',
    '/leaderboards/stars_unlocked?page=1&page=2',
  ]) {
    assert.equal((await worker.fetch(request(path))).status, 404, path);
  }
});

test('rejects unsupported routes, methods, and browser origins', async () => {
  globalThis.fetch = async () => assert.fail('rejected requests should not contact the upstream API');

  assert.equal((await worker.fetch(request('/anything'))).status, 404);
  assert.equal((await worker.fetch(request('/market', { method: 'POST' }))).status, 405);
  assert.equal((await worker.fetch(request('/market', {
    headers: { Origin: 'https://unrelated.example' },
  }))).status, 403);
});

test('allows local browser previews and non-browser health checks', async () => {
  const local = await worker.fetch(new Request('https://worker.example/', {
    headers: { Origin: 'http://127.0.0.1:4173' },
  }));
  const noOrigin = await worker.fetch(new Request('https://worker.example/'));

  assert.equal(local.status, 200);
  assert.equal(local.headers.get('Access-Control-Allow-Origin'), 'http://127.0.0.1:4173');
  assert.equal(noOrigin.status, 200);
  assert.equal(noOrigin.headers.get('Access-Control-Allow-Origin'), null);
});
