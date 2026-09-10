import { type BalanceState } from './balance';
export interface BalanceSectionProps {
    readonly state: BalanceState;
    /** Poll once right now, ignoring the schedule. */
    readonly onRefresh: () => void;
}
export declare const BalanceSection: import("react").NamedExoticComponent<BalanceSectionProps>;
