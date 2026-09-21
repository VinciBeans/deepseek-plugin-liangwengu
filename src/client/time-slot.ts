/**
 * Beijing compute-slot arithmetic and countdown formatting.
 *
 * Everything here is pure: a `Date` in, a classification or a number out. The
 * clock is always Asia/Shanghai (a fixed UTC+8, no DST since 1991), computed
 * arithmetically from the epoch so the result never depends on the browser's own
 * timezone, an `Intl` formatter, or the machine's locale data.
 *
 * Policy under test (see `test/time-slot.test.mjs`):
 *   - peak slots on an ordinary workday (Mon–Fri): Beijing [09:00, 12:00) and [14:00, 18:00)
 *   - everything else is valley — the whole weekend, every calendar day the State
 *     Council schedule gives off (`holidays.ts`), and a weekend that is only a
 *     调休 workday, which the official rate rule also charges off-peak
 *   - a valley runs continuously to the next peak start, so Friday evening and
 *     the weekend end at Monday 09:00, and the evening before a holiday ends at
 *     the first peak day after it
 *
 * The peak windows are the same windows DeepSeek discounts, so they also pick
 * the price tier the menu prices.
 */
import { isStatutoryHoliday } from './holidays'
import { BEIJING_OFFSET_MS, type PriceTier } from './pricing'

const DAY_MS = 86400000

/**
 * Workday peak slots, in Beijing local minutes:
 * [09:00, 12:00) and [14:00, 18:00). Weekends have no peak slots at all, and
 * neither has a calendar day the State Council schedule gives off.
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
 * Beijing weekday: 0 = Sunday ... 6 = Saturday. Weekends (Sat/Sun) and statutory
 * holidays are off-peak valley all day; the remaining workdays keep the original
 * peak schedule.
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

/**
 * Whether the day is a peak day: an ordinary workday, i.e. Mon–Fri minus the
 * days the State Council schedule gives off. Weekends need no separate holiday
 * entry — and neither do 调休 workdays, which are always a Saturday or Sunday, so
 * the weekday test already keeps them valley.
 */
function isPeakDay(date: Date): boolean {
  const weekday = getBeijingWeekday(date)
  if (weekday === 0 || weekday === 6) return false
  return !isStatutoryHoliday(date)
}

/** Whether the instant falls in a peak slot (peak day 09:00–12:00 / 14:00–18:00). */
function isPeakMoment(date: Date): boolean {
  if (!isPeakDay(date)) return false
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
 * How many days forward {@link getNextPeakStartMs} scans before giving up. The
 * longest stretch without a peak day is one holiday plus its adjacent weekend —
 * under 16 days even for the 9-day Spring Festival — so a longer gap means the
 * holiday table is wrong, not that the calendar is real.
 */
const MAX_PEAK_SCAN_DAYS = 32

/**
 * UTC timestamp of the next peak-slot start: the first 09:00 or 14:00 of a peak
 * day strictly after the given instant. Skips weekends and statutory holidays,
 * so a Friday evening resolves to Monday 09:00 and the evening before a holiday
 * resolves to the first peak day after it.
 */
function getNextPeakStartMs(date: Date): number {
  const ms = date.getTime()
  const dayIndex = getBeijingDayIndex(date)
  const dayStartMs = dayIndex * DAY_MS - BEIJING_OFFSET_MS
  for (let offset = 0; offset < MAX_PEAK_SCAN_DAYS; offset += 1) {
    const startOfDayMs = dayStartMs + offset * DAY_MS
    if (!isPeakDay(new Date(startOfDayMs))) continue
    for (const [start] of PEAK_SLOTS) {
      const candidate = startOfDayMs + start * 60 * 1000
      if (candidate > ms) return candidate
    }
  }
  return ms // degenerate: only reachable with a holiday table covering a whole month
}

/**
 * Seconds until the current peak/valley slot ends, for a given instant.
 * A peak ends at the same day's 12:00 or 18:00; a valley runs continuously
 * until the next peak start (Friday-evening and weekend valleys therefore
 * end at Monday 09:00, and the evening before a holiday at the first peak
 * after it).
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
