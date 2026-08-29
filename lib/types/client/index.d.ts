import type { Context as ClientContext } from '@deepseek-ai/cordis';
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
/**
 * Seconds until the current peak/valley slot ends, for a given instant.
 * A peak ends at the same day's 12:00 or 18:00; a valley runs continuously
 * until the next peak start (Friday-evening and weekend valleys therefore
 * end at Monday 09:00).
 */
export declare function getSlotRemaining(date: Date): number;
/** Format a second countdown as HH:MM:SS, or `Xd HH:MM:SS` when ≥ 24h. */
export declare function formatCountdown(totalSeconds: number): string;
/**
 * The time-slot capsule, mounted inside the session header's utilities row —
 * directly left of the export-session button (order: -1 < the button's 0).
 * It is a normal in-flow element, so it never floats over or blocks any UI;
 * it ticks once per second (re-synced to the second boundary), so the
 * countdown is live and slot changes appear promptly.
 */
export declare function TimeSlotIndicator(): import("react/jsx-runtime").JSX.Element;
/** Required services (cordis fiber inject): the slot registry. */
export declare const inject: string[];
/**
 * Register the capsule into the session header's right-aligned utilities row,
 * before (left of) the export-session button. `order: -1` sorts ahead of the
 * button's default 0; being an in-flow list entry it never overlays or blocks
 * any page control.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
