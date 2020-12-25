import { Column } from '../services/column'

export interface TorrentProps {
    hash: string
    status?: number
    name?: string
    size?: number
    percent?: number
    downloaded?: number
    uploaded?: number
    ratio?: number
    uploadSpeed?: number
    downloadSpeed?: number
    eta?: number
    label?: string
    peersConnected?: number
    peersInSwarm?: number
    seedsConnected?: number
    seedsInSwarm?: number
    torrentQueueOrder?: number
    statusMessage?: string
    dateAdded?: number
    dateCompleted?: number
    savePath?: string
    props?: Record<string, any>
}

export abstract class Torrent implements TorrentProps {

    // Specific fields
    selected: boolean
    isStarred: boolean
    decodedName: string
    cleanedName: string

    // Inherited fields
    hash: string
    status: number
    name: string
    size: number
    percent: number
    downloaded: number
    uploaded: number
    ratio: number
    uploadSpeed: number
    downloadSpeed: number
    eta: number
    label: string
    peersConnected: number
    peersInSwarm: number
    seedsConnected: number
    seedsInSwarm: number
    torrentQueueOrder: number
    statusMessage: string
    dateAdded: number
    dateCompleted: number
    savePath: string
    props: Record<string, any>


    constructor(props: TorrentProps) {
        for (let p in props) {
            this[p] = props[p]
        }
        this.selected = false;
        this.isStarred = false;
        this.decodedName = this.decodeName(this.name);
        this.cleanedName = this.cleanName(this.decodedName);
    }

