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
export const BALANCE_PATH = '/api/liangwengu.balance'

/** One `balance_infos` element; amounts are decimal strings. */
export interface BalanceEntry {
  readonly currency: string
  readonly totalBalance: string
  readonly grantedBalance: string
  readonly toppedUpBalance: string
}

/** What the host route answers, either way. */
export interface BalancePollResult {
  readonly ok: boolean
  readonly value?: {
    readonly isAvailable: boolean
    readonly entries: readonly BalanceEntry[]
    /** Host-configured poll interval, when the host reported one. */
    readonly pollIntervalMs?: number
    /** Host-configured low-balance threshold, when the host reported one. */
    readonly lowBalanceThreshold?: number
  }
  readonly error?: { readonly code: string; readonly message?: string }
}

/** Polled state of one account. */
export interface BalanceState {
  /** Last successful snapshot; undefined until the first success. */
  readonly entries: readonly BalanceEntry[] | undefined
  readonly isAvailable: boolean | undefined
  /** Epoch ms of the last successful poll. */
  readonly fetchedAt: number | undefined
  /** A poll is in flight right now. */
  readonly loading: boolean
  /** Consecutive failures since the last success. */
  readonly failureCount: number
  readonly lastError: { readonly code: string; readonly message?: string } | undefined
  /** Effective poll interval, from the host when it reported one. */
  readonly pollIntervalMs: number
  /** Effective low-balance threshold, from the host when it reported one. */
  readonly lowBalanceThreshold: number
}

export interface BalanceStore {
  /** Current state; a new object identity after every change. */
  getSnapshot(): BalanceState
  /** Observe state changes; returns the unsubscribe function. */
  subscribe(listener: () => void): () => void
  /** Start polling while the caller is mounted; returns the release function. */
  acquire(): () => void
  /** Poll once right now, ignoring the schedule. */
  refresh(): void
}

/** Defaults when the host reported no knobs (or is unreachable). */
const DEFAULT_INTERVAL_MS = 5_000
export const DEFAULT_LOW_BALANCE_THRESHOLD = 10

/** Max failure tier; further failures keep the third delay instead of escalating. */
const MAX_BACKOFF_TIER = 3

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
export function nextPollDelayMs(failureCount: number, intervalMs: number): number {
  if (failureCount < 1) return intervalMs
  const tier = Math.min(failureCount, MAX_BACKOFF_TIER)
  return Math.max((tier + 1) * intervalMs, tier * 10_000)
}

/** Spread of one scheduled delay: ±10%. */
const JITTER_RATIO = 0.1

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
export function jitteredDelayMs(delayMs: number, random: () => number = Math.random): number {
  const spread = Math.round(delayMs * JITTER_RATIO)
  if (spread === 0) return delayMs
  return delayMs - spread + Math.round(random() * spread * 2)
}

/** Query the host's balance route; never throws, always answers a result shape. */
async function callBalanceStatus(): Promise<BalancePollResult> {
  try {
    const response = await fetch(BALANCE_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    if (!response.ok) {
      return { ok: false, error: { code: 'transport', message: `HTTP ${response.status}` } }
    }
    const body = await response.json() as BalancePollResult | null
    if (body !== null && typeof body === 'object' && typeof body.ok === 'boolean') return body
    return { ok: false, error: { code: 'transport', message: 'malformed status response' } }
  } catch (error) {
    return { ok: false, error: { code: 'transport', message: String(error) } }
  }
}

/**
 * Build a poller around one status call.
 * @param callStatus - the transport, injectable so the store is testable.
 * @returns the store consumed by the badge.
 */
export function createBalanceStore(
  callStatus: () => Promise<BalancePollResult> = callBalanceStatus,
): BalanceStore {
  let state: BalanceState = {
    entries: undefined,
    isAvailable: undefined,
    fetchedAt: undefined,
    loading: false,
    failureCount: 0,
    lastError: undefined,
    pollIntervalMs: DEFAULT_INTERVAL_MS,
    lowBalanceThreshold: DEFAULT_LOW_BALANCE_THRESHOLD,
  }
  let refs = 0
  let running = false
  let inFlight = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const listeners = new Set<() => void>()

  const publish = (next: BalanceState): void => {
    state = next
    for (const listener of listeners) listener()
  }

  const clearTimer = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  const arm = (): void => {
    clearTimer()
    if (!running) return
    const delay = jitteredDelayMs(nextPollDelayMs(state.failureCount, state.pollIntervalMs))
    timer = setTimeout(() => { void poll().then(arm) }, delay)
  }

  const poll = async (): Promise<void> => {
    if (inFlight) return
    inFlight = true
    publish({ ...state, loading: true })
    try {
      const result = await callStatus()
      if (result.ok && result.value !== undefined) {
        publish({
          entries: result.value.entries,
          isAvailable: result.value.isAvailable,
          fetchedAt: Date.now(),
          loading: false,
          failureCount: 0,
          lastError: undefined,
          pollIntervalMs: result.value.pollIntervalMs ?? state.pollIntervalMs,
          lowBalanceThreshold: result.value.lowBalanceThreshold ?? state.lowBalanceThreshold,
        })
      } else {
        publish({
          ...state,
          loading: false,
          failureCount: state.failureCount + 1,
          lastError: result.error ?? { code: 'api' },
        })
      }
    } catch (error) {
      publish({ ...state, loading: false, failureCount: state.failureCount + 1, lastError: { code: 'internal', message: String(error) } })
    } finally {
      inFlight = false
    }
  }

  const onVisibility = (): void => {
    if (document.hidden) clearTimer()
    else if (running) void poll().then(arm)
  }

  const start = (): void => {
    running = true
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
    void poll().then(arm)
  }

  const stop = (): void => {
    running = false
    clearTimer()
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
  }

  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    acquire: () => {
      refs += 1
      if (refs === 1) start()
      let released = false
      return () => {
        if (released) return
        released = true
        refs -= 1
        if (refs === 0) stop()
      }
    },
    refresh: () => { void poll().then(arm) },
  }
}

