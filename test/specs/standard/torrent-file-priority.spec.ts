import * as e2e from "../../e2e"
import { eventually } from "../../e2e/eventually"
import { configureSpec, getTestFixture, requireFeature } from "../../framework/fixture"
import { createTorrentFile } from "../../torrent"

const tracker = getTestFixture().tracker

describe("torrent file priority", function () {
  configureSpec()
  requireFeature(({ features }) => Boolean(features.filePriorities?.length))

  let torrent: e2e.Torrent

  before(async function () {
    const filename = await createTorrentFile(tracker, {
      files: {
        "first.bin": 100000,
        "nested/second.bin": 100000,
      },
      downloadSpeed: 1,
      uploadSpeed: 1,
    })
    torrent = await this.app.uploadTorrent({ filename })
    await torrent.waitForExist()
  })

  after(async function () {
    if (torrent && await torrent.isExisting()) await torrent.delete()
  })

  it("changes and persists a semantic priority in a multi-file torrent", async function () {
    this.timeout(60 * 1000)

    const priorities = getTestFixture().client.features.filePriorities || []
    priorities.length.should.be.greaterThan(1)
    const target = priorities.find((priority) => priority.id === "skip") || priorities[priorities.length - 1]

    const panel = await torrent.openDetailsPanel()
    await torrent.openDetailsTab("files")

    const getFileDropdowns = async () => {
      return panel.$$("tbody tr:not(.torrent-details-folder-row) [data-role='torrent-details-file-priority']")
    }
    await eventually(async () => (await getFileDropdowns()).length)
      .satisfies("include at least two file priority dropdowns", (count) => count >= 2, { timeout: 30_000 })

    const dropdown = (await getFileDropdowns())[0]
    const fileIndex = await dropdown.getAttribute("data-file-index")
    if (!fileIndex) throw new Error("File priority dropdown did not expose its file index")
    await dropdown.click()
    const item = dropdown.$(`[data-priority-id='${target.id}']`)
    await item.waitForClickable({ timeout: 10_000 })
    await item.click()
    const updatedDropdown = panel.$(`tbody tr:not(.torrent-details-folder-row) [data-role='torrent-details-file-priority'][data-file-index='${fileIndex}']`)
    await eventually(() => updatedDropdown.$(".text").getText()).equals(target.label)

    await torrent.closeDetailsPanel()
    const reopenedPanel = await torrent.openDetailsPanel()
    await torrent.openDetailsTab("files")

    const persistedDropdown = reopenedPanel.$(`tbody tr:not(.torrent-details-folder-row) [data-role='torrent-details-file-priority'][data-file-index='${fileIndex}']`)
    await persistedDropdown.waitForDisplayed({ timeout: 30_000 })
    await eventually(() => persistedDropdown.$(".text").getText()).equals(target.label)

    await torrent.closeDetailsPanel()
  })
})
