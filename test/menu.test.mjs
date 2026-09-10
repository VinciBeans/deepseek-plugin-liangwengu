/**
 * Interaction test for the badge's detail menu.
 *
 * Drives the BUILT browser bundle (`lib/client.js`) through a real React root
 * in jsdom, so the shipped artifact and the real slot props are what is under
 * test — not a hand-mounted copy of the component.
 *
 * The pure pricing math lives in test/pricing.test.mjs; this file covers what
 * only a render can: the menu opening and closing, and the menu showing the
 * price revision in force at a given instant. The clock is faked to sit on
 * either side of the announced flash cut, so the switch is asserted
 * deterministically instead of depending on when the suite runs.
 *
 * The whole run is wrapped so a failing assertion still tears the jsdom window
 * down: the badge's per-second tick would otherwise keep the event loop alive
 * and turn a test failure into a hang.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { JSDOM } = require('jsdom')

// ── jsdom document ─────────────────────────────────────────────────────────
const dom = new JSDOM(
  '<!doctype html><html><body></body></html>',
  { url: 'http://localhost/', pretendToBeVisual: true },
)
const { window } = dom
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  globalThis[key] = window[key]
}
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true })
globalThis.IS_REACT_ACT_ENVIRONMENT = false

const react = require('react')
const jsxRuntime = require('react/jsx-runtime')
const { createRoot } = require('react-dom/client')

// ── load the shipped bundle the way the DSH shell does ─────────────────────
let registration
window.__ModuleLoader__ = { load: (reg) => { registration = reg } }
;(0, eval)(readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'))
assert.equal(registration.id, 'liangwengu', 'bundle registers under its package id')

const plugin = registration.factory((spec) => {
  if (spec === 'react') return react
  if (spec === 'react/jsx-runtime') return jsxRuntime
  throw new Error(`unresolved external: ${spec}`)
})

// ── faked balance route ────────────────────────────────────────────────────
// The badge polls the host's `/api/liangwengu.balance` on mount; answer it
// in-process so the render assertions never depend on a live DSH host.
const BALANCE_SNAPSHOT = {
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
let balanceCalls = 0
/** Build stamp the faked host reports; the mismatch scenario flips it. */
let hostBuild = plugin.BUILD_STAMP
globalThis.fetch = async () => {
  balanceCalls += 1
  return { ok: true, json: async () => ({ ok: true, build: hostBuild, value: BALANCE_SNAPSHOT }) }
}

// ── faked clock helper ─────────────────────────────────────────────────────
const REAL_DATE = Date

/** Freeze the ambient clock at `epochMs`; `null` restores the real one. */
function installClock(epochMs) {
  if (epochMs === null) {
    globalThis.Date = REAL_DATE
    window.Date = REAL_DATE
    return
  }
  class FakeDate extends REAL_DATE {
    constructor(...args) { if (args.length === 0) super(epochMs); else super(...args) }
    static now() { return epochMs }
  }
  FakeDate.UTC = REAL_DATE.UTC
  FakeDate.parse = REAL_DATE.parse
  globalThis.Date = FakeDate
  window.Date = FakeDate
}

/** Beijing peak/off-peak tier at an instant, mirroring the badge's rule. */
function tierAt(epochMs) {
  const beijing = epochMs + 8 * 3600 * 1000
  const minutes = Math.floor((beijing % 86400000) / 60000)
  const weekday = (Math.floor(beijing / 86400000) + 4) % 7
  const peak = weekday !== 0 && weekday !== 6
    && ((minutes >= 540 && minutes < 720) || (minutes >= 840 && minutes < 1080))
  return peak ? 'peak' : 'offPeak'
}

const tick = () => new Promise(resolve => setTimeout(resolve, 60))

/**
 * Wait until `predicate` holds, checking on each tick.
 *
 * The balance arrives from a poll that resolves asynchronously, so asserting on
 * it right after a mount is a race — it passed on a fast machine and failed on
 * CI, where the badge still read `余额 查询中…`. Counting attempts rather than
 * milliseconds keeps this correct while the badge's clock is frozen.
 */
async function waitFor(predicate, what, attempts = 50) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (predicate()) return
    await tick()
  }
  throw new Error(`timed out after ${attempts} ticks waiting for ${what}`)
}

// A failed assertion can leave a React root (and its per-second tick) alive,
// which would turn a test failure into a hang. Bound the run so CI fails fast.
const WATCHDOG_MS = 15_000
const watchdog = setTimeout(() => {
  console.error(`menu test: still running after ${WATCHDOG_MS}ms — a failed assertion left the event loop alive`)
  process.exit(1)
}, WATCHDOG_MS)
watchdog.unref()

const usage = {
  uncachedInputTokens: 1_000_000,
  cacheReadTokens: 9_000_000,
  cacheWriteTokens: 0,
  outputTokens: 1_000_000,
}
const projections = {
  tokenUsage: usage,
  modelSelection: {
    next: { provider: 'deepseek-official', model: 'deepseek-v4-flash' },
    lastUsed: null,
  },
}
const useProjection = key => projections[key]

/** Roots currently mounted, so teardown runs even when an assertion throws. */
const mounted = []

