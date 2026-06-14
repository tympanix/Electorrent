import fs from "node:fs"
import path from "node:path"
import parseTorrent from "parse-torrent"
import { browser } from "@wdio/globals"
import * as e2e from "../e2e"
import { createTorrentFile } from "../torrent"
import { configureSpec, createUniqueLabel, getTestFixture } from "../framework/fixture"
import { restartApplication } from "../shared"

const fixture = getTestFixture()
const tracker = fixture.tracker

describe("local files", function () {
  configureSpec()

  it("uploads torrent files copied into the watched folder", async function () {
    this.timeout(90 * 1000)

    const watchDirectory = path.join("/tmp", createUniqueLabel("electorrent-watch"))
    const torrentPath = await createTorrentFile(tracker, { fileSize: 1 })
    const watchedTorrentPath = path.join(watchDirectory, path.basename(torrentPath))
    const torrentInfo = parseTorrent(fs.readFileSync(torrentPath))
    const watchedTorrent = new e2e.Torrent({ hash: torrentInfo.infoHash, app: this.app })
    let initialPromptSetting = false

    fs.mkdirSync(watchDirectory, { recursive: true })

    try {
      await restartApplication(this)
      await this.app.torrentsPageIsVisible()
      await this.app.openSettings()
      await this.app.settingsGotoTab("general")
      initialPromptSetting = await this.app.getGeneralToggleState("Always prompt for upload options")
      if (initialPromptSetting) {
        await this.app.setGeneralToggle("Always prompt for upload options", false)
      }

      await this.app.settingsGotoTab("advanced")
      await this.app.setSettingsWatchDirectory(watchDirectory)
      await this.app.settingsSave()
      await this.app.torrentsPageIsVisible()

      await fs.promises.copyFile(torrentPath, watchedTorrentPath)
      await watchedTorrent.waitForExist({ timeout: 30 * 1000 })
    } finally {
      if (await watchedTorrent.isExisting()) {
        await watchedTorrent.delete()
      }

      await this.app.openSettings()
      await this.app.settingsGotoTab("advanced")
      await this.app.clearSettingsWatchDirectory()
      await this.app.settingsGotoTab("general")
      if (await this.app.getGeneralToggleState("Always prompt for upload options") !== initialPromptSetting) {
        await this.app.setGeneralToggle("Always prompt for upload options", initialPromptSetting)
      }
      await this.app.settingsSave()
      await this.app.torrentsPageIsVisible()

      fs.rmSync(watchDirectory, { recursive: true, force: true })
    }
  })

  it("removes local torrent file after successful upload", async function () {
    this.timeout(90 * 1000)

    const torrentPath = await createTorrentFile(tracker, { fileSize: 1 })
    let initialAutoRemoveSetting = false
    let torrent: e2e.Torrent | undefined

    try {
      await restartApplication(this)
      await this.app.torrentsPageIsVisible()
      await this.app.openSettings()
      await this.app.settingsGotoTab("general")
      initialAutoRemoveSetting = await this.app.getGeneralToggleState("Delete Torrent Files")
      await this.app.setGeneralToggle("Delete Torrent Files", true)
      await this.app.settingsSave()
      await this.app.torrentsPageIsVisible()

      torrent = await this.app.uploadTorrent({
        filename: torrentPath,
        sourcePath: torrentPath,
      })
      await torrent.waitForExist({ timeout: 30 * 1000 })
      await browser.waitUntil(async () => !fs.existsSync(torrentPath), {
        timeout: 10 * 1000,
        timeoutMsg: `expected torrent file ${torrentPath} to be removed after upload`,
      })
    } finally {
      if (torrent && await torrent.isExisting()) {
        await torrent.delete()
      }

      await this.app.openSettings()
      await this.app.settingsGotoTab("general")
      if (await this.app.getGeneralToggleState("Delete Torrent Files") !== initialAutoRemoveSetting) {
        await this.app.setGeneralToggle("Delete Torrent Files", initialAutoRemoveSetting)
      }
      await this.app.settingsSave()
      await this.app.torrentsPageIsVisible()
    }
  })
})
