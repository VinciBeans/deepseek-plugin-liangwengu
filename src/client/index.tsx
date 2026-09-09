/**
 * 梁文谷 — browser half.
 *
 * Renders a small badge at the top-right corner of the DeepSeek Harness Web
 * GUI showing the current official compute time-slot together with a live
 * countdown of the remaining time of that slot:
 *
 *   - workdays (Mon–Fri) 09:00–12:00 and 14:00–18:00 → 「当前时段：梁文峰」
 *   - all other times, incl. the whole weekend      → 「当前时段：梁文谷」
 *
 * 周末（周六/周日）全天为低谷期：谷期从周五 18:00 起连续运行到周一 09:00
 * 峰期开始，倒计时跨天计算（≥24h 时以 `X天 HH:MM:SS` 显示）。
 *
 * The time is always evaluated in Asia/Shanghai, regardless of the user's
 * local timezone. The countdown ticks once per second and both the label and
 * the remaining time flip immediately at every slot boundary without a
 * reload.
 *
 * Hovering the badge deepens its colours; clicking it opens a detail menu —
 * the same shape as DSH's own token-stat dialog — whose top half is the
 * official DeepSeek price table and whose bottom half is this session's
 * blended unit price in 元 per 亿 tokens, computed from the session's own
 * cache-hit mix under the current slot's rates. Clicking anywhere outside the
 * badge or the menu, or pressing Escape, closes it.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pull the `slots` service declaration (Context augmentation) from
// ui-renderer and the SlotMap merges declaring the conversation header slots
// (ui-conversation) used below. All are erased before bundling — the browser
// bundle only requires the baseline platform words (react / react/jsx-runtime).
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: merge the `tokenUsage` and `modelSelection` session projections
// into SessionProjectionMap so the slot-supplied useProjection reads them.
import type {} from '@deepseek-ai/dsh-token-meter/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/types'
import {
  activeRevision,
  BEIJING_OFFSET_MS,
  cacheHitRate,
  compositePerYiTokens,
  costYuan,
  formatBeijingDateTime,
  formatCompactTokens,
  formatHitRate,
  formatMoney,
  formatRate,
  lookupPricing,
  nextRevision,
  OFFICIAL_MODELS,
  PRICING_UPDATED_AT,
  rateAt,
  totalTokens,
  type PriceTier,
  type RateRevision,
} from './pricing'

// ── time-slot logic ───────────────────────────────────────────────────────

const DAY_MS = 86400000

/**
 * Workday peak slots, in Beijing local minutes:
 * [09:00, 12:00) and [14:00, 18:00). Weekends have no peak slots at all.
 */
const PEAK_SLOTS: ReadonlyArray<readonly [number, number]> = [
  [9 * 60, 12 * 60],
  [14 * 60, 18 * 60],
]

/**
 * Beijing-time day index: 0 = 1970-01-01 (a Thursday). Pure UTC arithmetic
 * is safe because Asia/Shanghai is fixed at UTC+8.
 */
function getBeijingDayIndex(date: Date): number {
  return Math.floor((date.getTime() + BEIJING_OFFSET_MS) / DAY_MS)
}

/**
 * Beijing weekday: 0 = Sunday ... 6 = Saturday. Weekends (Sat/Sun) are
 * off-peak valley all day; workdays keep the original peak schedule.
 */
export function getBeijingWeekday(date: Date): number {
  return (getBeijingDayIndex(date) + 4) % 7
}

/**
 * Get the current Beijing wall-clock time as seconds since midnight.
 * Asia/Shanghai is a fixed UTC+8 (no DST since 1991), so this is pure
 * arithmetic on the epoch ms — no Intl formatter per tick, and it stays
 * correct regardless of the browser's own timezone.
 */
export function getBeijingSeconds(date: Date): number {
  const ms = date.getTime() + BEIJING_OFFSET_MS
  return Math.floor((ms % DAY_MS) / 1000)
}

/** Minutes since Beijing midnight, on the same wall clock as {@link getBeijingSeconds}. */
function getBeijingMinutes(date: Date): number {
  return Math.floor(getBeijingSeconds(date) / 60)
}

