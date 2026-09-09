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
  FLASH_PRICE_CHANGE_AT: () => FLASH_PRICE_CHANGE_AT,
  OFFICIAL_MODELS: () => OFFICIAL_MODELS,
  PRICING_SOURCE_URL: () => PRICING_SOURCE_URL,
  PRICING_UPDATED_AT: () => PRICING_UPDATED_AT,
  TimeSlotIndicator: () => TimeSlotIndicator,
  activeRevision: () => activeRevision,
  apply: () => apply,
  cacheHitRate: () => cacheHitRate,
  compositePerYiTokens: () => compositePerYiTokens,
  costYuan: () => costYuan,
  formatBeijingDateTime: () => formatBeijingDateTime,
  formatCompactTokens: () => formatCompactTokens,
  formatCountdown: () => formatCountdown,
  formatHitRate: () => formatHitRate,
  formatRate: () => formatRate,
  formatYuan: () => formatYuan,
  formatYuanPerYi: () => formatYuanPerYi,
  getBeijingSeconds: () => getBeijingSeconds,
  getBeijingWeekday: () => getBeijingWeekday,
  getSlotLabel: () => getSlotLabel,
  getSlotRemaining: () => getSlotRemaining,
  inject: () => inject,
  lookupPricing: () => lookupPricing,
  nextRevision: () => nextRevision,
  rateAt: () => rateAt,
  totalTokens: () => totalTokens
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");

