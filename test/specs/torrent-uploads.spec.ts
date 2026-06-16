import * as e2e from "../e2e"
import { configureSpec, getTestFixture, getTorrentFilePath, requireFeature } from "../framework/fixture"
import { restartApplication } from "../shared"
const fixture = getTestFixture()
const client = fixture.client

describe("torrent uploads", function () {
  configureSpec()

  describe("torrent file uploads", function () {
    let torrent: e2e.Torrent
    before(async function () {
      const filename = getTorrentFilePath()
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
      return torrent.waitForState(client.downloadLabel)
    })

    it("torrent is in the downloading tab", function () {
      return torrent.checkInState(["all", "downloading"])
    })

  })

  describe("magnet link uploads", function () {
    requireFeature(({ features }) => features.magnetLinks === true)
    let torrent: e2e.Torrent

    before(async function () {
      await restartApplication(this)
      const filename = getTorrentFilePath()
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
      return torrent.waitForState(client.downloadLabel)
    })
  })
})
