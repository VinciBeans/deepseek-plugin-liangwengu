/**
 * Beijing compute-slot arithmetic and countdown formatting.
 *
 * Everything here is pure: a `Date` in, a classification or a number out. The
 * clock is always Asia/Shanghai (a fixed UTC+8, no DST since 1991), computed
 * arithmetically from the epoch so the result never depends on the browser's own
 * timezone, an `Intl` formatter, or the machine's locale data.
 *
 * Policy under test (see `test/time-slot.test.mjs`):
 *   - workday (Mon–Fri) peak slots: Beijing [09:00, 12:00) and [14:00, 18:00)
 *   - everything else, including the whole weekend, is valley
 *   - a valley runs continuously to the next peak start, so Friday evening and
 *     the weekend end at Monday 09:00
 *
 * The peak windows are the same windows DeepSeek discounts, so they also pick
 * the price tier the menu prices.
 */
import { BEIJING_OFFSET_MS, type PriceTier } from './pricing'

const DAY_MS = 86400000

/**
 * Workday peak slots, in Beijing local minutes:
 * [09:00, 12:00) and [14:00, 18:00). Weekends have no peak slots at all.
 *
 * Transcribed from the official price page's discount window. Prices are dated
 * data (see `pricing.ts`); this schedule is not, so a change to the discount
 * window is a code change, not a table row.
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

/** The official price tier the badge's current instant falls in. */
export function tierOf(date: Date): PriceTier {
  return isPeakMoment(date) ? 'peak' : 'offPeak'
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
