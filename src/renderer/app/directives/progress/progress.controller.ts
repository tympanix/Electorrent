export class ProgressController {
    torrent: any;

    class() {
        return this.torrent.statusColor();
    }

    label() {
        let label = this.torrent.statusText();
        if (this.torrent.isStatusDownloading() || this.torrent.isStatusCompleted() || this.torrent.isStatusSeeding()) {
            label += ` ${this.torrent.getPercentStr()}`;
        }

        return label;
    }
}
