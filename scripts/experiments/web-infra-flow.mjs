import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';

// CDN·라우터의 HTTP 동작을 확인하는 모형입니다. 클라우드 제품 구현은 아닙니다.
const servers = [];
const counts = { origin: 0, api: 0 };
const cache = new Map();
const originToken = 'local-experiment-only';
async function listen(handler) {
  const server = createServer((req, res) => {
    Promise.resolve(handler(req, res)).catch((error) => {
      res.writeHead(500).end(String(error));
    });
  });
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}
function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    ...headers,
  });
  res.end(body);
}

try {
  const api = await listen((req, res) => {
    counts.api++;
    send(res, 200, JSON.stringify({ id: 42, name: 'Sample product' }));
  });
  const origin = await listen(async (req, res) => {
    counts.origin++;
    if (req.headers['x-demo-origin-token'] !== originToken) {
      return send(res, 403, 'Forbidden');
    }
    const url = new URL(req.url, 'http://local.invalid');
    if (url.pathname === '/old-products/42') {
      return send(res, 307, '', { location: '/products/42' });
    }
    if (url.pathname.startsWith('/auth/')) {
      // 내부 경로만 바꾸므로 브라우저가 다시 요청할 Location은 없습니다.
      return send(res, 200, `auth:${url.pathname.slice('/auth'.length)}`);
    }
    if (url.pathname === '/api/products/42') {
      const response = await fetch(api + '/products/42');
      return send(res, response.status, await response.text(), {
        'cache-control': 'no-store',
      });
    }
    if (url.pathname === '/account') {
      return send(res, 200, req.headers.cookie || 'anonymous', {
        'cache-control': 'private, no-store',
      });
    }
    if (url.pathname === '/products/42') {
      const product = await fetch(api + '/products/42').then((r) => r.json());
      const rsc = req.headers.rsc === '1';
      return send(
        res,
        200,
        rsc ? `RSC:${product.id}` : `<h1>${product.name}</h1>`,
        {
          'content-type': rsc ? 'text/x-component' : 'text/html; charset=utf-8',
          'cache-control': 'public, max-age=0, s-maxage=60',
          vary: 'RSC',
        },
      );
    }
    return send(res, 404, 'Not found');
  });
  const edge = await listen(async (req, res) => {
    // 차단을 캐시 조회 앞에 두어 HIT도 같은 검사를 거치게 합니다.
    if (req.headers['x-demo-block'] === '1') return send(res, 403, 'Blocked');
    const url = new URL(req.url, 'http://local.invalid');
    const naive = url.searchParams.has('naive');
    const key = naive
      ? url.pathname
      : `${url.pathname}${url.search}|rsc=${req.headers.rsc || '0'}`;
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return send(res, cached.status, cached.body, {
        ...cached.headers,
        'x-demo-cache': 'HIT',
      });
    }
    const response = await fetch(origin + req.url, {
      redirect: 'manual',
      headers: {
        'x-demo-origin-token': originToken,
        ...(req.headers.rsc ? { rsc: req.headers.rsc } : {}),
        ...(req.headers.cookie ? { cookie: req.headers.cookie } : {}),
      },
    });
    const body = await response.text();
    const headers = Object.fromEntries(
      ['content-type', 'cache-control', 'vary', 'location']
        .filter((name) => response.headers.has(name))
        .map((name) => [name, response.headers.get(name)]),
    );
    const policy = response.headers.get('cache-control') || '';
    // 공개 상품의 GET만 공유하고 개인 응답은 저장하지 않습니다.
    if (
      req.method === 'GET' &&
      response.status === 200 &&
      url.pathname === '/products/42' &&
      !/private|no-store/.test(policy)
    ) {
      cache.set(key, {
        status: response.status,
        body,
        headers,
        expires: Date.now() + 60_000,
      });
    }
    send(res, response.status, body, { ...headers, 'x-demo-cache': 'MISS' });
  });
  async function check(name, run) {
    await run();
    console.log(`PASS ${name}`);
  }
  await check('SSR MISS calls API; HIT skips origin and API', async () => {
    const first = await fetch(edge + '/products/42');
    assert.equal(first.headers.get('x-demo-cache'), 'MISS');
    assert.match(await first.text(), /Sample product/);
    const before = { ...counts };
    const second = await fetch(edge + '/products/42');
    assert.equal(second.headers.get('x-demo-cache'), 'HIT');
    await second.text();
    assert.deepEqual(counts, before);
  });
  await check('edge rejection runs even when cache is warm', async () => {
    const response = await fetch(edge + '/products/42', {
      headers: { 'x-demo-block': '1' },
    });
    assert.equal(response.status, 403);
    await response.text();
  });
  await check('direct origin request without token is rejected', async () => {
    const response = await fetch(origin + '/products/42');
    assert.equal(response.status, 403);
    await response.text();
  });
  await check('redirect returns 307 and Location', async () => {
    const response = await fetch(edge + '/old-products/42', {
      redirect: 'manual',
    });
    assert.equal(response.status, 307);
    assert.equal(response.headers.get('location'), '/products/42');
    await response.text();
  });
  await check('rewrite changes upstream path without Location', async () => {
    const response = await fetch(edge + '/auth/callback');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('location'), null);
    assert.equal(await response.text(), 'auth:/callback');
  });
  await check(
    'private responses are never shared between sessions',
    async () => {
      for (const user of ['alice', 'bob']) {
        const response = await fetch(edge + '/account', {
          headers: { cookie: `session=${user}` },
        });
        assert.equal(response.headers.get('x-demo-cache'), 'MISS');
        assert.equal(await response.text(), `session=${user}`);
      }
    },
  );
  await check('HTML and RSC variants use separate cache entries', async () => {
    const response = await fetch(edge + '/products/42?_rsc=demo', {
      headers: { rsc: '1' },
    });
    assert.equal(response.headers.get('content-type'), 'text/x-component');
    assert.equal(await response.text(), 'RSC:42');
    const html = await fetch(edge + '/products/42');
    assert.match(html.headers.get('content-type'), /text\/html/);
    await html.text();
  });
  await check('path-only cache reproduces HTML/RSC collision', async () => {
    cache.clear();
    await fetch(edge + '/products/42?naive=1').then((r) => r.text());
    const response = await fetch(edge + '/products/42?naive=1&_rsc=demo', {
      headers: { rsc: '1' },
    });
    assert.equal(response.headers.get('x-demo-cache'), 'HIT');
    assert.match(response.headers.get('content-type'), /text\/html/);
    await response.text();
  });
  await check(
    'same-origin API proxy makes a separate server request',
    async () => {
      const before = counts.api;
      const response = await fetch(edge + '/api/products/42');
      assert.equal((await response.json()).id, 42);
      assert.equal(counts.api, before + 1);
    },
  );
} finally {
  await Promise.all(
    servers.map(
      (server) =>
        new Promise((resolve) => {
          server.close(resolve);
          server.closeAllConnections();
        }),
    ),
  );
}
