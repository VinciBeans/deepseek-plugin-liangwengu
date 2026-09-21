import { type PriceTier } from './pricing';
/**
 * Beijing weekday: 0 = Sunday ... 6 = Saturday. Weekends (Sat/Sun) and statutory
 * holidays are off-peak valley all day; the remaining workdays keep the original
 * peak schedule.
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
 * end at Monday 09:00, and the evening before a holiday at the first peak
 * after it).
 */
export declare function getSlotRemaining(date: Date): number;
/** Format a second countdown as HH:MM:SS, or `Xd HH:MM:SS` when ≥ 24h. */
export declare function formatCountdown(totalSeconds: number): string;