/** Whether the instant falls in a peak slot (workday 09:00–12:00 / 14:00–18:00). */
function isPeakMoment(date: Date): boolean {
  const weekday = getBeijingWeekday(date)
  if (weekday === 0 || weekday === 6) return false
  const minutes = getBeijingMinutes(date)
  return PEAK_SLOTS.some(([start, end]) => minutes >= start && minutes < end)
}

/** Return the badge text for a given instant. */
export function getSlotLabel(date: Date): string {
  return isPeakMoment(date) ? '当前时段：梁文峰' : '当前时段：梁文谷'
}

/**
 * UTC timestamp of the next peak-slot start: the first workday 09:00 or
 * 14:00 strictly after the given instant. During the weekend valley this
 * resolves to Monday 09:00.
 */
function getNextPeakStartMs(date: Date): number {
  const ms = date.getTime()
  const dayIndex = getBeijingDayIndex(date)
  const dayStartMs = dayIndex * DAY_MS - BEIJING_OFFSET_MS
  for (let offset = 0; offset < 8; offset += 1) {
    const weekday = (dayIndex + offset + 4) % 7
    if (weekday === 0 || weekday === 6) continue
    for (const [start] of PEAK_SLOTS) {
      const candidate = dayStartMs + offset * DAY_MS + start * 60 * 1000
      if (candidate > ms) return candidate
    }
  }
  return ms // unreachable: within 8 days there is always a workday
}

/**
 * Seconds until the current peak/valley slot ends, for a given instant.
 * A peak ends at the same day's 12:00 or 18:00; a valley runs continuously
 * until the next peak start (Friday-evening and weekend valleys therefore
 * end at Monday 09:00).
 */
export function getSlotRemaining(date: Date): number {
  if (isPeakMoment(date)) {
    const seconds = getBeijingSeconds(date)
    const end = seconds < 12 * 3600 ? 12 * 3600 : 18 * 3600
    return end - seconds
  }
  return Math.ceil((getNextPeakStartMs(date) - date.getTime()) / 1000)
}

/** Format a second countdown as HH:MM:SS, or `Xd HH:MM:SS` when ≥ 24h. */
export function formatCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds))
  const days = Math.floor(clamped / 86400)
  const hours = Math.floor((clamped % 86400) / 3600)
  const minutes = Math.floor((clamped % 3600) / 60)
  const seconds = clamped % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  const time = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  return days > 0 ? `${days}天 ${time}` : time
}

// ── badge visual ──────────────────────────────────────────────────────────

/** The official price tier the badge's current instant falls in. */
function tierOf(date: Date): PriceTier {
  return isPeakMoment(date) ? 'peak' : 'offPeak'
}

/** Human label for a price tier. */
function tierLabel(tier: PriceTier): string {
  return tier === 'peak' ? '高峰时段' : '空闲时段'
}

