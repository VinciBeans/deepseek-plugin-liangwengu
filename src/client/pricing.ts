/**
 * DeepSeek official token pricing and the blended unit-price math behind the
 * badge's detail menu.
 *
 * Every rate is 元 per million tokens, transcribed from the official price page
 * ({@link PRICING_SOURCE_URL}). The page's peak window — Beijing time
 * Mon–Fri 09:00–12:00 and 14:00–18:00, off-peak otherwise — is the same window
 * the badge already classifies as 梁文峰 / 梁文谷, so the menu reuses that
 * classification instead of keeping a second copy of the schedule.
 *
 * Prices are not one table but a list of dated revisions per model: an official
 * price change is recorded as a new {@link RateRevision} carrying the instant it
 * takes effect, and every read resolves the revision in force at that instant.
 * A running page therefore switches price automatically at the announced time
 * with no reload — the badge already re-renders once per second.
 */

/** The two official price tiers. */
export type PriceTier = 'peak' | 'offPeak'

/** Display name of a price tier, as the official page words it. */
export function tierLabel(tier: PriceTier): string {
  return tier === 'peak' ? '高峰时段' : '空闲时段'
}

/** One tier's rates, in 元 per million tokens. */
export interface TierRate {
  /** Cached input (缓存命中). */
  readonly cacheHit: number
  /** Uncached input (缓存未命中). */
  readonly cacheMiss: number
  /** Generated output (输出). */
  readonly output: number
}

/** One dated revision of a model's rates. */
export interface RateRevision {
  /**
   * UTC epoch ms at which these rates take effect, inclusive. `0` is the
   * original table and covers every earlier instant.
   */
  readonly effectiveFrom: number
  /** Off-peak (空闲时段) rates. */
  readonly offPeak: TierRate
  /** Peak (高峰时段) rates; the official rule is exactly twice {@link offPeak}. */
  readonly peak: TierRate
}

/** One officially priced model. */
export interface ModelPricing {
  /** Short display name used in the menu. */
  name: string
  /** Revisions in ascending `effectiveFrom` order; the first covers all earlier instants. */
  readonly revisions: readonly [RateRevision, ...RateRevision[]]
}

/** One entry of the embedded official table. */
export interface OfficialModel {
  /** Provider-owned model id. */
  readonly id: string
  /** Its price revisions. */
  readonly pricing: ModelPricing
}

/** The official price page these rates were transcribed from. */
export const PRICING_SOURCE_URL = 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing'

/** Date the base table was last transcribed from {@link PRICING_SOURCE_URL}. */
export const PRICING_UPDATED_AT = '2026-09-08'

/**
 * Instant the announced flash-series price change takes effect:
 * 北京时间 2026-09-10 12:00 (= 04:00 UTC, Asia/Shanghai being a fixed UTC+8).
 */
export const FLASH_PRICE_CHANGE_AT = Date.UTC(2026, 8, 10, 4, 0, 0)

/** One frozen tier's rates. */
function rate(cacheHit: number, cacheMiss: number, output: number): TierRate {
  return Object.freeze({ cacheHit, cacheMiss, output })
}

/** Rates in force before {@link FLASH_PRICE_CHANGE_AT}. */
const FLASH_BASE: RateRevision = Object.freeze({
  effectiveFrom: 0,
  offPeak: rate(0.05, 1.5, 4.5),
  peak: rate(0.1, 3, 9),
})

/**
 * The announced flash-series cut: 空闲时段 命中 0.02 / 未命中 1 / 输出 4 元 per
 * million tokens, with 高峰时段 exactly twice that.
 */
const FLASH_CUT: RateRevision = Object.freeze({
  effectiveFrom: FLASH_PRICE_CHANGE_AT,
  offPeak: rate(0.02, 1, 4),
  peak: rate(0.04, 2, 8),
})

/** The official table, in menu order. */
export const OFFICIAL_MODELS: readonly [OfficialModel, ...OfficialModel[]] = [
  {
    id: 'deepseek-v4-flash',
    pricing: { name: 'V4-Flash', revisions: [FLASH_BASE, FLASH_CUT] },
  },
  {
    id: 'deepseek-v4-pro',
    pricing: {
      name: 'V4-Pro',
      revisions: [{
        effectiveFrom: 0,
        offPeak: rate(0.15, 4.5, 13.5),
        peak: rate(0.3, 9, 27),
      }],
    },
  },
  {
    // The notice says "flash 系列"; the official page prices this vision variant
    // identically to deepseek-v4-flash, so it moves with the same revision.
    id: 'deepseek-v4-flash-vision-exp',
    pricing: { name: 'V4-Flash-Vision', revisions: [FLASH_BASE, FLASH_CUT] },
  },
  {
    // V4.1-Flash is priced line-for-line with the rest of the flash series, so
    // it reuses the same two revisions rather than copying their numbers: the
    // announced flash cut moves it as well.
    id: 'deepseek-flash',
    pricing: { name: 'V4.1-Flash', revisions: [FLASH_BASE, FLASH_CUT] },
  },
]

/**
 * Look one model id up in the official table.
 * @param modelId - provider-owned model id.
 * @returns its pricing (all revisions), or undefined when the id is not listed.
 */
export function lookupPricing(modelId: string | null | undefined): ModelPricing | undefined {
  if (modelId === null || modelId === undefined) return undefined
  return OFFICIAL_MODELS.find(entry => entry.id === modelId)?.pricing
}

