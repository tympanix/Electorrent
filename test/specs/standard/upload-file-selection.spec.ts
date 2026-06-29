import path from "node:path"
import { fileURLToPath } from "node:url"
import { $ } from "@wdio/globals"
import * as e2e from "../../e2e"
import { eventually } from "../../e2e/eventually"
import { configureSpec, requireFeature } from "../../framework/fixture"

const testDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

describe("upload file selection", function () {
  configureSpec()
  requireFeature(({ features }) => features.uploadFileSelection === true && features.torrentDetails === true)

  let torrent: e2e.Torrent | undefined

  afterEach(async function () {
    if (torrent && await torrent.isExisting()) {
      await torrent.delete()
    }
    torrent = undefined
  })

  it("adds a torrent with one file disabled from advanced upload options", async function () {
    this.timeout(60 * 1000)

    const torrentPath = path.join(testDir, "shared/multifile.torrent")

    torrent = await this.app.uploadTorrent({ filename: torrentPath, askUploadOptions: true })
    await this.app.uploadTorrentModalSubmit({ disabledFileIndexes: [0] })
    await torrent.waitForExist({ timeout: 20 * 1000 })

    await torrent.openDetailsPanel()
    await torrent.openDetailsTab("files")

    const firstFileWanted = $("[data-role='torrent-details-files-table'] tbody tr[data-file-index='0'] td[data-col='wanted']")
    await firstFileWanted.waitForDisplayed({ timeout: 30 * 1000 })
    await eventually(() => firstFileWanted.getText()).equals("", { timeout: 30 * 1000 })
    const firstFileWantedIconExists = await firstFileWanted.$("[data-role='torrent-details-file-wanted-check']").isExisting()
    firstFileWantedIconExists.should.equal(false)

    const secondFileWanted = $("[data-role='torrent-details-files-table'] tbody tr[data-file-index='1'] td[data-col='wanted']")
    await secondFileWanted.waitForDisplayed({ timeout: 30 * 1000 })
    await secondFileWanted.$("[data-role='torrent-details-file-wanted-check']").waitForDisplayed({ timeout: 30 * 1000 })

    await torrent.closeDetailsPanel()
  })
})