const STYLE = `
  .dsh-liangwengu-anchor { display: inline-flex; flex: none; position: relative; }
  .dsh-liangwengu, .dsh-lwgu-panel {
    --lwgu-bg: var(--dsw-alias-bg-layer-1, #ffffff);
    --lwgu-panel-bg: var(--dsw-alias-bg-layer-2, #ffffff);
    --lwgu-border: var(--dsw-alias-border-l1, rgba(0,0,0,0.12));
    --lwgu-text: var(--dsw-alias-label-primary, #222);
    --lwgu-sub: var(--dsw-alias-label-secondary, #8a8f99);
    --lwgu-dim: var(--dsw-alias-label-caption, #9ca3af);
    --lwgu-rule: var(--dsw-alias-border-l2, rgba(0,0,0,0.1));
    --lwgu-hover: var(--dsw-alias-interactive-bg-hover-solid, #f1f3f5);
    --lwgu-active-bg: var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,0.06));
    --lwgu-accent: var(--dsw-alias-link, #4176e6);
    --lwgu-shadow: 0 1px 4px rgba(0,0,0,0.06);
    --lwgu-panel-shadow: 0 8px 28px rgba(0,0,0,0.16);
    --lwgu-peak: var(--dsw-alias-state-success-primary, #22c55e);
    --lwgu-off: var(--dsw-alias-label-caption, #9ca3af);
  }
  body[data-ds-dark-theme] .dsh-liangwengu,
  body[data-ds-dark-theme] .dsh-lwgu-panel {
    --lwgu-bg: #17181c;
    --lwgu-panel-bg: #1c1d22;
    --lwgu-border: rgba(255,255,255,0.14);
    --lwgu-text: #e8e8ea;
    --lwgu-sub: #9aa0aa;
    --lwgu-dim: #71717a;
    --lwgu-rule: rgba(255,255,255,0.12);
    --lwgu-hover: #23242a;
    --lwgu-active-bg: rgba(255,255,255,0.08);
    --lwgu-accent: #6f9bff;
    --lwgu-shadow: 0 1px 6px rgba(0,0,0,0.5);
    --lwgu-panel-shadow: 0 10px 32px rgba(0,0,0,0.6);
    --lwgu-peak: #4ade80;
    --lwgu-off: #71717a;
  }
  .dsh-liangwengu {
    display: flex;
    flex: none;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    margin: 0;
    padding: 3px 10px;
    border-radius: 14px;
    background: var(--lwgu-bg);
    border: 1px solid var(--lwgu-border);
    box-shadow: var(--lwgu-shadow);
    color: var(--lwgu-text);
    font-family: inherit;
    font-size: 12px;
    line-height: 15px;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease;
  }
  .dsh-liangwengu:hover { background: var(--lwgu-hover); border-color: var(--lwgu-rule); }
  .dsh-liangwengu:focus-visible { outline: 2px solid var(--lwgu-accent); outline-offset: 1px; }
  .dsh-lwgu-line { display: inline-flex; align-items: center; gap: 6px; }
  .dsh-lwgu-dot {
    width: 7px; height: 7px; border-radius: 50%; flex: none;
    background: var(--lwgu-off);
  }
  .dsh-lwgu-dot[data-peak="true"] { background: var(--lwgu-peak); }
  .dsh-lwgu-countdown {
    padding-left: 13px;
    font-size: 10px;
    line-height: 12px;
    color: var(--lwgu-sub);
    font-weight: 400;
    font-variant-numeric: tabular-nums;
  }
  .dsh-lwgu-sr {
    position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
    overflow: hidden; clip-path: inset(50%); white-space: nowrap;
  }
  .dsh-lwgu-panel {
    position: fixed; z-index: 2147483000; box-sizing: border-box; width: 300px;
    padding: 12px 14px 14px; border-radius: 12px;
    background: var(--lwgu-panel-bg);
    border: 1px solid var(--lwgu-border);
    box-shadow: var(--lwgu-panel-shadow);
    color: var(--lwgu-text);
    font-size: 12px; line-height: 16px;
  }
  .dsh-lwgu-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .dsh-lwgu-title { font-size: 12px; font-weight: 600; }
  .dsh-lwgu-tier { color: var(--lwgu-sub); font-size: 11px; }
  .dsh-lwgu-sub { margin-top: 2px; color: var(--lwgu-dim); font-size: 10px; line-height: 14px; }
  .dsh-lwgu-rule { height: 1px; margin: 10px 0; background: var(--lwgu-rule); }
  .dsh-lwgu-grid { display: grid; gap: 2px; }
  .dsh-lwgu-grid-head, .dsh-lwgu-grid-row {
    display: grid; grid-template-columns: minmax(0,1fr) 52px 52px 44px;
    align-items: center; gap: 4px;
  }
  .dsh-lwgu-grid-head { padding: 0 6px 4px; color: var(--lwgu-dim); font-size: 10px; font-weight: 400; }
  .dsh-lwgu-grid-head span:not(:first-child), .dsh-lwgu-grid-row span:not(:first-child) {
    text-align: right; font-variant-numeric: tabular-nums;
  }
  .dsh-lwgu-grid-row {
    margin: 0; padding: 5px 6px; border: none; border-radius: 7px;
    background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer;
  }
  .dsh-lwgu-grid-row:hover { background: var(--lwgu-active-bg); }
  .dsh-lwgu-grid-row[aria-pressed="true"] { background: var(--lwgu-active-bg); font-weight: 600; }
  .dsh-lwgu-kv { display: flex; justify-content: space-between; gap: 12px; }
  .dsh-lwgu-kv span:last-child { font-variant-numeric: tabular-nums; }
  .dsh-lwgu-composite { display: flex; align-items: baseline; gap: 6px; margin-top: 8px; }
  .dsh-lwgu-composite-value {
    color: var(--lwgu-accent);
    font-size: 22px; line-height: 26px; font-weight: 600; font-variant-numeric: tabular-nums;
  }
  .dsh-lwgu-composite-unit { color: var(--lwgu-sub); font-size: 11px; }
  .dsh-lwgu-note { margin-top: 6px; color: var(--lwgu-dim); font-size: 10px; line-height: 14px; }
  @media (prefers-reduced-motion: reduce) {
    .dsh-liangwengu { transition: none; }
  }
`

