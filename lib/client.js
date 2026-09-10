window.__ModuleLoader__.load({ id: "liangwengu", factory: (require) => { var module = { exports: {} }; var exports = module.exports; Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  BALANCE_PATH: () => BALANCE_PATH,
  FLASH_PRICE_CHANGE_AT: () => FLASH_PRICE_CHANGE_AT,
  OFFICIAL_MODELS: () => OFFICIAL_MODELS,
  PRICING_SOURCE_URL: () => PRICING_SOURCE_URL,
  PRICING_UPDATED_AT: () => PRICING_UPDATED_AT,
  TimeSlotIndicator: () => TimeSlotIndicator,
  activeRevision: () => activeRevision,
  apply: () => apply,
  badgeBalanceText: () => badgeBalanceText,
  balance: () => balance,
  balanceEmptyText: () => balanceEmptyText,
  balanceErrorText: () => balanceErrorText,
  balanceTone: () => balanceTone,
  balanceUpdatedText: () => balanceUpdatedText,
  cacheHitRate: () => cacheHitRate,
  compositePerYiTokens: () => compositePerYiTokens,
  costYuan: () => costYuan,
  createBalanceStore: () => createBalanceStore,
  currencySign: () => currencySign,
  formatBalanceEntries: () => formatBalanceEntries,
  formatBeijingDateTime: () => formatBeijingDateTime,
  formatCompactTokens: () => formatCompactTokens,
  formatCountdown: () => formatCountdown,
  formatHitRate: () => formatHitRate,
  formatMoney: () => formatMoney,
  formatRate: () => formatRate,
  getBeijingSeconds: () => getBeijingSeconds,
  getBeijingWeekday: () => getBeijingWeekday,
  getSlotLabel: () => getSlotLabel,
  getSlotRemaining: () => getSlotRemaining,
  inject: () => inject,
  isBalanceLow: () => isBalanceLow,
  isEntryLow: () => isEntryLow,
  jitteredDelayMs: () => jitteredDelayMs,
  lookupPricing: () => lookupPricing,
  nextPollDelayMs: () => nextPollDelayMs,
  nextRevision: () => nextRevision,
  rateAt: () => rateAt,
  tierLabel: () => tierLabel,
  totalTokens: () => totalTokens
});
module.exports = __toCommonJS(index_exports);
var import_react4 = require("react");

// src/client/pricing.ts
function tierLabel(tier) {
  return tier === "peak" ? "\u9AD8\u5CF0\u65F6\u6BB5" : "\u7A7A\u95F2\u65F6\u6BB5";
}
var PRICING_SOURCE_URL = "https://api-docs.deepseek.com/zh-cn/quick_start/pricing";
var PRICING_UPDATED_AT = "2026-09-08";
var FLASH_PRICE_CHANGE_AT = Date.UTC(2026, 8, 10, 4, 0, 0);
function rate(cacheHit, cacheMiss, output) {
  return Object.freeze({ cacheHit, cacheMiss, output });
}
var FLASH_BASE = Object.freeze({
  effectiveFrom: 0,
  offPeak: rate(0.05, 1.5, 4.5),
  peak: rate(0.1, 3, 9)
});
var FLASH_CUT = Object.freeze({
  effectiveFrom: FLASH_PRICE_CHANGE_AT,
  offPeak: rate(0.02, 1, 4),
  peak: rate(0.04, 2, 8)
});
var OFFICIAL_MODELS = [
  {
    id: "deepseek-v4-flash",
    pricing: { name: "V4-Flash", revisions: [FLASH_BASE, FLASH_CUT] }
  },
  {
    id: "deepseek-v4-pro",
    pricing: {
      name: "V4-Pro",
      revisions: [{
        effectiveFrom: 0,
        offPeak: rate(0.15, 4.5, 13.5),
        peak: rate(0.3, 9, 27)
      }]
    }
  },
  {
    // The notice says "flash 系列"; the official page prices this vision variant
    // identically to deepseek-v4-flash, so it moves with the same revision.
    id: "deepseek-v4-flash-vision-exp",
    pricing: { name: "V4-Flash-Vision", revisions: [FLASH_BASE, FLASH_CUT] }
  },
  {
    // V4.1-Flash is priced line-for-line with the rest of the flash series, so
    // it reuses the same two revisions rather than copying their numbers: the
    // announced flash cut moves it as well.
    id: "deepseek-flash",
    pricing: { name: "V4.1-Flash", revisions: [FLASH_BASE, FLASH_CUT] }
  }
];
function lookupPricing(modelId) {
  if (modelId === null || modelId === void 0) return void 0;
  return OFFICIAL_MODELS.find((entry) => entry.id === modelId)?.pricing;
}
function activeRevision(pricing, atMs) {
  let active = pricing.revisions[0];
  for (const revision of pricing.revisions) {
    if (revision.effectiveFrom > atMs) break;
    active = revision;
  }
  return active;
}
function nextRevision(pricing, atMs) {
  return pricing.revisions.find((revision) => revision.effectiveFrom > atMs);
}
function rateAt(pricing, atMs, tier) {
  return activeRevision(pricing, atMs)[tier];
}
var BEIJING_OFFSET_MS = 8 * 3600 * 1e3;
function formatBeijingDateTime(epochMs) {
  const shifted = new Date(epochMs + BEIJING_OFFSET_MS);
  const pad = (value) => String(value).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())} ${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}
