// src/balance-api.ts
var PUBLIC_BASE_URL = "https://api.deepseek.com";
var BalanceError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "BalanceError";
    this.code = code;
  }
};
var DEFAULT_TIMEOUT_MS = 1e4;
async function fetchBalance(baseUrl, apiKey, timeoutMs = DEFAULT_TIMEOUT_MS, doFetch = fetch) {
  if (apiKey.length === 0) throw new BalanceError("no-key", "no API key");
  const target = `${baseUrl.replace(/\/+$/, "")}/user/balance`;
  let response;
  try {
    response = await doFetch(target, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    throw new BalanceError("network", `request to ${target} failed: ${String(error)}`);
  }
  if (response.status === 401 || response.status === 403) {
    throw new BalanceError("unauthorized", `DeepSeek rejected the API key (HTTP ${response.status})`);
  }
  if (!response.ok) {
    throw new BalanceError("api", `DeepSeek balance endpoint answered HTTP ${response.status}`);
  }
  let raw;
  try {
    raw = await response.json();
  } catch {
    throw new BalanceError("invalid-response", "balance endpoint did not answer JSON");
  }
  return parseBalanceResponse(raw);
}
function parseBalanceResponse(raw) {
  if (typeof raw !== "object" || raw === null) {
    throw new BalanceError("invalid-response", "balance response is not an object");
  }
  const record = raw;
  if (typeof record.is_available !== "boolean" || !Array.isArray(record.balance_infos)) {
    throw new BalanceError("invalid-response", "balance response lacks is_available or balance_infos");
  }
  const entries = record.balance_infos.map((value) => {
    if (typeof value !== "object" || value === null) {
      throw new BalanceError("invalid-response", "balance_infos entry is not an object");
    }
    const item = value;
    const { currency, total_balance: totalBalance, granted_balance: grantedBalance, topped_up_balance: toppedUpBalance } = item;
    if (typeof currency !== "string" || currency.length === 0 || typeof totalBalance !== "string" || typeof grantedBalance !== "string" || typeof toppedUpBalance !== "string") {
      throw new BalanceError("invalid-response", "balance_infos entry has non-string fields");
    }
    return { currency, totalBalance, grantedBalance, toppedUpBalance };
  });
  return { isAvailable: record.is_available, entries };
}

// src/index.ts
var inject = ["connection"];
var DEFAULT_INTERVAL_MS = 5e3;
var DEFAULT_LOW_BALANCE_THRESHOLD = 10;
var DEFAULT_API_KEY_ENV = "DEEPSEEK_API_KEY";
var DEFAULT_TIMEOUT_MS2 = 1e4;
var BALANCE_PATH = "/api/liangwengu.balance";
var COALESCE_MS = 1500;
function resolveConfig(config) {
  const intervalMs = config.intervalMs;
  const threshold = config.lowBalanceThreshold;
  return {
    intervalMs: typeof intervalMs === "number" && intervalMs >= 1e3 ? intervalMs : DEFAULT_INTERVAL_MS,
    lowBalanceThreshold: typeof threshold === "number" && threshold >= 0 ? threshold : DEFAULT_LOW_BALANCE_THRESHOLD,
    apiKeyEnv: typeof config.apiKeyEnv === "string" && config.apiKeyEnv.length > 0 ? config.apiKeyEnv : DEFAULT_API_KEY_ENV,
    baseUrl: typeof config.baseUrl === "string" && config.baseUrl.length > 0 ? config.baseUrl : PUBLIC_BASE_URL
  };
}
function launchEnvironment() {
  const proc = globalThis.process;
  return proc?.env ?? {};
}
async function resolveApiKey(ctx, ref) {
  const credentials = ctx.get("credentials");
  if (credentials !== void 0) {
    const hit = await credentials.resolve(ref);
    if (hit?.value !== void 0 && hit.value.length > 0) return hit.value;
  }
  const ambient = launchEnvironment()[ref];
  if (ambient !== void 0 && ambient.length > 0) return ambient;
  throw new BalanceError(
    "no-key",
    `no API key for "${ref}"; store it through the credentials service (the web Models page writes it), or export ${ref} in the launching environment`
  );
}
async function querySnapshot(ctx, config) {
  const apiKey = await resolveApiKey(ctx, config.apiKeyEnv);
  try {
    return await fetchBalance(config.baseUrl, apiKey, DEFAULT_TIMEOUT_MS2);
  } catch (error) {
    if (error instanceof BalanceError) throw error;
    throw new BalanceError("network", String(error));
  }
}
function asFailure(error) {
  if (error instanceof BalanceError) return { code: error.code, message: error.message };
  return { code: "api", message: String(error) };
}
async function apply(ctx, config = {}) {
  const resolved = resolveConfig(config);
  let recent;
  const queryRecent = () => {
    const now = Date.now();
    if (recent !== void 0 && now - recent.at < COALESCE_MS) return recent.snapshot;
    const snapshot = querySnapshot(ctx, resolved);
    recent = { at: now, snapshot };
    return snapshot;
  };
  try {
    const connection = ctx.connection;
    if (connection === void 0) {
      ctx.logger?.error("liangwengu: connection service unavailable; balance channel disabled");
      return;
    }
    connection.fetch.register({
      path: BALANCE_PATH,
      methods: ["POST"],
      requestBody: "buffered",
      fetch: async () => {
        try {
          const snapshot = await queryRecent();
          return Response.json(
            { ok: true, value: { ...snapshot, ...pollKnobs(resolved) } },
            { headers: { "cache-control": "no-store" } }
          );
        } catch (error) {
          return Response.json({ ok: false, error: asFailure(error) });
        }
      }
    });
  } catch (error) {
    ctx.logger?.error("liangwengu: balance route registration failed", error);
  }
}
function pollKnobs(config) {
  return {
    pollIntervalMs: config.intervalMs,
    lowBalanceThreshold: config.lowBalanceThreshold
  };
}
export {
  apply,
  inject
};