/** Slot-supplied props: the session projection read seat. */
type IndicatorProps = PropsRuntime<'conversation.session.header.utilities'>

/**
 * The time-slot capsule, mounted inside the session header's utilities row —
 * directly left of the export-session button (order: -1 < the button's 0).
 * It is a normal in-flow element, so it never floats over or blocks any UI;
 * it ticks once per second (re-synced to the second boundary), so the
 * countdown is live and slot changes appear promptly. Clicking it opens the
 * price detail menu described in the module doc.
 * @param props - slot runtime props; only the projection hook is used.
 */
export function TimeSlotIndicator({ useProjection, sessionId }: IndicatorProps) {
  const [now, setNow] = useState(() => new Date())
  const [open, setOpen] = useState(false)
  const [pickedModelId, setPickedModelId] = useState<string | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  // A pricing model picked for one Session must not leak into the next one.
  useEffect(() => { setPickedModelId(null) }, [sessionId])

  useEffect(() => {
    let timer: number

    const scheduleNextTick = () => {
      // Align every tick to the next whole second boundary; the countdown
      // itself comes from the Beijing wall clock, so it stays timezone-safe.
      const delay = Math.max(50, 1000 - new Date().getMilliseconds())
      timer = window.setTimeout(() => {
        setNow(new Date())
        scheduleNextTick()
      }, delay)
    }

    scheduleNextTick()
    return () => window.clearTimeout(timer)
  }, [])

  // Place the fixed-position panel under the badge, clamped into the viewport;
  // the first pass runs unpositioned (hidden) so its own size is measured.
  // DSH keeps portal-free `position: fixed` descendants working (no ancestor
  // transform / container-type), so no portal is needed here.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    const place = (): void => {
      const anchor = anchorRef.current
      const panel = panelRef.current
      if (anchor === null || panel === null) return
      const rect = anchor.getBoundingClientRect()
      const margin = 12
      const gap = 8
      const left = Math.min(
        Math.max(margin, rect.right - panel.offsetWidth),
        window.innerWidth - panel.offsetWidth - margin,
      )
      let top = rect.bottom + gap
      if (top + panel.offsetHeight > window.innerHeight - margin) {
        top = Math.max(margin, rect.top - gap - panel.offsetHeight)
      }
      setPos({ left, top })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  // Outside pointerdown and Escape close, exactly as DSH's own stat dialog.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node | null
      if (target === null) return
      if (anchorRef.current?.contains(target) === true) return
      if (panelRef.current?.contains(target) === true) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const label = getSlotLabel(now)
  const countdown = formatCountdown(getSlotRemaining(now))
  const peak = isPeakMoment(now)
  const tier = tierOf(now)
  const countdownId = useId()

  const usage = useProjection('tokenUsage')
  const modelSelection = useProjection('modelSelection')
  const sessionModelId = modelSelection?.next?.model ?? modelSelection?.lastUsed?.model ?? null
  const sessionPriced = lookupPricing(sessionModelId) !== undefined
  const activeModelId = pickedModelId
    ?? (sessionModelId !== null && sessionPriced ? sessionModelId : OFFICIAL_MODELS[0].id)
  const activeEntry = OFFICIAL_MODELS.find(entry => entry.id === activeModelId) ?? OFFICIAL_MODELS[0]
  // Resolve the revision in force right now: a scheduled official price change
  // flips the menu by itself as the per-second tick re-renders.
  const at = now.getTime()
  const revision = activeRevision(activeEntry.pricing, at)
  const rate = rateAt(activeEntry.pricing, at, tier)
  // Every model with an announced change, grouped by the revision it moves to.
  const upcomingGroups = new Map<RateRevision, string[]>()
  for (const entry of OFFICIAL_MODELS) {
    const nextRev = nextRevision(entry.pricing, at)
    if (nextRev === undefined) continue
    upcomingGroups.set(nextRev, [...(upcomingGroups.get(nextRev) ?? []), entry.pricing.name])
  }

  const billed = usage !== undefined && totalTokens(usage) > 0
  const hit = usage === undefined ? null : cacheHitRate(usage)
  const composite = billed ? compositePerYiTokens(usage, rate) : null
  const cost = billed ? costYuan(usage, rate) : null

  return (
    <div ref={anchorRef} className="dsh-liangwengu-anchor">
      <style>{STYLE}</style>
      <button
        type="button"
        className="dsh-liangwengu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}，查看 DeepSeek 定价`}
        aria-describedby={countdownId}
        onClick={() => { setOpen(current => !current) }}
      >
        <span className="dsh-lwgu-line">
          <span className="dsh-lwgu-dot" data-peak={peak ? 'true' : 'false'} />
          <span>{label}</span>
        </span>
        <span className="dsh-lwgu-countdown" id={countdownId}>剩余 {countdown}</span>
      </button>
      {/* The button's accessible name is the slot label alone (the countdown
          rides aria-describedby, so it is readable on demand without renaming
          the button every second); this live region announces label changes at
          slot boundaries. */}
      <span className="dsh-lwgu-sr" aria-live="polite">{label}</span>
      {open && (
        <div
          ref={panelRef}
          className="dsh-lwgu-panel"
          role="dialog"
          aria-label="DeepSeek 定价与综合单价"
          style={{
            left: pos?.left ?? 0,
            top: pos?.top ?? 0,
            visibility: pos === null ? 'hidden' : 'visible',
          }}
        >
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
            {OFFICIAL_MODELS.map((entry) => {
              const row = rateAt(entry.pricing, at, tier)
              const active = entry.id === activeModelId
              return (
                <button
                  key={entry.id}
                  type="button"
                  className="dsh-lwgu-grid-row"
                  aria-pressed={active}
                  onClick={() => { setPickedModelId(entry.id) }}
                >
                  <span>{entry.pricing.name}</span>
                  <span>{formatRate(row.cacheHit)}</span>
                  <span>{formatRate(row.cacheMiss)}</span>
                  <span>{formatRate(row.output)}</span>
                </button>
              )
            })}
          </div>
          {[...upcomingGroups].map(([nextRev, names]) => (
            <div className="dsh-lwgu-note" key={names[0]}>
              {formatBeijingDateTime(nextRev.effectiveFrom)} 起 {names.join(' / ')} 调价：
              命中 {formatRate(nextRev[tier].cacheHit)} / 未命中 {formatRate(nextRev[tier].cacheMiss)}
              / 输出 {formatRate(nextRev[tier].output)}（{tierLabel(tier)}）
            </div>
          ))}
          <div className="dsh-lwgu-rule" />
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
        </div>
      )}
    </div>
  )
}

// ── plugin body ───────────────────────────────────────────────────────────

// Re-exported so the pricing math stays testable through the built bundle.
export {
  activeRevision,
  cacheHitRate,
  compositePerYiTokens,
  costYuan,
  FLASH_PRICE_CHANGE_AT,
  formatBeijingDateTime,
  formatCompactTokens,
  formatHitRate,
  formatMoney,
  formatRate,
  lookupPricing,
  nextRevision,
  OFFICIAL_MODELS,
  PRICING_SOURCE_URL,
  PRICING_UPDATED_AT,
  rateAt,
  totalTokens,
} from './pricing'

/** Required services (cordis fiber inject): the slot registry. */
export const inject = ['slots']

/**
 * Register the capsule into the session header's right-aligned utilities row,
 * before (left of) the export-session button. `order: -1` sorts ahead of the
 * button's default 0; being an in-flow list entry it never overlays or blocks
 * any page control.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities',
    id: '梁文谷',
    order: -1,
  }, TimeSlotIndicator))
}
