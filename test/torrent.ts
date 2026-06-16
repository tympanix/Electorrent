import path from "node:path";
import { DockerComposeService } from "./shared/compose";
import { getTestFixture } from "./framework/fixture";

/**
 * Create a torrent file in the tracker service.
 * @param tracker The DockerComposeService instance for the tracker.
 * @param options Options for creating the torrent file.
 * @returns The path to the created torrent file.
 */
export async function createTorrentFile(tracker: DockerComposeService, options: {
    torrentName?: string;
    fileSize?: number;
    downloadSpeed?: number;
    uploadSpeed?: number;
    trackerUrl?: string;
}): Promise<string> {
    const randomString = Math.random().toString(36).substring(2, 10);
    const torrentName = options.torrentName || `test-torrent-${randomString}`;
    const fileSize = options.fileSize || 1; // Default to 1 kB if not specified
    const cmd = [
        "gen-torrent",
        "--torrent-name", torrentName,
        "--file-size", fileSize.toString(),
    ]
    if (options.downloadSpeed) {
        cmd.push("--download-speed", options.downloadSpeed.toString());
    }
    if (options.uploadSpeed) {
        cmd.push("--upload-speed", options.uploadSpeed.toString());
    }
    if (options.trackerUrl) {
        cmd.push("--tracker-url", options.trackerUrl);
    }
    await tracker.exec(cmd);
    return path.join(getTestFixture().sharedDir, `${torrentName}.torrent`);
}
