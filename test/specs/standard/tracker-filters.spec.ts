import * as e2e from "../../e2e"
import { eventually } from "../../e2e/eventually"
import { createTorrentFile } from "../../torrent"
import { configureSpec, getTestFixture, requireFeature } from "../../framework/fixture"

const fixture = getTestFixture()
const tracker = fixture.tracker

describe("tracker filters", function () {
  configureSpec()
  requireFeature(({ features }) => features.trackerFilter === true)

  it("filters torrents by individual trackers", async function () {
    this.timeout(120 * 1000)

    const torrentCases = [
      { tracker: "tracker-one.test", trackerUrl: "http://tracker-one.test:6969/announce" },
      { tracker: "tracker-two.test", trackerUrl: "http://tracker-two.test:6969/announce" },
      { tracker: "tracker-three.test", trackerUrl: "http://tracker-three.test:6969/announce" },
    ]
    const torrents: e2e.Torrent[] = []

    const waitForSidebarTrackers = async (expectedTrackers: string[]) => {
      await eventually(() => this.app.getAllSidebarTrackers())
        .satisfies(`contain ${expectedTrackers.join(", ")}`, (sidebarTrackers) => {
          return expectedTrackers.every((tracker) => sidebarTrackers.includes(tracker))
        }, { timeout: 30 * 1000 })
    }

    try {
      for (const [index, torrentCase] of torrentCases.entries()) {
        const torrentPath = await createTorrentFile(tracker, {
          torrentName: `tracker-filter-${index}-${Math.random().toString(36).slice(2, 10)}`,
          fileSize: 1,
          trackerUrl: torrentCase.trackerUrl,
        })
        const torrent = await this.app.uploadTorrent({ filename: torrentPath })
        torrents.push(torrent)
        await torrent.waitForExist({ timeout: 30 * 1000 })
        await waitForSidebarTrackers(torrentCases.slice(0, index + 1).map(({ tracker }) => tracker))
      }

      for (const [index, torrentCase] of torrentCases.entries()) {
        await this.app.filterTracker(torrentCase.tracker)

        for (const [torrentIndex, torrent] of torrents.entries()) {
          if (torrentIndex === index) {
            await torrent.waitForExist()
          } else {
            await torrent.waitForGone()
          }
        }
      }

      await this.app.filterTracker(torrentCases[0].tracker)
      await this.app.filterTracker(torrentCases[0].tracker)
      for (const torrent of torrents) {
        await torrent.waitForExist()
      }

      await this.app.filterTracker()
      await torrents[1].delete()
      await eventually(() => this.app.getAllSidebarTrackers())
        .satisfies(`remove ${torrentCases[1].tracker}`, (sidebarTrackers) => {
          return !sidebarTrackers.includes(torrentCases[1].tracker)
            && sidebarTrackers.includes(torrentCases[0].tracker)
            && sidebarTrackers.includes(torrentCases[2].tracker)
        }, { timeout: 30 * 1000 })
    } finally {
      await this.app.filterTracker()
      for (const torrent of torrents) {
        if (await torrent.isExisting()) {
          await torrent.delete()
        }
      }
    }
  })
})