function billedInputTokens(buckets) {
  return buckets.uncachedInputTokens + buckets.cacheReadTokens + buckets.cacheWriteTokens;
}
function totalTokens(buckets) {
  return billedInputTokens(buckets) + buckets.outputTokens;
}
function cacheHitRate(buckets) {
  const prompt = billedInputTokens(buckets);
  return prompt === 0 ? null : buckets.cacheReadTokens / prompt;
}
function costYuan(buckets, rate2) {
  const cost = (buckets.uncachedInputTokens * rate2.cacheMiss + buckets.cacheReadTokens * rate2.cacheHit + buckets.cacheWriteTokens * rate2.cacheMiss + buckets.outputTokens * rate2.output) / 1e6;
  return cost;
}
function compositePerYiTokens(buckets, rate2) {
  const total = totalTokens(buckets);
  if (total === 0) return 0;
  return costYuan(buckets, rate2) / total * 1e8;
}
function formatRate(value) {
  if (value === 0) return "0";
  return value < 1 ? value.toFixed(2) : String(Math.round(value * 10) / 10);
}
function formatMoney(value) {
  return value.toFixed(2);
}
function formatCompactTokens(value) {
  if (value < 1e3) return String(value);
  const scaled = (candidate) => candidate >= 100 ? String(Math.round(candidate)) : String(Math.round(candidate * 10) / 10);
  if (value < 1e6) return `${scaled(value / 1e3)}K`;
  return `${scaled(value / 1e6)}M`;
}
function formatHitRate(rate2) {
  if (rate2 >= 1) return "100";
  const tenths = Math.min(999, Math.round(rate2 * 1e3));
  return (tenths / 10).toFixed(1);
}

// src/client/time-slot.ts
var DAY_MS = 864e5;
var PEAK_SLOTS = [
  [9 * 60, 12 * 60],
  [14 * 60, 18 * 60]
];
function getBeijingDayIndex(date) {
  return Math.floor((date.getTime() + BEIJING_OFFSET_MS) / DAY_MS);
}
function getBeijingWeekday(date) {
  return (getBeijingDayIndex(date) + 4) % 7;
}
function getBeijingSeconds(date) {
  const ms = date.getTime() + BEIJING_OFFSET_MS;
  return Math.floor(ms % DAY_MS / 1e3);
}
function getBeijingMinutes(date) {
  return Math.floor(getBeijingSeconds(date) / 60);
}
function isPeakMoment(date) {
  const weekday = getBeijingWeekday(date);
  if (weekday === 0 || weekday === 6) return false;
  const minutes = getBeijingMinutes(date);
  return PEAK_SLOTS.some(([start, end]) => minutes >= start && minutes < end);
}
function getSlotLabel(date) {
  return isPeakMoment(date) ? "\u5F53\u524D\u65F6\u6BB5\uFF1A\u6881\u6587\u5CF0" : "\u5F53\u524D\u65F6\u6BB5\uFF1A\u6881\u6587\u8C37";
}
function tierOf(date) {
  return isPeakMoment(date) ? "peak" : "offPeak";
}
function getNextPeakStartMs(date) {
  const ms = date.getTime();
  const dayIndex = getBeijingDayIndex(date);
  const dayStartMs = dayIndex * DAY_MS - BEIJING_OFFSET_MS;
  for (let offset = 0; offset < 8; offset += 1) {
    const weekday = (dayIndex + offset + 4) % 7;
    if (weekday === 0 || weekday === 6) continue;
    for (const [start] of PEAK_SLOTS) {
      const candidate = dayStartMs + offset * DAY_MS + start * 60 * 1e3;
      if (candidate > ms) return candidate;
    }
  }
  return ms;
}
function getSlotRemaining(date) {
  if (isPeakMoment(date)) {
    const seconds = getBeijingSeconds(date);
    const end = seconds < 12 * 3600 ? 12 * 3600 : 18 * 3600;
    return end - seconds;
  }
  return Math.ceil((getNextPeakStartMs(date) - date.getTime()) / 1e3);
}
function formatCountdown(totalSeconds) {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(clamped / 86400);
  const hours = Math.floor(clamped % 86400 / 3600);
  const minutes = Math.floor(clamped % 3600 / 60);
  const seconds = clamped % 60;
  const pad = (value) => String(value).padStart(2, "0");
  const time = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? `${days}\u5929 ${time}` : time;
}

