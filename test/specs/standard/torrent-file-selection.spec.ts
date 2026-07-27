import * as e2e from "../../e2e"
import { eventually } from "../../e2e/eventually"
import { configureSpec, getTestFixture, requireFeature } from "../../framework/fixture"
import { createSlowTorrentFile } from "../../torrent"

const tracker = getTestFixture().tracker

describe("torrent file selection", function () {
  configureSpec()
  requireFeature(({ features }) => features.fileSelection === true)

  let torrent: e2e.Torrent

  before(async function () {
    const filename = await createSlowTorrentFile(tracker)
    torrent = await this.app.uploadTorrent({ filename })
    await torrent.waitForExist()
  })

  after(async function () {
    if (torrent && await torrent.isExisting()) {
      await torrent.delete()
    }
  })

  it("persists file wanted state via torrent details", async function () {
    this.timeout(60 * 1000)

    const panel = await torrent.openDetailsPanel()
    await torrent.openDetailsTab("files")

    const firstFileCheckbox = panel.$("[data-role='torrent-details-file-checkbox']")
    await firstFileCheckbox.waitForEnabled({ timeout: 30_000 })

    const initialSelected = await firstFileCheckbox.isSelected()
    await firstFileCheckbox.click()
    await eventually(() => firstFileCheckbox.isSelected()).equals(!initialSelected)

    await torrent.closeDetailsPanel()
    const reopenedPanel = await torrent.openDetailsPanel()
    await torrent.openDetailsTab("files")

    const checkboxAfter = reopenedPanel.$("[data-role='torrent-details-file-checkbox']")
    await checkboxAfter.waitForEnabled({ timeout: 30_000 })
    await eventually(() => checkboxAfter.isSelected()).equals(!initialSelected)

    await torrent.closeDetailsPanel()
  })
})
