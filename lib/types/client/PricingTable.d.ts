import { type PriceTier, type RateRevision } from './pricing';
export interface PricingTableProps {
    /** The revision in force for the priced model, and the instant this block reads the table at. */
    readonly revision: RateRevision;
    readonly tier: PriceTier;
    readonly activeModelId: string;
    /** Pick a model to price the session with. */
    readonly onPick: (modelId: string) => void;
}
export declare const PricingTable: import("react").NamedExoticComponent<PricingTableProps>;
