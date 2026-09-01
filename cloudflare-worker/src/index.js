const MANARION_API = 'https://api.manarion.com';
const SITE_ORIGINS = new Set([
  'https://velhosi.github.io',
]);
const LOCAL_ORIGIN = /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/;

function isAllowedOrigin(origin) {
  return !origin || SITE_ORIGINS.has(origin) || LOCAL_ORIGIN.test(origin);
}

function corsHeaders(origin) {
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  });

  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  return headers;
}

function jsonResponse(body, status, origin) {
  const headers = corsHeaders(origin);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers });
}

function upstreamUrl(pathname) {
  if (pathname === '/market' || pathname === '/guilds') {
    return `${MANARION_API}${pathname}`;
  }

  const playerMatch = pathname.match(/^\/players\/([^/]+)$/);
  if (!playerMatch) return null;

  try {
    const username = decodeURIComponent(playerMatch[1]).trim();
    if (!username || username.length > 100) return null;
    return `${MANARION_API}/players/${encodeURIComponent(username)}`;
  } catch (_) {
    return null;
  }
}

export default {
  async fetch(request) {
    const requestUrl = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (!isAllowedOrigin(origin)) {
      return jsonResponse({ error: 'Origin is not allowed.' }, 403, '');
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Method not allowed.' }, 405, origin);
    }

    if (requestUrl.pathname === '/') {
      return jsonResponse({
        service: 'Emilia Manarion API relay',
        status: 'ok',
        routes: ['/players/:username', '/market', '/guilds'],
      }, 200, origin);
    }

    const target = upstreamUrl(requestUrl.pathname);
    if (!target) {
      return jsonResponse({ error: 'Route not found.' }, 404, origin);
    }

    try {
      const upstream = await fetch(target, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const headers = corsHeaders(origin);
      headers.set(
        'Content-Type',
        upstream.headers.get('Content-Type') || 'application/json; charset=utf-8',
      );

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers,
      });
    } catch (error) {
      return jsonResponse({
        error: 'Manarion API request failed.',
        detail: error instanceof Error ? error.message : String(error),
      }, 502, origin);
    }
  },
};
