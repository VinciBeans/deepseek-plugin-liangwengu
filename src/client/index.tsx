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
 */
import { useEffect, useState } from 'react'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pull the `slots` service declaration (Context augmentation) from
// ui-renderer and the SlotMap merge declaring 'shell.overlay' from ui-layout.
// Both are erased before bundling — the browser bundle only requires the
// baseline platform words (react / react/jsx-runtime).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'

// ── time-slot logic ───────────────────────────────────────────────────────

/** Beijing offset in ms: Asia/Shanghai is fixed at UTC+8 (no DST since 1991). */
const BEIJING_OFFSET_MS = 8 * 3600 * 1000
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
 * Uses Intl with the fixed Asia/Shanghai timezone so the badge is correct
 * even when the browser is running in another timezone.
 */
export function getBeijingSeconds(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  let hour = 0
  let minute = 0
  let second = 0
  for (const part of parts) {
    if (part.type === 'hour') hour = Number(part.value)
    else if (part.type === 'minute') minute = Number(part.value)
    else if (part.type === 'second') second = Number(part.value)
  }
  return hour * 3600 + minute * 60 + second
}

/**
 * Get the current Beijing wall-clock time in minutes since midnight.
 * Derived from {@link getBeijingSeconds} so both views share one clock.
 */
export function getBeijingMinutes(date: Date): number {
  return Math.floor(getBeijingSeconds(date) / 60)
}

/** Whether the instant falls in a peak slot (workday 09:00–12:00 / 14:00–18:00). */
export function isPeakMoment(date: Date): boolean {
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
    for (const hour of [9, 14]) {
      const candidate = dayStartMs + offset * DAY_MS + hour * 3600 * 1000
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

/**
 * The top-right badge. pointerEvents is disabled so it never blocks the app;
 * it ticks once per second (re-synced to the second boundary), so the
 * countdown is live and slot changes appear promptly.
 */
export function TimeSlotIndicator() {
  const [now, setNow] = useState(() => new Date())

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

  const label = getSlotLabel(now)

  return (
    <div
      aria-live="polite"
      className="dsh-liangwengu"
      style={{
        position: 'fixed',
        top: 12,
        right: 16,
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 2,
        padding: '6px 12px',
        borderRadius: 14,
        background: 'var(--lwgu-bg, #ffffff)',
        border: '1px solid var(--lwgu-border, rgba(0,0,0,0.12))',
        boxShadow: 'var(--lwgu-shadow, 0 2px 8px rgba(0,0,0,0.08))',
        color: 'var(--lwgu-text, #222)',
        fontSize: 13,
        lineHeight: '18px',
        fontWeight: 500,
        pointerEvents: 'none',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <style>{`
        .dsh-liangwengu {
          --lwgu-bg: var(--dsw-alias-bg-elevated, #ffffff);
          --lwgu-border: var(--dsw-alias-border-l1, rgba(0,0,0,0.12));
          --lwgu-text: var(--dsw-alias-label-primary, #222);
          --lwgu-sub: var(--dsw-alias-label-secondary, #8a8f99);
          --lwgu-shadow: 0 2px 8px rgba(0,0,0,0.08);
          --lwgu-peak: var(--dsw-alias-status-success, #22c55e);
          --lwgu-off: var(--dsw-alias-status-muted, #9ca3af);
        }
        body[data-ds-dark-theme] .dsh-liangwengu {
          --lwgu-bg: #17181c;
          --lwgu-border: rgba(255,255,255,0.14);
          --lwgu-text: #e8e8ea;
          --lwgu-sub: #9aa0aa;
          --lwgu-shadow: 0 2px 12px rgba(0,0,0,0.5);
          --lwgu-peak: #4ade80;
          --lwgu-off: #71717a;
        }
      `}</style>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            flex: 'none',
            background: label.includes('梁文峰')
              ? 'var(--lwgu-peak, #22c55e)'
              : 'var(--lwgu-off, #9ca3af)',
          }}
        />
        <span>{label}</span>
      </span>
      <span
        style={{
          paddingLeft: 16,
          fontSize: 11,
          lineHeight: '14px',
          color: 'var(--lwgu-sub, #8a8f99)',
          fontWeight: 400,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        剩余 {formatCountdown(getSlotRemaining(now))}
      </span>
    </div>
  )
}

// ── plugin body ───────────────────────────────────────────────────────────

/** Required services (cordis fiber inject): the slot registry. */
export const inject = ['slots']

/**
 * Register the badge into the frame-wide additive `shell.overlay` slot.
 * A high order keeps it above most floating surfaces, while pointer-events
 * remains off so it never intercepts clicks.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: '梁文谷',
    order: 9000,
  }, TimeSlotIndicator))
}
