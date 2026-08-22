/**
 * Build liangwengu:
 *   - lib/index.js   — node half (ESM), the empty host-side plugin body
 *   - lib/client.js  — browser half, a closure-factory CJS bundle in the
 *                      exact shape the DSH client module system expects:
 *                      window.__ModuleLoader__.load({ id, factory: (require) => ... })
 *                      with platform modules (react, @deepseek-ai/*) external
 *                      — they resolve at runtime from the loader module table.
 */
import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

const ID = 'liangwengu'

await mkdir('lib', { recursive: true })

// ── node half ─────────────────────────────────────────────────────────────
await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: 'lib/index.js',
  logLevel: 'info',
})

// ── browser half ──────────────────────────────────────────────────────────
await build({
  entryPoints: ['src/client/index.tsx'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  jsx: 'automatic',
  outfile: 'lib/client.js',
  external: ['react', 'react/jsx-runtime', 'react-dom', '@deepseek-ai/*'],
  banner: {
    js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => { var module = { exports: {} }; var exports = module.exports; Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });`,
  },
  footer: {
    js: `return module.exports; } });`,
  },
  logLevel: 'info',
})

// ── type declarations ─────────────────────────────────────────────────────
// Emit .d.ts for both halves into lib/types (package.json `types` fields).
const result = spawnSync('tsc', ['-p', 'tsconfig.build.json'], { stdio: 'inherit' })
if (result.status !== 0) process.exit(result.status ?? 1)

console.log('build complete: lib/index.js + lib/client.js + lib/types')
