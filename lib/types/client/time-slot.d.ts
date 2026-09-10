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
import { type PriceTier } from './pricing';
/**
 * Beijing weekday: 0 = Sunday ... 6 = Saturday. Weekends (Sat/Sun) are
 * off-peak valley all day; workdays keep the original peak schedule.
 */
export declare function getBeijingWeekday(date: Date): number;
/**
 * Get the current Beijing wall-clock time as seconds since midnight.
 * Asia/Shanghai is a fixed UTC+8 (no DST since 1991), so this is pure
 * arithmetic on the epoch ms — no Intl formatter per tick, and it stays
 * correct regardless of the browser's own timezone.
 */
export declare function getBeijingSeconds(date: Date): number;
/** Return the badge text for a given instant. */
export declare function getSlotLabel(date: Date): string;
/** The official price tier the badge's current instant falls in. */
export declare function tierOf(date: Date): PriceTier;
/**
 * Seconds until the current peak/valley slot ends, for a given instant.
 * A peak ends at the same day's 12:00 or 18:00; a valley runs continuously
 * until the next peak start (Friday-evening and weekend valleys therefore
 * end at Monday 09:00).
 */
export declare function getSlotRemaining(date: Date): number;
/** Format a second countdown as HH:MM:SS, or `Xd HH:MM:SS` when ≥ 24h. */
export declare function formatCountdown(totalSeconds: number): string;
