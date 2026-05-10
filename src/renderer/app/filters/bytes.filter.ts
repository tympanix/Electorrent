import { IFilterNumber } from "angular";

export class BytesFilter {
    public static getInstance(): () => IFilterNumber {
        return () => new BytesFilter().transform;
    }

    public transform: IFilterNumber = (value, fractionSize = 1): string => {
        const bytes = Number(value);
        const decimals = Number(fractionSize);

        if (!bytes) {
            return "0 B";
        }

        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    };
}
