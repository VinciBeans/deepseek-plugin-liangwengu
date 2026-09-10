/**
 * DeepSeek `GET /user/balance` client: request, parse, and error classification.
 *
 * Purely functional — the caller supplies the credential and, in tests, the
 * transport — so every branch is exercisable without a wire.
 * See https://api-docs.deepseek.com/zh-cn/api/get-user-balance
 */
/** Public API origin; the plugin config may point somewhere else. */
export declare const PUBLIC_BASE_URL = "https://api.deepseek.com";
/** One element of `balance_infos`; amounts arrive as decimal strings. */
export interface BalanceEntry {
    readonly currency: string;
    readonly totalBalance: string;
    readonly grantedBalance: string;
    readonly toppedUpBalance: string;
}
/** The parsed response of one successful balance query. */
export interface BalanceSnapshot {
    readonly isAvailable: boolean;
    readonly entries: readonly BalanceEntry[];
}
/** Milestone during one query — `is_available` staying false is a fact, not an error. */
export type BalanceErrorCode = 'no-key' | 'unauthorized' | 'network' | 'api' | 'invalid-response';
/** Failure with a stable machine-readable code the menu can explain. */
export declare class BalanceError extends Error {
    readonly code: BalanceErrorCode;
    constructor(code: BalanceErrorCode, message: string);
}
/**
 * Query the account balance once.
 * @param baseUrl - API origin such as `https://api.deepseek.com`.
 * @param apiKey - the key, already resolved; never returned or logged.
 * @param timeoutMs - per-request timeout.
 * @param doFetch - injectable transport (tests); defaults to global `fetch`.
 * @returns the parsed snapshot.
 * @throws {BalanceError} with a stable code on any failure.
 */
export declare function fetchBalance(baseUrl: string, apiKey: string, timeoutMs?: number, doFetch?: typeof fetch): Promise<BalanceSnapshot>;
/**
 * Parse and validate the documented response shape.
 * @param raw - the decoded JSON body.
 * @returns the snapshot.
 * @throws {BalanceError} with code `invalid-response` on any shape violation.
 */
export declare function parseBalanceResponse(raw: unknown): BalanceSnapshot;
