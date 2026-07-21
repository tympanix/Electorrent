import chai from "chai"
import fs from "node:fs"
import path from "node:path"
import parseTorrent from "parse-torrent"
import { $, browser } from "@wdio/globals"
import * as e2e from "../../e2e"
import { eventually } from "../../e2e/eventually"
import { waitForModalClose, waitForModalOpen } from "../../e2e/modal"
import { createTorrentFile } from "../../torrent"
import { configureSpec, createUniqueLabel, getTestFixture } from "../../framework/fixture"

const { assert } = chai
const fixture = getTestFixture()
const client = fixture.client
const backend = fixture.backend
const tracker = fixture.tracker

function shellQuote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`
}

function findDownloadedContentCommand(downloadRoot: string, contentName: string) {
  return `find ${shellQuote(downloadRoot)} -maxdepth 5 -type f -name ${shellQuote(contentName)} -print -quit`
}

function findDownloadedDirectoryCommand(downloadRoot: string, contentName: string) {
  return `find ${shellQuote(downloadRoot)} -maxdepth 5 -type d -name ${shellQuote(contentName)} -print -quit`
}

async function sendRemoveAndDeleteShortcut() {
  await browser.electron.execute((electron) => {
    const win = electron.BrowserWindow.getFocusedWindow()
      || electron.BrowserWindow.getAllWindows().find((window) => !window.isDestroyed())

    if (!win) throw new Error("No Electron window found")

    const menu = electron.Menu.getApplicationMenu()
    const actionsMenu = menu?.items.find((item) => item.id === "actions" || item.label === "Actions")
    const findShortcut = (items: Electron.MenuItem[]): Electron.MenuItem | undefined => {
      for (const item of items) {
        if (item.accelerator === "CmdOrCtrl+Delete") return item
        const submenuItem = item.submenu && findShortcut(item.submenu.items)
        if (submenuItem) return submenuItem
      }
    }
    const menuItem = actionsMenu?.submenu && findShortcut(actionsMenu.submenu.items)

    if (!menuItem || !menuItem.visible || !menuItem.enabled) {
      throw new Error("CmdOrCtrl+Delete action is unavailable")
    }

    menuItem.click({}, win, win.webContents)
  })
}

describe("torrent actions", function () {
  configureSpec()

  let torrent: e2e.Torrent

  before(async function () {
    this.timeout(60 * 1000)
    const filename = await createTorrentFile(tracker, {
      torrentName: createUniqueLabel("actions"),
      fileSize: 100000,
      downloadSpeed: 1,
      uploadSpeed: 1,
    })
    torrent = await this.app.uploadTorrent({ filename })
    await torrent.waitForExist()
  })

  after(async function () {
    if (torrent && await torrent.isExisting()) {
      await torrent.delete()
    }
  })

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
    await eventually(() => modal.$(".content").getText()).contains("Are you sure")

    const cancelButton = modal.$("button.deny")
    await cancelButton.waitForDisplayed()
    await cancelButton.waitForClickable()
    await cancelButton.click()
    await waitForModalClose(modal)

    await torrent.waitForExist()
  })

  it("CmdOrCtrl+Delete shows the delete confirmation modal", async function () {
    await $(torrent.query).click()
    await sendRemoveAndDeleteShortcut()

    const modal = $("#deleteTorrentModal")
    await waitForModalOpen(modal, torrent.timeout)
    await eventually(() => modal.$(".content").getText()).contains("Are you sure")
    await modal.$("button.deny").click()
    await waitForModalClose(modal)

    await torrent.waitForExist()
  })

  it("torrent is stopped and resumed", async function () {
    this.timeout(40 * 1000)
    await torrent.stop({ state: client.stopLabel, timeout: 20 * 1000 })
    await torrent.waitForState(client.stopLabel, { timeout: 20 * 1000 })
    await torrent.checkInState(["all", "stopped"])
    await torrent.resume({ waitForState: false })
    await torrent.waitForDownloading({ timeout: 20 * 1000 })
    await torrent.checkInState(["all", "downloading"])
  })

  it("remove and delete removes downloaded content from disk", async function () {
    this.timeout(300 * 1000)
    if (!backend || !client.downloadRoot) {
      return this.skip()
    }

    const torrentName = createUniqueLabel("delete-files")
    const torrentPath = await createTorrentFile(tracker, { fileSize: 1, torrentName })
    const torrentInfo = parseTorrent(fs.readFileSync(torrentPath))
    const contentName = String(torrentInfo.name || torrentName)
    const findContentCommand = findDownloadedContentCommand(client.downloadRoot, contentName)
    const contentExistsCommand = `${findContentCommand} | grep -q .`
    const contentMissingCommand = `[ -z "$(${findContentCommand})" ]`
    const torrentToDelete = await this.app.uploadTorrent({ filename: torrentPath })

    try {
      await torrentToDelete.waitForExist({ timeout: 20 * 1000 })
      await torrentToDelete.waitForStates(["Seeding", "Finished"], { timeout: 120 * 1000 })
      await backend.waitForExec(["sh", "-lc", contentExistsCommand], 20 * 1000)
      await $("#page-torrents li[data-state=all]").click()
      await torrentToDelete.waitForExist()

      const modal = await torrentToDelete.openDeleteConfirmation()
      const approveButton = modal.$("button.approve")
      await approveButton.waitForDisplayed()
      await approveButton.waitForClickable()
      await approveButton.click()
      await waitForModalClose(modal)
      await torrentToDelete.waitForGone()

      await backend.waitForExec(["sh", "-lc", contentMissingCommand], 60 * 1000)
    } finally {
      if (await torrentToDelete.isExisting()) {
        await $("#page-torrents li[data-state=all]").click()
        await torrentToDelete.delete()
      }
    }
  })

  it("remove and delete removes multi-file content from disk", async function () {
    this.timeout(300 * 1000)
    if (!backend || !client.downloadRoot) {
      return this.skip()
    }

    const torrentName = createUniqueLabel("delete-multi-file")
    const torrentPath = await createTorrentFile(tracker, {
      torrentName,
      files: {
        "first.bin": 1,
        "nested/second.bin": 1,
        "nested/deeper/third.bin": 1,
      },
    })
    const findContentCommand = findDownloadedDirectoryCommand(client.downloadRoot, torrentName)
    const contentExistsCommand = `content_path=$(${findContentCommand}); [ -n "$content_path" ] && [ -f "$content_path/first.bin" ] && [ -f "$content_path/nested/deeper/third.bin" ]`
    const contentMissingCommand = `[ -z "$(${findContentCommand})" ]`
    const torrentToDelete = await this.app.uploadTorrent({ filename: torrentPath })

    try {
      await torrentToDelete.waitForExist({ timeout: 20 * 1000 })
      await torrentToDelete.waitForStates(["Seeding", "Finished"], { timeout: 120 * 1000 })
      await backend.waitForExec(["sh", "-lc", contentExistsCommand], 20 * 1000)
      await $("#page-torrents li[data-state=all]").click()
      await torrentToDelete.waitForExist()

      const modal = await torrentToDelete.openDeleteConfirmation()
      const approveButton = modal.$("button.approve")
      await approveButton.waitForDisplayed()
      await approveButton.waitForClickable()
      await approveButton.click()
      await waitForModalClose(modal)
      await torrentToDelete.waitForGone()

      await backend.waitForExec(["sh", "-lc", contentMissingCommand], 60 * 1000)
    } finally {
      if (await torrentToDelete.isExisting()) {
        await $("#page-torrents li[data-state=all]").click()
        await torrentToDelete.delete()
      }
    }
  })

  it("moves downloaded content via Set Location", async function () {
    this.timeout(300 * 1000)
    if (client.features.setLocation !== true) {
      return this.skip()
    }

    const torrentName = createUniqueLabel("set-location")
    const torrentPath = await createTorrentFile(tracker, { fileSize: 1, torrentName })
    const torrentInfo = parseTorrent(fs.readFileSync(torrentPath))
    const contentName = String(torrentInfo.name || torrentName)
    const targetDirectory = path.posix.join("/downloads", createUniqueLabel("moved"))
    const targetPath = path.posix.join(targetDirectory, contentName)
    const contentExistsCommand = `find /downloads -maxdepth 4 -name '${contentName}' | grep -q .`
    const contentMovedCommand = `matches=$(find /downloads -maxdepth 4 -name '${contentName}' | sort); [ "$(printf '%s\\n' "$matches" | grep -c .)" -eq 1 ] && printf '%s\\n' "$matches" | grep -Fqx '${targetPath}'`

    await backend.exec(["rm", "-rf", targetDirectory])
    await backend.exec(["mkdir", "-p", targetDirectory])
    await backend.exec(["chmod", "777", targetDirectory])
    await backend.exec(["test", "-d", targetDirectory])

    await this.app.openSettings()
    await this.app.settingsGotoTab("advanced")
    await this.app.addSettingsSavedLocation({ path: targetDirectory, icon: "folder open" })
    await this.app.settingsSave()
    await this.app.torrentsPageIsVisible()

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
