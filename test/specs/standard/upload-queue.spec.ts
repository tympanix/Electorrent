import fs from "node:fs"
import path from "node:path"
import parseTorrent from "parse-torrent"
import * as e2e from "../../e2e"
import { eventually } from "../../e2e/eventually"
import { createTorrentFile } from "../../torrent"
import { configureSpec, createUniqueLabel, getTestFixture, requireFeature } from "../../framework/fixture"
import { restartApplication } from "../../shared"

const fixture = getTestFixture()
const tracker = fixture.tracker

describe("upload queue", function () {
  configureSpec()
  requireFeature(({ features }) => features.magnetLinks === true)
  requireFeature(({ features }) => Object.values(features.uploadOptions || {}).some((enabled) => enabled === true))

  it("uploads queued torrent items from multiple sources one by one", async function () {
    this.timeout(120 * 1000)

    const watchDirectory = path.join("/tmp", createUniqueLabel("electorrent-upload-queue-watch"))
    const magnetTorrentPath = await createTorrentFile(tracker, {
      torrentName: createUniqueLabel("upload-queue-magnet"),
      fileSize: 1,
    })
    const fileTorrentPath = await createTorrentFile(tracker, {
      torrentName: createUniqueLabel("upload-queue-file"),
      fileSize: 1,
    })
    const watchTorrentPath = await createTorrentFile(tracker, {
      torrentName: createUniqueLabel("upload-queue-watch"),
      fileSize: 1,
    })
    const watchedTorrentPath = path.join(watchDirectory, path.basename(watchTorrentPath))
    const torrentItems = [
      { name: String(parseTorrent(fs.readFileSync(magnetTorrentPath)).name) },
      { name: String(parseTorrent(fs.readFileSync(fileTorrentPath)).name) },
      { name: String(parseTorrent(fs.readFileSync(watchTorrentPath)).name) },
    ]
    let initialPromptSetting = false
    let uploadedTorrents: e2e.Torrent[] = []

    fs.mkdirSync(watchDirectory, { recursive: true })

    try {
      await restartApplication(this)
      await this.app.torrentsPageIsVisible()
      await this.app.openSettings()
      await this.app.settingsGotoTab("general")
      initialPromptSetting = await this.app.getGeneralToggleState("Always prompt for upload options")
      if (!initialPromptSetting) {
        await this.app.setGeneralToggle("Always prompt for upload options", true)
      }
      await this.app.settingsGotoTab("advanced")
      await this.app.setSettingsWatchDirectory(watchDirectory)
      await this.app.settingsSave()
      await this.app.torrentsPageIsVisible()

      uploadedTorrents = [
        await this.app.uploadMagnetLink({ filename: magnetTorrentPath, askUploadOptions: true }),
        await this.app.uploadTorrent({ filename: fileTorrentPath, askUploadOptions: true }),
        new e2e.Torrent({ hash: parseTorrent(fs.readFileSync(watchTorrentPath)).infoHash, app: this.app }),
      ]
      await fs.promises.copyFile(watchTorrentPath, watchedTorrentPath)

      await eventually(() => this.app.uploadTorrentModalPendingCountLabel()).contains("3 torrents remaining", { timeout: 30 * 1000 })

      for (let index = 0; index < torrentItems.length; index++) {
        const remaining = torrentItems.length - index
        await eventually(() => this.app.uploadTorrentModalLabel()).equals(torrentItems[index].name, { timeout: 10 * 1000 })
        await eventually(() => this.app.uploadTorrentModalPendingCountLabel()).contains(`${remaining} ${remaining === 1 ? "torrent" : "torrents"} remaining`, { timeout: 10 * 1000 })
        await this.app.uploadTorrentModalSubmit({ waitForClose: remaining === 1 })
      }

      for (const torrent of uploadedTorrents) {
        await torrent.waitForExist({ timeout: 30 * 1000 })
      }
      const magnetTorrent = uploadedTorrents[0]
      await eventually(() => magnetTorrent.getColumn("decodedName")).satisfies(
        "not contain [METADATA]",
        (name) => !/\[metadata\]/i.test(name),
        { timeout: 30 * 1000 },
      )
      await magnetTorrent.waitForStates(["Seeding", "Finished"], { timeout: 120 * 1000 })
      await magnetTorrent.delete()
    } finally {
      for (const torrent of uploadedTorrents) {
        if (await torrent.isExisting()) {
          await torrent.delete()
        }
      }

      await restartApplication(this)
      await this.app.torrentsPageIsVisible()
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
})
