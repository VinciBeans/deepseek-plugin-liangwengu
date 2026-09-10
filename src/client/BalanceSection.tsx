/**
 * The menu's last block: the account balance in detail.
 *
 * It reads the same store the badge's lower line reads, so the two can never
 * disagree, and it offers the manual refresh the poller already supports.
 * Memoized like the other blocks: its input changes on a poll (every few
 * seconds), not on the badge's per-second tick.
 */
import { memo } from 'react'
import {
  balanceEmptyText,
  balanceErrorText,
  balanceUpdatedText,
  currencySign,
  isEntryLow,
  type BalanceState,
} from './balance'

export interface BalanceSectionProps {
  readonly state: BalanceState
  /** Poll once right now, ignoring the schedule. */
  readonly onRefresh: () => void
}

export const BalanceSection = memo(function BalanceSection({ state, onRefresh }: BalanceSectionProps) {
  const entries = state.entries ?? []
  return (
    <>
      <div className="dsh-lwgu-head">
        <span className="dsh-lwgu-title">账户余额</span>
        <button
          type="button"
          className="dsh-lwgu-refresh"
          disabled={state.loading}
          onClick={onRefresh}
        >
          {state.loading ? '查询中…' : '刷新'}
        </button>
      </div>
      {entries.length === 0
        ? <div className="dsh-lwgu-note">{balanceEmptyText(state)}</div>
        : (
          <>
            {entries.map((entry) => {
              const sign = currencySign(entry.currency)
              const low = isEntryLow(entry, state.lowBalanceThreshold)
              return (
                <div className="dsh-lwgu-bal" key={entry.currency}>
                  <div className="dsh-lwgu-kv">
                    <span>{entry.currency} 总可用</span>
                    <span className="dsh-lwgu-bal-amount" data-tone={low ? 'low' : 'ok'}>
                      {sign}{entry.totalBalance}
                    </span>
                  </div>
                  <div className="dsh-lwgu-note">
                    未过期赠金 {sign}{entry.grantedBalance} · 充值余额 {sign}{entry.toppedUpBalance}
                  </div>
                </div>
              )
            })}
            <div className="dsh-lwgu-note">
              可用：{state.isAvailable === false ? '不可调用' : '可调用'}
              {' · '}
              更新于 {balanceUpdatedText(state)}
            </div>
          </>
        )}
      {state.lastError !== undefined && (
        <div className="dsh-lwgu-note">
          {balanceErrorText(state.lastError)}
        </div>
      )}
    </>
  )
})
