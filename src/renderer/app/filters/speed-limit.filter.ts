import { IFilterNumber, IFilterService } from "angular";

type BytesFilterTransform = IFilterNumber;

interface SpeedLimitFilterTransform extends IFilterNumber {
    (bytesPerSecond: number | string | null | undefined): string;
}

interface SpeedLimitFilterFactory {
    ($filter: IFilterService): SpeedLimitFilterTransform;
    $inject?: string[];
}

export class SpeedLimitFilter {
    public static getInstance(): SpeedLimitFilterFactory {
        const factory: SpeedLimitFilterFactory = ($filter: IFilterService) =>
            new SpeedLimitFilter($filter<BytesFilterTransform>("bytes")).transform;
        factory.$inject = ["$filter"];
        return factory;
    }

    constructor(private bytesFilter: BytesFilterTransform) {}

    public transform: SpeedLimitFilterTransform = (bytesPerSecond): string => {
        const value = Number(bytesPerSecond);

        if (!Number.isFinite(value)) {
            return "";
        }

        if (value <= 0) {
            return "∞";
        }

        return `${this.bytesFilter(value)}/s`;
    };
}
