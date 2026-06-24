export const NO_LABEL_FILTER = "__electorrent_no_label__";

export function matchesLabelFilter(torrentLabel: string | null | undefined, filterLabel?: string) {
    if (!filterLabel) {
        return true;
    }

    if (filterLabel === NO_LABEL_FILTER) {
        return !torrentLabel;
    }

    return torrentLabel === filterLabel;
}
