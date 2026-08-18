/**
 * 梁文谷 — browser half.
 *
 * Renders a small badge at the top-right corner of the DeepSeek Harness Web
 * GUI showing the current official compute time-slot:
 *
 *   - Beijing time 09:00-12:00 and 14:00-18:00 → 「当前时段：梁文峰」
 *   - all other times                       → 「当前时段：梁文谷」
 *
 * The time is always evaluated in Asia/Shanghai, regardless of the user's
 * local timezone, and the badge updates on the minute without needing a
 * reload.
 */
import { useEffect, useState } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pull the SlotMap merge declaring 'shell.overlay' from ui-layout.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'

// ── time-slot logic ───────────────────────────────────────────────────────

/** Peak slots, in Beijing local minutes: [09:00, 12:00) and [14:00, 18:00). */
const PEAK_SLOTS: ReadonlyArray<readonly [number, number]> = [
  [9 * 60, 12 * 60],
  [14 * 60, 18 * 60],
]

/**
 * Get the current Beijing wall-clock time in minutes since midnight.
 * Uses Intl with the fixed Asia/Shanghai timezone so the badge is correct
 * even when the browser is running in another timezone.
 */
export function getBeijingMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  let hour = 0
  let minute = 0
  for (const part of parts) {
    if (part.type === 'hour') hour = Number(part.value)
    else if (part.type === 'minute') minute = Number(part.value)
  }
  return hour * 60 + minute
}

/** Return the badge text for a given instant. */
export function getSlotLabel(date: Date): string {
  const minutes = getBeijingMinutes(date)
  const isLiangWenfeng = PEAK_SLOTS.some(([start, end]) => minutes >= start && minutes < end)
  return isLiangWenfeng ? '当前时段：梁文峰' : '当前时段：梁文谷'
}

// ── badge visual ──────────────────────────────────────────────────────────

/**
 * The top-right badge. pointerEvents is disabled so it never blocks the app;
 * it schedules a refresh at the next minute boundary, so slot changes appear
 * promptly.
 */
export function TimeSlotIndicator() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timer: number

    const scheduleNextMinute = () => {
      // Beijing time is UTC+8, so its minute boundary is exactly the UTC
      // minute boundary. Using UTC seconds avoids local-timezone quirks such
      // as non-whole-hour offsets.
      const current = new Date()
      const delay = Math.max(
        1000,
        (60 - current.getUTCSeconds()) * 1000 - current.getUTCMilliseconds(),
      )
      timer = window.setTimeout(() => {
        setNow(new Date())
        scheduleNextMinute()
      }, delay)
    }

    scheduleNextMinute()
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
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderRadius: 999,
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
          --lwgu-shadow: 0 2px 8px rgba(0,0,0,0.08);
          --lwgu-peak: var(--dsw-alias-status-success, #22c55e);
          --lwgu-off: var(--dsw-alias-status-muted, #9ca3af);
        }
        body[data-ds-dark-theme] .dsh-liangwengu {
          --lwgu-bg: #17181c;
          --lwgu-border: rgba(255,255,255,0.14);
          --lwgu-text: #e8e8ea;
          --lwgu-shadow: 0 2px 12px rgba(0,0,0,0.5);
          --lwgu-peak: #4ade80;
          --lwgu-off: #71717a;
        }
      `}</style>
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