/** Mount the badge at a frozen instant and return its DOM handles. */
async function mount(epochMs, sessionId = 'session-a') {
  installClock(epochMs)
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  root.render(react.createElement(plugin.TimeSlotIndicator, { useProjection, sessionId }))
  await tick()
  mounted.push({ root, container })
  const button = container.querySelector('.dsh-liangwengu')
  assert.ok(button !== null, 'badge button rendered')
  return { root, container, button }
}

/** The menu row button whose first cell is exactly `name`. */
function modelRow(name) {
  const row = [...document.querySelectorAll('.dsh-lwgu-grid-row')]
    .find(candidate => candidate.firstElementChild?.textContent === name)
  assert.ok(row !== undefined, `menu row ${name} rendered`)
  return row
}

const flash = plugin.lookupPricing('deepseek-v4-flash')
const cut = plugin.FLASH_PRICE_CHANGE_AT
const bundleSource = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

try {
  // ── scenario 1: one hour BEFORE the announced flash cut (peak tier) ──────
  {
    const at = cut - 3600_000 // 2026-09-10 11:00 北京时间
    assert.equal(tierAt(at), 'peak')
    const expected = plugin.rateAt(flash, at, 'peak')
    const { button } = await mount(at)

    // One line, in this order: slot label · countdown | balance. The gaps around
    // the separators are CSS, so the text content itself has no spaces there.
    await waitFor(
      () => button.textContent.includes('余额 ￥110.00'),
      'the polled balance to reach the badge',
    )
    assert.match(
      button.textContent,
      /^当前时段：梁文(峰|谷)·剩余 \d{2}:\d{2}:\d{2}\|余额 ￥110\.00$/,
      'the badge reads as one line of label · countdown | balance',
    )
    assert.ok(balanceCalls > 0, 'mounting the badge starts the balance poll')
    assert.equal(button.getAttribute('aria-haspopup'), 'dialog')
    assert.equal(button.getAttribute('aria-expanded'), 'false')
    assert.ok(document.querySelector('.dsh-lwgu-panel') === null, 'menu starts closed')

    // A keyboard user reaches the badge with Tab; the menu must take focus from
    // there and give it back on close. (DOM nodes are compared as booleans: a
    // failing assert.equal on a React-owned node makes Node deep-inspect the
    // fiber and die with an allocation error instead of reporting.)
    button.focus()
    assert.ok(document.activeElement === button, 'the badge is focusable')
    button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    await tick()
    const panel = document.querySelector('.dsh-lwgu-panel')
    assert.ok(panel !== null, 'click opens the menu')
    assert.equal(button.getAttribute('aria-expanded'), 'true')
    assert.equal(panel.getAttribute('tabindex'), '-1', 'the panel is focusable without joining the tab order')
    assert.ok(document.activeElement === panel, 'opening the menu moves focus into it')
    const text = panel.textContent
    assert.ok(text.includes('DeepSeek 官方定价'), 'menu shows the pricing heading')
    assert.ok(text.includes('缓存命中') && text.includes('未命中') && text.includes('输出'), 'menu shows the rate columns')
    assert.ok(
      text.includes(plugin.formatRate(expected.cacheHit))
      && text.includes(plugin.formatRate(expected.cacheMiss))
      && text.includes(plugin.formatRate(expected.output)),
      `menu prices the pre-cut rates ${JSON.stringify(expected)}`,
    )
    assert.ok(text.includes('缓存命中率') && text.includes('90.0%'), 'menu shows the cache-hit rate')
    assert.ok(
      text.includes(plugin.formatMoney(plugin.compositePerYiTokens(usage, expected)))
      && text.includes('元 / 亿 tokens'),
      'menu shows the blended price for the pre-cut revision',
    )
    assert.ok(text.includes('2026-09-10 12:00 起 V4-Flash / V4-Flash-Vision / V4.1-Flash 调价'), 'menu announces the pending change for every affected model')
    // V4.1-Flash renders as its own row priced line-for-line with V4-Flash.
    const v41Cells = [...modelRow('V4.1-Flash').children].slice(1).map(cell => cell.textContent)
    const flashCells = [...modelRow('V4-Flash').children].slice(1).map(cell => cell.textContent)
    assert.deepEqual(v41Cells, flashCells, 'V4.1-Flash shows the same rates as V4-Flash')

    // ── the balance detail block sits at the very foot of the panel ────────
    assert.ok(text.includes('账户余额'), 'menu shows the balance heading')
    assert.ok(text.includes('CNY 总可用') && text.includes('￥110.00'), 'menu shows the total balance per currency')
    assert.ok(
      text.includes('未过期赠金 ￥0.00 · 充值余额 ￥110.00'),
      'menu splits granted and topped-up balance',
    )
    assert.ok(text.includes('可用：可调用'), 'menu reports whether the account can still call the API')
    assert.ok(text.includes('更新于'), 'menu reports when the amount was confirmed')
    // The build stamps are diagnostics, not content: a matching pair says nothing.
    assert.ok(!text.includes('构建'), 'a matching host build puts no field in the panel')
    assert.ok(!text.includes('不是同一份构建'), 'and no warning either')
    assert.ok(
      text.indexOf('账户余额') > text.indexOf('本会话综合单价'),
      'the balance block sits below the session blended price',
    )
    const refresh = panel.querySelector('.dsh-lwgu-refresh')
    assert.ok(refresh !== null, 'menu offers a manual balance refresh')
    const callsBeforeRefresh = balanceCalls
    refresh.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    await waitFor(() => balanceCalls > callsBeforeRefresh, 'the refresh button to poll again')

    // Outside pointerdown closes.
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.dispatchEvent(new window.Event('pointerdown', { bubbles: true }))
    await tick()
    assert.ok(document.querySelector('.dsh-lwgu-panel') === null, 'outside pointerdown closes the menu')
    assert.ok(document.activeElement === button, 'closing returns focus to the badge')
    outside.remove()
  }

  // ── scenario 2: a host of a different build is called out ────────────────
  {
    const at = cut - 3600_000
    const { button } = await mount(at)
    button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    await tick()
    hostBuild = 'deadbeef'
    const refresh = document.querySelector('.dsh-lwgu-refresh')
    refresh.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    await waitFor(
      () => document.querySelector('.dsh-lwgu-panel').textContent.includes('不是同一份构建'),
      'the mismatch warning to render',
    )
    const text = document.querySelector('.dsh-lwgu-panel').textContent
    assert.ok(
      text.includes('宿主半侧与前端不是同一份构建（宿主 deadbeef'),
      'a page talking to a differently-built host says so',
    )
    assert.ok(text.includes('重启 dsh web'), 'and says what to do about it')
    hostBuild = plugin.BUILD_STAMP
    // Close it: a panel left open would be the first `.dsh-lwgu-panel` the next
    // scenario queries, and it would assert against this scenario's clock.
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await tick()
    assert.ok(document.querySelector('.dsh-lwgu-panel') === null, 'the mismatch scenario closes its menu')
  }

  // ── scenario 2: one hour AFTER the cut (off-peak tier, new rates) ────────
  {
    const at = cut + 3600_000 // 2026-09-10 13:00 北京时间
    assert.equal(tierAt(at), 'offPeak')
    const expected = plugin.rateAt(flash, at, 'offPeak')
    assert.deepEqual(expected, { cacheHit: 0.02, cacheMiss: 1, output: 4 })
    const { button } = await mount(at)

    button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    await tick()
    const panel = document.querySelector('.dsh-lwgu-panel')
    assert.ok(panel !== null, 'click opens the menu')
    const text = panel.textContent
    assert.ok(
      text.includes(plugin.formatRate(expected.cacheHit))
      && text.includes(plugin.formatRate(expected.cacheMiss))
      && text.includes(plugin.formatRate(expected.output)),
      'menu switched to the post-cut rates',
    )
    assert.ok(text.includes('2026-09-10 12:00 起生效'), 'menu labels the effective revision')
    assert.ok(
      text.includes(plugin.formatMoney(plugin.compositePerYiTokens(usage, expected))),
      'menu shows the blended price for the post-cut revision',
    )

    // Escape closes.
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await tick()
    assert.ok(document.querySelector('.dsh-lwgu-panel') === null, 'Escape closes the menu')
  }

  // ── scenario 3: a picked model resets when the Session changes ───────────
  {
    const at = cut + 3600_000
    const { root, button } = await mount(at, 'session-a')
    button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    await tick()
    const pro = modelRow('V4-Pro')
    pro.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    await tick()
    assert.ok(pro.getAttribute('aria-pressed') === 'true', 'picked model becomes the priced one')

    root.render(react.createElement(plugin.TimeSlotIndicator, { useProjection, sessionId: 'session-b' }))
    await tick()
    assert.ok(modelRow('V4-Pro').getAttribute('aria-pressed') === 'false', 'picked model resets on Session change')
    assert.ok(modelRow('V4-Flash').getAttribute('aria-pressed') === 'true', 'priced model falls back to the Session model')
  }

  // ── artifact contracts ───────────────────────────────────────────────────
  assert.ok(bundleSource.includes('.dsh-liangwengu:hover'), 'bundle ships the hover deepening rule')
  assert.ok(bundleSource.includes('prefers-reduced-motion'), 'bundle respects reduced motion')
  assert.ok(!bundleSource.includes('require("react-dom")'), 'bundle keeps react/react/jsx-runtime as its only externals')
  // The `| 余额 …` segment is set at the slot label's own size, taken from one
  // token so the two cannot drift apart.
  assert.ok(bundleSource.includes('--lwgu-label-size: 12px'), 'the label size is a token')
  assert.match(
    bundleSource,
    /\.dsh-lwgu-balance \{[^}]*font-size: var\(--lwgu-label-size\)/,
    'the balance segment takes its size from the label token',
  )
} finally {
  installClock(null)
  for (const { root, container } of mounted) {
    try { root.unmount() } catch { /* the root may already be gone after a failure */ }
    container.remove()
  }
  dom.window.close()
}

console.log('menu test ok (pre-cut + post-cut render, open/outside-close/Escape, blended price, session-scoped picker reset)')
clearTimeout(watchdog)
