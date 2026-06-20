import * as e2e from "../../e2e"
import { createTorrentFile } from "../../torrent"
import { configureSpec, createUniqueLabel, getTestFixture, requireFeature } from "../../framework/fixture"
import { restartApplication } from "../../shared"

const fixture = getTestFixture()
const tracker = fixture.tracker

describe("torrent uploads", function () {
  configureSpec()

  describe("torrent file uploads", function () {
    let torrent: e2e.Torrent
    before(async function () {
      this.timeout(60 * 1000)
      const filename = await createTorrentFile(tracker, {
        torrentName: createUniqueLabel("upload-file"),
        fileSize: 100000,
        downloadSpeed: 1,
        uploadSpeed: 1,
      })
      torrent = await this.app.uploadTorrent({ filename })
    })

    after(async function () {
      if (torrent && await torrent.isExisting()) {
        await torrent.delete()
      }
    })

    it("torrent is visible in the table", () => {
      return torrent.waitForExist()
    })

    it("torrent begins downloading", function () {
      return torrent.waitForDownloading({ timeout: 20 * 1000 })
    })

    it("torrent is in the downloading tab", function () {
      return torrent.checkInState(["all", "downloading"])
    })

  })

  describe("magnet link uploads", function () {
    requireFeature(({ features }) => features.magnetLinks === true)
    let torrent: e2e.Torrent

    before(async function () {
      this.timeout(60 * 1000)
      await restartApplication(this)
      const filename = await createTorrentFile(tracker, {
        torrentName: createUniqueLabel("upload-magnet"),
        fileSize: 100000,
        downloadSpeed: 1,
        uploadSpeed: 1,
      })
      torrent = await this.app.uploadMagnetLink({ filename })
    })

    after(async function () {
      if (torrent && await torrent.isExisting()) {
        await torrent.delete()
      }
    })

    it("torrent is visible in the table", () => {
      return torrent.waitForExist()
    })

    it("torrent begins downloading", () => {
      return torrent.waitForDownloading({ timeout: 20 * 1000 })
    })
  })
})
