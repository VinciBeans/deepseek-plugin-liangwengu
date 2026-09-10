/**
 * The menu's second block: this session's blended unit price.
 *
 * The session's own `tokenUsage` bucket mix is priced under the tier in force,
 * so a session with a high cache-hit share lands nearer the cache-hit rate and a
 * pure-output session lands exactly on the output rate. Memoized like the price
 * table: its inputs move when a token is billed, not when a second passes.
 */
import { memo } from 'react'
import {
  cacheHitRate,
  compositePerYiTokens,
  costYuan,
  formatCompactTokens,
  formatHitRate,
  formatMoney,
  lookupPricing,
  rateAt,
  tierLabel,
  totalTokens,
  type OfficialModel,
  type PriceTier,
  type RateRevision,
  type TokenBuckets,
} from './pricing'

export interface CompositeSectionProps {
  /** Cumulative session usage; undefined until the projection reports any. */
  readonly usage: TokenBuckets | undefined
  /** The model whose rates price this session. */
  readonly activeEntry: OfficialModel
  readonly revision: RateRevision
  readonly tier: PriceTier
  /** The Session's own model id, so the block can say when it is unpriced. */
  readonly sessionModelId: string | null
}

export const CompositeSection = memo(function CompositeSection({
  usage,
  activeEntry,
  revision,
  tier,
  sessionModelId,
}: CompositeSectionProps) {
  const rate = rateAt(activeEntry.pricing, revision.effectiveFrom, tier)
  const billed = usage !== undefined && totalTokens(usage) > 0
  const hit = usage === undefined ? null : cacheHitRate(usage)
  const composite = billed ? compositePerYiTokens(usage, rate) : null
  const cost = billed ? costYuan(usage, rate) : null
  const sessionPriced = lookupPricing(sessionModelId) !== undefined

  return (
    <>
      <div className="dsh-lwgu-head">
        <span className="dsh-lwgu-title">本会话综合单价</span>
      </div>
      {usage === undefined
        ? <div className="dsh-lwgu-note">当前会话暂无 token 用量数据。</div>
        : (
          <>
            <div className="dsh-lwgu-kv">
              <span>缓存命中率</span>
              <span>{hit === null ? '—' : `${formatHitRate(hit)}%`}</span>
            </div>
            <div className="dsh-lwgu-kv">
              <span>缓存读取</span>
              <span>{formatCompactTokens(usage.cacheReadTokens)}</span>
            </div>
            <div className="dsh-lwgu-kv">
              <span>未命中输入</span>
              <span>{formatCompactTokens(usage.uncachedInputTokens)}</span>
            </div>
            <div className="dsh-lwgu-kv">
              <span>输出</span>
              <span>{formatCompactTokens(usage.outputTokens)}</span>
            </div>
          </>
        )}
      <div className="dsh-lwgu-composite">
        <span className="dsh-lwgu-composite-value">
          {composite === null ? '—' : formatMoney(composite)}
        </span>
        <span className="dsh-lwgu-composite-unit">元 / 亿 tokens</span>
      </div>
      <div className="dsh-lwgu-note">
        按 {activeEntry.pricing.name} · {tierLabel(tier)}单价估算
        {cost !== null && <> · 按当前单价折算 ≈ ¥{formatMoney(cost)}</>}
      </div>
      {revision.effectiveFrom > 0 && (
        <div className="dsh-lwgu-note">
          整段会话用量统一按调价后单价折算，调价前的历史用量未分段还原。
        </div>
      )}
      {sessionModelId !== null && !sessionPriced && (
        <div className="dsh-lwgu-note">
          当前模型 {sessionModelId} 不在官方价目表中，已改用 {activeEntry.pricing.name} 计价；
          可点击上方模型行切换计价模型。
        </div>
      )}
    </>
  )
})