/**
 * The revision in force at an instant.
 * @param pricing - the model's full revision list.
 * @param atMs - UTC epoch ms to resolve.
 * @returns the newest revision whose `effectiveFrom` has been reached; the
 * first revision when the instant predates every dated change.
 */
export function activeRevision(pricing: ModelPricing, atMs: number): RateRevision {
  let active = pricing.revisions[0]
  for (const revision of pricing.revisions) {
    if (revision.effectiveFrom > atMs) break
    active = revision
  }
  return active
}

/**
 * The next announced revision strictly after an instant.
 * @param pricing - the model's full revision list.
 * @param atMs - UTC epoch ms to look forward from.
 * @returns the upcoming revision, or undefined when none is scheduled.
 */
export function nextRevision(pricing: ModelPricing, atMs: number): RateRevision | undefined {
  return pricing.revisions.find(revision => revision.effectiveFrom > atMs)
}

/**
 * The rates in force for one tier at an instant.
 * @param pricing - the model's full revision list.
 * @param atMs - UTC epoch ms to resolve.
 * @param tier - peak or off-peak.
 * @returns the tier's per-million rates in 元.
 */
export function rateAt(pricing: ModelPricing, atMs: number, tier: PriceTier): TierRate {
  return activeRevision(pricing, atMs)[tier]
}

/** Beijing offset in ms: Asia/Shanghai is fixed at UTC+8 (no DST since 1991). */
export const BEIJING_OFFSET_MS = 8 * 3600 * 1000

/**
 * Format an instant as Beijing `YYYY-MM-DD HH:MM`.
 * @param epochMs - UTC epoch ms.
 * @returns the Beijing wall-clock label.
 */
export function formatBeijingDateTime(epochMs: number): string {
  const shifted = new Date(epochMs + BEIJING_OFFSET_MS)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
    + ` ${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`
}

/** The four disjoint provider-reported token buckets of one session. */
export interface TokenBuckets {
  uncachedInputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  outputTokens: number
}

/** Prompt-side billed input: the three disjoint input buckets. */
export function billedInputTokens(buckets: TokenBuckets): number {
  return buckets.uncachedInputTokens + buckets.cacheReadTokens + buckets.cacheWriteTokens
}

/** Every billed token: all input buckets plus output. */
export function totalTokens(buckets: TokenBuckets): number {
  return billedInputTokens(buckets) + buckets.outputTokens
}

/**
 * Cache-hit share of prompt-side input.
 * @param buckets - cumulative session buckets.
 * @returns a 0–1 ratio, or null when no prompt-side token was billed.
 */
export function cacheHitRate(buckets: TokenBuckets): number | null {
  const prompt = billedInputTokens(buckets)
  return prompt === 0 ? null : buckets.cacheReadTokens / prompt
}

/**
 * Cost of the given buckets under one tier.
 *
 * Cache writes are charged at the uncached-input rate: DeepSeek publishes no
 * separate cache-write price, and its usage never reports the bucket.
 * @param buckets - cumulative session buckets.
 * @param rate - the tier's per-million rates in 元.
 * @returns the cost in 元.
 */
export function costYuan(buckets: TokenBuckets, rate: TierRate): number {
  const cost = (
    buckets.uncachedInputTokens * rate.cacheMiss
    + buckets.cacheReadTokens * rate.cacheHit
    + buckets.cacheWriteTokens * rate.cacheMiss
    + buckets.outputTokens * rate.output
  ) / 1_000_000
  return cost
}

/**
 * Blended unit price: what one 亿 tokens of this session's mix costs.
 *
 * The mix is the session's own bucket proportions, so a higher cache-hit share
 * pulls the blended price toward the cache-hit rate.
 * @param buckets - cumulative session buckets.
 * @param rate - the tier's per-million rates in 元.
 * @returns 元 per 100 million tokens; 0 when nothing was billed.
 */
export function compositePerYiTokens(buckets: TokenBuckets, rate: TierRate): number {
  const total = totalTokens(buckets)
  if (total === 0) return 0
  return costYuan(buckets, rate) / total * 1e8
}

/** Price text: two decimals under 1 元, otherwise up to one. */
export function formatRate(value: number): string {
  if (value === 0) return '0'
  return value < 1 ? value.toFixed(2) : String(Math.round(value * 10) / 10)
}

/** Money text: two decimals, no currency symbol (元, or 元/亿 tokens for the blended price). */
export function formatMoney(value: number): string {
  return value.toFixed(2)
}

/** Compact token count: 517 / 12.2K / 517K / 1.2M. */
export function formatCompactTokens(value: number): string {
  if (value < 1_000) return String(value)
  const scaled = (candidate: number): string =>
    candidate >= 100 ? String(Math.round(candidate)) : String(Math.round(candidate * 10) / 10)
  if (value < 1_000_000) return `${scaled(value / 1_000)}K`
  return `${scaled(value / 1_000_000)}M`
}

/**
 * Cache-hit percentage text, honest about near-full hits.
 * @param rate - 0–1 ratio from {@link cacheHitRate}.
 * @returns one-decimal percentage text; a partial hit never rounds up to 100.
 */
export function formatHitRate(rate: number): string {
  if (rate >= 1) return '100'
  const tenths = Math.min(999, Math.round(rate * 1000))
  return (tenths / 10).toFixed(1)
}