    private decodeName(name: string) {
        if(!name) return undefined

        return name.replace(/[\._]/g, ' ').replace(/(\[[^\]]*\])(.*)$/, '$2 $1').trim();
    };

    private cleanName(name: string) {
        if(!name) return undefined

        return name.toLowerCase().replace(/s?([0-9]{1,2})[x|e|-]([0-9]{1,2})/, '').replace(
            /(bdrip|brrip|cam|dttrip|dvdrip|dvdscr|dvd|fs|hdtv|hdtvrip|hq|pdtv|satrip|dvbrip|r5|r6|ts|tc|tvrip|vhsrip|vhsscr|ws|aac|ac3|dd|dsp|dts|lc|ld|md|mp3|xvid|720p|1080p|fs|internal|limited|proper|stv|subbed|tma|tnz|silent|tls|gbm|fsh|rev|trl|upz|unrated|webrip|ws|mkv|avi|mov|mp4|mp3|iso|x264|x265|h264|h265)/g,
            '').trim();
    };


    update(other: Torrent) {
        for(var k in other) {
            if(other.hasOwnProperty(k) && k !== 'selected') {
                if(other[k] !== undefined) {
                    this[k] = other[k];
                }
            }
        }
    };

    getMagnetURI(longUri: string) {
        var i = 0;
        var link = 'magnet:?xt=urn:btih:' + this.hash;
        if(longUri) {
            link += '&dn=' + encodeURIComponent(this.name);
            link += '&xl=' + encodeURIComponent(this.size);

            if(this.props && this.props.trackers) {
                var trackers = this.props.trackers.split('\r\n');
                for(i = 0; i < trackers.length; i++) {
                    if(trackers[i].length > 0) {
                        link += '&tr=' + encodeURIComponent(trackers[i]);
                    }
                }
            }
        }
        return link;
    };


    abstract isStatusError(): boolean;
    abstract isStatusPaused(): boolean;
    abstract isStatusQueued(): boolean;
    abstract isStatusCompleted(): boolean;
    abstract isStatusDownloading(): boolean;
    abstract isStatusSeeding(): boolean;
    abstract isStatusStopped(): boolean;

    getPercentStr(): string {
        return(Number((this.percent || 0) / 10)).toFixed(0) + '%';
    };

    statusColor(): string {
        if (this.isStatusPaused()){
            return 'grey';
        } else if (this.isStatusSeeding()){
            return 'orange';
        } else if (this.isStatusQueued()){
            return 'yellow'
        } else if (this.isStatusDownloading()){
            return 'blue';
        } else if (this.isStatusError()){
            return 'error';
        } else if (this.isStatusCompleted()){
            return 'success';
        } else {
            return 'disabled';
        }
    };

    manualStatusText(): string {
        if (this.isStatusPaused()){
            return 'Paused';
        } else if (this.isStatusStopped()){
            return 'Stopped';
        } else if (this.isStatusSeeding()){
            return 'Seeding';
        } else if (this.isStatusQueued()){
            return 'Queued';
        } else if (this.isStatusDownloading()){
            return 'Downloading';
        } else if (this.isStatusError()){
            return 'Error';
        } else if (this.isStatusCompleted()){
            return 'Finished';
        } else {
            return 'Unknown';
        }
    };

    statusText(): string {
        const statusRegex = /[^a-zA-Z(): ]/g;
        if (!this.statusMessage) return this.manualStatusText();
        return this.statusMessage.replace(statusRegex, '');
    };

    seedsText(): string {
        if (Number.isInteger(this.seedsConnected) && Number.isInteger(this.seedsInSwarm)) {
            return this.seedsConnected + ' of ' + this.seedsInSwarm
        } else {
            return ''
        }
    }

    peersText(): string {
        if (Number.isInteger(this.peersConnected) && Number.isInteger(this.peersInSwarm)) {
            return this.peersConnected + ' of ' + this.peersInSwarm
        } else {
            return ''
        }
    }

    queueText(): string {
        if (Number.isInteger(this.torrentQueueOrder) && this.torrentQueueOrder >= 0) {
            return this.torrentQueueOrder.toString()
        } else {
            return ''
        }
    }

    static sort(attribute: keyof Torrent) {
        switch (attribute) {
            case 'decodedName': return Torrent.alphabetical
            case 'label': return Torrent.alphabetical
            case 'torrentQueueOrder': return Torrent.naturalNumberAsc
            case 'eta': return Torrent.naturalNumberAsc
            default: return Torrent.numerical
        }
    }

    static COL_NAME = new Column({
      name: 'Name',
      enabled: true,
      template: '{{settings.ui.cleanNames ? torrent.decodedName : torrent.name}}',
      attribute: 'decodedName',
      sort: Column.ALPHABETICAL
    })

    static COL_SIZE = new Column({
      name: 'Size',
      enabled: true,
      template: '{{torrent.size | bytes}}',
      attribute: 'size'
    })

    static COL_DOWNSPEED = new Column({
      name: 'Down',
      enabled: true,
      template: '{{torrent.downloadSpeed | speed}}',
      attribute: 'downloadSpeed'
    })

    static COL_UPSPEED = new Column({
      name: 'Up',
      enabled: true,
      template: '{{torrent.uploadSpeed | speed}}',
      attribute: 'uploadSpeed'
    })

    static COL_PROGRESS = new Column({
      name: 'Progress',
      enabled: true,
      template: '<div progress="torrent"></div>',
      attribute: 'percent'
    })

    static COL_LABEL = new Column({
      name: 'Label',
      enabled: true,
      template: '{{torrent.label}}',
      attribute: 'label',
      sort: Column.ALPHABETICAL
    })

    static COL_DATEADDED = new Column({
      name: 'Date Added',
      enabled: true,
      template: '<span time="torrent.dateAdded"></span>',
      attribute: 'dateAdded'
    })

    static COL_PEERS = new Column({
      name: 'Peers',
      enabled: false,
      template: '{{torrent.peersText()}}',
      attribute: 'peersConnected'
    })

    static COL_SEEDS = new Column({
      name: 'Seeds',
      enabled: false,
      template: '{{torrent.seedsText()}}',
      attribute: 'seedsConnected'
    })

    static COL_QUEUE = new Column({
      name: 'Queue',
      enabled: false,
      template: '{{torrent.torrentQueueOrder | torrentQueue}}',
      attribute: 'torrentQueueOrder',
      sort: Column.NATURAL_NUMBER_ASC
    })

    static COL_ETA = new Column({
      name: 'ETA',
      enabled: false,
      template: '{{torrent.eta | eta}}',
      attribute: 'eta',
      sort: Column.NATURAL_NUMBER_ASC
    })

    static COL_RATIO = new Column({
      name: 'Ratio',
      enabled: false,
      template: '{{torrent.ratio | torrentRatio}}',
      attribute: 'ratio'
    })

    static COLUMNS = [
        Torrent.COL_NAME,
        Torrent.COL_SIZE,
        Torrent.COL_DOWNSPEED,
        Torrent.COL_UPSPEED,
        Torrent.COL_PROGRESS,
        Torrent.COL_LABEL,
        Torrent.COL_DATEADDED,
        Torrent.COL_PEERS,
        Torrent.COL_SEEDS,
        Torrent.COL_QUEUE,
        Torrent.COL_ETA,
        Torrent.COL_RATIO
    ]

    private static alphabetical(a: string, b: string) {
        var aLower = a.toLowerCase();
        var bLower = b.toLowerCase();
        return aLower.localeCompare(bLower);
    }

    private static numerical(a: number, b: number){
        return b - a;
    }

    private static naturalNumberAsc(a: number, b: number){
        if (a < 1) return 1
        if (b < 1) return -1
        return a - b
    }
}

