import { IFilterNumber } from "angular";

export class TorrentRatioFilter {
    public static getInstance(): () => IFilterNumber {
        return () => new TorrentRatioFilter().transform;
    }

    public transform: IFilterNumber = (ratio): string => {
        if (this.isNumeric(ratio)) {
            return parseFloat(String(ratio)).toFixed(2);
        }

        return "";
    };

    private isNumeric(number: number | string): boolean {
        return !isNaN(parseFloat(String(number))) && isFinite(Number(number));
    }
}
