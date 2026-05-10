import { IFilterDate } from "angular";
import moment from "moment";

const BT_EPOCH = 994032000000; /* July 2nd 2001, release of bittorrent */

export class DateFilter {
    public static getInstance(): () => IFilterDate {
        return () => new DateFilter().transform;
    }

    public transform: IFilterDate = (date): string => {
        const epochTime =
            date instanceof Date ? date.getTime() : typeof date === "number" ? date : Number(date);

        if (!epochTime || epochTime < BT_EPOCH) {
            return "";
        }

        return moment(epochTime).fromNow();
    };
}
