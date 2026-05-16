declare namespace angular {
    type TorrentClient = import("@renderer/app/bittorrent/torrentclient").TorrentClient
    
    interface IRootScopeService {
        $btclient: TorrentClient
    }
}
