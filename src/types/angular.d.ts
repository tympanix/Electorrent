declare namespace angular {
    type TorrentClient = import("../scripts/bittorrent/torrentclient").TorrentClient
    
    interface IRootScopeService {
        $btclient: TorrentClient
    }
}