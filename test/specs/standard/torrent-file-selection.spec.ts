import chai from "chai"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { $ } from "@wdio/globals"
import * as e2e from "../../e2e"
import { waitForModalClose, waitForModalOpen } from "../../e2e/modal"
import { configureSpec, requireFeature } from "../../framework/fixture"

const testDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

describe("torrent file selection", function () {
  configureSpec()
  requireFeature(({ features }) => features.fileSelection === true)

  let torrent: e2e.Torrent

  before(async function () {
    const filename = path.join(testDir, "shared/opentracker/data/shared/slow.torrent")
    torrent = await this.app.uploadTorrent({ filename })
    await torrent.waitForExist()
  })

  after(async function () {
    if (torrent && await torrent.isExisting()) {
      await torrent.delete()
    }
  })

  it("persists file wanted state via Files modal", async function () {
    this.timeout(60 * 1000)

    await torrent.openContextMenu()
    const contextMenu = $("#contextmenu")

    const filesItem = contextMenu.$("a=Files")
    await filesItem.waitForDisplayed()
    await filesItem.click()
    await contextMenu.waitForDisplayed({ reverse: true })

    const modal = $("#torrentFilesModal")
    await waitForModalOpen(modal)

    const firstFileCheckbox = modal.$('.torrent-files-tree input[id^="file-cb-"]')
    await firstFileCheckbox.waitForExist({ timeout: 30_000 })

    const initialSelected = await firstFileCheckbox.isSelected()
    await firstFileCheckbox.click()

    const saveButton = modal.$("button.ui.green")
    await saveButton.waitForEnabled()
    await saveButton.click()
    await waitForModalClose(modal)

    await torrent.openContextMenu()
    const filesItem2 = contextMenu.$("a=Files")
    await filesItem2.waitForDisplayed()
    await filesItem2.click()
    await contextMenu.waitForDisplayed({ reverse: true })
    await waitForModalOpen(modal)

    const firstFileCheckboxAfter = modal.$('.torrent-files-tree input[id^="file-cb-"]')
    await firstFileCheckboxAfter.waitForExist({ timeout: 30_000 })
    const selectedAfter = await firstFileCheckboxAfter.isSelected()
    chai.expect(selectedAfter).to.equal(!initialSelected)

    const closeButton = modal.$("button.ui.black")
    await closeButton.waitForEnabled()
    await closeButton.click()
    await waitForModalClose(modal)
  })
})