// src/client/pricing.ts
var PRICING_SOURCE_URL = "https://api-docs.deepseek.com/zh-cn/quick_start/pricing";
var PRICING_UPDATED_AT = "2026-09-08";
var FLASH_PRICE_CHANGE_AT = Date.UTC(2026, 8, 10, 4, 0, 0);
var FLASH_BASE = {
  effectiveFrom: 0,
  offPeak: { cacheHit: 0.05, cacheMiss: 1.5, output: 4.5 },
  peak: { cacheHit: 0.1, cacheMiss: 3, output: 9 }
};
var FLASH_CUT = {
  effectiveFrom: FLASH_PRICE_CHANGE_AT,
  offPeak: { cacheHit: 0.02, cacheMiss: 1, output: 4 },
  peak: { cacheHit: 0.04, cacheMiss: 2, output: 8 }
};
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
        offPeak: { cacheHit: 0.15, cacheMiss: 4.5, output: 13.5 },
        peak: { cacheHit: 0.3, cacheMiss: 9, output: 27 }
      }]
    }
  },
  {
    id: "deepseek-v4-flash-vision-exp",
    pricing: { name: "V4-Flash-Vision", revisions: [FLASH_BASE, FLASH_CUT] }
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
function costYuan(buckets, rate) {
  const millionths = (buckets.uncachedInputTokens * rate.cacheMiss + buckets.cacheReadTokens * rate.cacheHit + buckets.cacheWriteTokens * rate.cacheMiss + buckets.outputTokens * rate.output) / 1e6;
  return millionths;
}
function compositePerYiTokens(buckets, rate) {
  const total = totalTokens(buckets);
  if (total === 0) return 0;
  return costYuan(buckets, rate) / total * 1e8;
}
function formatRate(value) {
  if (value === 0) return "0";
  return value < 1 ? value.toFixed(2) : String(Math.round(value * 10) / 10);
}
function formatYuanPerYi(value) {
  return value.toFixed(2);
}
function formatYuan(value) {
  return value.toFixed(2);
}
function formatCompactTokens(value) {
  if (value < 1e3) return String(value);
  const scaled = (candidate) => candidate >= 100 ? String(Math.round(candidate)) : String(Math.round(candidate * 10) / 10);
  if (value < 1e6) return `${scaled(value / 1e3)}K`;
  return `${scaled(value / 1e6)}M`;
}
function formatHitRate(rate) {
  if (rate >= 1) return "100";
  const tenths = Math.floor(rate * 1e3);
  return (tenths / 10).toFixed(1);
}

// src/client/index.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var BEIJING_OFFSET_MS2 = 8 * 3600 * 1e3;
var DAY_MS = 864e5;
var PEAK_SLOTS = [
  [9 * 60, 12 * 60],
  [14 * 60, 18 * 60]
];
function getBeijingDayIndex(date) {
  return Math.floor((date.getTime() + BEIJING_OFFSET_MS2) / DAY_MS);
}
function getBeijingWeekday(date) {
  return (getBeijingDayIndex(date) + 4) % 7;
}
function getBeijingSeconds(date) {
  const ms = date.getTime() + BEIJING_OFFSET_MS2;
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
function getNextPeakStartMs(date) {
  const ms = date.getTime();
  const dayIndex = getBeijingDayIndex(date);
  const dayStartMs = dayIndex * DAY_MS - BEIJING_OFFSET_MS2;
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
function tierOf(date) {
  return isPeakMoment(date) ? "peak" : "offPeak";
}
function tierLabel(tier) {
  return tier === "peak" ? "\u9AD8\u5CF0\u65F6\u6BB5" : "\u7A7A\u95F2\u65F6\u6BB5";
}
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
  .dsh-lwgu-countdown {
    padding-left: 13px;
    font-size: 10px;
    line-height: 12px;
    color: var(--lwgu-sub);
    font-weight: 400;
    font-variant-numeric: tabular-nums;
  }
  .dsh-lwgu-sr {
    position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
    overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;
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
  .dsh-lwgu-composite { display: flex; align-items: baseline; gap: 6px; margin-top: 8px; }
  .dsh-lwgu-composite-value {
    color: var(--lwgu-accent);
    font-size: 22px; line-height: 26px; font-weight: 600; font-variant-numeric: tabular-nums;
  }
  .dsh-lwgu-composite-unit { color: var(--lwgu-sub); font-size: 11px; }
  .dsh-lwgu-note { margin-top: 6px; color: var(--lwgu-dim); font-size: 10px; line-height: 14px; }
`;
function TimeSlotIndicator({ useProjection }) {
  const [now, setNow] = (0, import_react.useState)(() => /* @__PURE__ */ new Date());
  const [open, setOpen] = (0, import_react.useState)(false);
  const [pickedModelId, setPickedModelId] = (0, import_react.useState)(null);
  const [pos, setPos] = (0, import_react.useState)(null);
  const anchorRef = (0, import_react.useRef)(null);
  const panelRef = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
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
  (0, import_react.useLayoutEffect)(() => {
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
  (0, import_react.useEffect)(() => {
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
  const peak = isPeakMoment(now);
  const tier = tierOf(now);
  const usage = useProjection("tokenUsage");
  const modelSelection = useProjection("modelSelection");
  const sessionModelId = modelSelection?.next?.model ?? modelSelection?.lastUsed?.model ?? null;
  const sessionPriced = lookupPricing(sessionModelId) !== void 0;
  const activeModelId = pickedModelId ?? (sessionPriced ? sessionModelId : OFFICIAL_MODELS[0].id);
  const activeEntry = OFFICIAL_MODELS.find((entry) => entry.id === activeModelId) ?? OFFICIAL_MODELS[0];
  const at = now.getTime();
  const revision = activeRevision(activeEntry.pricing, at);
  const upcoming = nextRevision(activeEntry.pricing, at);
  const rate = rateAt(activeEntry.pricing, at, tier);
  const billed = usage !== void 0 && totalTokens(usage) > 0;
  const hit = usage === void 0 ? null : cacheHitRate(usage);
  const composite = billed ? compositePerYiTokens(usage, rate) : null;
  const cost = billed ? costYuan(usage, rate) : null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { ref: anchorRef, className: "dsh-liangwengu-anchor", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: STYLE }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "button",
      {
        type: "button",
        className: "dsh-liangwengu",
        "aria-haspopup": "dialog",
        "aria-expanded": open,
        "aria-label": `${label}\uFF0C\u5269\u4F59 ${countdown}\uFF0C\u67E5\u770B DeepSeek \u5B9A\u4EF7`,
        onClick: () => {
          setOpen((current) => !current);
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dsh-lwgu-line", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh-lwgu-dot", "data-peak": peak ? "true" : "false" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dsh-lwgu-countdown", children: [
            "\u5269\u4F59 ",
            countdown
          ] })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh-lwgu-sr", "aria-live": "polite", children: label }),
    open && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        ref: panelRef,
        className: "dsh-lwgu-panel",
        role: "dialog",
        "aria-label": "DeepSeek \u5B9A\u4EF7\u4E0E\u7EFC\u5408\u5355\u4EF7",
        style: {
          left: pos?.left ?? 0,
          top: pos?.top ?? 0,
          visibility: pos === null ? "hidden" : "visible"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-lwgu-head", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh-lwgu-title", children: "DeepSeek \u5B98\u65B9\u5B9A\u4EF7" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh-lwgu-tier", children: tierLabel(tier) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-lwgu-sub", children: [
            "\u5143 / \u767E\u4E07 tokens \xB7 ",
            revision.effectiveFrom === 0 ? `\u4EF7\u76EE\u8868\u66F4\u65B0\u4E8E ${PRICING_UPDATED_AT}` : `${formatBeijingDateTime(revision.effectiveFrom)} \u8D77\u751F\u6548`
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-lwgu-rule" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-lwgu-grid", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-lwgu-grid-head", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u6A21\u578B" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u7F13\u5B58\u547D\u4E2D" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u672A\u547D\u4E2D" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u8F93\u51FA" })
            ] }),
            OFFICIAL_MODELS.map((entry) => {
              const row = rateAt(entry.pricing, at, tier);
              const active = entry.id === activeModelId;
              return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "button",
                {
                  type: "button",
                  className: "dsh-lwgu-grid-row",
                  "aria-pressed": active,
                  onClick: () => {
                    setPickedModelId(entry.id);
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: entry.pricing.name }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: formatRate(row.cacheHit) }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: formatRate(row.cacheMiss) }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: formatRate(row.output) })
                  ]
                },
                entry.id
              );
            })
          ] }),
          upcoming !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-lwgu-note", children: [
            formatBeijingDateTime(upcoming.effectiveFrom),
            " \u8D77\u672C\u6A21\u578B\u8C03\u4EF7\uFF1A \u547D\u4E2D ",
            formatRate(upcoming[tier].cacheHit),
            " / \u672A\u547D\u4E2D ",
            formatRate(upcoming[tier].cacheMiss),
            "/ \u8F93\u51FA ",
            formatRate(upcoming[tier].output),
            "\uFF08",
            tierLabel(tier),
            "\uFF09"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-lwgu-rule" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-lwgu-head", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh-lwgu-title", children: "\u672C\u4F1A\u8BDD\u7EFC\u5408\u5355\u4EF7" }) }),
          usage === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-lwgu-note", children: "\u5F53\u524D\u4F1A\u8BDD\u6682\u65E0 token \u7528\u91CF\u6570\u636E\u3002" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-lwgu-kv", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u7F13\u5B58\u547D\u4E2D\u7387" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: hit === null ? "\u2014" : `${formatHitRate(hit)}%` })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-lwgu-kv", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u7F13\u5B58\u8BFB\u53D6" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: formatCompactTokens(usage.cacheReadTokens) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-lwgu-kv", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u672A\u547D\u4E2D\u8F93\u5165" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: formatCompactTokens(usage.uncachedInputTokens) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-lwgu-kv", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u8F93\u51FA" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: formatCompactTokens(usage.outputTokens) })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-lwgu-composite", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh-lwgu-composite-value", children: composite === null ? "\u2014" : formatYuanPerYi(composite) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh-lwgu-composite-unit", children: "\u5143 / \u4EBF tokens" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-lwgu-note", children: [
            "\u6309 ",
            activeEntry.pricing.name,
            " \xB7 ",
            tierLabel(tier),
            "\u5355\u4EF7\u4F30\u7B97",
            cost !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
              " \xB7 \u672C\u4F1A\u8BDD\u7D2F\u8BA1 \u2248 \xA5",
              formatYuan(cost)
            ] })
          ] }),
          sessionModelId !== null && !sessionPriced && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-lwgu-note", children: [
            "\u5F53\u524D\u6A21\u578B ",
            sessionModelId,
            " \u4E0D\u5728\u5B98\u65B9\u4EF7\u76EE\u8868\u4E2D\uFF0C\u5DF2\u6539\u7528 ",
            activeEntry.pricing.name,
            " \u8BA1\u4EF7\uFF1B \u53EF\u70B9\u51FB\u4E0A\u65B9\u6A21\u578B\u884C\u5207\u6362\u8BA1\u4EF7\u6A21\u578B\u3002"
          ] })
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
