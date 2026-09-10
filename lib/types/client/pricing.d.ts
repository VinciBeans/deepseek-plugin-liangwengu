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
export type PriceTier = 'peak' | 'offPeak';
/** Display name of a price tier, as the official page words it. */
export declare function tierLabel(tier: PriceTier): string;
/** One tier's rates, in 元 per million tokens. */
export interface TierRate {
    /** Cached input (缓存命中). */
    readonly cacheHit: number;
    /** Uncached input (缓存未命中). */
    readonly cacheMiss: number;
    /** Generated output (输出). */
    readonly output: number;
}
/** One dated revision of a model's rates. */
export interface RateRevision {
    /**
     * UTC epoch ms at which these rates take effect, inclusive. `0` is the
     * original table and covers every earlier instant.
     */
    readonly effectiveFrom: number;
    /** Off-peak (空闲时段) rates. */
    readonly offPeak: TierRate;
    /** Peak (高峰时段) rates; the official rule is exactly twice {@link offPeak}. */
    readonly peak: TierRate;
}
/** One officially priced model. */
export interface ModelPricing {
    /** Short display name used in the menu. */
    name: string;
    /** Revisions in ascending `effectiveFrom` order; the first covers all earlier instants. */
    readonly revisions: readonly [RateRevision, ...RateRevision[]];
}
/** One entry of the embedded official table. */
export interface OfficialModel {
    /** Provider-owned model id. */
    readonly id: string;
    /** Its price revisions. */
    readonly pricing: ModelPricing;
}
/** The official price page these rates were transcribed from. */
export declare const PRICING_SOURCE_URL = "https://api-docs.deepseek.com/zh-cn/quick_start/pricing";
/** Date the base table was last transcribed from {@link PRICING_SOURCE_URL}. */
export declare const PRICING_UPDATED_AT = "2026-09-08";
/**
 * Instant the announced flash-series price change takes effect:
 * 北京时间 2026-09-10 12:00 (= 04:00 UTC, Asia/Shanghai being a fixed UTC+8).
 */
export declare const FLASH_PRICE_CHANGE_AT: number;
/** The official table, in menu order. */
export declare const OFFICIAL_MODELS: readonly [OfficialModel, ...OfficialModel[]];
/**
 * Look one model id up in the official table.
 * @param modelId - provider-owned model id.
 * @returns its pricing (all revisions), or undefined when the id is not listed.
 */
export declare function lookupPricing(modelId: string | null | undefined): ModelPricing | undefined;
/**
 * The revision in force at an instant.
 * @param pricing - the model's full revision list.
 * @param atMs - UTC epoch ms to resolve.
 * @returns the newest revision whose `effectiveFrom` has been reached; the
 * first revision when the instant predates every dated change.
 */
export declare function activeRevision(pricing: ModelPricing, atMs: number): RateRevision;
/**
 * The next announced revision strictly after an instant.
 * @param pricing - the model's full revision list.
 * @param atMs - UTC epoch ms to look forward from.
 * @returns the upcoming revision, or undefined when none is scheduled.
 */
export declare function nextRevision(pricing: ModelPricing, atMs: number): RateRevision | undefined;
/**
 * The rates in force for one tier at an instant.
 * @param pricing - the model's full revision list.
 * @param atMs - UTC epoch ms to resolve.
 * @param tier - peak or off-peak.
 * @returns the tier's per-million rates in 元.
 */
export declare function rateAt(pricing: ModelPricing, atMs: number, tier: PriceTier): TierRate;
/** Beijing offset in ms: Asia/Shanghai is fixed at UTC+8 (no DST since 1991). */
export declare const BEIJING_OFFSET_MS: number;
/**
 * Format an instant as Beijing `YYYY-MM-DD HH:MM`.
 * @param epochMs - UTC epoch ms.
 * @returns the Beijing wall-clock label.
 */
export declare function formatBeijingDateTime(epochMs: number): string;
/** The four disjoint provider-reported token buckets of one session. */
export interface TokenBuckets {
    uncachedInputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    outputTokens: number;
}
/** Prompt-side billed input: the three disjoint input buckets. */
export declare function billedInputTokens(buckets: TokenBuckets): number;
/** Every billed token: all input buckets plus output. */
export declare function totalTokens(buckets: TokenBuckets): number;
/**
 * Cache-hit share of prompt-side input.
 * @param buckets - cumulative session buckets.
 * @returns a 0–1 ratio, or null when no prompt-side token was billed.
 */
export declare function cacheHitRate(buckets: TokenBuckets): number | null;
/**
 * Cost of the given buckets under one tier.
 *
 * Cache writes are charged at the uncached-input rate: DeepSeek publishes no
 * separate cache-write price, and its usage never reports the bucket.
 * @param buckets - cumulative session buckets.
 * @param rate - the tier's per-million rates in 元.
 * @returns the cost in 元.
 */
export declare function costYuan(buckets: TokenBuckets, rate: TierRate): number;
/**
 * Blended unit price: what one 亿 tokens of this session's mix costs.
 *
 * The mix is the session's own bucket proportions, so a higher cache-hit share
 * pulls the blended price toward the cache-hit rate.
 * @param buckets - cumulative session buckets.
 * @param rate - the tier's per-million rates in 元.
 * @returns 元 per 100 million tokens; 0 when nothing was billed.
 */
export declare function compositePerYiTokens(buckets: TokenBuckets, rate: TierRate): number;
/** Price text: two decimals under 1 元, otherwise up to one. */
export declare function formatRate(value: number): string;
/** Money text: two decimals, no currency symbol (元, or 元/亿 tokens for the blended price). */
export declare function formatMoney(value: number): string;
/** Compact token count: 517 / 12.2K / 517K / 1.2M. */
export declare function formatCompactTokens(value: number): string;
/**
 * Cache-hit percentage text, honest about near-full hits.
 * @param rate - 0–1 ratio from {@link cacheHitRate}.
 * @returns one-decimal percentage text; a partial hit never rounds up to 100.
 */
export declare function formatHitRate(rate: number): string;
