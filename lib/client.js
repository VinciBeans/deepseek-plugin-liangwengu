window.__ModuleLoader__.load({ id: "liangwenfeng-gu", factory: (require) => { var module = { exports: {} }; var exports = module.exports; Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
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
  getBeijingMinutes: () => getBeijingMinutes,
  getSlotLabel: () => getSlotLabel,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var PEAK_SLOTS = [
  [9 * 60, 12 * 60],
  [14 * 60, 18 * 60]
];
function getBeijingMinutes(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  let hour = 0;
  let minute = 0;
  for (const part of parts) {
    if (part.type === "hour") hour = Number(part.value);
    else if (part.type === "minute") minute = Number(part.value);
  }
  return hour * 60 + minute;
}
function getSlotLabel(date) {
  const minutes = getBeijingMinutes(date);
  const isLiangWenfeng = PEAK_SLOTS.some(([start, end]) => minutes >= start && minutes < end);
  return isLiangWenfeng ? "\u5F53\u524D\u65F6\u6BB5\uFF1A\u6881\u6587\u5CF0" : "\u5F53\u524D\u65F6\u6BB5\uFF1A\u6881\u6587\u8C37";
}
function TimeSlotIndicator() {
  const [now, setNow] = (0, import_react.useState)(() => /* @__PURE__ */ new Date());
  (0, import_react.useEffect)(() => {
    let timer;
    const scheduleNextMinute = () => {
      const current = /* @__PURE__ */ new Date();
      const delay = Math.max(
        1e3,
        (60 - current.getUTCSeconds()) * 1e3 - current.getUTCMilliseconds()
      );
      timer = window.setTimeout(() => {
        setNow(/* @__PURE__ */ new Date());
        scheduleNextMinute();
      }, delay);
    };
    scheduleNextMinute();
    return () => window.clearTimeout(timer);
  }, []);
  const label = getSlotLabel(now);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      "aria-live": "polite",
      className: "dsh-liangwenfeng-gu",
      style: {
        position: "fixed",
        top: 12,
        right: 16,
        zIndex: 2e3,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderRadius: 999,
        background: "var(--lwfg-bg, #ffffff)",
        border: "1px solid var(--lwfg-border, rgba(0,0,0,0.12))",
        boxShadow: "var(--lwfg-shadow, 0 2px 8px rgba(0,0,0,0.08))",
        color: "var(--lwfg-text, #222)",
        fontSize: 13,
        lineHeight: "18px",
        fontWeight: 500,
        pointerEvents: "none",
        userSelect: "none",
        whiteSpace: "nowrap"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: `
        .dsh-liangwenfeng-gu {
          --lwfg-bg: var(--dsw-alias-bg-elevated, #ffffff);
          --lwfg-border: var(--dsw-alias-border-l1, rgba(0,0,0,0.12));
          --lwfg-text: var(--dsw-alias-label-primary, #222);
          --lwfg-shadow: 0 2px 8px rgba(0,0,0,0.08);
          --lwfg-peak: var(--dsw-alias-status-success, #22c55e);
          --lwfg-off: var(--dsw-alias-status-muted, #9ca3af);
        }
        body[data-ds-dark-theme] .dsh-liangwenfeng-gu {
          --lwfg-bg: #17181c;
          --lwfg-border: rgba(255,255,255,0.14);
          --lwfg-text: #e8e8ea;
          --lwfg-shadow: 0 2px 12px rgba(0,0,0,0.5);
          --lwfg-peak: #4ade80;
          --lwfg-off: #71717a;
        }
      ` }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            style: {
              width: 8,
              height: 8,
              borderRadius: "50%",
              flex: "none",
              background: label.includes("\u6881\u6587\u5CF0") ? "var(--lwfg-peak, #22c55e)" : "var(--lwfg-off, #9ca3af)"
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label })
      ]
    }
  );
}
var inject = ["slots"];
function apply(ctx) {
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({
    name: "shell.overlay",
    id: "\u6881\u6587\u5CF0\u8C37",
    order: 9e3
  }, TimeSlotIndicator));
}
return module.exports; } });
