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
  TimeSlotIndicator: () => TimeSlotIndicator,
  apply: () => apply,
  formatCountdown: () => formatCountdown,
  getBeijingMinutes: () => getBeijingMinutes,
  getBeijingSeconds: () => getBeijingSeconds,
  getBeijingWeekday: () => getBeijingWeekday,
  getSlotLabel: () => getSlotLabel,
  getSlotRemaining: () => getSlotRemaining,
  inject: () => inject,
  isPeakMoment: () => isPeakMoment
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var BEIJING_OFFSET_MS = 8 * 3600 * 1e3;
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
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  let hour = 0;
  let minute = 0;
  let second = 0;
  for (const part of parts) {
    if (part.type === "hour") hour = Number(part.value);
    else if (part.type === "minute") minute = Number(part.value);
    else if (part.type === "second") second = Number(part.value);
  }
  return hour * 3600 + minute * 60 + second;
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
  const dayStartMs = dayIndex * DAY_MS - BEIJING_OFFSET_MS;
  for (let offset = 0; offset < 8; offset += 1) {
    const weekday = (dayIndex + offset + 4) % 7;
    if (weekday === 0 || weekday === 6) continue;
    for (const hour of [9, 14]) {
      const candidate = dayStartMs + offset * DAY_MS + hour * 3600 * 1e3;
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
function TimeSlotIndicator() {
  const [now, setNow] = (0, import_react.useState)(() => /* @__PURE__ */ new Date());
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
  const label = getSlotLabel(now);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      "aria-live": "polite",
      className: "dsh-liangwengu",
      style: {
        position: "fixed",
        top: 12,
        right: 16,
        zIndex: 2e3,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 2,
        padding: "6px 12px",
        borderRadius: 14,
        background: "var(--lwgu-bg, #ffffff)",
        border: "1px solid var(--lwgu-border, rgba(0,0,0,0.12))",
        boxShadow: "var(--lwgu-shadow, 0 2px 8px rgba(0,0,0,0.08))",
        color: "var(--lwgu-text, #222)",
        fontSize: 13,
        lineHeight: "18px",
        fontWeight: 500,
        pointerEvents: "none",
        userSelect: "none",
        whiteSpace: "nowrap"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: `
        .dsh-liangwengu {
          --lwgu-bg: var(--dsw-alias-bg-elevated, #ffffff);
          --lwgu-border: var(--dsw-alias-border-l1, rgba(0,0,0,0.12));
          --lwgu-text: var(--dsw-alias-label-primary, #222);
          --lwgu-sub: var(--dsw-alias-label-secondary, #8a8f99);
          --lwgu-shadow: 0 2px 8px rgba(0,0,0,0.08);
          --lwgu-peak: var(--dsw-alias-status-success, #22c55e);
          --lwgu-off: var(--dsw-alias-status-muted, #9ca3af);
        }
        body[data-ds-dark-theme] .dsh-liangwengu {
          --lwgu-bg: #17181c;
          --lwgu-border: rgba(255,255,255,0.14);
          --lwgu-text: #e8e8ea;
          --lwgu-sub: #9aa0aa;
          --lwgu-shadow: 0 2px 12px rgba(0,0,0,0.5);
          --lwgu-peak: #4ade80;
          --lwgu-off: #71717a;
        }
      ` }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { display: "inline-flex", alignItems: "center", gap: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "span",
            {
              style: {
                width: 8,
                height: 8,
                borderRadius: "50%",
                flex: "none",
                background: label.includes("\u6881\u6587\u5CF0") ? "var(--lwgu-peak, #22c55e)" : "var(--lwgu-off, #9ca3af)"
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "span",
          {
            style: {
              paddingLeft: 16,
              fontSize: 11,
              lineHeight: "14px",
              color: "var(--lwgu-sub, #8a8f99)",
              fontWeight: 400,
              fontVariantNumeric: "tabular-nums"
            },
            children: [
              "\u5269\u4F59 ",
              formatCountdown(getSlotRemaining(now))
            ]
          }
        )
      ]
    }
  );
}
var inject = ["slots"];
function apply(ctx) {
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({
    name: "shell.overlay",
    id: "\u6881\u6587\u8C37",
    order: 9e3
  }, TimeSlotIndicator));
}
return module.exports; } });
