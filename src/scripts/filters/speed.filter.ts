import { IFilterNumber, IFilterService } from "angular";

type BytesFilterTransform = IFilterNumber;
type SpeedFilterTorrent = {
    isStatusDownloading: () => boolean;
};

interface SpeedFilterTransform extends IFilterNumber {
    (bytesPerSecond: number | string, torrent?: SpeedFilterTorrent | number | string): string;
}

interface SpeedFilterFactory {
    ($filter: IFilterService): SpeedFilterTransform;
    $inject?: string[];
}

export class SpeedFilter {
    public static getInstance(): SpeedFilterFactory {
        const factory: SpeedFilterFactory = ($filter: IFilterService) =>
            new SpeedFilter($filter<BytesFilterTransform>("bytes")).transform;
        factory.$inject = ["$filter"];
        return factory;
    }

    constructor(private bytesFilter: BytesFilterTransform) {}

    public transform: SpeedFilterTransform = (bytesPerSecond, torrent): string => {
        let display = true;

        if (torrent && typeof torrent === "object") {
            display = torrent.isStatusDownloading();
        }

        if (display) {
            return `${this.bytesFilter(bytesPerSecond)}/s`;
        }

        return "";
    };
}
