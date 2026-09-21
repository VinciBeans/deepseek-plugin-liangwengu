/**
 * 中国法定节假日放假安排，按北京时间的日历日查询。
 *
 * 官方计费口径：「北京时间周一至周五（不含中国法定节假日）9:00–12:00、14:00–18:00
 * 为高峰时段；其余时段，包括周末及中国法定节假日全天均为空闲时段」，调休上班的周末
 * 同样按空闲时段计费。于是谷期日 = 周末 ∪ 本表列出的放假日期；峰期日 = 周一至周五
 * ∩ 非放假日期（见 `time-slot.ts`）。
 *
 * 表里记的是官方通知的**整天放假区间**（含调休拼出的连休及其中的周末），而不是「法定
 * 节假日」本身的那几天：官方按整段假期计费（2026 年中秋 3 天 + 国庆 7 天 = 10 天）。
 *
 * 调休上班日不需要单独一张表：它们固定落在周六/周日（调休本来就是用周末换连休），已被
 * 「周末全天为谷期」覆盖，官方口径也正是要求它们按空闲时段计费。2026 年的调休上班日为
 * 1-04、2-14、2-28、5-09、9-20、10-10，`test/time-slot.test.mjs` 用 9-20、10-10 锁住
 * 「调休上班日仍是谷期」，防止日后把「工作日」改成官方上班日日历。
 *
 * 这张表是**逐年公告**的数据，不是规则：国务院办公厅一般在头一年 11 月公布次年安排，
 * 公布后往 {@link HOLIDAY_SPANS} 追加区间即可，判定代码不用动。表未覆盖的日期按裸规则
 * 判定（周一至周五 09:00–12:00、14:00–18:00 为峰期）。
 */

import { BEIJING_OFFSET_MS } from './pricing'

const DAY_MS = 86_400_000

/**
 * 数据来源：《国务院办公厅关于 2026 年部分节假日安排的通知》（国办发明电〔2025〕7 号，
 * 2025-11-04 发布），逐条对应通知里的「X、XX节：…放假」。
 */
export const HOLIDAY_SOURCE_URL = 'https://www.gov.cn/gongbao/2025/issue_12406/202511/content_7048922.html'

/**
 * 放假区间 `[首日, 末日]`，北京时间闭区间，`YYYY-MM-DD`。
 *
 * 只列通知里的「放假」条款，不列「上班」条款——后者是调休上班日，见模块文档。
 */
export const HOLIDAY_SPANS: readonly (readonly [string, string])[] = [
  ['2026-01-01', '2026-01-03'], // 元旦
  ['2026-02-15', '2026-02-23'], // 春节
  ['2026-04-04', '2026-04-06'], // 清明节
  ['2026-05-01', '2026-05-05'], // 劳动节
  ['2026-06-19', '2026-06-21'], // 端午节
  ['2026-09-25', '2026-09-27'], // 中秋节
  ['2026-10-01', '2026-10-07'], // 国庆节
]

/** Beijing calendar-day key, `YYYY-MM-DD`: Asia/Shanghai is a fixed UTC+8, so shifting then reading UTC is exact. */
function beijingDateKey(date: Date): string {
  return new Date(date.getTime() + BEIJING_OFFSET_MS).toISOString().slice(0, 10)
}

/** Expand a `[from, to]` span into one key per day, both ends included. */
function expandSpan([from, to]: readonly [string, string]): string[] {
  const days: string[] = []
  const end = Date.parse(`${to}T00:00:00Z`)
  for (let ms = Date.parse(`${from}T00:00:00Z`); ms <= end; ms += DAY_MS) {
    days.push(new Date(ms).toISOString().slice(0, 10))
  }
  return days
}

const HOLIDAY_DAYS: ReadonlySet<string> = new Set(HOLIDAY_SPANS.flatMap(expandSpan))

/**
 * Whether an instant falls on a day the State Council schedule gives off, in Beijing time.
 * @param date - any instant.
 * @returns true for every calendar day of a {@link HOLIDAY_SPANS} span, both ends included.
 */
export function isStatutoryHoliday(date: Date): boolean {
  return HOLIDAY_DAYS.has(beijingDateKey(date))
}