// src/client/balance.ts
var BALANCE_PATH = "/api/liangwengu.balance";
var DEFAULT_INTERVAL_MS = 5e3;
var DEFAULT_LOW_BALANCE_THRESHOLD = 10;
var MAX_BACKOFF_TIER = 3;
function nextPollDelayMs(failureCount, intervalMs) {
  if (failureCount < 1) return intervalMs;
  const tier = Math.min(failureCount, MAX_BACKOFF_TIER);
  return Math.max((tier + 1) * intervalMs, tier * 1e4);
}
var JITTER_RATIO = 0.1;
function jitteredDelayMs(delayMs, random = Math.random) {
  const spread = Math.round(delayMs * JITTER_RATIO);
  if (spread === 0) return delayMs;
  return delayMs - spread + Math.round(random() * spread * 2);
}
async function callBalanceStatus() {
  try {
    const response = await fetch(BALANCE_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}"
    });
    if (!response.ok) {
      return { ok: false, error: { code: "transport", message: `HTTP ${response.status}` } };
    }
    const body = await response.json();
    if (body !== null && typeof body === "object" && typeof body.ok === "boolean") return body;
    return { ok: false, error: { code: "transport", message: "malformed status response" } };
  } catch (error) {
    return { ok: false, error: { code: "transport", message: String(error) } };
  }
}
function createBalanceStore(callStatus = callBalanceStatus) {
  let state = {
    entries: void 0,
    isAvailable: void 0,
    fetchedAt: void 0,
    loading: false,
    failureCount: 0,
    lastError: void 0,
    pollIntervalMs: DEFAULT_INTERVAL_MS,
    lowBalanceThreshold: DEFAULT_LOW_BALANCE_THRESHOLD
  };
  let refs = 0;
  let running = false;
  let inFlight = false;
  let timer;
  const listeners = /* @__PURE__ */ new Set();
  const publish = (next) => {
    state = next;
    for (const listener of listeners) listener();
  };
  const clearTimer = () => {
    if (timer !== void 0) {
      clearTimeout(timer);
      timer = void 0;
    }
  };
  const arm = () => {
    clearTimer();
    if (!running) return;
    const delay = jitteredDelayMs(nextPollDelayMs(state.failureCount, state.pollIntervalMs));
    timer = setTimeout(() => {
      void poll().then(arm);
    }, delay);
  };
  const poll = async () => {
    if (inFlight) return;
    inFlight = true;
    publish({ ...state, loading: true });
    try {
      const result = await callStatus();
      if (result.ok && result.value !== void 0) {
        publish({
          entries: result.value.entries,
          isAvailable: result.value.isAvailable,
          fetchedAt: Date.now(),
          loading: false,
          failureCount: 0,
          lastError: void 0,
          pollIntervalMs: result.value.pollIntervalMs ?? state.pollIntervalMs,
          lowBalanceThreshold: result.value.lowBalanceThreshold ?? state.lowBalanceThreshold
        });
      } else {
        publish({
          ...state,
          loading: false,
          failureCount: state.failureCount + 1,
          lastError: result.error ?? { code: "api" }
        });
      }
    } catch (error) {
      publish({ ...state, loading: false, failureCount: state.failureCount + 1, lastError: { code: "internal", message: String(error) } });
    } finally {
      inFlight = false;
    }
  };
  const onVisibility = () => {
    if (document.hidden) clearTimer();
    else if (running) void poll().then(arm);
  };
  const start = () => {
    running = true;
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);
    void poll().then(arm);
  };
  const stop = () => {
    running = false;
    clearTimer();
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
  };
  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    acquire: () => {
      refs += 1;
      if (refs === 1) start();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        refs -= 1;
        if (refs === 0) stop();
      };
    },
    refresh: () => {
      void poll().then(arm);
    }
  };
}
var balance = createBalanceStore();
function currencySign(currency) {
  switch (currency) {
    case "CNY":
      return "\xA5";
    case "USD":
      return "$";
    default:
      return `${currency} `;
  }
}
function formatBalanceEntries(entries) {
  return entries.map((entry) => `${currencySign(entry.currency)}${entry.totalBalance}`).join(" \xB7 ");
}
function isEntryLow(entry, threshold) {
  const amount = Number(entry.totalBalance);
  return Number.isFinite(amount) && amount < threshold;
}
function isBalanceLow(state) {
  if (state.isAvailable === false) return true;
  return (state.entries ?? []).some((entry) => isEntryLow(entry, state.lowBalanceThreshold));
}
function balanceTone(state) {
  const hasData = state.entries !== void 0 && state.entries.length > 0;
  if (hasData && isBalanceLow(state)) return "low";
  if (hasData) return state.failureCount > 0 ? "stale" : "ok";
  return "none";
}
function badgeBalanceText(state) {
  const entries = state.entries;
  if (entries !== void 0 && entries.length > 0) {
    return `${formatBalanceEntries(entries)}${balanceTone(state) === "ok" ? "" : " \u26A0"}`;
  }
  if (state.failureCount > 0) {
    return state.lastError?.code === "no-key" ? "\u672A\u914D\u7F6E\u5BC6\u94A5" : "\u67E5\u8BE2\u5931\u8D25";
  }
  return state.loading ? "\u67E5\u8BE2\u4E2D\u2026" : "\u2014";
}
function balanceEmptyText(state) {
  if (state.failureCount > 0) {
    return state.lastError === void 0 ? "\u67E5\u8BE2\u5931\u8D25" : balanceErrorText(state.lastError);
  }
  return state.loading ? "\u67E5\u8BE2\u4E2D\u2026" : "\u5C1A\u672A\u67E5\u8BE2\u5230\u4F59\u989D\u3002";
}
function balanceErrorText(error) {
  const detail = error.message === void 0 || error.message.length === 0 ? "" : `\uFF08${error.message}\uFF09`;
  switch (error.code) {
    case "no-key":
      return "\u672A\u914D\u7F6E API key\uFF1A\u5728 Web Models \u9875\u586B\u5199\uFF0C\u6216\u5BFC\u51FA DEEPSEEK_API_KEY \u540E\u91CD\u542F";
    case "unauthorized":
      return `API key \u88AB DeepSeek \u62D2\u7EDD${detail}`;
    case "network":
      return `\u65E0\u6CD5\u8FDE\u63A5 DeepSeek${detail}`;
    case "invalid-response":
      return `\u4F59\u989D\u54CD\u5E94\u683C\u5F0F\u5F02\u5E38${detail}`;
    case "transport":
      return `\u5BBF\u4E3B\u901A\u9053\u4E0D\u53EF\u7528${detail}`;
    default:
      return `DeepSeek \u8FD4\u56DE\u9519\u8BEF${detail}`;
  }
}
function balanceUpdatedText(state) {
  if (state.fetchedAt === void 0) return "\u5C1A\u672A\u6210\u529F\u67E5\u8BE2";
  return new Date(state.fetchedAt).toLocaleTimeString();
}

