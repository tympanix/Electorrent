import fs from "node:fs"
import parseTorrent from "parse-torrent"
import * as e2e from "../../e2e"
import { eventually } from "../../e2e/eventually"
import { configureSpec, formatBytes, getTestFixture, requireFeature } from "../../framework/fixture"
import { createTorrentFile } from "../../torrent"

const tracker = getTestFixture().tracker
describe("torrent details", function () {
  configureSpec()
  requireFeature(({ features }) => features.torrentDetails === true)

  let torrent: e2e.Torrent
  let torrentMetadata: parseTorrent.Instance

  before(async function () {
    const filename = await createTorrentFile(tracker, {
      files: {
        "documents/readme.txt": 100_000,
        "documents/guides/setup.txt": 100_000,
        "media/preview.jpg": 100_000,
      },
      downloadSpeed: 1,
      uploadSpeed: 1,
    })
    torrentMetadata = parseTorrent(fs.readFileSync(filename)) as parseTorrent.Instance
    torrent = await this.app.uploadTorrent({ filename })
    await torrent.waitForExist()
  })

  after(async function () {
    if (torrent && await torrent.isExisting()) {
      await torrent.delete()
    }
  })

  it("shows expected torrent information in the info tab", async function () {
    this.timeout(60 * 1000)

    const panel = await torrent.openDetailsPanel()
    const infoTab = panel.$("[data-role='torrent-details-info']")

    await eventually(() => infoTab.getText()).contains(torrentMetadata.infoHash, { timeout: 30_000 })

    const infoText = await infoTab.getText()
    infoText.should.contain(torrentMetadata.name || "")
    infoText.should.contain(torrentMetadata.infoHash)
    infoText.should.contain(formatBytes(torrentMetadata.length || 0))

    await torrent.closeDetailsPanel()
  })

  it("shows expected torrent file information in the files tab", async function () {
    this.timeout(60 * 1000)

    const panel = await torrent.openDetailsPanel()
    await torrent.openDetailsTab("files")

    const filesTab = panel.$("[data-role='torrent-details-files']")
    const expectedFile = torrentMetadata.files?.[0]
    const expectedPath = expectedFile?.path || ""
    const torrentRoot = `${torrentMetadata.name || ""}/`
    const expectedRelativePath = expectedPath.startsWith(torrentRoot)
      ? expectedPath.slice(torrentRoot.length)
      : expectedPath
    const expectedPaths = new Set([expectedPath, expectedRelativePath].filter(Boolean))

    await eventually(() => filesTab.getText()).satisfies(
      `contain a client-normalized path for ${expectedPath}`,
      (text) => Array.from(expectedPaths).some((path) => text.includes(path)),
      { timeout: 30_000 },
    )

    const filesText = await filesTab.getText()
    Array.from(expectedPaths).some((path) => filesText.includes(path)).should.equal(true)
    filesText.should.contain(formatBytes(expectedFile?.length || 0))

    const progressBar = filesTab.$(".torrent-details-file-progress .bar")
    await progressBar.waitForExist({ timeout: 10_000 })

    const firstHeaderCheckbox = filesTab.$("thead th:first-child input[type='checkbox']")
    await firstHeaderCheckbox.waitForExist({ timeout: 10_000 })

    const folderRow = filesTab.$("tbody tr.torrent-details-folder-row")
    await folderRow.waitForDisplayed({ timeout: 10_000 })
    const visibleRowsBeforeCollapse = await filesTab.$$("tbody tr")
    const rowCountBeforeCollapse = await visibleRowsBeforeCollapse.length

    await folderRow.$(".torrent-details-folder-toggle").click()
    await eventually(async () => (await filesTab.$$("tbody tr")).length)
      .satisfies("decrease after collapsing a folder", (count) => count < rowCountBeforeCollapse)

    await torrent.closeDetailsPanel()
  })

  it("can resize columns in the files tab", async function () {
    this.timeout(60 * 1000)

    const panel = await torrent.openDetailsPanel()
    await torrent.openDetailsTab("files")

    const filesTable = panel.$("[data-role='torrent-details-files-table']")
    await filesTable.waitForDisplayed({ timeout: 30_000 })

    await eventually(async () => (await filesTable.$$("thead th")).length)
      .satisfies("be greater than 1", (count) => count > 1, { timeout: 30_000 })

    const headers = await filesTable.$$("thead th")
    const selectionHeader = headers[0]
    const selectionWidth = (await selectionHeader.getSize()).width
    selectionWidth.should.be.at.most(40)
    const selectionHandleDisplayed = await selectionHeader.$(".rz-handle").isDisplayed()
    const selectionSortIconExists = await selectionHeader.$(".sorting.icon").isExisting()
    selectionHandleDisplayed.should.equal(false)
    selectionSortIconExists.should.equal(false)

    const selectionCell = filesTable.$("tbody td[data-col='wanted']")
    const selectionCheckbox = selectionCell.$(".torrent-details-file-checkbox")
    const cellLocation = await selectionCell.getLocation()
    const cellSize = await selectionCell.getSize()
    const checkboxLocation = await selectionCheckbox.getLocation()
    const checkboxSize = await selectionCheckbox.getSize()
    checkboxLocation.x.should.be.at.least(cellLocation.x)
    checkboxLocation.y.should.be.at.least(cellLocation.y)
    const checkboxRight = checkboxLocation.x + checkboxSize.width
    const checkboxBottom = checkboxLocation.y + checkboxSize.height
    checkboxRight.should.be.at.most(cellLocation.x + cellSize.width)
    checkboxBottom.should.be.at.most(cellLocation.y + cellSize.height)

    const firstResizableHeader = headers[1]
    const controlledHeader = firstResizableHeader
    const handle = firstResizableHeader.$(".rz-handle")
    await handle.waitForDisplayed({ timeout: 10_000 })

    const initialWidth = (await controlledHeader.getSize()).width
    await handle.dragAndDrop({ x: 40, y: 0 })

    await eventually(async () => (await controlledHeader.getSize()).width)
      .satisfies(`change by at least 10 from ${initialWidth}`, (nextWidth) => Math.abs(nextWidth - initialWidth) >= 10)

    await torrent.closeDetailsPanel()
  })
})
