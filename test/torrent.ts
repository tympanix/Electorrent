import path from "node:path";
import { fileURLToPath } from "node:url";
import { DockerComposeService } from "./shared/compose";

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Create a torrent file in the tracker service.
 * @param tracker The DockerComposeService instance for the tracker.
 * @param options Options for creating the torrent file.
 * @returns The path to the created torrent file.
 */
export async function createTorrentFile(tracker: DockerComposeService, options: {
    torrentName?: string;
    fileSize?: number;
    files?: Record<string, number>;
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
    ]
    if (options.files) {
        for (const [filePath, size] of Object.entries(options.files)) {
            cmd.push("--file", filePath, size.toString());
        }
    } else {
        cmd.push("--file-size", fileSize.toString());
    }
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
    const torrentPath = path.join(__dirname, `shared/opentracker/data/shared/${torrentName}.torrent`)
    return torrentPath;
}

/** Create the large, bandwidth-limited torrent used by slower integration tests. */
export function createSlowTorrentFile(tracker: DockerComposeService): Promise<string> {
    const randomString = Math.random().toString(36).substring(2, 10);
    return createTorrentFile(tracker, {
        torrentName: `slow-${randomString}`,
        fileSize: 100000,
        downloadSpeed: 1,
        uploadSpeed: 1,
    });
}