// src/client/BalanceSection.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var BalanceSection = (0, import_react.memo)(function BalanceSection2({ state, onRefresh }) {
  const entries = state.entries ?? [];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-lwgu-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh-lwgu-title", children: "\u8D26\u6237\u4F59\u989D" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          className: "dsh-lwgu-refresh",
          disabled: state.loading,
          onClick: onRefresh,
          children: state.loading ? "\u67E5\u8BE2\u4E2D\u2026" : "\u5237\u65B0"
        }
      )
    ] }),
    entries.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-lwgu-note", children: balanceEmptyText(state) }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      entries.map((entry) => {
        const sign = currencySign(entry.currency);
        const low = isEntryLow(entry, state.lowBalanceThreshold);
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-lwgu-bal", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-lwgu-kv", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
              entry.currency,
              " \u603B\u53EF\u7528"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dsh-lwgu-bal-amount", "data-tone": low ? "low" : "ok", children: [
              sign,
              entry.totalBalance
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-lwgu-note", children: [
            "\u672A\u8FC7\u671F\u8D60\u91D1 ",
            sign,
            entry.grantedBalance,
            " \xB7 \u5145\u503C\u4F59\u989D ",
            sign,
            entry.toppedUpBalance
          ] })
        ] }, entry.currency);
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-lwgu-note", children: [
        "\u53EF\u7528\uFF1A",
        state.isAvailable === false ? "\u4E0D\u53EF\u8C03\u7528" : "\u53EF\u8C03\u7528",
        " \xB7 ",
        "\u66F4\u65B0\u4E8E ",
        balanceUpdatedText(state)
      ] })
    ] }),
    state.lastError !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-lwgu-note", children: balanceErrorText(state.lastError) })
  ] });
});

