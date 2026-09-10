/**
 * Shared `react` / `react/jsx-runtime` / `react-dom` stubs for the test files
 * that load the built browser bundle WITHOUT rendering it.
 *
 * They are not decoration: the bundle evaluates `memo(...)` around its menu
 * blocks while the module is imported, so a stub missing `memo` fails the import
 * itself rather than an assertion inside a test. The hooks that only run during
 * a render are inert placeholders here — the render test (`menu.test.mjs`) uses
 * the real React, so nothing in this file may pretend to implement rendering.
 */

/** The `react` surface the bundle touches at import time and during a render. */
export function reactStub() {
  return {
    memo: (component) => component,
    useCallback: (callback) => callback,
    useMemo: (factory) => factory(),
    useEffect() {},
    useId: () => 'stub-id',
    useLayoutEffect() {},
    useRef: () => ({ current: null }),
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
    useSyncExternalStore: () => undefined,
  }
}

/** The `react/jsx-runtime` surface (the bundle only calls these while rendering). */
export const jsxRuntimeStub = { jsx() {}, jsxs() {} }

/** The `react-dom` surface (kept for parity with the platform seed table). */
export const reactDomStub = { createPortal() {} }
