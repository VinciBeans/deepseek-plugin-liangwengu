/**
 * 梁文谷 — browser half.
 *
 * Renders a small badge at the top-right corner of the DeepSeek Harness Web
 * GUI showing the current official compute time-slot together with a live
 * countdown of the remaining time of that slot, and — on its lower line — the
 * DeepSeek account balance polled through the host half's `/api` route:
 *
 *   - workdays (Mon–Fri) 09:00–12:00 and 14:00–18:00 → 「当前时段：梁文峰」
 *   - all other times, incl. the whole weekend      → 「当前时段：梁文谷」
 *   - lower line                                    → 「余额 ¥110.00」
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
 * the same shape as DSH's own token-stat dialog — whose blocks are the official
 * DeepSeek price table, this session's blended unit price in 元 per 亿 tokens.
 * and the account-balance detail. Clicking anywhere outside the badge or the
 * menu, or pressing Escape, closes it.
 *
 * This module owns the badge, the panel shell (placement, focus, dismissal) and
 * the plugin body; the slot arithmetic lives in `time-slot.ts`, the price table
 * and blended-price math in `pricing.ts`, the balance poller and its display
 * rules in `balance.ts`, the three menu blocks in their own components, and the
 * stylesheet in `styles.ts`.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
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
import { activeRevision, FALLBACK_MODEL_ID, lookupPricing, OFFICIAL_MODELS, type OfficialModel } from './pricing'
import {
  formatCountdown,
  getSlotLabel,
  getSlotRemaining,
  tierOf,
} from './time-slot'
import { badgeBalanceText, balance, balanceTone } from './balance'
import { BalanceSection } from './BalanceSection'
import { CompositeSection } from './CompositeSection'
import { PricingTable } from './PricingTable'
import { STYLE } from './styles'

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
  /** Element focus returns to when the menu closes; null while it is closed. */
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  // A pricing model picked for one Session must not leak into the next one.
  useEffect(() => { setPickedModelId(null) }, [sessionId])

  // Poll the account balance while this badge is mounted (reference-counted:
  // the last unmounting consumer stops the timer), and re-render as each poll
  // lands — the per-second slot tick alone would leave a fresh balance unseen
  // for up to a second.
  const [balanceState, setBalanceState] = useState(() => balance.getSnapshot())
  useEffect(() => {
    setBalanceState(balance.getSnapshot())
    const unsubscribe = balance.subscribe(() => { setBalanceState(balance.getSnapshot()) })
    const release = balance.acquire()
    return () => {
      unsubscribe()
      release()
    }
  }, [])

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

  // Focus bookkeeping: the menu is a NON-modal dialog (the page behind stays
  // usable and an outside click closes it), so focus is not trapped — but it
  // must enter the panel on open, or a keyboard user cannot reach the model
  // rows and the refresh button without tabbing through the whole page first,
  // and it must come back to the badge on close.
  useLayoutEffect(() => {
    if (open) {
      if (restoreFocusRef.current === null) {
        const active = document.activeElement
        restoreFocusRef.current = active instanceof HTMLElement ? active : null
      }
      return
    }
    const target = restoreFocusRef.current
    restoreFocusRef.current = null
    if (target !== null && document.contains(target)) target.focus()
  }, [open])

  // The panel starts hidden (it has no measured position yet), and a hidden
  // element cannot take focus — so focus waits for the placement pass above to
  // publish a position, which lands in the very next render.
  useLayoutEffect(() => {
    if (open && pos !== null) panelRef.current?.focus()
  }, [open, pos])

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
  const tier = tierOf(now)
  const peak = tier === 'peak'
  const countdownId = useId()

  const usage = useProjection('tokenUsage')
  const modelSelection = useProjection('modelSelection')
  const sessionModelId = modelSelection?.next?.model ?? modelSelection?.lastUsed?.model ?? null
  const sessionPriced = lookupPricing(sessionModelId) !== undefined
  const activeModelId = pickedModelId
    ?? (sessionModelId !== null && sessionPriced ? sessionModelId : FALLBACK_MODEL_ID)
  const activeEntry: OfficialModel = OFFICIAL_MODELS.find(entry => entry.id === activeModelId) ?? OFFICIAL_MODELS[0]
  // Resolve the revision in force right now: a scheduled official price change
  // flips the menu by itself as the per-second tick re-renders.
  const revision = activeRevision(activeEntry.pricing, now.getTime())

  const onPickModel = useCallback((modelId: string) => { setPickedModelId(modelId) }, [])
  const onRefreshBalance = useCallback(() => { balance.refresh() }, [])

  return (
    <div ref={anchorRef} className="dsh-liangwengu-anchor">
      <style>{STYLE}</style>
      <button
        type="button"
        className="dsh-liangwengu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}，余额 ${badgeBalanceText(balanceState)}，查看定价与余额`}
        aria-describedby={countdownId}
        onClick={() => { setOpen(current => !current) }}
      >
        <span className="dsh-lwgu-line">
          <span className="dsh-lwgu-dot" data-peak={peak ? 'true' : 'false'} />
          <span>{label}</span>
          <span className="dsh-lwgu-sep" aria-hidden="true">·</span>
          <span className="dsh-lwgu-countdown" id={countdownId}>剩余 {countdown}</span>
        </span>
        <span className="dsh-lwgu-balance" data-tone={balanceTone(balanceState)}>
          余额 {badgeBalanceText(balanceState)}
        </span>
      </button>
      {/* The button's accessible name carries the label and the balance (the
          countdown rides aria-describedby, so it is readable on demand without
          renaming the button every second); this live region announces label
          changes at slot boundaries. */}
      <span className="dsh-lwgu-sr" aria-live="polite">{label}</span>
      {open && (
        <div
          ref={panelRef}
          className="dsh-lwgu-panel"
          role="dialog"
          aria-label="DeepSeek 定价与综合单价"
          tabIndex={-1}
          style={{
            left: pos?.left ?? 0,
            top: pos?.top ?? 0,
            visibility: pos === null ? 'hidden' : 'visible',
          }}
        >
          <PricingTable
            revision={revision}
            tier={tier}
            activeModelId={activeModelId}
            onPick={onPickModel}
          />
          <div className="dsh-lwgu-rule" />
          <CompositeSection
            usage={usage}
            activeEntry={activeEntry}
            revision={revision}
            tier={tier}
            sessionModelId={sessionModelId}
          />
          <div className="dsh-lwgu-rule" />
          <BalanceSection state={balanceState} onRefresh={onRefreshBalance} />
        </div>
      )}
    </div>
  )
}

// ── plugin body ───────────────────────────────────────────────────────────

// Re-exported so the slot arithmetic stays testable through the built bundle.
export {
  formatCountdown,
  getBeijingSeconds,
  getBeijingWeekday,
  getSlotLabel,
  getSlotRemaining,
} from './time-slot'

// Same for the pricing math.
export {
  activeRevision,
  cacheHitRate,
  compositePerYiTokens,
  costYuan,
  FALLBACK_MODEL_ID,
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
  tierLabel,
  totalTokens,
} from './pricing'

// Same for the balance poller and its display rules.
export {
  BALANCE_PATH,
  BUILD_STAMP,
  balance,
  balanceEmptyText,
  balanceErrorText,
  balanceTone,
  balanceUpdatedText,
  badgeBalanceText,
  buildMismatchText,
  createBalanceStore,
  currencySign,
  formatBalanceEntries,
  isBalanceLow,
  isEntryLow,
  jitteredDelayMs,
  nextPollDelayMs,
} from './balance'

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