// src/client/CompositeSection.tsx
var import_react2 = require("react");
var import_jsx_runtime2 = require("react/jsx-runtime");
var CompositeSection = (0, import_react2.memo)(function CompositeSection2({
  usage,
  activeEntry,
  revision,
  tier,
  sessionModelId
}) {
  const rate2 = rateAt(activeEntry.pricing, revision.effectiveFrom, tier);
  const billed = usage !== void 0 && totalTokens(usage) > 0;
  const hit = usage === void 0 ? null : cacheHitRate(usage);
  const composite = billed ? compositePerYiTokens(usage, rate2) : null;
  const cost = billed ? costYuan(usage, rate2) : null;
  const sessionPriced = lookupPricing(sessionModelId) !== void 0;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dsh-lwgu-head", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dsh-lwgu-title", children: "\u672C\u4F1A\u8BDD\u7EFC\u5408\u5355\u4EF7" }) }),
    usage === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dsh-lwgu-note", children: "\u5F53\u524D\u4F1A\u8BDD\u6682\u65E0 token \u7528\u91CF\u6570\u636E\u3002" }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-lwgu-kv", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u7F13\u5B58\u547D\u4E2D\u7387" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: hit === null ? "\u2014" : `${formatHitRate(hit)}%` })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-lwgu-kv", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u7F13\u5B58\u8BFB\u53D6" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: formatCompactTokens(usage.cacheReadTokens) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-lwgu-kv", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u672A\u547D\u4E2D\u8F93\u5165" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: formatCompactTokens(usage.uncachedInputTokens) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-lwgu-kv", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u8F93\u51FA" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: formatCompactTokens(usage.outputTokens) })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-lwgu-composite", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dsh-lwgu-composite-value", children: composite === null ? "\u2014" : formatMoney(composite) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dsh-lwgu-composite-unit", children: "\u5143 / \u4EBF tokens" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-lwgu-note", children: [
      "\u6309 ",
      activeEntry.pricing.name,
      " \xB7 ",
      tierLabel(tier),
      "\u5355\u4EF7\u4F30\u7B97",
      cost !== null && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
        " \xB7 \u6309\u5F53\u524D\u5355\u4EF7\u6298\u7B97 \u2248 \xA5",
        formatMoney(cost)
      ] })
    ] }),
    revision.effectiveFrom > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dsh-lwgu-note", children: "\u6574\u6BB5\u4F1A\u8BDD\u7528\u91CF\u7EDF\u4E00\u6309\u8C03\u4EF7\u540E\u5355\u4EF7\u6298\u7B97\uFF0C\u8C03\u4EF7\u524D\u7684\u5386\u53F2\u7528\u91CF\u672A\u5206\u6BB5\u8FD8\u539F\u3002" }),
    sessionModelId !== null && !sessionPriced && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-lwgu-note", children: [
      "\u5F53\u524D\u6A21\u578B ",
      sessionModelId,
      " \u4E0D\u5728\u5B98\u65B9\u4EF7\u76EE\u8868\u4E2D\uFF0C\u5DF2\u6539\u7528 ",
      activeEntry.pricing.name,
      " \u8BA1\u4EF7\uFF1B \u53EF\u70B9\u51FB\u4E0A\u65B9\u6A21\u578B\u884C\u5207\u6362\u8BA1\u4EF7\u6A21\u578B\u3002"
    ] })
  ] });
});

// src/client/PricingTable.tsx
var import_react3 = require("react");
var import_jsx_runtime3 = require("react/jsx-runtime");
var PricingTable = (0, import_react3.memo)(function PricingTable2({
  revision,
  tier,
  activeModelId,
  onPick
}) {
  const at = revision.effectiveFrom;
  const rows = (0, import_react3.useMemo)(() => OFFICIAL_MODELS.map((entry) => ({
    id: entry.id,
    name: entry.pricing.name,
    rate: rateAt(entry.pricing, at, tier)
  })), [at, tier]);
  const upcoming = (0, import_react3.useMemo)(() => {
    const groups = /* @__PURE__ */ new Map();
    for (const entry of OFFICIAL_MODELS) {
      const next = nextRevision(entry.pricing, at);
      if (next === void 0) continue;
      groups.set(next, [...groups.get(next) ?? [], entry.pricing.name]);
    }
    return [...groups];
  }, [at]);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dsh-lwgu-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-lwgu-title", children: "DeepSeek \u5B98\u65B9\u5B9A\u4EF7" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-lwgu-tier", children: tierLabel(tier) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dsh-lwgu-sub", children: [
      "\u5143 / \u767E\u4E07 tokens \xB7 ",
      revision.effectiveFrom === 0 ? `\u4EF7\u76EE\u8868\u66F4\u65B0\u4E8E ${PRICING_UPDATED_AT}` : `${formatBeijingDateTime(revision.effectiveFrom)} \u8D77\u751F\u6548`
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dsh-lwgu-rule" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dsh-lwgu-grid", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dsh-lwgu-grid-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: "\u6A21\u578B" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: "\u7F13\u5B58\u547D\u4E2D" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: "\u672A\u547D\u4E2D" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: "\u8F93\u51FA" })
      ] }),
      rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
        "button",
        {
          type: "button",
          className: "dsh-lwgu-grid-row",
          "aria-pressed": row.id === activeModelId,
          onClick: () => {
            onPick(row.id);
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: row.name }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: formatRate(row.rate.cacheHit) }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: formatRate(row.rate.cacheMiss) }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: formatRate(row.rate.output) })
          ]
        },
        row.id
      ))
    ] }),
    upcoming.map(([next, names]) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dsh-lwgu-note", children: [
      formatBeijingDateTime(next.effectiveFrom),
      " \u8D77 ",
      names.join(" / "),
      " \u8C03\u4EF7\uFF1A \u547D\u4E2D ",
      formatRate(next[tier].cacheHit),
      " / \u672A\u547D\u4E2D ",
      formatRate(next[tier].cacheMiss),
      "/ \u8F93\u51FA ",
      formatRate(next[tier].output),
      "\uFF08",
      tierLabel(tier),
      "\uFF09"
    ] }, names[0]))
  ] });
});

