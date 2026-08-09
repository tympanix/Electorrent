import { IFilterNumber, IFilterService } from "angular";
import { formatSpeedValue } from "@renderer/app/filters/speed-format";
import type { SettingsService } from "@renderer/app/services/settings";

type BytesFilterTransform = IFilterNumber;

interface SpeedLimitFilterTransform extends IFilterNumber {
    (bytesPerSecond: number | string | null | undefined): string;
    $stateful?: boolean;
}

interface SpeedLimitFilterFactory {
    ($filter: IFilterService, settingsService: SettingsService): SpeedLimitFilterTransform;
    $inject?: string[];
}

export class SpeedLimitFilter {
    public static getInstance(): SpeedLimitFilterFactory {
        const factory: SpeedLimitFilterFactory = ($filter: IFilterService, settingsService: SettingsService) => {
            const transform = new SpeedLimitFilter($filter<BytesFilterTransform>("bytes"), settingsService).transform;
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

    public transform: SpeedLimitFilterTransform = (bytesPerSecond): string => {
        const value = Number(bytesPerSecond);

        if (!Number.isFinite(value)) {
            return "";
        }

        if (value <= 0) {
            return "∞";
        }

        const unit = this.settingsService.getAllSettings().ui.speedUnit;
        return `${formatSpeedValue(value, unit, this.bytesFilter)}/s`;
    };
}
