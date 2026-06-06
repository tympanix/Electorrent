import { QBittorrentClient } from "@renderer/app/bittorrent/qbittorrent"

export class MockBittorrentClient extends QBittorrentClient {
    public name = "Mock Bittorrent"
    public id = "mock"
}
