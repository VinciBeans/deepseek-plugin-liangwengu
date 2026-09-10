/**
 * DeepSeek `GET /user/balance` client: request, parse, and error classification.
 *
 * Purely functional — the caller supplies the credential and, in tests, the
 * transport — so every branch is exercisable without a wire.
 * See https://api-docs.deepseek.com/zh-cn/api/get-user-balance
 */

/** Public API origin; the plugin config may point somewhere else. */
export const PUBLIC_BASE_URL = 'https://api.deepseek.com'

/** One element of `balance_infos`; amounts arrive as decimal strings. */
export interface BalanceEntry {
  readonly currency: string
  readonly totalBalance: string
  readonly grantedBalance: string
  readonly toppedUpBalance: string
}

/** The parsed response of one successful balance query. */
export interface BalanceSnapshot {
  readonly isAvailable: boolean
  readonly entries: readonly BalanceEntry[]
}

/** Milestone during one query — `is_available` staying false is a fact, not an error. */
export type BalanceErrorCode =
  | 'no-key'
  | 'unauthorized'
  | 'network'
  | 'api'
  | 'invalid-response'

/** Failure with a stable machine-readable code the menu can explain. */
export class BalanceError extends Error {
  readonly code: BalanceErrorCode

  constructor(code: BalanceErrorCode, message: string) {
    super(message)
    this.name = 'BalanceError'
    this.code = code
  }
}

/** Timeout for one request. */
const DEFAULT_TIMEOUT_MS = 10_000

/**
 * Query the account balance once.
 * @param baseUrl - API origin such as `https://api.deepseek.com`.
 * @param apiKey - the key, already resolved; never returned or logged.
 * @param timeoutMs - per-request timeout.
 * @param doFetch - injectable transport (tests); defaults to global `fetch`.
 * @returns the parsed snapshot.
 * @throws {BalanceError} with a stable code on any failure.
 */
export async function fetchBalance(
  baseUrl: string,
  apiKey: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  doFetch: typeof fetch = fetch,
): Promise<BalanceSnapshot> {
  if (apiKey.length === 0) throw new BalanceError('no-key', 'no API key')
  const target = `${baseUrl.replace(/\/+$/, '')}/user/balance`

  let response: Response
  try {
    response = await doFetch(target, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    throw new BalanceError('network', `request to ${target} failed: ${String(error)}`)
  }

  if (response.status === 401 || response.status === 403) {
    throw new BalanceError('unauthorized', `DeepSeek rejected the API key (HTTP ${response.status})`)
  }
  if (!response.ok) {
    throw new BalanceError('api', `DeepSeek balance endpoint answered HTTP ${response.status}`)
  }

  let raw: unknown
  try {
    raw = await response.json()
  } catch {
    throw new BalanceError('invalid-response', 'balance endpoint did not answer JSON')
  }
  return parseBalanceResponse(raw)
}

/**
 * Parse and validate the documented response shape.
 * @param raw - the decoded JSON body.
 * @returns the snapshot.
 * @throws {BalanceError} with code `invalid-response` on any shape violation.
 */
export function parseBalanceResponse(raw: unknown): BalanceSnapshot {
  if (typeof raw !== 'object' || raw === null) {
    throw new BalanceError('invalid-response', 'balance response is not an object')
  }
  const record = raw as Record<string, unknown>
  if (typeof record.is_available !== 'boolean' || !Array.isArray(record.balance_infos)) {
    throw new BalanceError('invalid-response', 'balance response lacks is_available or balance_infos')
  }
  const entries = record.balance_infos.map((value) => {
    if (typeof value !== 'object' || value === null) {
      throw new BalanceError('invalid-response', 'balance_infos entry is not an object')
    }
    const item = value as Record<string, unknown>
    const { currency, total_balance: totalBalance, granted_balance: grantedBalance, topped_up_balance: toppedUpBalance } = item
    if (
      typeof currency !== 'string' || currency.length === 0
      || typeof totalBalance !== 'string'
      || typeof grantedBalance !== 'string'
      || typeof toppedUpBalance !== 'string'
    ) {
      throw new BalanceError('invalid-response', 'balance_infos entry has non-string fields')
    }
    return { currency, totalBalance, grantedBalance, toppedUpBalance } satisfies BalanceEntry
  })
  return { isAvailable: record.is_available, entries }
}
