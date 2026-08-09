import { IFilterNumber, IFilterService } from "angular";
import { formatSpeedValue } from "@renderer/app/filters/speed-format";
import type { SettingsService } from "@renderer/app/services/settings";

type BytesFilterTransform = IFilterNumber;
type SpeedFilterTorrent = {
    isStatusDownloading: () => boolean;
};

interface SpeedFilterTransform extends IFilterNumber {
    (bytesPerSecond: number | string, torrent?: SpeedFilterTorrent | number | string): string;
    $stateful?: boolean;
}

interface SpeedFilterFactory {
    ($filter: IFilterService, settingsService: SettingsService): SpeedFilterTransform;
    $inject?: string[];
}

export class SpeedFilter {
    public static getInstance(): SpeedFilterFactory {
        const factory: SpeedFilterFactory = ($filter: IFilterService, settingsService: SettingsService) => {
            const transform = new SpeedFilter($filter<BytesFilterTransform>("bytes"), settingsService).transform;
            // The rendered unit comes from user settings rather than from the
            // filter input, so opt out of the stateless filter optimisation.
            transform.$stateful = true;
            return transform;
        };
        factory.$inject = ["$filter", "settingsService"];
        return factory;
    }

    constructor(
        private bytesFilter: BytesFilterTransform,
        private settingsService: SettingsService,
    ) {}

    public transform: SpeedFilterTransform = (bytesPerSecond, torrent): string => {
        let display = true;

        if (torrent && typeof torrent === "object") {
            display = torrent.isStatusDownloading();
        }

        if (display) {
            const unit = this.settingsService.getAllSettings().ui.speedUnit;
            return `${formatSpeedValue(bytesPerSecond, unit, this.bytesFilter)}/s`;
        }

        return "";
    };
}
