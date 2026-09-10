/**
 * Host-half test for the built node plugin.
 *
 * Imports lib/index.js directly (the node half is plain ESM, not a module-table
 * factory) and drives `apply` against a fake Connection service, so the wire
 * contract the browser half depends on is asserted without a DSH process:
 * which exact route is registered, and what the route answers on success and on
 * every failure the menu can show.
 *
 * The balance route is only registered while the host half is loaded, and the
 * host half is imported once when `dsh web` boots — a stale host process (older
 * than lib/index.js) answers 404 on this path, which the browser half reports as
 * 「宿主通道不可用（HTTP 404）」.
 */
import assert from 'node:assert/strict'

const host = await import(new URL('../lib/index.js', import.meta.url).href)

assert.deepEqual(host.inject, ['connection'], 'the host half waits for Connection')

/** A fake host context recording every registered route. */
function makeCtx({ credentials, connection } = {}) {
  const registered = []
  const logged = []
  const ctx = {
    get: name => (name === 'credentials' ? credentials : undefined),
    connection: connection === undefined
      ? { fetch: { register: (route) => { registered.push(route); return () => {} } } }
      : connection,
    logger: { error: (...args) => { logged.push(args) } },
  }
  return { ctx, registered, logged }
}

const request = () => new Request('http://localhost/api/liangwengu.balance', { method: 'POST' })

// ── route registration shape ───────────────────────────────────────────────
{
  const { ctx, registered } = makeCtx()
  await host.apply(ctx, {})
  assert.equal(registered.length, 1, 'apply registers exactly one route')
  const route = registered[0]
  assert.equal(route.path, '/api/liangwengu.balance')
  assert.deepEqual(route.methods, ['POST'])
  assert.equal(route.requestBody, 'buffered')
  assert.equal(typeof route.fetch, 'function')
}

// ── success: the credential seam supplies the key, DeepSeek supplies amounts ─
{
  const seen = []
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    seen.push({ url: String(url), authorization: init.headers.Authorization })
    return new Response(JSON.stringify({
      is_available: true,
      balance_infos: [{
        currency: 'CNY',
        total_balance: '110.00',
        granted_balance: '0.00',
        topped_up_balance: '110.00',
      }],
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  try {
    const credentials = { resolve: async ref => (ref === 'MY_KEY' ? { value: 'sk-seam' } : undefined) }
    const { ctx, registered } = makeCtx({ credentials })
    await host.apply(ctx, { apiKeyEnv: 'MY_KEY', intervalMs: 7_000, lowBalanceThreshold: 3, baseUrl: 'https://example.test/' })
    const response = await registered[0].fetch(request())
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      ok: true,
      value: {
        isAvailable: true,
        entries: [{
          currency: 'CNY',
          totalBalance: '110.00',
          grantedBalance: '0.00',
          toppedUpBalance: '110.00',
        }],
        pollIntervalMs: 7_000,
        lowBalanceThreshold: 3,
      },
    })
    // A trailing slash on the configured origin must not double up.
    assert.equal(seen[0].url, 'https://example.test/user/balance')
    assert.equal(seen[0].authorization, 'Bearer sk-seam')
  } finally {
    globalThis.fetch = realFetch
  }
}

// ── success: no seam, the launch environment supplies the key ──────────────
{
  const realFetch = globalThis.fetch
  let authorization
  globalThis.fetch = async (_url, init) => {
    authorization = init.headers.Authorization
    return new Response(JSON.stringify({ is_available: true, balance_infos: [] }), { status: 200 })
  }
  const previous = process.env.LIANGWENGU_TEST_KEY
  process.env.LIANGWENGU_TEST_KEY = 'sk-env'
  try {
    const { ctx, registered } = makeCtx()
    await host.apply(ctx, { apiKeyEnv: 'LIANGWENGU_TEST_KEY' })
    const body = await (await registered[0].fetch(request())).json()
    assert.equal(body.ok, true)
    assert.deepEqual(body.value.entries, [])
    assert.equal(authorization, 'Bearer sk-env')
  } finally {
    globalThis.fetch = realFetch
    if (previous === undefined) delete process.env.LIANGWENGU_TEST_KEY
    else process.env.LIANGWENGU_TEST_KEY = previous
  }
}

// ── failures: the route answers 200 with a machine-readable code ───────────
{
  // No seam and no environment entry.
  const { ctx, registered } = makeCtx()
  await host.apply(ctx, { apiKeyEnv: 'LIANGWENGU_ABSENT_KEY' })
  const response = await registered[0].fetch(request())
  assert.equal(response.status, 200, 'failures ride a 200 body, not an HTTP error')
  const body = await response.json()
  assert.equal(body.ok, false)
  assert.equal(body.error.code, 'no-key')
  assert.match(body.error.message, /LIANGWENGU_ABSENT_KEY/)

  // A rejected key is classified, not surfaced as a generic transport error.
  const realFetch = globalThis.fetch
  globalThis.fetch = async () => new Response('nope', { status: 401 })
  try {
    const credentials = { resolve: async () => ({ value: 'sk-bad' }) }
    const ctxBad = makeCtx({ credentials })
    await host.apply(ctxBad.ctx, {})
    const bad = await (await ctxBad.registered[0].fetch(request())).json()
    assert.equal(bad.ok, false)
    assert.equal(bad.error.code, 'unauthorized')
  } finally {
    globalThis.fetch = realFetch
  }

  // A network failure is classified too.
  globalThis.fetch = async () => { throw new Error('socket hang up') }
  try {
    const credentials = { resolve: async () => ({ value: 'sk-any' }) }
    const ctxNet = makeCtx({ credentials })
    await host.apply(ctxNet.ctx, {})
    const net = await (await ctxNet.registered[0].fetch(request())).json()
    assert.equal(net.error.code, 'network')
  } finally {
    globalThis.fetch = realFetch
  }
}

// ── config defaults and clamping ───────────────────────────────────────────
{
  const credentials = { resolve: async () => ({ value: 'sk-any' }) }
  const realFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ is_available: true, balance_infos: [] }), { status: 200 })
  try {
    const { ctx, registered } = makeCtx({ credentials })
    // Below the 1s floor, a negative threshold and an empty origin all fall back.
    await host.apply(ctx, { intervalMs: 100, lowBalanceThreshold: -1, baseUrl: '', apiKeyEnv: '' })
    const body = await (await registered[0].fetch(request())).json()
    assert.equal(body.value.pollIntervalMs, 5_000)
    assert.equal(body.value.lowBalanceThreshold, 10)
  } finally {
    globalThis.fetch = realFetch
  }
}

// ── degradation: no Connection service means no route, and no throw ────────
{
  const { ctx, registered, logged } = makeCtx({ connection: undefined })
  delete ctx.connection
  await host.apply(ctx, {})
  assert.equal(registered.length, 0)
  assert.equal(logged.length, 1, 'the reason is logged once')
  assert.match(String(logged[0][0]), /connection service unavailable/)
}

console.log('host test ok (route registration + success via seam/env + failure codes + config defaults + degradation)')
