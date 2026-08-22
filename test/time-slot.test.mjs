/**
 * Smoke test for the built DSH browser-half plugin.
 *
 * Loads lib/client.js through the same __ModuleLoader__ shape the DSH web
 * client uses, then exercises the exported time-slot classifier and the
 * remaining-time countdown against known UTC instants mapped to Beijing
 * wall-clock boundaries.
 *
 * Policy under test (Beijing time):
 *   - workday (Mon–Fri) peak slots: [09:00, 12:00) and [14:00, 18:00)
 *   - everything else, incl. the whole weekend (Sat/Sun), is valley;
 *     the valley runs continuously until the next workday peak start,
 *     so Friday-evening and weekend valleys end at Monday 09:00.
 *
 * Reference weekdays: 2024-01-01 = Mon, 2024-01-05 = Fri,
 * 2024-01-06 = Sat, 2024-01-07 = Sun.
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

const { getSlotLabel, getSlotRemaining, formatCountdown, getBeijingSeconds, getBeijingWeekday } = plugin
assert.equal(typeof getSlotLabel, 'function')
assert.equal(typeof getSlotRemaining, 'function')
assert.equal(typeof formatCountdown, 'function')
assert.equal(typeof getBeijingWeekday, 'function')

// ── Beijing weekday ────────────────────────────────────────────────────────
const weekdayCases = [
  ['2024-01-01T02:00:00Z', 1], // Mon 10:00
  ['2024-01-05T02:00:00Z', 5], // Fri 10:00
  ['2024-01-06T02:00:00Z', 6], // Sat 10:00
  ['2024-01-07T02:00:00Z', 0], // Sun 10:00
]

for (const [iso, expected] of weekdayCases) {
  assert.equal(getBeijingWeekday(new Date(iso)), expected, iso)
}

// ── label ──────────────────────────────────────────────────────────────────
const labelCases = [
  ['2024-01-01T00:59:00Z', '当前时段：梁文谷'], // Mon 08:59
  ['2024-01-01T01:00:00Z', '当前时段：梁文峰'], // Mon 09:00
  ['2024-01-01T03:59:00Z', '当前时段：梁文峰'], // Mon 11:59
  ['2024-01-01T04:00:00Z', '当前时段：梁文谷'], // Mon 12:00
  ['2024-01-01T06:00:00Z', '当前时段：梁文峰'], // Mon 14:00
  ['2024-01-01T09:59:00Z', '当前时段：梁文峰'], // Mon 17:59
  ['2024-01-01T10:00:00Z', '当前时段：梁文谷'], // Mon 18:00
  ['2024-01-05T02:00:00Z', '当前时段：梁文峰'], // Fri 10:00 — workday peak
  ['2024-01-06T02:00:00Z', '当前时段：梁文谷'], // Sat 10:00 — all-day valley
  ['2024-01-06T09:00:00Z', '当前时段：梁文谷'], // Sat 17:00 — all-day valley
  ['2024-01-07T02:00:00Z', '当前时段：梁文谷'], // Sun 10:00 — all-day valley
]

for (const [iso, expected] of labelCases) {
  assert.equal(getSlotLabel(new Date(iso)), expected, iso)
}

// ── remaining seconds ──────────────────────────────────────────────────────
// Workday peaks end at the same day's 12:00 / 18:00.
const remainingCases = [
  ['2024-01-01T00:59:00Z', 60], //   Mon 08:59 valley → 09:00 (1 min left)
  ['2024-01-01T01:00:00Z', 10800], // Mon 09:00 peak → 12:00 (3 h left)
  ['2024-01-01T03:59:30Z', 30], //   Mon 11:59:30 peak → 12:00
  ['2024-01-01T04:00:00Z', 7200], // Mon 12:00 valley → 14:00 (2 h left)
  ['2024-01-01T04:30:00Z', 5400], // Mon 12:30 valley → 14:00
  ['2024-01-01T06:00:00Z', 14400], // Mon 14:00 peak → 18:00 (4 h left)
  ['2024-01-01T09:59:00Z', 60], //   Mon 17:59 peak → 18:00
  // Workday evening valley crosses midnight into the next workday 09:00.
  ['2024-01-01T10:00:00Z', 54000], // Mon 18:00 valley → Tue 09:00 (15 h left)
  ['2024-01-01T15:32:10Z', 34070], // Mon 23:32:10 valley → Tue 09:00
  ['2024-01-01T16:30:00Z', 30600], // Tue 00:30 valley → 09:00 (8 h 30 min)
  ['2024-01-01T16:59:59Z', 28801], // Tue 00:59:59 valley → 09:00
  // Friday evening + the whole weekend are one continuous valley until Mon 09:00.
  ['2024-01-05T10:30:00Z', 225000], // Fri 18:30 valley → Mon 09:00 (62 h 30 min)
  ['2024-01-05T14:00:00Z', 212400], // Fri 22:00 valley → Mon 09:00 (59 h)
  ['2024-01-06T01:00:00Z', 172800], // Sat 09:00 valley → Mon 09:00 (48 h)
  ['2024-01-06T02:00:00Z', 169200], // Sat 10:00 valley → Mon 09:00 (47 h)
  ['2024-01-06T07:00:00Z', 151200], // Sat 15:00 valley → Mon 09:00 (42 h)
  ['2024-01-06T16:00:00Z', 118800], // Sun 00:00 valley → Mon 09:00 (33 h)
  ['2024-01-07T04:00:00Z', 75600], // Sun 12:00 valley → Mon 09:00 (21 h)
  ['2024-01-07T15:59:59Z', 32401], // Sun 23:59:59 valley → Mon 09:00
]

for (const [iso, expected] of remainingCases) {
  assert.equal(getSlotRemaining(new Date(iso)), expected, iso)
}

// ── Beijing wall clock with seconds ────────────────────────────────────────
assert.equal(getBeijingSeconds(new Date('2024-01-01T01:23:45Z')), 9 * 3600 + 23 * 60 + 45)

// ── countdown formatting ───────────────────────────────────────────────────
const formatCases = [
  [0, '00:00:00'],
  [59, '00:00:59'],
  [60, '00:01:00'],
  [3661, '01:01:01'],
  [10800, '03:00:00'],
  [54000, '15:00:00'],
  [75600, '21:00:00'],
  [118800, '1天 09:00:00'],
  [172800, '2天 00:00:00'],
  [212400, '2天 11:00:00'],
  [225000, '2天 14:30:00'],
]

for (const [seconds, expected] of formatCases) {
  assert.equal(formatCountdown(seconds), expected, String(seconds))
}

console.log(
  `time-slot test ok (${weekdayCases.length} weekday + ${labelCases.length} label + ` +
  `${remainingCases.length} remaining + ${formatCases.length} format cases)`,
)
