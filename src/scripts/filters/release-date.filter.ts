import { IFilterDate } from "angular";
import moment from "moment";

export class ReleaseDateFilter {
    public static getInstance(): () => IFilterDate {
        return () => new ReleaseDateFilter().transform;
    }

    public transform: IFilterDate = (date): string => {
        if (!date) {
            return "Release date unknown";
        }

        if (typeof date === "string") {
            return moment(date, moment.ISO_8601, true).format("MMMM Do YYYY, HH:mm");
        }

        return moment(date).format("MMMM Do YYYY, HH:mm");
    };
}
