export declare const inject: string[];
/** Plugin entry config; every field is optional and has a default. */
export interface PluginConfig {
    /** Poll interval offered to the browser half, in ms (minimum 1000). */
    intervalMs?: number;
    /** Per-currency amount below which the badge warns (default 10). */
    lowBalanceThreshold?: number;
    /** Credential reference (environment-variable name); default `DEEPSEEK_API_KEY`. */
    apiKeyEnv?: string;
    /** API origin; default `https://api.deepseek.com`. */
    baseUrl?: string;
}
interface ConnectionFetchRoute {
    /** Absolute path below `/api`; the carrier applies its trust/auth policy. */
    readonly path: string;
    readonly methods: readonly string[];
    readonly requestBody: 'buffered' | 'streaming';
    readonly fetch: (request: Request) => Promise<Response>;
}
interface ConnectionService {
    readonly fetch: {
        register(route: ConnectionFetchRoute): unknown;
    };
}
interface Logger {
    error(...args: readonly unknown[]): void;
    info(...args: readonly unknown[]): void;
    warn(...args: readonly unknown[]): void;
}
interface HostCtx {
    get(service: string): unknown;
    readonly connection?: ConnectionService;
    readonly logger?: Logger;
}
/**
 * Register the balance route. The config knobs ride every response so the
 * browser half follows a host-side config change without a reload.
 * @param ctx - host plugin context (Connection service required).
 * @param config - raw entry config; defaults fill every gap.
 */
export declare function apply(ctx: HostCtx, config?: PluginConfig): Promise<void>;
export {};
