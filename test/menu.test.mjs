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

    assert.match(button.textContent, /当前时段：梁文(谷|峰)/, 'badge shows the slot label')
    assert.ok(button.textContent.includes('剩余'), 'badge shows the countdown')
    assert.equal(button.getAttribute('aria-haspopup'), 'dialog')
    assert.equal(button.getAttribute('aria-expanded'), 'false')
    assert.ok(document.querySelector('.dsh-lwgu-panel') === null, 'menu starts closed')

    button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    await tick()
    const panel = document.querySelector('.dsh-lwgu-panel')
    assert.ok(panel !== null, 'click opens the menu')
    assert.equal(button.getAttribute('aria-expanded'), 'true')
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

    // Outside pointerdown closes.
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.dispatchEvent(new window.Event('pointerdown', { bubbles: true }))
    await tick()
    assert.ok(document.querySelector('.dsh-lwgu-panel') === null, 'outside pointerdown closes the menu')
    outside.remove()
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
