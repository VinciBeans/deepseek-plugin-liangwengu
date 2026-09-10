/**
 * The menu's first block: the official price table, plus the note announcing
 * every scheduled price change and which models it moves.
 *
 * Memoized on purpose. The badge re-renders once per second for its countdown,
 * but this block only depends on the revision in force (a step function that
 * changes at announced instants), the current tier (twice a day) and the picked
 * model — so a second passing must not rebuild it.
 */
import { memo, useMemo } from 'react'
import {
  OFFICIAL_MODELS,
  PRICING_UPDATED_AT,
  formatBeijingDateTime,
  formatRate,
  nextRevision,
  rateAt,
  tierLabel,
  type PriceTier,
  type RateRevision,
} from './pricing'

export interface PricingTableProps {
  /** The revision in force for the priced model, and the instant this block reads the table at. */
  readonly revision: RateRevision
  readonly tier: PriceTier
  readonly activeModelId: string
  /** Pick a model to price the session with. */
  readonly onPick: (modelId: string) => void
}

export const PricingTable = memo(function PricingTable({
  revision,
  tier,
  activeModelId,
  onPick,
}: PricingTableProps) {
  // Revisions are step functions, so every instant inside the current window
  // yields the same rows and the same upcoming change. Reading at the window's
  // own start therefore keeps this block's inputs identical from second to
  // second instead of churning on the live clock.
  const at = revision.effectiveFrom

  const rows = useMemo(() => OFFICIAL_MODELS.map(entry => ({
    id: entry.id,
    name: entry.pricing.name,
    rate: rateAt(entry.pricing, at, tier),
  })), [at, tier])

  const upcoming = useMemo(() => {
    const groups = new Map<RateRevision, string[]>()
    for (const entry of OFFICIAL_MODELS) {
      const next = nextRevision(entry.pricing, at)
      if (next === undefined) continue
      groups.set(next, [...(groups.get(next) ?? []), entry.pricing.name])
    }
    return [...groups]
  }, [at])

  return (
    <>
      <div className="dsh-lwgu-head">
        <span className="dsh-lwgu-title">DeepSeek 官方定价</span>
        <span className="dsh-lwgu-tier">{tierLabel(tier)}</span>
      </div>
      <div className="dsh-lwgu-sub">
        元 / 百万 tokens · {revision.effectiveFrom === 0
          ? `价目表更新于 ${PRICING_UPDATED_AT}`
          : `${formatBeijingDateTime(revision.effectiveFrom)} 起生效`}
      </div>
      <div className="dsh-lwgu-rule" />
      <div className="dsh-lwgu-grid">
        <div className="dsh-lwgu-grid-head">
          <span>模型</span>
          <span>缓存命中</span>
          <span>未命中</span>
          <span>输出</span>
        </div>
        {rows.map(row => (
          <button
            key={row.id}
            type="button"
            className="dsh-lwgu-grid-row"
            aria-pressed={row.id === activeModelId}
            onClick={() => { onPick(row.id) }}
          >
            <span>{row.name}</span>
            <span>{formatRate(row.rate.cacheHit)}</span>
            <span>{formatRate(row.rate.cacheMiss)}</span>
            <span>{formatRate(row.rate.output)}</span>
          </button>
        ))}
      </div>
      {upcoming.map(([next, names]) => (
        <div className="dsh-lwgu-note" key={names[0]}>
          {formatBeijingDateTime(next.effectiveFrom)} 起 {names.join(' / ')} 调价：
          命中 {formatRate(next[tier].cacheHit)} / 未命中 {formatRate(next[tier].cacheMiss)}
          / 输出 {formatRate(next[tier].output)}（{tierLabel(tier)}）
        </div>
      ))}
    </>
  )
})
