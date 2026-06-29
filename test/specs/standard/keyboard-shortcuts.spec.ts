import fs from "node:fs"
import magnet from "magnet-uri"
import parseTorrent from "parse-torrent"
import { browser } from "@wdio/globals"
import * as e2e from "../../e2e"
import { createTorrentFile } from "../../torrent"
import { configureSpec, createUniqueLabel, getTestFixture, requireFeature } from "../../framework/fixture"

const fixture = getTestFixture()
const client = fixture.client
const tracker = fixture.tracker

async function createMagnetTorrent(app: e2e.App, prefix: string) {
  const filename = await createTorrentFile(tracker, {
    torrentName: createUniqueLabel(prefix),
    fileSize: 100000,
    downloadSpeed: 1,
    uploadSpeed: 1,
  })
  const info = parseTorrent(fs.readFileSync(filename))
  const magnetUri = magnet.encode({
    xt: [`urn:btih:${info.infoHash}`],
    dn: info.name,
    tr: info.announce,
  })
  const torrent = new e2e.Torrent({ hash: info.infoHash, app })

  await browser.electron.execute((electron, value) => electron.clipboard.writeText(value), magnetUri)
  return torrent
}

async function sendPasteTorrentUrlShortcut(askUploadOptions: boolean) {
  await browser.electron.execute((electron, askUploadOptions) => {
    const win = electron.BrowserWindow.getFocusedWindow()
      || electron.BrowserWindow.getAllWindows().find((window) => !window.isDestroyed())

    if (!win) throw new Error("No Electron window found")

    const menu = electron.Menu.getApplicationMenu()
    const fileMenu = menu?.items.find((item) => item.id === "file" || item.label === "File")
    const menuItem = fileMenu?.submenu?.items.find((item) => item.label === (askUploadOptions ? "Paste Torrent URL (Advanced)" : "Paste Torrent URL"))

    if (!menuItem || !menuItem.visible || !menuItem.enabled) {
      throw new Error("Paste Torrent URL menu item is unavailable")
    }

    menuItem.click({}, win, win.webContents)
  }, askUploadOptions)
}

describe("keyboard shortcuts", function () {
  configureSpec()
  requireFeature(({ features }) => features.magnetLinks === true)

  it("Paste Torrent URL uploads the clipboard link", async function () {
    this.timeout(60 * 1000)
    const torrent = await createMagnetTorrent(this.app, "shortcut-paste-url")

    try {
      await sendPasteTorrentUrlShortcut(false)
      await torrent.waitForExist({ timeout: 30 * 1000 })
    } finally {
      if (await torrent.isExisting()) {
        await torrent.delete()
      }
    }
  })

  it("Paste Torrent URL (Advanced) opens upload options", async function () {
    this.timeout(60 * 1000)
    if (!Object.values(client.features.uploadOptions || {}).some(Boolean)) return this.skip()

    const torrent = await createMagnetTorrent(this.app, "shortcut-paste-url-advanced")

    try {
      await sendPasteTorrentUrlShortcut(true)
      await this.app.uploadTorrentModalVisible()
      await this.app.uploadTorrentModalSubmit()
      await torrent.waitForExist({ timeout: 30 * 1000 })
    } finally {
      if (await torrent.isExisting()) {
        await torrent.delete()
      }
    }
  })
})
