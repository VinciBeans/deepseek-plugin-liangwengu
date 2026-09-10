/**
 * Balance smoke test for the built DSH browser-half plugin.
 *
 * Loads lib/client.js through the same __ModuleLoader__ shape the DSH web
 * client uses, then checks the poller's scheduling rules, its state machine
 * (success adopts the host's knobs, failure keeps the last good snapshot), and
 * the display rules the badge and its menu read from that state.
 *
 * The transport is injected, so no wire and no timer is involved: `refresh()`
 * polls once and `acquire()`'s schedule is only asserted through
 * `nextPollDelayMs` plus the fact that a released store stops polling.
 */
import assert from 'node:assert/strict'
import { jsxRuntimeStub, reactDomStub, reactStub } from './react-stub.mjs'
let plugin
globalThis.window = {
  __ModuleLoader__: {
    load({ id, factory }) {
      const require = (spec) => {
        if (spec === 'react') return reactStub()
        if (spec === 'react/jsx-runtime') return jsxRuntimeStub
        if (spec === 'react-dom') return reactDomStub
        throw new Error(`unexpected require: ${spec}`)
      }
      plugin = factory(require)
    },
  },
}

await import(new URL('../lib/client.js', import.meta.url).href)

const {
  BALANCE_PATH, badgeBalanceText, balanceEmptyText, balanceErrorText, balanceTone,
  balanceUpdatedText, createBalanceStore, currencySign, formatBalanceEntries,
  isBalanceLow, isEntryLow, jitteredDelayMs, nextPollDelayMs,
} = plugin

/** Let a poll's promise chain (callStatus → state write) settle. */
const flush = () => new Promise(resolve => setTimeout(resolve, 0))

const SNAPSHOT = {
  isAvailable: true,
  entries: [{
    currency: 'CNY',
    totalBalance: '110.00',
    grantedBalance: '0.00',
    toppedUpBalance: '110.00',
  }],
  pollIntervalMs: 30_000,
  lowBalanceThreshold: 10,
}

// ── the route the host half registers ──────────────────────────────────────
assert.equal(BALANCE_PATH, '/api/liangwengu.balance')

// ── backoff ────────────────────────────────────────────────────────────────
// Healthy: the configured interval. Then max((k+1)×interval, k×10s), capped at tier 3.
assert.equal(nextPollDelayMs(0, 5_000), 5_000)
assert.equal(nextPollDelayMs(1, 5_000), 10_000)
assert.equal(nextPollDelayMs(2, 5_000), 20_000)
assert.equal(nextPollDelayMs(3, 5_000), 30_000)
assert.equal(nextPollDelayMs(9, 5_000), 30_000)
// A 30s interval is already past the 10s-per-tier floor.
assert.equal(nextPollDelayMs(1, 30_000), 60_000)
assert.equal(nextPollDelayMs(2, 30_000), 90_000)
assert.equal(nextPollDelayMs(3, 30_000), 120_000)

// ── jitter: ±10%, and never a phase that is not spread ─────────────────────
// Independent tabs must not poll in lockstep, but the spread stays bounded so
// the configured interval keeps meaning what it says.
assert.equal(jitteredDelayMs(5_000, () => 0), 4_500)
assert.equal(jitteredDelayMs(5_000, () => 0.5), 5_000)
assert.equal(jitteredDelayMs(5_000, () => 1), 5_500)
assert.equal(jitteredDelayMs(0, () => 0.5), 0)
assert.equal(jitteredDelayMs(4, () => 0.999), 4, 'a delay too small to spread is left alone')
for (const sample of [0, 0.25, 0.5, 0.75, 1]) {
  const jittered = jitteredDelayMs(30_000, () => sample)
  assert.ok(jittered >= 27_000 && jittered <= 33_000, `30s stays within ±10% (got ${jittered})`)
}

// ── currency and entry formatting ──────────────────────────────────────────
assert.equal(currencySign('CNY'), '¥')
assert.equal(currencySign('USD'), '$')
assert.equal(currencySign('EUR'), 'EUR ')
assert.equal(formatBalanceEntries(SNAPSHOT.entries), '¥110.00')
assert.equal(
  formatBalanceEntries([
    ...SNAPSHOT.entries,
    { currency: 'USD', totalBalance: '5.00', grantedBalance: '0.00', toppedUpBalance: '5.00' },
  ]),
  '¥110.00 · $5.00',
)
assert.equal(formatBalanceEntries([]), '')

// ── store: first success, then a failure that keeps the good snapshot ──────
{
  let calls = 0
  let answer = { ok: true, value: SNAPSHOT }
  const store = createBalanceStore(async () => { calls += 1; return answer })

  const cold = store.getSnapshot()
  assert.equal(cold.entries, undefined)
  assert.equal(cold.loading, false)
  assert.equal(cold.failureCount, 0)
  assert.equal(cold.pollIntervalMs, 5_000)
  assert.equal(cold.lowBalanceThreshold, 10)
  assert.equal(badgeBalanceText(cold), '—')
  assert.equal(balanceTone(cold), 'none')

  store.refresh()
  await flush()
  const warmed = store.getSnapshot()
  assert.equal(calls, 1)
  assert.equal(warmed.loading, false)
  assert.deepEqual(warmed.entries, SNAPSHOT.entries)
  assert.equal(warmed.isAvailable, true)
  assert.equal(typeof warmed.fetchedAt, 'number')
  assert.equal(warmed.failureCount, 0)
  assert.equal(warmed.lastError, undefined)
  // The host's knobs replace this plugin's defaults.
  assert.equal(warmed.pollIntervalMs, 30_000)
  assert.equal(badgeBalanceText(warmed), '¥110.00')
  assert.equal(balanceTone(warmed), 'ok')

  answer = { ok: false, error: { code: 'network', message: 'boom' } }
  store.refresh()
  await flush()
  const failed = store.getSnapshot()
  assert.equal(failed.failureCount, 1)
  assert.deepEqual(failed.lastError, { code: 'network', message: 'boom' })
  // Stale, not blank: the last good amount survives and is flagged.
  assert.deepEqual(failed.entries, SNAPSHOT.entries)
  assert.equal(badgeBalanceText(failed), '¥110.00 ⚠')
  assert.equal(balanceTone(failed), 'stale')

  answer = { ok: true, value: SNAPSHOT }
  store.refresh()
  await flush()
  assert.equal(store.getSnapshot().failureCount, 0)
  assert.equal(store.getSnapshot().lastError, undefined)
  assert.equal(balanceTone(store.getSnapshot()), 'ok')
}

