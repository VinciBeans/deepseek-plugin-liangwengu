/**
 * Smoke test for the built DSH browser-half plugin.
 *
 * Loads lib/client.js through the same __ModuleLoader__ shape the DSH web
 * client uses, then exercises the exported time-slot classifier and the
 * remaining-time countdown against known UTC instants mapped to Beijing
 * wall-clock boundaries.
 *
 * Policy under test (Beijing time):
 *   - peak slots on an ordinary workday (Mon–Fri): [09:00, 12:00) and [14:00, 18:00)
 *   - everything else is valley, incl. the whole weekend (Sat/Sun), every day of a
 *     statutory-holiday span, and a weekend that is only a 调休 workday; a valley
 *     runs continuously until the next peak start, so Friday-evening and weekend
 *     valleys end at Monday 09:00 and the evening before a holiday ends at the
 *     first peak day after it.
 *
 * Reference weekdays: 2024-01-01 = Mon, 2024-01-05 = Fri,
 * 2024-01-06 = Sat, 2024-01-07 = Sun.
 */
import assert from 'node:assert/strict'
import { jsxRuntimeStub, reactDomStub, reactStub } from './react-stub.mjs'
let plugin
globalThis.window = {
  __ModuleLoader__: {
    load({ id, factory }) {
      const require = (spec) => {
        if (spec === 'react') return reactStub()
        if (spec === 'react/jsx-runtime') return jsxRuntimeStub
        if (spec === 'react-dom') return reactDomStub
        throw new Error(`unexpected require: ${spec}`)
      }
      plugin = factory(require)
    },
  },
}

await import(new URL('../lib/client.js', import.meta.url).href)

const { getSlotLabel, getSlotRemaining, formatCountdown, getBeijingSeconds, getBeijingWeekday, isStatutoryHoliday } = plugin
assert.equal(typeof getSlotLabel, 'function')
assert.equal(typeof getSlotRemaining, 'function')
assert.equal(typeof formatCountdown, 'function')
assert.equal(typeof getBeijingWeekday, 'function')
assert.equal(typeof isStatutoryHoliday, 'function')

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

// ── 法定节假日与调休上班日（2026 年放假安排） ──────────────────────────────
// 官方计费口径：周一至周五（不含中国法定节假日）的 09:00–12:00、14:00–18:00 为高峰
// 时段，其余含周末与法定节假日全天为空闲时段；调休上班的周末同样按空闲时段计费。
// 下面两张表按《国务院办公厅关于 2026 年部分节假日安排的通知》独立转录，与
// `src/client/holidays.ts` 的 HOLIDAY_SPANS 同源但分开书写：两边不一致就说明有一边抄错。
const NOTICE_SPANS = [
  ['2026-01-01', '2026-01-03'], // 元旦 3 天
  ['2026-02-15', '2026-02-23'], // 春节 9 天
  ['2026-04-04', '2026-04-06'], // 清明节 3 天
  ['2026-05-01', '2026-05-05'], // 劳动节 5 天
  ['2026-06-19', '2026-06-21'], // 端午节 3 天
  ['2026-09-25', '2026-09-27'], // 中秋节 3 天
  ['2026-10-01', '2026-10-07'], // 国庆节 7 天
]
// 通知里的「上班」条款：调休上班日，全部落在周六/周日。
const NOTICE_MAKEUP_DAYS = [
  '2026-01-04', '2026-02-14', '2026-02-28', '2026-05-09', '2026-09-20', '2026-10-10',
]

assert.equal(typeof plugin.HOLIDAY_SOURCE_URL, 'string', 'the table cites the notice it was transcribed from')
assert.deepEqual(
  plugin.HOLIDAY_SPANS.map(span => [...span]),
  NOTICE_SPANS,
  '放假区间与国办通知逐条一致',
)

/** An instant at a Beijing wall-clock date and time. */
const atBeijing = (date, time) => new Date(`${date}T${time}:00+08:00`)

/** Every `YYYY-MM-DD` of a closed interval. */
function eachDay(from, to) {
  const days = []
  for (let ms = Date.parse(`${from}T00:00:00Z`); ms <= Date.parse(`${to}T00:00:00Z`); ms += 86400000) {
    days.push(new Date(ms).toISOString().slice(0, 10))
  }
  return days
}

const holidayDays = NOTICE_SPANS.flatMap(([from, to]) => eachDay(from, to))
assert.equal(holidayDays.length, 33, '2026 年放假共 33 个日历日')