// src/client/styles.ts
var STYLE = `
  .dsh-liangwengu-anchor { display: inline-flex; flex: none; position: relative; }
  .dsh-liangwengu, .dsh-lwgu-panel {
    --lwgu-bg: var(--dsw-alias-bg-layer-1, #ffffff);
    --lwgu-panel-bg: var(--dsw-alias-bg-layer-2, #ffffff);
    --lwgu-border: var(--dsw-alias-border-l1, rgba(0,0,0,0.12));
    --lwgu-text: var(--dsw-alias-label-primary, #222);
    --lwgu-sub: var(--dsw-alias-label-secondary, #8a8f99);
    --lwgu-dim: var(--dsw-alias-label-caption, #9ca3af);
    --lwgu-rule: var(--dsw-alias-border-l2, rgba(0,0,0,0.1));
    --lwgu-hover: var(--dsw-alias-interactive-bg-hover-solid, #f1f3f5);
    --lwgu-active-bg: var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,0.06));
    --lwgu-accent: var(--dsw-alias-link, #4176e6);
    --lwgu-shadow: 0 1px 4px rgba(0,0,0,0.06);
    --lwgu-panel-shadow: 0 8px 28px rgba(0,0,0,0.16);
    --lwgu-peak: var(--dsw-alias-state-success-primary, #22c55e);
    --lwgu-off: var(--dsw-alias-label-caption, #9ca3af);
    --lwgu-warn: var(--dsw-alias-state-warn-primary, #e8a33d);
    --lwgu-alert: var(--dsw-alias-state-error-primary, #d54941);
  }
  body[data-ds-dark-theme] .dsh-liangwengu,
  body[data-ds-dark-theme] .dsh-lwgu-panel {
    --lwgu-bg: #17181c;
    --lwgu-panel-bg: #1c1d22;
    --lwgu-border: rgba(255,255,255,0.14);
    --lwgu-text: #e8e8ea;
    --lwgu-sub: #9aa0aa;
    --lwgu-dim: #71717a;
    --lwgu-rule: rgba(255,255,255,0.12);
    --lwgu-hover: #23242a;
    --lwgu-active-bg: rgba(255,255,255,0.08);
    --lwgu-accent: #6f9bff;
    --lwgu-shadow: 0 1px 6px rgba(0,0,0,0.5);
    --lwgu-panel-shadow: 0 10px 32px rgba(0,0,0,0.6);
    --lwgu-peak: #4ade80;
    --lwgu-off: #71717a;
    --lwgu-warn: #e0a83c;
    --lwgu-alert: #f2726f;
  }
  .dsh-liangwengu {
    display: flex;
    flex: none;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    margin: 0;
    padding: 3px 10px;
    border-radius: 14px;
    background: var(--lwgu-bg);
    border: 1px solid var(--lwgu-border);
    box-shadow: var(--lwgu-shadow);
    color: var(--lwgu-text);
    font-family: inherit;
    font-size: 12px;
    line-height: 15px;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease;
  }
  .dsh-liangwengu:hover { background: var(--lwgu-hover); border-color: var(--lwgu-rule); }
  .dsh-liangwengu:focus-visible { outline: 2px solid var(--lwgu-accent); outline-offset: 1px; }
  .dsh-lwgu-line { display: inline-flex; align-items: center; gap: 6px; }
  .dsh-lwgu-dot {
    width: 7px; height: 7px; border-radius: 50%; flex: none;
    background: var(--lwgu-off);
  }
  .dsh-lwgu-dot[data-peak="true"] { background: var(--lwgu-peak); }
  .dsh-lwgu-sep { color: var(--lwgu-dim); font-weight: 400; }
  .dsh-lwgu-countdown {
    font-size: 10px;
    line-height: 12px;
    color: var(--lwgu-sub);
    font-weight: 400;
    font-variant-numeric: tabular-nums;
  }
  /* The badge's lower half: the account balance, always on its own line so a
     long amount or a warning never reflows the slot label above it. */
  .dsh-lwgu-balance {
    font-size: 10px;
    line-height: 12px;
    color: var(--lwgu-sub);
    font-weight: 400;
    font-variant-numeric: tabular-nums;
  }
  .dsh-lwgu-balance[data-tone="low"] { color: var(--lwgu-alert); font-weight: 600; }
  .dsh-lwgu-balance[data-tone="stale"] { color: var(--lwgu-warn); }
  .dsh-lwgu-balance[data-tone="none"] { color: var(--lwgu-dim); }
  .dsh-lwgu-sr {
    position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
    overflow: hidden; clip-path: inset(50%); white-space: nowrap;
  }
  .dsh-lwgu-panel {
    position: fixed; z-index: 2147483000; box-sizing: border-box; width: 300px;
    padding: 12px 14px 14px; border-radius: 12px;
    background: var(--lwgu-panel-bg);
    border: 1px solid var(--lwgu-border);
    box-shadow: var(--lwgu-panel-shadow);
    color: var(--lwgu-text);
    font-size: 12px; line-height: 16px;
  }
  .dsh-lwgu-panel:focus { outline: none; }
  .dsh-lwgu-panel:focus-visible { outline: 2px solid var(--lwgu-accent); outline-offset: 2px; }
  .dsh-lwgu-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .dsh-lwgu-title { font-size: 12px; font-weight: 600; }
  .dsh-lwgu-tier { color: var(--lwgu-sub); font-size: 11px; }
  .dsh-lwgu-sub { margin-top: 2px; color: var(--lwgu-dim); font-size: 10px; line-height: 14px; }
  .dsh-lwgu-rule { height: 1px; margin: 10px 0; background: var(--lwgu-rule); }
  .dsh-lwgu-grid { display: grid; gap: 2px; }
  .dsh-lwgu-grid-head, .dsh-lwgu-grid-row {
    display: grid; grid-template-columns: minmax(0,1fr) 52px 52px 44px;
    align-items: center; gap: 4px;
  }
  .dsh-lwgu-grid-head { padding: 0 6px 4px; color: var(--lwgu-dim); font-size: 10px; font-weight: 400; }
  .dsh-lwgu-grid-head span:not(:first-child), .dsh-lwgu-grid-row span:not(:first-child) {
    text-align: right; font-variant-numeric: tabular-nums;
  }
  .dsh-lwgu-grid-row {
    margin: 0; padding: 5px 6px; border: none; border-radius: 7px;
    background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer;
  }
  .dsh-lwgu-grid-row:hover { background: var(--lwgu-active-bg); }
  .dsh-lwgu-grid-row[aria-pressed="true"] { background: var(--lwgu-active-bg); font-weight: 600; }
  .dsh-lwgu-kv { display: flex; justify-content: space-between; gap: 12px; }
  .dsh-lwgu-kv span:last-child { font-variant-numeric: tabular-nums; }
  .dsh-lwgu-bal { margin-top: 4px; }
  .dsh-lwgu-bal-amount { font-weight: 600; }
  .dsh-lwgu-bal-amount[data-tone="low"] { color: var(--lwgu-alert); }
  .dsh-lwgu-refresh {
    margin: 0; padding: 0 2px; border: none; background: none;
    color: var(--lwgu-accent); font: inherit; font-size: 11px;
    border-radius: 4px; cursor: pointer;
  }
  .dsh-lwgu-refresh:hover:not(:disabled) { text-decoration: underline; }
  .dsh-lwgu-refresh:focus-visible { outline: 2px solid var(--lwgu-accent); outline-offset: 1px; }
  .dsh-lwgu-refresh:disabled { color: var(--lwgu-dim); cursor: default; }
  .dsh-lwgu-composite { display: flex; align-items: baseline; gap: 6px; margin-top: 8px; }
  .dsh-lwgu-composite-value {
    color: var(--lwgu-accent);
    font-size: 22px; line-height: 26px; font-weight: 600; font-variant-numeric: tabular-nums;
  }
  .dsh-lwgu-composite-unit { color: var(--lwgu-sub); font-size: 11px; }
  .dsh-lwgu-note { margin-top: 6px; color: var(--lwgu-dim); font-size: 10px; line-height: 14px; }
  @media (prefers-reduced-motion: reduce) {
    .dsh-liangwengu { transition: none; }
  }
`;

