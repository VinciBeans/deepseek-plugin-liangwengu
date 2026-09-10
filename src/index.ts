/**
 * 梁文谷 — node half.
 *
 * Two jobs:
 *   1. the empty body that puts this package on the host cordis tree;
 *   2. the account-balance channel behind the browser half's badge line and
 *      detail menu.
 *
 * The channel is one exact Fetch route on Connection's shared `/api` carrier
 * (`POST /api/liangwengu.balance`). Connection applies the deployment's
 * Host/Origin fence and browser authentication before the handler runs, and
 * the plugin names its own path (rather than reusing the balance plugin's) so
 * both packages can stay installed at once — Connection rejects a duplicate
 * exact route.
 *
 * The API key is resolved per request through DSH's credential seam (the same
 * chain the DeepSeek model adapter uses), so a key stored or rotated in the web
 * Models page reaches the next poll. The key never crosses the wire: only the
 * balance snapshot does. A profile without a Connection service (headless)
 * leaves the plugin inactive.
 */
import {
  BalanceError,
  PUBLIC_BASE_URL,
  fetchBalance,
  type BalanceSnapshot,
} from './balance-api'

export const inject = ['connection']

/** Plugin entry config; every field is optional and has a default. */
export interface PluginConfig {
  /** Poll interval offered to the browser half, in ms (minimum 1000). */
  intervalMs?: number
  /** Per-currency amount below which the badge warns (default 10). */
  lowBalanceThreshold?: number
  /** Credential reference (environment-variable name); default `DEEPSEEK_API_KEY`. */
  apiKeyEnv?: string
  /** API origin; default `https://api.deepseek.com`. */
  baseUrl?: string
}

const DEFAULT_INTERVAL_MS = 5_000
const DEFAULT_LOW_BALANCE_THRESHOLD = 10
const DEFAULT_API_KEY_ENV = 'DEEPSEEK_API_KEY'
const DEFAULT_TIMEOUT_MS = 10_000

/** This plugin's exact route below Connection's `/api` carrier. */
const BALANCE_PATH = '/api/liangwengu.balance'

// ---------------------------------------------------------------------------
// Minimal structural typings. The services below are seams the DSH install
// provides; the packages are not imported (the node bundle stays
// dependency-free), and every access is guarded so an absent service degrades
// to "UI reports unavailable" instead of failing the fiber.
// ---------------------------------------------------------------------------

interface RpcFailure {
  readonly code: string
  readonly message: string
}

interface CredentialsService {
  resolve(ref: string): Promise<{ readonly value?: string } | undefined> | undefined
}

interface ConnectionFetchRoute {
  /** Absolute path below `/api`; the carrier applies its trust/auth policy. */
  readonly path: string
  readonly methods: readonly string[]
  readonly requestBody: 'buffered' | 'streaming'
  readonly fetch: (request: Request) => Promise<Response>
}

interface ConnectionService {
  readonly fetch: { register(route: ConnectionFetchRoute): unknown }
}

interface Logger {
  error(...args: readonly unknown[]): void
}

interface HostCtx {
  get(service: string): unknown
  readonly connection?: ConnectionService
  readonly logger?: Logger
}

/** Effective config after defaults; also what the browser half polls for. */
interface ResolvedConfig {
  readonly intervalMs: number
  readonly lowBalanceThreshold: number
  readonly apiKeyEnv: string
  readonly baseUrl: string
}

/** Bad config cannot break the route: every field falls back to its default. */
function resolveConfig(config: PluginConfig): ResolvedConfig {
  const intervalMs = config.intervalMs
  const threshold = config.lowBalanceThreshold
  return {
    intervalMs: typeof intervalMs === 'number' && intervalMs >= 1_000 ? intervalMs : DEFAULT_INTERVAL_MS,
    lowBalanceThreshold: typeof threshold === 'number' && threshold >= 0 ? threshold : DEFAULT_LOW_BALANCE_THRESHOLD,
    apiKeyEnv: typeof config.apiKeyEnv === 'string' && config.apiKeyEnv.length > 0 ? config.apiKeyEnv : DEFAULT_API_KEY_ENV,
    baseUrl: typeof config.baseUrl === 'string' && config.baseUrl.length > 0 ? config.baseUrl : PUBLIC_BASE_URL,
  }
}

/** The launch environment, read off `globalThis` so no node type package is needed. */
function launchEnvironment(): Record<string, string | undefined> {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  return proc?.env ?? {}
}

/** Resolve the reference through the credential seam, then the environment. */
async function resolveApiKey(ctx: HostCtx, ref: string): Promise<string> {
  const credentials = ctx.get('credentials') as CredentialsService | undefined
  if (credentials !== undefined) {
    const hit = await credentials.resolve(ref)
    if (hit?.value !== undefined && hit.value.length > 0) return hit.value
  }
  const ambient = launchEnvironment()[ref]
  if (ambient !== undefined && ambient.length > 0) return ambient
  throw new BalanceError(
    'no-key',
    `no API key for "${ref}"; store it through the credentials service (the web Models page writes it), or export ${ref} in the launching environment`,
  )
}

/** One poll: resolve the key, fetch, and normalize any failure to a code. */
async function querySnapshot(ctx: HostCtx, config: ResolvedConfig): Promise<BalanceSnapshot> {
  const apiKey = await resolveApiKey(ctx, config.apiKeyEnv)
  try {
    return await fetchBalance(config.baseUrl, apiKey, DEFAULT_TIMEOUT_MS)
  } catch (error) {
    if (error instanceof BalanceError) throw error
    throw new BalanceError('network', String(error))
  }
}

/** The failure shape the browser half switches on. */
function asFailure(error: unknown): RpcFailure {
  if (error instanceof BalanceError) return { code: error.code, message: error.message }
  return { code: 'api', message: String(error) }
}

/**
 * Register the balance route. The config knobs ride every response so the
 * browser half follows a host-side config change without a reload.
 * @param ctx - host plugin context (Connection service required).
 * @param config - raw entry config; defaults fill every gap.
 */
export async function apply(ctx: HostCtx, config: PluginConfig = {}): Promise<void> {
  const resolved = resolveConfig(config)
  try {
    const connection = ctx.connection
    if (connection === undefined) {
      ctx.logger?.error('liangwengu: connection service unavailable; balance channel disabled')
      return
    }
    connection.fetch.register({
      path: BALANCE_PATH,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: async () => {
        try {
          const snapshot = await querySnapshot(ctx, resolved)
          return Response.json(
            { ok: true, value: { ...snapshot, ...pollKnobs(resolved) } },
            { headers: { 'cache-control': 'no-store' } },
          )
        } catch (error) {
          return Response.json({ ok: false, error: asFailure(error) })
        }
      },
    })
  } catch (error) {
    // A contract change degrades to "balance unavailable" in the UI instead of
    // failing the whole plugin fiber.
    ctx.logger?.error('liangwengu: balance route registration failed', error)
  }
}

/** Config values the browser half needs on its side of the wire. */
function pollKnobs(config: ResolvedConfig): {
  readonly pollIntervalMs: number
  readonly lowBalanceThreshold: number
} {
  return {
    pollIntervalMs: config.intervalMs,
    lowBalanceThreshold: config.lowBalanceThreshold,
  }
}
