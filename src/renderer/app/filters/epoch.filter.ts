import { IFilterDate } from "angular";
import moment from "moment";

interface EpochFilterTransform extends IFilterDate {
    (epoch: number | string): string;
}

export class EpochFilter {
    public static getInstance(): () => EpochFilterTransform {
        return () => new EpochFilter().transform;
    }

    public transform: EpochFilterTransform = (value): string => {
        if (value instanceof Date) {
            return "Unknown date";
        }

        const epoch = Number(value);

        if (!epoch) {
            return "Unknown date";
        }

        return moment(epoch * 1000).format("MMMM Do YYYY, HH:mm");
    };
}