// Every day of every span is valley — a weekday 10:00/15:00 would otherwise be peak.
for (const date of holidayDays) {
  for (const time of ['10:00', '15:00']) {
    assert.equal(isStatutoryHoliday(atBeijing(date, time)), true, `${date} ${time} 是放假日期`)
    assert.equal(getSlotLabel(atBeijing(date, time)), '当前时段：梁文谷', `${date} ${time}`)
  }
}

// 调休上班日不是放假日期，但官方口径同样按空闲时段计费。
for (const date of NOTICE_MAKEUP_DAYS) {
  for (const time of ['10:00', '15:00']) {
    assert.equal(isStatutoryHoliday(atBeijing(date, time)), false, `${date} 不是放假日期`)
    assert.equal(getSlotLabel(atBeijing(date, time)), '当前时段：梁文谷', `${date} ${time}（调休上班）`)
  }
}

// 假期两端：假期前一天还是普通工作日，假期后第一天回到峰期。
const holidayNeighbourCases = [
  ['2025-12-31', '当前时段：梁文峰'], // 元旦前一天（周三）
  ['2026-01-04', '当前时段：梁文谷'], // 元旦后一天（周日 + 调休上班）
  ['2026-02-13', '当前时段：梁文峰'], // 春节前最后一个工作日（周五）
  ['2026-02-24', '当前时段：梁文峰'], // 春节后第一天（周二）
  ['2026-04-03', '当前时段：梁文峰'], // 清明前一天（周五）
  ['2026-04-07', '当前时段：梁文峰'], // 清明后第一天（周二）
  ['2026-04-30', '当前时段：梁文峰'], // 劳动节前一天（周四）
  ['2026-05-06', '当前时段：梁文峰'], // 劳动节后第一天（周三）
  ['2026-06-18', '当前时段：梁文峰'], // 端午前一天（周四）
  ['2026-06-22', '当前时段：梁文峰'], // 端午后第一天（周一）
  ['2026-09-24', '当前时段：梁文峰'], // 中秋前一天（周四）
  ['2026-09-28', '当前时段：梁文峰'], // 中秋后第一天（周一）
  ['2026-09-30', '当前时段：梁文峰'], // 国庆前最后一个工作日（周三）
  ['2026-10-08', '当前时段：梁文峰'], // 国庆后第一天（周四）
  ['2027-03-10', '当前时段：梁文峰'], // 表未覆盖的年份按裸规则判定
]

for (const [date, expected] of holidayNeighbourCases) {
  assert.equal(getSlotLabel(atBeijing(date, '10:00')), expected, `${date} 10:00`)
}

// 跨假期倒计时：谷期不是在假期中段结束，而是连续算到假期后第一个峰期开始。
const holidayRemainingCases = [
  ['2026-02-16', '10:00', 687600], // 春节（除夕，周一）→ 2-24 周二 09:00（7 天 23 h）
  ['2026-09-20', '10:00', 82800], //  周日（调休上班）→ 9-21 周一 09:00（23 h）
  ['2026-09-21', '08:59', 60], //     周一 08:59 → 09:00（调休周日不改变周一的峰期）
  ['2026-09-25', '10:00', 255600], // 中秋首日（周五）→ 9-28 周一 09:00（2 天 23 h）
  ['2026-09-30', '18:00', 658800], // 国庆前夜（周三）→ 10-08 周四 09:00（7 天 15 h）
  ['2026-10-07', '10:00', 82800], //  国庆最后一天（周三）→ 10-08 周四 09:00（23 h）
  ['2026-10-10', '10:00', 169200], // 周六（调休上班）→ 10-12 周一 09:00（47 h）
]

for (const [date, time, expected] of holidayRemainingCases) {
  assert.equal(getSlotRemaining(atBeijing(date, time)), expected, `${date} ${time}`)
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
  [255600, '2天 23:00:00'],
  [658800, '7天 15:00:00'],
]

for (const [seconds, expected] of formatCases) {
  assert.equal(formatCountdown(seconds), expected, String(seconds))
}

console.log(
  `time-slot test ok (${weekdayCases.length} weekday + ${labelCases.length} label + ` +
  `${remainingCases.length} remaining + ${holidayDays.length} holiday + ` +
  `${NOTICE_MAKEUP_DAYS.length} makeup-workday + ${holidayRemainingCases.length} holiday-countdown + ` +
  `${formatCases.length} format cases)`,
)
