/**
 * Build liangwengu:
 *   - lib/index.js   — node half (ESM), the host-side plugin body
 *   - lib/client.js  — browser half, a closure-factory CJS bundle in the
 *                      exact shape the DSH client module system expects:
 *                      window.__ModuleLoader__.load({ id, factory: (require) => ... })
 *                      with platform modules (react, @deepseek-ai/*) external
 *                      — they resolve at runtime from the loader module table.
 *   - lib/types/**   — .d.ts for both halves
 *
 * Both halves are stamped with a hash of the sources they were built from
 * (`__LWGU_STAMP__`): the browser half shows it and compares it with the stamp
 * the host reports, so "the host process is older than the bundle" is a visible
 * fact rather than a mystery 404.
 */
import { createHash } from 'node:crypto'
import { build } from 'esbuild'
import { mkdir, readdir, readFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'

const require = createRequire(import.meta.url)
// Resolve the compiler script and run it through the current node executable:
// a bare `spawnSync('tsc')` cannot resolve node_modules/.bin shims on Windows
// (only .cmd/.ps1 wrappers exist there), so this keeps the build cross-platform.
const TSC = require.resolve('typescript/bin/tsc')

const ID = 'liangwengu'

/** Every TypeScript source of both halves, in a stable order. */
async function sourceFiles(dir) {
  const found = []
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...await sourceFiles(full))
    else if (/\.tsx?$/.test(entry.name)) found.push(full)
  }
  return found
}

/**
 * Source-identity stamp: a short hash over the POSIX-relative path and the
 * contents of every source file, with line endings normalised so a CRLF
 * checkout and an LF checkout of the same commit stamp identically.
 */
async function sourceStamp() {
  const hash = createHash('sha256')
  for (const file of await sourceFiles('src')) {
    hash.update(relative('src', file).split(sep).join('/'))
    hash.update('\0')
    hash.update((await readFile(file, 'utf8')).replace(/\r\n/g, '\n'))
    hash.update('\0')
  }
  return hash.digest('hex').slice(0, 8)
}

const stamp = await sourceStamp()
const define = { __LWGU_STAMP__: JSON.stringify(stamp) }

await mkdir('lib', { recursive: true })

// ── node half ─────────────────────────────────────────────────────────────
await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: 'lib/index.js',
  define,
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
  define,
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
const result = spawnSync(process.execPath, [TSC, '-p', 'tsconfig.build.json'], { stdio: 'inherit' })
if (result.error) {
  console.error('tsc spawn failed:', result.error)
  process.exit(1)
}
if (result.status !== 0) process.exit(result.status ?? 1)

console.log(`build complete: lib/index.js + lib/client.js + lib/types (stamp ${stamp})`)