// ── store: acquiring starts polling, releasing stops it ───────────────────
{
  let calls = 0
  const store = createBalanceStore(async () => { calls += 1; return { ok: true, value: SNAPSHOT } })
  const releaseFirst = store.acquire()
  await flush()
  assert.equal(calls, 1, 'the first acquire polls immediately')
  const releaseSecond = store.acquire()
  await flush()
  assert.equal(calls, 1, 'a second consumer shares the running poller')
  releaseSecond()
  await flush()
  assert.equal(calls, 1, 'polling continues while one consumer remains')
  releaseFirst()
  await flush()
  assert.equal(calls, 1, 'the last release stops the schedule')
  // Releasing twice is a no-op, not a broken reference count.
  releaseFirst()
  store.acquire()()
}

// ── states without data ────────────────────────────────────────────────────
{
  let answer = { ok: false, error: { code: 'no-key', message: 'no API key' } }
  const store = createBalanceStore(async () => answer)
  store.refresh()
  await flush()
  const missingKey = store.getSnapshot()
  assert.equal(badgeBalanceText(missingKey), '未配置密钥')
  assert.equal(balanceTone(missingKey), 'none')

  answer = { ok: false, error: { code: 'api', message: 'HTTP 500' } }
  store.refresh()
  await flush()
  assert.equal(badgeBalanceText(store.getSnapshot()), '查询失败')

  // Malformed answers are failures too, never a crash.
  const malformed = createBalanceStore(async () => ({ ok: true }))
  malformed.refresh()
  await flush()
  assert.equal(malformed.getSnapshot().failureCount, 1)
  assert.equal(malformed.getSnapshot().lastError?.code, 'api')
}

// ── low balance ────────────────────────────────────────────────────────────
{
  const entry = { currency: 'CNY', totalBalance: '3.20', grantedBalance: '3.20', toppedUpBalance: '0.00' }
  const low = {
    entries: [entry],
    isAvailable: true,
    fetchedAt: 0,
    loading: false,
    failureCount: 0,
    lastError: undefined,
    pollIntervalMs: 5_000,
    lowBalanceThreshold: 10,
  }
  assert.equal(isBalanceLow(low), true)
  assert.equal(balanceTone(low), 'low')
  assert.equal(badgeBalanceText(low), '¥3.20 ⚠')
  // At the threshold is not below it.
  assert.equal(isBalanceLow({ ...low, entries: [{ ...entry, totalBalance: '10.00' }] }), false)
  assert.equal(isEntryLow({ ...entry, totalBalance: '10.00' }, 10), false)
  // An unusable account alerts regardless of the amount.
  assert.equal(isBalanceLow({ ...low, entries: [{ ...entry, totalBalance: '999.00' }], isAvailable: false }), true)
  // A non-numeric amount cannot be judged, and must not be treated as zero.
  assert.equal(isBalanceLow({ ...low, entries: [{ ...entry, totalBalance: '—' }] }), false)
}

// ── menu detail text ───────────────────────────────────────────────────────
{
  const ready = {
    entries: SNAPSHOT.entries,
    isAvailable: true,
    fetchedAt: Date.UTC(2026, 8, 8, 4, 0, 0),
    loading: false,
    failureCount: 0,
    lastError: undefined,
    pollIntervalMs: 5_000,
    lowBalanceThreshold: 10,
  }
  assert.equal(balanceUpdatedText(ready), new Date(ready.fetchedAt).toLocaleTimeString())
  assert.equal(balanceUpdatedText({ ...ready, fetchedAt: undefined }), '尚未成功查询')
  assert.equal(balanceEmptyText({ ...ready, entries: [], loading: true }), '查询中…')
  assert.equal(balanceEmptyText({ ...ready, entries: [], loading: false }), '尚未查询到余额。')
  assert.equal(
    balanceEmptyText({ ...ready, entries: [], failureCount: 2, lastError: { code: 'network', message: 'socket hang up' } }),
    '无法连接 DeepSeek（socket hang up）',
  )

  // Every failure code gets its own explanation, and the wire message rides along.
  assert.match(balanceErrorText({ code: 'no-key' }), /未配置 API key/)
  assert.match(balanceErrorText({ code: 'unauthorized' }), /拒绝/)
  assert.match(balanceErrorText({ code: 'invalid-response', message: 'shape' }), /格式异常（shape）/)
  assert.match(balanceErrorText({ code: 'transport', message: 'HTTP 401' }), /宿主通道不可用（HTTP 401）/)
  assert.match(balanceErrorText({ code: 'api', message: 'HTTP 500' }), /DeepSeek 返回错误（HTTP 500）/)
}

console.log(
  'balance test ok (route + backoff + store success/failure/stale + acquire/release + low-balance + display states + menu detail text)',
)
