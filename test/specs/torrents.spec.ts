import chai from "chai"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import parseTorrent from "parse-torrent"
import { $, browser } from "@wdio/globals"
import * as e2e from "../e2e"
import { waitForModalClose, waitForModalOpen } from "../e2e/modal"
import { createTorrentFile } from "../torrent"
import { configureSpec, createUniqueLabel, formatBytes, getTestFixture, requireFeature } from "../framework/fixture"
import { restartApplication } from "../shared"

const { assert } = chai
const testDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const fixture = getTestFixture()
const client = fixture.client
const backend = fixture.backend
const tracker = fixture.tracker

describe("torrents", function () {
  configureSpec()
  describe("tracker filters", function () {
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
        await browser.waitUntil(async () => {
          const sidebarTrackers = await this.app.getAllSidebarTrackers()
          return expectedTrackers.every((tracker) => sidebarTrackers.includes(tracker))
        }, {
          timeout: 30 * 1000,
          timeoutMsg: `Expected tracker sidebar to contain: ${expectedTrackers.join(", ")}`,
        })
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

        await this.app.filterTracker()
        await torrents[1].delete()
        await browser.waitUntil(async () => {
          const sidebarTrackers = await this.app.getAllSidebarTrackers()
          return !sidebarTrackers.includes(torrentCases[1].tracker)
            && sidebarTrackers.includes(torrentCases[0].tracker)
            && sidebarTrackers.includes(torrentCases[2].tracker)
        }, {
          timeout: 30 * 1000,
          timeoutMsg: `Expected ${torrentCases[1].tracker} to be removed from tracker sidebar`,
        })
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

  describe("when a magnet link is uploaded", async function () {
    let torrent: e2e.Torrent
    requireFeature(({ features }) => features.magnetLinks === true)

    before(async function () {
      await restartApplication(this)
      const filename = path.join(testDir, "shared/opentracker/data/shared/slow.torrent")
      torrent = await this.app.uploadMagnetLink({ filename })
    })

    after(async function () {
      if (torrent && await torrent.isExisting()) {
        await torrent.delete()
      }
    })

    it("torrent should be visible in table", () => {
      return torrent.waitForExist()
    })

    it("torrent should begin downloading", () => {
      return torrent.waitForState(client.downloadLabel)
    })
  })

  describe("given new torrent is uploaded", async function () {
    let torrent: e2e.Torrent
    let torrentMetadata: parseTorrent.Instance

    before(async function () {
      const filename = path.join(testDir, "shared/opentracker/data/shared/slow.torrent")
      torrentMetadata = parseTorrent(fs.readFileSync(filename))
      torrent = await this.app.uploadTorrent({ filename: filename });
    })

    after(async function () {
      if (torrent) {
        await torrent.delete();
      }
    })

    it("torrent should be visible in table", () => {
      return torrent.waitForExist();
    })

    it("wait for download to begin", () => {
      return torrent.waitForState(client.downloadLabel);
    });

    it("opens the context menu at the mouse position", async function () {
      const torrentRow = $(torrent.query)
      const rowLocation = await torrentRow.getLocation()
      const rowSize = await torrentRow.getSize()
      const clickOffset = {
        x: -Math.floor(rowSize.width / 4),
        y: 0,
      }
      const expectedMenuLocation = {
        x: rowLocation.x + Math.floor(rowSize.width / 2) + clickOffset.x,
        y: rowLocation.y + Math.floor(rowSize.height / 2) + clickOffset.y,
      }

      await torrent.openContextMenu({ button: "right", ...clickOffset })

      const contextMenuLocation = await $("#contextmenu").getLocation()
      const tolerance = 2
      assert.closeTo(contextMenuLocation.x, expectedMenuLocation.x, tolerance)
      assert.closeTo(contextMenuLocation.y, expectedMenuLocation.y, tolerance)
    })

    it("delete action shows a confirmation modal", async function () {
      const modal = await torrent.openDeleteConfirmation()
      await modal.$(".content").getText().should.eventually.contain("Are you sure")

      const cancelButton = modal.$("button.deny")
      await cancelButton.waitForDisplayed()
      await cancelButton.waitForClickable()
      await cancelButton.click()
      await waitForModalClose(modal)

      await torrent.waitForExist()
    })

    it("torrent should be in downloading tab", () => {
      return torrent.checkInState(["all", "downloading"]);
    });

    it("torrent is stopped and resumed", async function () {
      this.timeout(25 * 1000)
      await torrent.stop({ state: client.stopLabel });
      await torrent.waitForState(client.stopLabel)
      await torrent.checkInState(["all", "stopped"]);
      await torrent.resume({ state: client.downloadLabel });
      await torrent.waitForState(client.downloadLabel)
      await torrent.checkInState(["all", "downloading"])
    })

    describe("given file selection is supported", function () {
      before(function () {
        if (client.features.fileSelection !== true) {
          this.skip()
        }
      })

      it("persists file wanted state via Files modal", async function () {
        this.timeout(60 * 1000)

        await torrent.openContextMenu()
        const contextMenu = $("#contextmenu")

        // Click the Files item in the context menu
        const filesItem = contextMenu.$("a=Files")
        await filesItem.waitForDisplayed()
        await filesItem.click()
        await contextMenu.waitForDisplayed({ reverse: true })

        const modal = $("#torrentFilesModal")
        await waitForModalOpen(modal)

        // Wait for at least one file checkbox
        const firstFileCheckbox = modal.$('.torrent-files-tree input[id^="file-cb-"]')
        await firstFileCheckbox.waitForExist({ timeout: 30_000 })

        const initialSelected = await firstFileCheckbox.isSelected()
        await firstFileCheckbox.click()

        const saveButton = modal.$("button.ui.green")
        await saveButton.waitForEnabled()
        await saveButton.click()
        await waitForModalClose(modal)

        // Reopen Files modal and verify state persisted
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

        // Close modal
        const closeButton = modal.$("button.ui.black")
        await closeButton.waitForEnabled()
        await closeButton.click()
        await waitForModalClose(modal)
      })
    })

    describe("given torrent details are supported", function () {
      before(function () {
        if (client.features.torrentDetails !== true) {
          this.skip()
        }
      })

      it("shows expected torrent information in the details info tab", async function () {
        this.timeout(60 * 1000)

        const panel = await torrent.openDetailsPanel()
        const infoTab = panel.$("[data-role='torrent-details-info']")

        await browser.waitUntil(async () => {
          return (await infoTab.getText()).includes(torrentMetadata.infoHash)
        }, {
          timeout: 30_000,
          timeoutMsg: "Torrent details info tab did not load expected metadata",
        })

        const infoText = await infoTab.getText()
        infoText.should.contain(torrentMetadata.name || "")
        infoText.should.contain(torrentMetadata.infoHash)
        infoText.should.contain(formatBytes(torrentMetadata.length || 0))

        await torrent.closeDetailsPanel()
      })

      it("shows expected torrent file information in the details files tab", async function () {
        this.timeout(60 * 1000)

        const panel = await torrent.openDetailsPanel()
        await torrent.openDetailsTab("files")

        const filesTab = panel.$("[data-role='torrent-details-files']")
        const expectedFile = torrentMetadata.files?.[0]

        await browser.waitUntil(async () => {
          return (await filesTab.getText()).includes(expectedFile?.path || "")
        }, {
          timeout: 30_000,
          timeoutMsg: "Torrent details files tab did not load expected file rows",
        })

        const filesText = await filesTab.getText()
        filesText.should.contain(expectedFile?.path || "")
        filesText.should.contain(formatBytes(expectedFile?.length || 0))

        const progressBar = filesTab.$(".torrent-details-file-progress .bar")
        await progressBar.waitForExist({ timeout: 10_000 })

        await torrent.closeDetailsPanel()
      })

      it("can resize columns in the details files tab", async function () {
        this.timeout(60 * 1000)

        const panel = await torrent.openDetailsPanel()
        await torrent.openDetailsTab("files")

        const filesTable = panel.$("[data-role='torrent-details-files-table']")
        await filesTable.waitForDisplayed({ timeout: 30_000 })

        await browser.waitUntil(async () => {
          const headers = await filesTable.$$("thead th")
          return headers.length > 1
        }, {
          timeout: 30_000,
          timeoutMsg: "Torrent details files table did not render enough columns to resize",
        })

        const headers = await filesTable.$$("thead th")
        const firstHeader = headers[0]
        const handle = firstHeader.$(".rz-handle")
        await handle.waitForDisplayed({ timeout: 10_000 })

        const initialWidth = (await firstHeader.getSize()).width
        await handle.dragAndDrop({ x: 40, y: 0 })

        await browser.waitUntil(async () => {
          const nextWidth = (await firstHeader.getSize()).width
          return Math.abs(nextWidth - initialWidth) >= 10
        }, {
          timeout: 10_000,
          timeoutMsg: "Torrent details files table column width did not change after dragging the resize handle",
        })

        await torrent.closeDetailsPanel()
      })
    })

    describe("given labels are supported", function () {
      requireFeature(({ features }) => features.labels === true)
      const firstLabel = createUniqueLabel("testlabel")
      const secondLabel = createUniqueLabel("someotherlabel")
      let initialLabelCount = 0

      before(async function () {
        initialLabelCount = (await this.app.getAllSidebarLabels()).length
      })

      it("apply new label", async function () {
        await torrent.newLabel(firstLabel);
        await this.app.waitForLabelInDropdown(firstLabel);
        const labels = await this.app.getAllSidebarLabels()
        labels.should.include(firstLabel)
        labels.should.have.length(initialLabelCount + 1)
      });

      it("apply another new label", async function () {
        await torrent.newLabel(secondLabel);
        await this.app.waitForLabelInDropdown(secondLabel);
        await torrent.checkInFilterLabel(secondLabel);
        const labels = await this.app.getAllSidebarLabels()
        labels.should.include(firstLabel)
        labels.should.include(secondLabel)
        labels.should.have.length(initialLabelCount + 2)
      });

      it("change back to previous label", async function () {
        await torrent.changeLabel(firstLabel);
        await torrent.checkInFilterLabel(firstLabel);
      });
    });

    describe("given set location is supported", function () {
      before(function () {
        if (client.features.setLocation !== true) {
          this.skip()
        }
      })

      it("moves downloaded content via Set Location", async function () {
        this.timeout(300 * 1000)

        const torrentName = createUniqueLabel("set-location")
        const torrentPath = await createTorrentFile(tracker, { fileSize: 1, torrentName })
        const torrentInfo = parseTorrent(fs.readFileSync(torrentPath))
        const contentName = torrentInfo.name || torrentName
        const targetDirectory = path.posix.join("/downloads", createUniqueLabel("moved"))
        const targetPath = path.posix.join(targetDirectory, contentName)
        const contentExistsCommand = `find /downloads -maxdepth 4 -name '${contentName}' | grep -q .`
        const contentMovedCommand = `matches=$(find /downloads -maxdepth 4 -name '${contentName}' | sort); [ "$(printf '%s\\n' "$matches" | grep -c .)" -eq 1 ] && printf '%s\\n' "$matches" | grep -Fqx '${targetPath}'`

        await backend.exec(["rm", "-rf", targetDirectory])
        await backend.exec(["mkdir", "-p", targetDirectory])
        await backend.exec(["chmod", "777", targetDirectory])
        await backend.exec(["test", "-d", targetDirectory])

        const fastTorrent = await this.app.uploadTorrent({ filename: torrentPath })

        try {
          await fastTorrent.waitForExist({ timeout: 20 * 1000 })
          await fastTorrent.waitForStates(["Seeding", "Finished"], { timeout: 120 * 1000 })
          await backend.waitForExec(["sh", "-lc", contentExistsCommand], 20 * 1000)

          await fastTorrent.setLocation(targetDirectory)

          await backend.waitForExec(["sh", "-lc", contentMovedCommand], 60 * 1000)
        } finally {
          if (await fastTorrent.isExisting()) {
            await fastTorrent.delete()
          }
          await backend.exec(["rm", "-rf", targetDirectory])
        }
      })
    })
  })
})
