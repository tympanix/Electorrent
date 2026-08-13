import { IFilterNumber } from "angular";
import { formatBits, formatBytes } from "@renderer/app/filters/speed-format";
import type { SettingsService } from "@renderer/app/services/settings";

type SpeedFilterTorrent = {
    isStatusDownloading: () => boolean;
};

interface SpeedFilterTransform extends IFilterNumber {
    (bytesPerSecond: number | string, torrent?: SpeedFilterTorrent | number | string): string;
    $stateful?: boolean;
}

interface SpeedFilterFactory {
    (settingsService: SettingsService): SpeedFilterTransform;
    $inject?: string[];
}

export class SpeedFilter {
    public static getInstance(): SpeedFilterFactory {
        const factory: SpeedFilterFactory = (settingsService: SettingsService) => {
            const transform = new SpeedFilter(settingsService).transform;
            // The rendered unit comes from user settings rather than from the
            // filter input, so opt out of the stateless filter optimisation.
            transform.$stateful = true;
            return transform;
        };
        factory.$inject = ["settingsService"];
        return factory;
    }

    constructor(private settingsService: SettingsService) {}

    public transform: SpeedFilterTransform = (bytesPerSecond, torrent): string => {
        let display = true;

        if (torrent && typeof torrent === "object") {
            display = torrent.isStatusDownloading();
        }

        if (display) {
            const format = this.settingsService.getAllSettings().ui.speedUnit === "bits" ? formatBits : formatBytes;
            return `${format(bytesPerSecond)}/s`;
        }

        return "";
    };
}
