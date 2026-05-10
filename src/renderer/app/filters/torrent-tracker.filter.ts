import { IFilterLowercase } from "angular";

export class TorrentTrackerFilter {
    private static readonly URL_REGEX = /^[a-z]+:\/\/(?:[a-z0-9-]+\.)*((?:[a-z0-9-]+\.)[a-z]+)/;

    public static getInstance(): () => IFilterLowercase {
        return () => new TorrentTrackerFilter().transform;
    }

    public transform: IFilterLowercase = (tracker): string => {
        if (!tracker) {
            return "";
        }

        const match = tracker.match(TorrentTrackerFilter.URL_REGEX);

        if (!match) {
            return "";
        }

        return match[1];
    };
}
