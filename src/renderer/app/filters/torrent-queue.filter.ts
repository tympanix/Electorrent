import type { NumberFilter as IFilterNumber } from "./filter-types";

export class TorrentQueueFilter {
    public static getInstance(): () => IFilterNumber {
        return () => new TorrentQueueFilter().transform;
    }

    public transform: IFilterNumber = (value): string => {
        const queue = Number(value);

        if (Number.isInteger(queue) && queue >= 0) {
            return queue.toString();
        }

        return "";
    };
}
