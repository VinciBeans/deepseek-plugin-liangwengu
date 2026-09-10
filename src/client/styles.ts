/**
 * The plugin's stylesheet, injected once by the badge.
 *
 * Plain CSS in one template literal (no CSS modules): the browser half ships as
 * a single closure-factory bundle, so a string is the one asset shape that
 * needs no loader. Colours are DSW design tokens with literal fallbacks, so the
 * badge renders correctly even where a token is missing, and the dark theme is
 * selected by the shell's `body[data-ds-dark-theme]` marker.
 */

export const STYLE = `
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
  .dsh-lwgu-note[data-tone="warn"] { color: var(--lwgu-warn); }
  @media (prefers-reduced-motion: reduce) {
    .dsh-liangwengu { transition: none; }
  }
`
