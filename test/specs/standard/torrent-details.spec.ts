import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import parseTorrent from "parse-torrent"
import { browser } from "@wdio/globals"
import * as e2e from "../../e2e"
import { configureSpec, formatBytes, requireFeature } from "../../framework/fixture"

const testDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
describe("torrent details", function () {
  configureSpec()
  requireFeature(({ features }) => features.torrentDetails === true)

  let torrent: e2e.Torrent
  let torrentMetadata: parseTorrent.Instance

  before(async function () {
    const filename = path.join(testDir, "shared/opentracker/data/shared/slow.torrent")
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

  it("shows expected torrent file information in the files tab", async function () {
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

  it("can resize columns in the files tab", async function () {
    this.timeout(60 * 1000)

    const panel = await torrent.openDetailsPanel()
    await torrent.openDetailsTab("files")

    const filesTable = panel.$("[data-role='torrent-details-files-table']")
    await filesTable.waitForDisplayed({ timeout: 30_000 })

    await browser.waitUntil(async () => {
      const headers = await filesTable.$$("thead th")
      return await headers.length > 1
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