// src/client/index.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
function TimeSlotIndicator({ useProjection, sessionId }) {
  const [now, setNow] = (0, import_react4.useState)(() => /* @__PURE__ */ new Date());
  const [open, setOpen] = (0, import_react4.useState)(false);
  const [pickedModelId, setPickedModelId] = (0, import_react4.useState)(null);
  const [pos, setPos] = (0, import_react4.useState)(null);
  const anchorRef = (0, import_react4.useRef)(null);
  const panelRef = (0, import_react4.useRef)(null);
  const restoreFocusRef = (0, import_react4.useRef)(null);
  (0, import_react4.useEffect)(() => {
    setPickedModelId(null);
  }, [sessionId]);
  const [balanceState, setBalanceState] = (0, import_react4.useState)(() => balance.getSnapshot());
  (0, import_react4.useEffect)(() => {
    setBalanceState(balance.getSnapshot());
    const unsubscribe = balance.subscribe(() => {
      setBalanceState(balance.getSnapshot());
    });
    const release = balance.acquire();
    return () => {
      unsubscribe();
      release();
    };
  }, []);
  (0, import_react4.useEffect)(() => {
    let timer;
    const scheduleNextTick = () => {
      const delay = Math.max(50, 1e3 - (/* @__PURE__ */ new Date()).getMilliseconds());
      timer = window.setTimeout(() => {
        setNow(/* @__PURE__ */ new Date());
        scheduleNextTick();
      }, delay);
    };
    scheduleNextTick();
    return () => window.clearTimeout(timer);
  }, []);
  (0, import_react4.useLayoutEffect)(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const place = () => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (anchor === null || panel === null) return;
      const rect = anchor.getBoundingClientRect();
      const margin = 12;
      const gap = 8;
      const left = Math.min(
        Math.max(margin, rect.right - panel.offsetWidth),
        window.innerWidth - panel.offsetWidth - margin
      );
      let top = rect.bottom + gap;
      if (top + panel.offsetHeight > window.innerHeight - margin) {
        top = Math.max(margin, rect.top - gap - panel.offsetHeight);
      }
      setPos({ left, top });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);
  (0, import_react4.useLayoutEffect)(() => {
    if (open) {
      if (restoreFocusRef.current === null) {
        const active = document.activeElement;
        restoreFocusRef.current = active instanceof HTMLElement ? active : null;
      }
      return;
    }
    const target = restoreFocusRef.current;
    restoreFocusRef.current = null;
    if (target !== null && document.contains(target)) target.focus();
  }, [open]);
  (0, import_react4.useLayoutEffect)(() => {
    if (open && pos !== null) panelRef.current?.focus();
  }, [open, pos]);
  (0, import_react4.useEffect)(() => {
    if (!open) return;
    const onPointerDown = (event) => {
      const target = event.target;
      if (target === null) return;
      if (anchorRef.current?.contains(target) === true) return;
      if (panelRef.current?.contains(target) === true) return;
      setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);
  const label = getSlotLabel(now);
  const countdown = formatCountdown(getSlotRemaining(now));
  const tier = tierOf(now);
  const peak = tier === "peak";
  const countdownId = (0, import_react4.useId)();
  const usage = useProjection("tokenUsage");
  const modelSelection = useProjection("modelSelection");
  const sessionModelId = modelSelection?.next?.model ?? modelSelection?.lastUsed?.model ?? null;
  const sessionPriced = lookupPricing(sessionModelId) !== void 0;
  const activeModelId = pickedModelId ?? (sessionModelId !== null && sessionPriced ? sessionModelId : OFFICIAL_MODELS[0].id);
  const activeEntry = OFFICIAL_MODELS.find((entry) => entry.id === activeModelId) ?? OFFICIAL_MODELS[0];
  const revision = activeRevision(activeEntry.pricing, now.getTime());
  const onPickModel = (0, import_react4.useCallback)((modelId) => {
    setPickedModelId(modelId);
  }, []);
  const onRefreshBalance = (0, import_react4.useCallback)(() => {
    balance.refresh();
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { ref: anchorRef, className: "dsh-liangwengu-anchor", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("style", { children: STYLE }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      "button",
      {
        type: "button",
        className: "dsh-liangwengu",
        "aria-haspopup": "dialog",
        "aria-expanded": open,
        "aria-label": `${label}\uFF0C\u4F59\u989D ${badgeBalanceText(balanceState)}\uFF0C\u67E5\u770B\u5B9A\u4EF7\u4E0E\u4F59\u989D`,
        "aria-describedby": countdownId,
        onClick: () => {
          setOpen((current) => !current);
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dsh-lwgu-line", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dsh-lwgu-dot", "data-peak": peak ? "true" : "false" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: label }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dsh-lwgu-sep", "aria-hidden": "true", children: "\xB7" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dsh-lwgu-countdown", id: countdownId, children: [
              "\u5269\u4F59 ",
              countdown
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dsh-lwgu-balance", "data-tone": balanceTone(balanceState), children: [
            "\u4F59\u989D ",
            badgeBalanceText(balanceState)
          ] })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dsh-lwgu-sr", "aria-live": "polite", children: label }),
    open && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      "div",
      {
        ref: panelRef,
        className: "dsh-lwgu-panel",
        role: "dialog",
        "aria-label": "DeepSeek \u5B9A\u4EF7\u4E0E\u7EFC\u5408\u5355\u4EF7",
        tabIndex: -1,
        style: {
          left: pos?.left ?? 0,
          top: pos?.top ?? 0,
          visibility: pos === null ? "hidden" : "visible"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            PricingTable,
            {
              revision,
              tier,
              activeModelId,
              onPick: onPickModel
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-lwgu-rule" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            CompositeSection,
            {
              usage,
              activeEntry,
              revision,
              tier,
              sessionModelId
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-lwgu-rule" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(BalanceSection, { state: balanceState, onRefresh: onRefreshBalance })
        ]
      }
    )
  ] });
}
var inject = ["slots"];
function apply(ctx) {
  ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({
    name: "conversation.session.header.utilities",
    id: "\u6881\u6587\u8C37",
    order: -1
  }, TimeSlotIndicator));
}
return module.exports; } });
