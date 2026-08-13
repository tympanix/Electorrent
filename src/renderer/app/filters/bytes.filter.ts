import { IFilterNumber } from "angular";
import { formatBytes } from "@renderer/app/filters/speed-format";

export class BytesFilter {
    public static getInstance(): () => IFilterNumber {
        return () => new BytesFilter().transform;
    }

    public transform: IFilterNumber = (value, fractionSize = 1): string => {
        return formatBytes(value, fractionSize);
    };
}
