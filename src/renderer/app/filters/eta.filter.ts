import { IFilterNumber } from "angular";
import moment from "moment";

const MONTH_IN_SECONDS = 60 * 60 * 24 * 30;

export class EtaFilter {
    public static getInstance(): () => IFilterNumber {
        return () => new EtaFilter().transform;
    }

    public transform: IFilterNumber = (value): string => {
        const seconds = Number(value);

        if (!seconds || seconds < 1 || seconds > MONTH_IN_SECONDS) {
            return "";
        }

        return moment().to(moment().add(seconds, "seconds"), true);
    };
}
