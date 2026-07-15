import fs from "node:fs"
import parseTorrent from "parse-torrent"
import * as e2e from "../../e2e"
import { eventually } from "../../e2e/eventually"
import { configureSpec, formatBytes, getTestFixture, requireFeature } from "../../framework/fixture"
import { createSlowTorrentFile } from "../../torrent"

const tracker = getTestFixture().tracker
describe("torrent details", function () {
  configureSpec()
  requireFeature(({ features }) => features.torrentDetails === true)

  let torrent: e2e.Torrent
  let torrentMetadata: parseTorrent.Instance

  before(async function () {
    const filename = await createSlowTorrentFile(tracker)
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

    await eventually(() => filesTab.getText()).contains(expectedFile?.path || "", { timeout: 30_000 })

    const filesText = await filesTab.getText()
    filesText.should.contain(expectedFile?.path || "")
    filesText.should.contain(formatBytes(expectedFile?.length || 0))

    const progressBar = filesTab.$(".torrent-details-file-progress .bar")
    await progressBar.waitForExist({ timeout: 10_000 })

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
    const firstHeader = headers[0]
    const handle = firstHeader.$(".rz-handle")
    await handle.waitForDisplayed({ timeout: 10_000 })

    const initialWidth = (await firstHeader.getSize()).width
    await handle.dragAndDrop({ x: 40, y: 0 })

    await eventually(async () => (await firstHeader.getSize()).width)
      .satisfies(`change by at least 10 from ${initialWidth}`, (nextWidth) => Math.abs(nextWidth - initialWidth) >= 10)

    await torrent.closeDetailsPanel()
  })
})
