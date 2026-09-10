import type { Context as ClientContext } from '@deepseek-ai/cordis';
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
/** Slot-supplied props: the session projection read seat. */
type IndicatorProps = PropsRuntime<'conversation.session.header.utilities'>;
/**
 * The time-slot capsule, mounted inside the session header's utilities row —
 * directly left of the export-session button (order: -1 < the button's 0).
 * It is a normal in-flow element, so it never floats over or blocks any UI;
 * it ticks once per second (re-synced to the second boundary), so the
 * countdown is live and slot changes appear promptly. Clicking it opens the
 * price detail menu described in the module doc.
 * @param props - slot runtime props; only the projection hook is used.
 */
export declare function TimeSlotIndicator({ useProjection, sessionId }: IndicatorProps): import("react/jsx-runtime").JSX.Element;
export { formatCountdown, getBeijingSeconds, getBeijingWeekday, getSlotLabel, getSlotRemaining, } from './time-slot';
export { activeRevision, cacheHitRate, compositePerYiTokens, costYuan, FALLBACK_MODEL_ID, FLASH_PRICE_CHANGE_AT, formatBeijingDateTime, formatCompactTokens, formatHitRate, formatMoney, formatRate, lookupPricing, nextRevision, OFFICIAL_MODELS, PRICING_SOURCE_URL, PRICING_UPDATED_AT, rateAt, tierLabel, totalTokens, } from './pricing';
export { BALANCE_PATH, BUILD_STAMP, balance, balanceEmptyText, balanceErrorText, balanceTone, balanceUpdatedText, badgeBalanceText, buildStatus, createBalanceStore, currencySign, formatBalanceEntries, isBalanceLow, isEntryLow, jitteredDelayMs, nextPollDelayMs, } from './balance';
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