/** The poller the badge and its menu share. */
export const balance: BalanceStore = createBalanceStore()

/** Currency sign for the compact badge line; unknown codes keep their own name. */
export function currencySign(currency: string): string {
  switch (currency) {
    case 'CNY': return '¥'
    case 'USD': return '$'
    default: return `${currency} `
  }
}

/**
 * The badge's amount text for one account's entries.
 * @param entries - successful snapshot entries, in wire order.
 * @returns e.g. `¥110.00` or `¥110.00 · $5.00`; an empty string when there are none.
 */
export function formatBalanceEntries(entries: readonly BalanceEntry[]): string {
  return entries.map(entry => `${currencySign(entry.currency)}${entry.totalBalance}`).join(' · ')
}

/** Whether one entry sits below the low-balance threshold. */
export function isEntryLow(entry: BalanceEntry, threshold: number): boolean {
  const amount = Number(entry.totalBalance)
  return Number.isFinite(amount) && amount < threshold
}

/** Whether the account is out of balance: below the threshold, or unusable. */
export function isBalanceLow(state: BalanceState): boolean {
  if (state.isAvailable === false) return true
  return (state.entries ?? []).some(entry => isEntryLow(entry, state.lowBalanceThreshold))
}

/** Presentation tone of the balance line: which fact deserves the colour. */
export type BalanceTone = 'ok' | 'low' | 'stale' | 'none'

/**
 * Colour intent for the balance surfaces.
 * @param state - current polled state.
 * @returns `low` (out of balance), `stale` (showing the last good value after a
 * failure), `ok` (live data), or `none` (no data to show yet).
 */
export function balanceTone(state: BalanceState): BalanceTone {
  const hasData = state.entries !== undefined && state.entries.length > 0
  if (hasData && isBalanceLow(state)) return 'low'
  if (hasData) return state.failureCount > 0 ? 'stale' : 'ok'
  return 'none'
}

/**
 * The badge's balance line text.
 * @param state - current polled state.
 * @returns the amount, a short reason it is missing, or `—`.
 */
export function badgeBalanceText(state: BalanceState): string {
  const entries = state.entries
  if (entries !== undefined && entries.length > 0) {
    return `${formatBalanceEntries(entries)}${balanceTone(state) === 'ok' ? '' : ' ⚠'}`
  }
  if (state.failureCount > 0) {
    return state.lastError?.code === 'no-key' ? '未配置密钥' : '查询失败'
  }
  return state.loading ? '查询中…' : '—'
}

/**
 * The menu's stand-in line when there is no amount to show.
 * @param state - current polled state.
 * @returns why the balance is missing, and what to do about it.
 */
export function balanceEmptyText(state: BalanceState): string {
  if (state.failureCount > 0) {
    return state.lastError === undefined ? '查询失败' : balanceErrorText(state.lastError)
  }
  return state.loading ? '查询中…' : '尚未查询到余额。'
}

/**
 * Explain one poll failure, keeping the wire message when it carries one.
 * @param error - the failure code and optional message from the host route.
 * @returns a one-line Chinese explanation.
 */
export function balanceErrorText(error: { readonly code: string; readonly message?: string }): string {
  const detail = error.message === undefined || error.message.length === 0 ? '' : `（${error.message}）`
  switch (error.code) {
    case 'no-key':
      return '未配置 API key：在 Web Models 页填写，或导出 DEEPSEEK_API_KEY 后重启'
    case 'unauthorized':
      return `API key 被 DeepSeek 拒绝${detail}`
    case 'network':
      return `无法连接 DeepSeek${detail}`
    case 'invalid-response':
      return `余额响应格式异常${detail}`
    case 'transport':
      return `宿主通道不可用${detail}`
    default:
      return `DeepSeek 返回错误${detail}`
  }
}

/**
 * When the shown amount was last confirmed.
 * @param state - current polled state.
 * @returns local wall-clock time of the last success, or a never-updated label.
 */
export function balanceUpdatedText(state: BalanceState): string {
  if (state.fetchedAt === undefined) return '尚未成功查询'
  return new Date(state.fetchedAt).toLocaleTimeString()
}
