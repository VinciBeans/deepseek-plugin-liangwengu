/**
 * Pricing smoke test for the built DSH browser-half plugin.
 *
 * Loads lib/client.js through the same __ModuleLoader__ shape the DSH web
 * client uses, then checks the embedded official price table, the dated
 * revision resolution that switches price at the announced instant, and the
 * blended unit-price math that the badge's detail menu renders.
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
  OFFICIAL_MODELS, PRICING_SOURCE_URL, FLASH_PRICE_CHANGE_AT, lookupPricing,
  activeRevision, nextRevision, rateAt, formatBeijingDateTime, cacheHitRate,
  costYuan, compositePerYiTokens, totalTokens, formatRate, formatMoney,
  formatCompactTokens, formatHitRate,
} = plugin

// ── the embedded table matches the official price page ─────────────────────
assert.match(PRICING_SOURCE_URL, /^https:\/\/api-docs\.deepseek\.com\//)
assert.equal(OFFICIAL_MODELS.length, 4)
assert.deepEqual(OFFICIAL_MODELS.map(entry => entry.id), [
  'deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-v4-flash-vision-exp', 'deepseek-flash',
])

const BASE_FLASH = { cacheHit: 0.05, cacheMiss: 1.5, output: 4.5 }
const BASE_FLASH_PEAK = { cacheHit: 0.1, cacheMiss: 3, output: 9 }
const CUT_FLASH = { cacheHit: 0.02, cacheMiss: 1, output: 4 }
const CUT_FLASH_PEAK = { cacheHit: 0.04, cacheMiss: 2, output: 8 }

// The official rule: off-peak is exactly half of peak, on every revision.
for (const entry of OFFICIAL_MODELS) {
  for (const revision of entry.pricing.revisions) {
    for (const key of ['cacheHit', 'cacheMiss', 'output']) {
      assert.equal(revision.peak[key], revision.offPeak[key] * 2, `${entry.id}.${key}`)
    }
  }
}

// ── the announced flash change takes effect at 北京时间 2026-09-10 12:00 ─────
assert.equal(formatBeijingDateTime(FLASH_PRICE_CHANGE_AT), '2026-09-10 12:00')
assert.equal(FLASH_PRICE_CHANGE_AT, Date.UTC(2026, 8, 10, 4, 0, 0))
assert.equal(formatBeijingDateTime(0), '1970-01-01 08:00')

// ── lookup ─────────────────────────────────────────────────────────────────
assert.equal(lookupPricing('deepseek-v4-pro'), OFFICIAL_MODELS[1].pricing)
assert.equal(lookupPricing('deepseek-v4.1-flash-expires-on-0910'), undefined)
assert.equal(lookupPricing(null), undefined)
assert.equal(lookupPricing(undefined), undefined)

const flash = lookupPricing('deepseek-v4-flash')
const vision = lookupPricing('deepseek-v4-flash-vision-exp')
const pro = lookupPricing('deepseek-v4-pro')
const v41 = lookupPricing('deepseek-flash')
assert.equal(flash.revisions.length, 2)
assert.equal(vision.revisions.length, 2)
assert.equal(pro.revisions.length, 1)
assert.equal(v41.revisions.length, 2)

// ── revision resolution around the change instant ──────────────────────────
const before = FLASH_PRICE_CHANGE_AT - 1
const after = FLASH_PRICE_CHANGE_AT

assert.deepEqual(rateAt(flash, before, 'offPeak'), BASE_FLASH)
assert.deepEqual(rateAt(flash, before, 'peak'), BASE_FLASH_PEAK)
assert.deepEqual(rateAt(flash, after, 'offPeak'), CUT_FLASH)
assert.deepEqual(rateAt(flash, after, 'peak'), CUT_FLASH_PEAK)

// Inclusive boundary: the announced minute itself is already the new price.
assert.deepEqual(rateAt(flash, after, 'offPeak'), CUT_FLASH)
// Well after the cut, and far before it.
assert.deepEqual(rateAt(flash, Date.UTC(2030, 0, 1), 'offPeak'), CUT_FLASH)
assert.deepEqual(rateAt(flash, 0, 'offPeak'), BASE_FLASH)

assert.equal(activeRevision(flash, before), flash.revisions[0])
assert.equal(activeRevision(flash, after), flash.revisions[1])
assert.equal(nextRevision(flash, before), flash.revisions[1])
assert.equal(nextRevision(flash, after), undefined)

// Pro is not part of the flash-series change.
assert.equal(activeRevision(pro, after), pro.revisions[0])
assert.equal(nextRevision(pro, 0), undefined)
assert.deepEqual(rateAt(pro, after, 'offPeak'), { cacheHit: 0.15, cacheMiss: 4.5, output: 13.5 })

// The vision flash variant is part of the same cut.
assert.deepEqual(rateAt(vision, before, 'offPeak'), BASE_FLASH)
assert.deepEqual(rateAt(vision, after, 'offPeak'), CUT_FLASH)

// V4.1-Flash (provider id `deepseek-flash`) is priced line-for-line with the
// flash series, on both sides of the announced cut.
assert.deepEqual(rateAt(v41, 0, 'offPeak'), BASE_FLASH)
assert.deepEqual(rateAt(v41, before, 'offPeak'), BASE_FLASH)
assert.deepEqual(rateAt(v41, before, 'peak'), BASE_FLASH_PEAK)
assert.deepEqual(rateAt(v41, after, 'offPeak'), CUT_FLASH)
assert.deepEqual(rateAt(v41, after, 'peak'), CUT_FLASH_PEAK)
assert.equal(activeRevision(v41, before), v41.revisions[0])
assert.equal(activeRevision(v41, after), v41.revisions[1])
assert.equal(nextRevision(v41, before), v41.revisions[1])
assert.equal(nextRevision(v41, after), undefined)

// ── buckets and cache-hit rate ─────────────────────────────────────────────
const mix = { uncachedInputTokens: 1_000_000, cacheReadTokens: 9_000_000, cacheWriteTokens: 0, outputTokens: 1_000_000 }
assert.equal(totalTokens(mix), 11_000_000)
assert.equal(cacheHitRate(mix), 0.9)
assert.equal(cacheHitRate({ uncachedInputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 5 }), null)

// ── cost and blended price ─────────────────────────────────────────────────
// Before the cut: 1.5 + 9×0.05 + 4.5 = 6.45 元 → 58.6363… 元/亿
assert.equal(Number(costYuan(mix, BASE_FLASH).toFixed(6)), 6.45)
assert.equal(Number(compositePerYiTokens(mix, BASE_FLASH).toFixed(4)), 58.6364)
// After the cut: 1 + 9×0.02 + 4 = 5.18 元 → 47.0909… 元/亿
assert.equal(Number(costYuan(mix, CUT_FLASH).toFixed(6)), 5.18)
assert.equal(Number(compositePerYiTokens(mix, CUT_FLASH).toFixed(4)), 47.0909)

// A single-bucket session collapses to that bucket's own rate × 100.
const only = (bucket) => ({ uncachedInputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0, ...bucket })
assert.equal(compositePerYiTokens(only({ cacheReadTokens: 1_000_000 }), BASE_FLASH), 5)
assert.equal(compositePerYiTokens(only({ uncachedInputTokens: 1_000_000 }), BASE_FLASH), 150)
assert.equal(compositePerYiTokens(only({ outputTokens: 1_000_000 }), BASE_FLASH), 450)
// Cache writes are charged at the uncached-input rate (DeepSeek publishes no
// separate write price).
assert.equal(compositePerYiTokens(only({ cacheWriteTokens: 1_000_000 }), BASE_FLASH), 150)
// The cut prices those same buckets at the new rates.
assert.equal(compositePerYiTokens(only({ cacheReadTokens: 1_000_000 }), CUT_FLASH), 2)
assert.equal(compositePerYiTokens(only({ uncachedInputTokens: 1_000_000 }), CUT_FLASH), 100)
assert.equal(compositePerYiTokens(only({ outputTokens: 1_000_000 }), CUT_FLASH), 400)

// Pro peak is 10× flash off-peak on every line.
assert.equal(compositePerYiTokens(only({ uncachedInputTokens: 1_000_000 }), pro.revisions[0].peak), 900)
assert.equal(compositePerYiTokens(only({ cacheReadTokens: 1_000_000 }), pro.revisions[0].peak), 30)

// Nothing billed → 0, never NaN.
const empty = only({})
assert.equal(compositePerYiTokens(empty, BASE_FLASH), 0)
assert.equal(costYuan(empty, BASE_FLASH), 0)

// ── formatting ─────────────────────────────────────────────────────────────
assert.equal(formatRate(0), '0')
assert.equal(formatRate(0.02), '0.02')
assert.equal(formatRate(0.05), '0.05')
assert.equal(formatRate(1), '1')
assert.equal(formatRate(1.5), '1.5')
assert.equal(formatRate(4), '4')
assert.equal(formatRate(13.5), '13.5')
assert.equal(formatRate(27), '27')
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
  `pricing test ok (${OFFICIAL_MODELS.length} models + revision switch at ${formatBeijingDateTime(FLASH_PRICE_CHANGE_AT)} + ` +
  'lookup + cache-hit + cost + blended price + formatting cases)',
)
