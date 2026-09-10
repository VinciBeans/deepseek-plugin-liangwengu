/**
 * Account-balance polling for the badge.
 *
 * One module-scoped poller feeds both balance surfaces (the badge's lower line
 * and the detail menu at the foot of its panel). The browser half POSTs the
 * plugin's own `/api` route, which fetches DeepSeek on the host with the
 * credential-seam key — the key never reaches the browser, and this module
 * carries no DSH client service dependency beyond the page's own `fetch`.
 *
 * The badge already re-renders once per second for its countdown, so consumers
 * read {@link BalanceStore.getSnapshot} during render instead of subscribing;
 * {@link BalanceStore.acquire} only decides whether polling runs at all.
 *
 * Scheduling follows the balance rules: `intervalMs` while healthy, the
 * {@link nextPollDelayMs} backoff after consecutive failures, and no timer at
 * all while the document is hidden (showing it again polls immediately). The
 * last good snapshot survives a failure — the badge marks it stale rather than
 * blanking out.
 */
/** This plugin's balance route; matches the host half's registered path. */
export declare const BALANCE_PATH = "/api/liangwengu.balance";
/** Source-identity stamp of this browser bundle; see `src/stamp.d.ts`. */
export declare const BUILD_STAMP: string;
/** One `balance_infos` element; amounts are decimal strings. */
export interface BalanceEntry {
    readonly currency: string;
    readonly totalBalance: string;
    readonly grantedBalance: string;
    readonly toppedUpBalance: string;
}
/** What the host route answers, either way. */
export interface BalancePollResult {
    readonly ok: boolean;
    /** Source-identity stamp of the answering host build. */
    readonly build?: string;
    readonly value?: {
        readonly isAvailable: boolean;
        readonly entries: readonly BalanceEntry[];
        /** Host-configured poll interval, when the host reported one. */
        readonly pollIntervalMs?: number;
        /** Host-configured low-balance threshold, when the host reported one. */
        readonly lowBalanceThreshold?: number;
    };
    readonly error?: {
        readonly code: string;
        readonly message?: string;
    };
}
/** Polled state of one account. */
export interface BalanceState {
    /** Last successful snapshot; undefined until the first success. */
    readonly entries: readonly BalanceEntry[] | undefined;
    readonly isAvailable: boolean | undefined;
    /** Epoch ms of the last successful poll. */
    readonly fetchedAt: number | undefined;
    /** A poll is in flight right now. */
    readonly loading: boolean;
    /** Consecutive failures since the last success. */
    readonly failureCount: number;
    readonly lastError: {
        readonly code: string;
        readonly message?: string;
    } | undefined;
    /** Effective poll interval, from the host when it reported one. */
    readonly pollIntervalMs: number;
    /** Effective low-balance threshold, from the host when it reported one. */
    readonly lowBalanceThreshold: number;
    /** Build stamp the answering host reported; undefined until a poll succeeds. */
    readonly hostBuild: string | undefined;
}
export interface BalanceStore {
    /** Current state; a new object identity after every change. */
    getSnapshot(): BalanceState;
    /** Observe state changes; returns the unsubscribe function. */
    subscribe(listener: () => void): () => void;
    /** Start polling while the caller is mounted; returns the release function. */
    acquire(): () => void;
    /** Poll once right now, ignoring the schedule. */
    refresh(): void;
}
export declare const DEFAULT_LOW_BALANCE_THRESHOLD = 10;
/**
 * Delay before the next poll after consecutive failures.
 *
 * The k-th consecutive failure (k = 1, 2, 3) waits
 * `max((k + 1) × intervalMs, k × 10s)`; beyond k = 3 the third delay holds, so
 * a long outage settles on a 30s beat rather than growing without bound. Any
 * success resets the count and restores the configured interval.
 * @param failureCount - consecutive failures since the last success (0 = healthy).
 * @param intervalMs - configured poll interval.
 * @returns the delay in milliseconds.
 */
export declare function nextPollDelayMs(failureCount: number, intervalMs: number): number;
/**
 * Spread one scheduled delay so independent tabs do not poll in lockstep.
 *
 * Every tab runs its own timer from its own mount instant; without jitter they
 * drift into the same phase and hit the host (and DeepSeek behind it) in
 * bursts. Jitter moves the timer only — `pollIntervalMs` in the state stays the
 * configured value.
 * @param delayMs - the scheduled delay.
 * @param random - injectable RNG in `[0, 1)` (tests).
 * @returns a delay within ±10% of the input.
 */
export declare function jitteredDelayMs(delayMs: number, random?: () => number): number;
/**
 * Build a poller around one status call.
 * @param callStatus - the transport, injectable so the store is testable.
 * @returns the store consumed by the badge.
 */
export declare function createBalanceStore(callStatus?: () => Promise<BalancePollResult>): BalanceStore;
/** The poller the badge and its menu share. */
export declare const balance: BalanceStore;
/** Currency sign for the compact badge line; unknown codes keep their own name. */
export declare function currencySign(currency: string): string;
/**
 * The badge's amount text for one account's entries.
 * @param entries - successful snapshot entries, in wire order.
 * @returns e.g. `¥110.00` or `¥110.00 · $5.00`; an empty string when there are none.
 */
export declare function formatBalanceEntries(entries: readonly BalanceEntry[]): string;
/** Whether one entry sits below the low-balance threshold. */
export declare function isEntryLow(entry: BalanceEntry, threshold: number): boolean;
/** Whether the account is out of balance: below the threshold, or unusable. */
export declare function isBalanceLow(state: BalanceState): boolean;
/** Presentation tone of the balance line: which fact deserves the colour. */
export type BalanceTone = 'ok' | 'low' | 'stale' | 'none';
/**
 * Colour intent for the balance surfaces.
 * @param state - current polled state.
 * @returns `low` (out of balance), `stale` (showing the last good value after a
 * failure), `ok` (live data), or `none` (no data to show yet).
 */
export declare function balanceTone(state: BalanceState): BalanceTone;
/**
 * The badge's balance line text.
 * @param state - current polled state.
 * @returns the amount, a short reason it is missing, or `—`.
 */
export declare function badgeBalanceText(state: BalanceState): string;
/**
 * The menu's stand-in line when there is no amount to show.
 * @param state - current polled state.
 * @returns why the balance is missing, and what to do about it.
 */
export declare function balanceEmptyText(state: BalanceState): string;
/**
 * Explain one poll failure, keeping the wire message when it carries one.
 * @param error - the failure code and optional message from the host route.
 * @returns a one-line Chinese explanation.
 */
export declare function balanceErrorText(error: {
    readonly code: string;
    readonly message?: string;
}): string;
/**
 * The build line under the balance block, and whether the two halves disagree.
 *
 * Both halves carry a stamp of the sources they were built from; a mismatch
 * means the running host and the loaded page come from different builds — the
 * state that makes a route look missing.
 * @param state - current polled state.
 * @returns the line to show, and whether it reports a mismatch.
 */
export declare function buildStatus(state: BalanceState): {
    readonly text: string;
    readonly mismatch: boolean;
};
/**
 * When the shown amount was last confirmed.
 * @param state - current polled state.
 * @returns local wall-clock time of the last success, or a never-updated label.
 */
export declare function balanceUpdatedText(state: BalanceState): string;
