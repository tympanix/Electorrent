export { Torrent } from "./abstracttorrent"
export { TorrentClient } from "./torrentclient"

// Client API implementations for bittorrent providers
export { DelugeClient, DelugeTorrent } from "./deluge"
export { QBittorrentClient, QBittorrentTorrent } from "./qbittorrent"
export { RtorrentClient, RtorrentTorrent } from "./rtorrent"
export { SynologyClient, SynologyTorrent } from "./synology"
export { TransmissionClient, TransmissionTorrent } from "./transmission"
export { UtorrentClient, UtorrentTorrent } from "./utorrent"
