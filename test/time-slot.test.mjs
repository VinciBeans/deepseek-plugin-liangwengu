/**
 * Smoke test for the built DSH browser-half plugin.
 *
 * Loads lib/client.js through the same __ModuleLoader__ shape the DSH web
 * client uses, then exercises the exported time-slot classifier against known
 * UTC instants mapped to Beijing wall-clock boundaries.
 */
import assert from 'node:assert/strict'
let plugin
globalThis.window = {
  __ModuleLoader__: {
    load({ id, factory }) {
      const require = (spec) => {
        if (spec === 'react') return { useEffect() {}, useState() {} }
        if (spec === 'react/jsx-runtime') return { jsx() {}, jsxs() {} }
        throw new Error(`unexpected require: ${spec}`)
      }
      plugin = factory(require)
    },
  },
}

await import(new URL('../lib/client.js', import.meta.url).href)

const { getSlotLabel } = plugin
assert.equal(typeof getSlotLabel, 'function')

const cases = [
  ['2024-01-01T00:59:00Z', '当前时段：梁文谷'], // 08:59 Beijing
  ['2024-01-01T01:00:00Z', '当前时段：梁文峰'], // 09:00 Beijing
  ['2024-01-01T03:59:00Z', '当前时段：梁文峰'], // 11:59 Beijing
  ['2024-01-01T04:00:00Z', '当前时段：梁文谷'], // 12:00 Beijing
  ['2024-01-01T06:00:00Z', '当前时段：梁文峰'], // 14:00 Beijing
  ['2024-01-01T09:59:00Z', '当前时段：梁文峰'], // 17:59 Beijing
  ['2024-01-01T10:00:00Z', '当前时段：梁文谷'], // 18:00 Beijing
]

for (const [iso, expected] of cases) {
  assert.equal(getSlotLabel(new Date(iso)), expected, iso)
}

console.log(`time-slot test ok (${cases.length} cases)`)
