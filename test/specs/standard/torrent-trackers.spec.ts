import * as e2e from "../../e2e"
import { $ } from "@wdio/globals"
import { eventually } from "../../e2e/eventually"
import { waitForModalClose, waitForModalOpen } from "../../e2e/modal"
import { configureSpec, getTestFixture, requireFeature } from "../../framework/fixture"
import { createTorrentFile } from "../../torrent"

const initialTracker = "http://tracker-one.test:6969/announce"
const addedTracker = "http://tracker-two.test:6969/announce"
const editedTracker = "http://tracker-three.test:6969/announce"

describe("torrent tracker management", function () {
  configureSpec()
  requireFeature(({ features }) => features.torrentTrackerManagement === true)

  let torrent: e2e.Torrent

  before(async function () {
    const filename = await createTorrentFile(getTestFixture().tracker, {
      fileSize: 100_000,
      downloadSpeed: 1,
      uploadSpeed: 1,
      trackerUrls: [initialTracker],
    })
    torrent = await this.app.uploadTorrent({ filename })
    await torrent.waitForExist()
  })

  after(async function () {
    if (torrent && await torrent.isExisting()) await torrent.delete()
  })

  it("adds, edits, and removes a tracker", async function () {
    this.timeout(90 * 1000)

    const panel = await torrent.openDetailsPanel()
    await torrent.openDetailsTab("trackers")
    const trackersTab = panel.$("[data-role='torrent-details-trackers']")

    await eventually(() => trackersTab.getText()).contains(initialTracker, { timeout: 30_000 })

    await trackersTab.$("[data-role='torrent-tracker-add']").click()
    const trackerModal = $("#torrent-tracker-modal")
    await waitForModalOpen(trackerModal, 10_000)
    const trackerInput = trackerModal.$("[data-role='torrent-tracker-url']")
    ;((await trackerInput.getAttribute("class")) || "").should.not.contain("ng-invalid")
    await trackerInput.setValue(addedTracker)
    await trackerModal.$("[data-role='torrent-tracker-save']").click()
    await waitForModalClose(trackerModal, 20_000)
    await eventually(() => trackersTab.getText()).contains(addedTracker, { timeout: 30_000 })

    const addedRow = trackersTab.$(`tbody tr[data-tracker-url='${addedTracker}']`)
    await addedRow.$("[data-role='torrent-tracker-edit']").click()
    await waitForModalOpen(trackerModal, 10_000)
    await trackerInput.clearValue()
    await trackerInput.setValue(editedTracker)
    await trackerModal.$("[data-role='torrent-tracker-save']").click()
    await waitForModalClose(trackerModal, 20_000)
    await eventually(() => trackersTab.getText()).contains(editedTracker, { timeout: 30_000 })
    ;(await addedRow.isExisting()).should.equal(false)

    const editedRow = trackersTab.$(`tbody tr[data-tracker-url='${editedTracker}']`)
    await editedRow.$("[data-role='torrent-tracker-remove']").click()
    const removeModal = $("#torrent-tracker-remove-modal")
    await waitForModalOpen(removeModal, 10_000)
    ;(await removeModal.getText()).should.contain(editedTracker)
    await removeModal.$("[data-role='torrent-tracker-remove-confirm']").click()
    await waitForModalClose(removeModal, 20_000)
    await eventually(() => editedRow.isExisting()).equals(false, { timeout: 30_000 })
    ;(await trackersTab.getText()).should.contain(initialTracker)

    await torrent.closeDetailsPanel()
  })
})
