import { type OfficialModel, type PriceTier, type RateRevision, type TokenBuckets } from './pricing';
export interface CompositeSectionProps {
    /** Cumulative session usage; undefined until the projection reports any. */
    readonly usage: TokenBuckets | undefined;
    /** The model whose rates price this session. */
    readonly activeEntry: OfficialModel;
    readonly revision: RateRevision;
    readonly tier: PriceTier;
    /** The Session's own model id, so the block can say when it is unpriced. */
    readonly sessionModelId: string | null;
}
export declare const CompositeSection: import("react").NamedExoticComponent<CompositeSectionProps>;
