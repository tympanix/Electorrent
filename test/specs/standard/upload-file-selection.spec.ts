import { $ } from "@wdio/globals"
import * as e2e from "../../e2e"
import { eventually } from "../../e2e/eventually"
import { configureSpec, createUniqueLabel, getTestFixture, requireFeature } from "../../framework/fixture"
import { createTorrentFile } from "../../torrent"

const tracker = getTestFixture().tracker

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

    const torrentPath = await createTorrentFile(tracker, {
      torrentName: createUniqueLabel("upload-file-selection"),
      files: {
        "documents/notes.txt": 1,
        "documents/report.pdf": 2,
        "media/audio/theme.mp3": 3,
        "media/images/cover.jpg": 4,
        "media/images/thumbnail.png": 5,
        "README.md": 1,
      },
    })

    torrent = await this.app.uploadTorrent({ filename: torrentPath, askUploadOptions: true })
    await this.app.uploadTorrentModalSubmit({ disabledFileIndexes: [0] })
    await torrent.waitForExist({ timeout: 20 * 1000 })

    await torrent.openDetailsPanel()
    await torrent.openDetailsTab("files")

    const firstFileWanted = $("[data-role='torrent-details-files-table'] tbody tr[data-file-index='0'] td[data-col='wanted']")
    await firstFileWanted.waitForDisplayed({ timeout: 30 * 1000 })
    const firstFileWantedCheckbox = firstFileWanted.$("[data-role='torrent-details-file-checkbox']")
    await firstFileWantedCheckbox.waitForExist({ timeout: 30 * 1000 })
    await eventually(() => firstFileWantedCheckbox.isSelected()).equals(false, { timeout: 30 * 1000 })

    const secondFileWanted = $("[data-role='torrent-details-files-table'] tbody tr[data-file-index='1'] td[data-col='wanted']")
    await secondFileWanted.waitForDisplayed({ timeout: 30 * 1000 })
    const secondFileWantedCheckbox = secondFileWanted.$("[data-role='torrent-details-file-checkbox']")
    await secondFileWantedCheckbox.waitForExist({ timeout: 30 * 1000 })
    await eventually(() => secondFileWantedCheckbox.isSelected()).equals(true, { timeout: 30 * 1000 })

    await torrent.closeDetailsPanel()
  })
})
