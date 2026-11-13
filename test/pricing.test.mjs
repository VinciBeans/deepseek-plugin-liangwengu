/**
 * Pricing smoke test for the built DSH browser-half plugin.
 *
 * Loads lib/client.js through the same __ModuleLoader__ shape the DSH web
 * client uses, then checks the embedded official price table, the dated
 * revision resolution that switches price at a scheduled instant, the retired
 * model-name aliases, and the blended unit-price math that the badge's detail
 * menu renders.
 *
 * Rates are 元 per million tokens; the blended price is 元 per 亿 (100 million)
 * tokens, i.e. the session's own bucket mix priced under one tier.
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
  OFFICIAL_MODELS, PRICING_SOURCE_URL, LEGACY_MODEL_ALIASES, FALLBACK_MODEL_ID,
  canonicalModelId, lookupPricing,
  activeRevision, nextRevision, rateAt, formatBeijingDateTime, cacheHitRate,
  costYuan, compositePerYiTokens, totalTokens, formatRate, formatMoney,
  formatCompactTokens, formatHitRate,
} = plugin

// ── the embedded table matches the official price page ─────────────────────
assert.match(PRICING_SOURCE_URL, /^https:\/\/api-docs\.deepseek\.com\//)
// The page lists exactly two models: deepseek-flash (V4.1-Flash-1017) and
// deepseek-v4-pro. The retired flash names are aliases, not rows.
assert.equal(OFFICIAL_MODELS.length, 2)
assert.deepEqual(OFFICIAL_MODELS.map(entry => entry.id), ['deepseek-flash', 'deepseek-v4-pro'])
assert.deepEqual(OFFICIAL_MODELS.map(entry => entry.pricing.name), ['V4.1-Flash', 'V4-Pro'])
// The fallback is named, not positional: the array order is display order, and
// inserting a row must not silently change which model prices a session.
assert.deepEqual(
  OFFICIAL_MODELS.map(entry => entry.id).filter(id => id === FALLBACK_MODEL_ID),
  [FALLBACK_MODEL_ID],
  'FALLBACK_MODEL_ID names exactly one model in the table',
)

const FLASH_OFFPEAK = { cacheHit: 0.02, cacheMiss: 1, output: 4 }
const FLASH_PEAK = { cacheHit: 0.04, cacheMiss: 2, output: 8 }
const PRO_OFFPEAK = { cacheHit: 0.15, cacheMiss: 4.5, output: 13.5 }
const PRO_PEAK = { cacheHit: 0.3, cacheMiss: 9, output: 27 }

// The official rule: off-peak is exactly half of peak, on every revision.
for (const entry of OFFICIAL_MODELS) {
  for (const revision of entry.pricing.revisions) {
    for (const key of ['cacheHit', 'cacheMiss', 'output']) {
      assert.equal(revision.peak[key], revision.offPeak[key] * 2, `${entry.id}.${key}`)
    }
  }
}

// ── lookup, including the retired flash aliases ────────────────────────────
const flash = lookupPricing('deepseek-flash')
const pro = lookupPricing('deepseek-v4-pro')
assert.equal(flash.revisions.length, 1)
assert.equal(pro.revisions.length, 1)
assert.deepEqual(rateAt(flash, 0, 'offPeak'), FLASH_OFFPEAK)
assert.deepEqual(rateAt(flash, 0, 'peak'), FLASH_PEAK)
assert.deepEqual(rateAt(pro, 0, 'offPeak'), PRO_OFFPEAK)
assert.deepEqual(rateAt(pro, 0, 'peak'), PRO_PEAK)

assert.deepEqual(Object.keys(LEGACY_MODEL_ALIASES).sort(), [
  'deepseek-v4-flash', 'deepseek-v4-flash-vision-exp',
])
assert.equal(canonicalModelId('deepseek-flash'), 'deepseek-flash')
assert.equal(canonicalModelId('deepseek-v4-pro'), 'deepseek-v4-pro')
assert.equal(canonicalModelId('deepseek-v4-flash'), 'deepseek-flash')
assert.equal(canonicalModelId('deepseek-v4-flash-vision-exp'), 'deepseek-flash')
assert.equal(canonicalModelId('deepseek-chat'), undefined)
assert.equal(canonicalModelId(null), undefined)
assert.equal(canonicalModelId(undefined), undefined)
// Both retired names are served and billed as Flash, so they resolve to the
// same pricing object and the menu highlights the V4.1-Flash row.
assert.equal(lookupPricing('deepseek-v4-flash'), flash)
assert.equal(lookupPricing('deepseek-v4-flash-vision-exp'), flash)
assert.equal(lookupPricing('deepseek-chat'), undefined)

// ── revision resolution around a dated change ──────────────────────────────
// The current table has one revision per model; the dated-revision machinery is
// exercised on a synthetic table so a future announced change stays covered.
const CHANGE_AT = Date.UTC(2026, 8, 10, 4, 0, 0) // 北京时间 2026-09-10 12:00
assert.equal(formatBeijingDateTime(CHANGE_AT), '2026-09-10 12:00')
assert.equal(formatBeijingDateTime(0), '1970-01-01 08:00')

const synthetic = {
  name: 'Synthetic',
  revisions: [
    { effectiveFrom: 0, offPeak: { cacheHit: 1, cacheMiss: 2, output: 3 }, peak: { cacheHit: 2, cacheMiss: 4, output: 6 } },
    { effectiveFrom: CHANGE_AT, offPeak: { cacheHit: 0.5, cacheMiss: 1, output: 2 }, peak: { cacheHit: 1, cacheMiss: 2, output: 4 } },
  ],
}
const before = CHANGE_AT - 1
const after = CHANGE_AT
assert.equal(activeRevision(synthetic, before), synthetic.revisions[0])
assert.equal(activeRevision(synthetic, after), synthetic.revisions[1])
assert.equal(nextRevision(synthetic, before), synthetic.revisions[1])
assert.equal(nextRevision(synthetic, after), undefined)
assert.deepEqual(rateAt(synthetic, before, 'offPeak'), { cacheHit: 1, cacheMiss: 2, output: 3 })
assert.deepEqual(rateAt(synthetic, after, 'offPeak'), { cacheHit: 0.5, cacheMiss: 1, output: 2 })
assert.deepEqual(rateAt(synthetic, after, 'peak'), { cacheHit: 1, cacheMiss: 2, output: 4 })
// Inclusive boundary: the announced minute itself is already the new price.
assert.deepEqual(rateAt(synthetic, after, 'offPeak'), rateAt(synthetic, CHANGE_AT + 10_000, 'offPeak'))
// No scheduled change on the real table today.
assert.equal(nextRevision(flash, 0), undefined)
assert.equal(nextRevision(pro, 0), undefined)

// ── buckets and cache-hit rate ─────────────────────────────────────────────
const mix = { uncachedInputTokens: 1_000_000, cacheReadTokens: 9_000_000, cacheWriteTokens: 0, outputTokens: 1_000_000 }
assert.equal(totalTokens(mix), 11_000_000)
assert.equal(cacheHitRate(mix), 0.9)
assert.equal(cacheHitRate({ uncachedInputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 5 }), null)

// ── cost and blended price ─────────────────────────────────────────────────
// V4.1-Flash off-peak: 1 + 9×0.02 + 4 = 5.18 元 → 47.0909… 元/亿
assert.equal(Number(costYuan(mix, FLASH_OFFPEAK).toFixed(6)), 5.18)
assert.equal(Number(compositePerYiTokens(mix, FLASH_OFFPEAK).toFixed(4)), 47.0909)
// V4.1-Flash peak: 2 + 9×0.04 + 8 = 10.36 元 → 94.1818… 元/亿
assert.equal(Number(costYuan(mix, FLASH_PEAK).toFixed(6)), 10.36)
assert.equal(Number(compositePerYiTokens(mix, FLASH_PEAK).toFixed(4)), 94.1818)

// A single-bucket session collapses to that bucket's own rate × 100.
const only = (bucket) => ({ uncachedInputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0, ...bucket })
assert.equal(compositePerYiTokens(only({ cacheReadTokens: 1_000_000 }), FLASH_OFFPEAK), 2)
assert.equal(compositePerYiTokens(only({ uncachedInputTokens: 1_000_000 }), FLASH_OFFPEAK), 100)
assert.equal(compositePerYiTokens(only({ outputTokens: 1_000_000 }), FLASH_OFFPEAK), 400)
assert.equal(compositePerYiTokens(only({ cacheReadTokens: 1_000_000 }), FLASH_PEAK), 4)
// Cache writes are charged at the uncached-input rate (DeepSeek publishes no
// separate write price).
assert.equal(compositePerYiTokens(only({ cacheWriteTokens: 1_000_000 }), FLASH_OFFPEAK), 100)
// Pro peak is 10× flash off-peak on the cache-hit line and 9× on output.
assert.equal(compositePerYiTokens(only({ uncachedInputTokens: 1_000_000 }), PRO_PEAK), 900)
assert.equal(compositePerYiTokens(only({ cacheReadTokens: 1_000_000 }), PRO_PEAK), 30)
assert.equal(compositePerYiTokens(only({ outputTokens: 1_000_000 }), PRO_OFFPEAK), 1350)

// Nothing billed → 0, never NaN.
const empty = only({})
assert.equal(compositePerYiTokens(empty, FLASH_OFFPEAK), 0)
assert.equal(costYuan(empty, FLASH_OFFPEAK), 0)

// ── formatting ─────────────────────────────────────────────────────────────
assert.equal(formatRate(0), '0')
assert.equal(formatRate(0.02), '0.02')
assert.equal(formatRate(0.05), '0.05')
assert.equal(formatRate(1), '1')
assert.equal(formatRate(1.5), '1.5')
assert.equal(formatRate(4), '4')
assert.equal(formatRate(13.5), '13.5')
assert.equal(formatRate(27), '27')
// Values that are not numbers must read as "no figure", never as "NaN".
assert.equal(formatRate(Number.NaN), '—')
assert.equal(formatMoney(Number.NaN), '—')
assert.equal(formatMoney(Number.POSITIVE_INFINITY), '—')
assert.equal(formatCompactTokens(Number.NaN), '—')
assert.equal(formatMoney(47.09090), '47.09')
assert.equal(formatMoney(5.18), '5.18')
assert.equal(formatCompactTokens(517), '517')
assert.equal(formatCompactTokens(12_200), '12.2K')
assert.equal(formatCompactTokens(517_000), '517K')
assert.equal(formatCompactTokens(1_200_000), '1.2M')
assert.equal(formatHitRate(0.9), '90.0')
assert.equal(formatHitRate(0.99999), '99.9') // a partial hit must never read 100
assert.equal(formatHitRate(1), '100')
assert.equal(formatHitRate(0), '0.0')

console.log(
  `pricing test ok (${OFFICIAL_MODELS.length} models + ${Object.keys(LEGACY_MODEL_ALIASES).length} retired aliases + ` +
  'dated revision switch + cache-hit + cost + blended price + formatting cases)',
)
