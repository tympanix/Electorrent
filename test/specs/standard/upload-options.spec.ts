import fs from "node:fs"
import parseTorrent from "parse-torrent"
import { browser } from "@wdio/globals"
import * as e2e from "../../e2e"
import { createTorrentFile } from "../../torrent"
import { configureSpec, createUniqueLabel, getTestFixture, requireFeature } from "../../framework/fixture"
import { restartApplication } from "../../shared"
import { eventually } from "../../e2e/eventually"

const fixture = getTestFixture()
const client = fixture.client
const backend = fixture.backend
const tracker = fixture.tracker

describe("upload options", function () {
  configureSpec()
  requireFeature(({ features }) => Object.values(features.uploadOptions || {}).some((enabled) => enabled === true))
  beforeEach(async function () {
    this.timeout(30 * 1000)
    this.torrentPath = await createTorrentFile(tracker, { fileSize: 1 })
    await restartApplication(this)
    await this.app.torrentsPageIsVisible()
  })
  it("torrent uploaded with default options", async function () {
    const torrent = await this.app.uploadTorrent({ filename: this.torrentPath, askUploadOptions: true });
    await this.app.uploadTorrentModalSubmit()
    await torrent.waitForExist()
    await torrent.waitForStates([client.downloadLabel, "Seeding"])
    await torrent.delete()
  })

  it("add torrent dialog uses current server default upload options", async function () {
    if (client.features.uploadOptions?.startTorrent !== true) return this.skip()

    let torrent: e2e.Torrent | undefined

    try {
      await this.app.openSettings()
      await this.app.settingsGotoTab("advanced")
      await this.app.setDefaultUploadOptions({ enabled: true, start: false })
      await this.app.settingsSave()
      await this.app.torrentsPageIsVisible()

      torrent = await this.app.uploadTorrent({ filename: this.torrentPath, askUploadOptions: true })
      await this.app.uploadTorrentModalSubmit()
      await torrent.waitForExist()
      await torrent.waitForState(client.stopLabel, { timeout: 20 * 1000 })
    } finally {
      if (torrent && await torrent.isExisting()) {
        await torrent.delete()
      }

      await this.app.openSettings()
      await this.app.settingsGotoTab("advanced")
      await this.app.setDefaultUploadOptions({ enabled: false })
      await this.app.settingsSave()
      await this.app.torrentsPageIsVisible()
    }
  })

  it("torrent uploaded with default label option", async function () {
    if (client.features.uploadOptions?.category !== true) return this.skip()

    const labelName = createUniqueLabel("defaultlabel")
    let torrent: e2e.Torrent | undefined

    try {
      torrent = await this.app.uploadTorrent({ filename: this.torrentPath })
      await torrent.newLabel(labelName)
      await torrent.delete()

      await this.app.openSettings()
      await this.app.settingsGotoTab("advanced")
      await this.app.setDefaultUploadOptions({ enabled: true, label: labelName })
      await this.app.settingsSave()
      await this.app.torrentsPageIsVisible()

      torrent = await this.app.uploadTorrent({ filename: this.torrentPath, askUploadOptions: true })
      await this.app.uploadTorrentModalSubmit()
      await torrent.waitForExist()
      await eventually(() => torrent.getLabel()).equals(labelName)
    } finally {
      if (torrent && await torrent.isExisting()) {
        await torrent.delete()
      }

      await this.app.openSettings()
      await this.app.settingsGotoTab("advanced")
      await this.app.setDefaultUploadOptions({ enabled: false })
      await this.app.settingsSave()
      await this.app.torrentsPageIsVisible()
    }
  })

  it("magnet link opens upload options", async function () {
    const torrent = await this.app.uploadMagnetLink({ filename: this.torrentPath, askUploadOptions: true });
    const torrentMetadata = parseTorrent(fs.readFileSync(this.torrentPath))

    await this.app.uploadTorrentModalVisible()
    await eventually(() => this.app.uploadTorrentModalLabel()).equals(String(torrentMetadata.name))
    await this.app.uploadTorrentModalSubmit()
    await torrent.waitForExist()
    await torrent.waitForStates([client.downloadLabel, "Seeding"], { timeout: 20 * 1000 })
    await torrent.delete()
  })

  it("torrent uploaded with preexisting label", async function () {
    if (client.features.uploadOptions?.category !== true) return this.skip()
    const labelName = createUniqueLabel("mylabel")
    let torrent = await this.app.uploadTorrent({ filename: this.torrentPath });
    await torrent.newLabel(labelName)
    await torrent.delete()

    torrent = await this.app.uploadTorrent({ filename: this.torrentPath, askUploadOptions: true });
    await this.app.uploadTorrentModalSubmit({ label: labelName })
    await torrent.waitForExist()
    await eventually(() => torrent.getLabel()).equals(labelName)
    await torrent.delete()
  })

  it("torrent uploaded in stopped state", async function () {
    this.timeout(30 * 1000)
    if (client.features.uploadOptions?.startTorrent !== true) return this.skip()
    const torrent = await this.app.uploadTorrent({ filename: this.torrentPath, askUploadOptions: true });
    await this.app.uploadTorrentModalSubmit({ start: false })
    await torrent.isExisting()
    await torrent.waitForState(client.stopLabel, { timeout: 20 * 1000 })
    await torrent.delete()
  })

  it("torrent uploaded with peer limit", async function () {
    this.timeout(30 * 1000)
    if (client.features.uploadOptions?.peerLimit !== true) return this.skip()
    const peerLimit = 8
    const torrent = await this.app.uploadTorrent({ filename: this.torrentPath, askUploadOptions: true });
    await this.app.uploadTorrentModalSubmit({ peerLimit })
    await torrent.waitForExist({ timeout: 20 * 1000 })
    await torrent.waitForStates([client.downloadLabel, "Seeding"], { timeout: 20 * 1000 })
    await torrent.openDetailsPanel()
    await eventually(() => torrent.getDetailsFieldValue("connections-limit")).equals(String(peerLimit))
    await torrent.closeDetailsPanel()
    await torrent.delete()
  })

  it("torrent uploaded with speed limits", async function () {
    this.timeout(30 * 1000)
    if (client.features.uploadOptions?.downloadSpeedLimit !== true && client.features.uploadOptions?.uploadSpeedLimit !== true) return this.skip()
    const downloadSpeedLimit = 111
    const uploadSpeedLimit = 37
    const torrent = await this.app.uploadTorrent({ filename: this.torrentPath, askUploadOptions: true });
    await this.app.uploadTorrentModalSubmit({
      downloadSpeedLimit: client.features.uploadOptions?.downloadSpeedLimit === true ? downloadSpeedLimit : undefined,
      uploadSpeedLimit: client.features.uploadOptions?.uploadSpeedLimit === true ? uploadSpeedLimit : undefined,
    })
    await torrent.waitForExist({ timeout: 20 * 1000 })
    await torrent.waitForStates([client.downloadLabel, "Seeding"], { timeout: 20 * 1000 })
    await torrent.openDetailsPanel()
    if (client.features.uploadOptions?.downloadSpeedLimit === true) {
      await eventually(() => torrent.getDetailsFieldValue("download-limit")).equals(`${downloadSpeedLimit} KB/s`)
    }
    if (client.features.uploadOptions?.uploadSpeedLimit === true) {
      await eventually(() => torrent.getDetailsFieldValue("upload-limit")).equals(`${uploadSpeedLimit} KB/s`)
    }
    await torrent.closeDetailsPanel()
    await torrent.delete()
  })

  it("torrent uploaded with sequential download", async function () {
    this.timeout(30 * 1000)
    if (client.features.uploadOptions?.sequentialDownload !== true) return this.skip()
    const torrent = await this.app.uploadTorrent({ filename: this.torrentPath, askUploadOptions: true });
    await this.app.uploadTorrentModalSubmit({ sequentialDownload: true })
    await torrent.waitForExist({ timeout: 20 * 1000 })
    await torrent.waitForStates([client.downloadLabel, "Seeding"], { timeout: 20 * 1000 })
    await torrent.openDetailsPanel()
    await eventually(() => torrent.getDetailsFieldValue("sequential-download")).equals("Yes")
    await torrent.closeDetailsPanel()
    await torrent.delete()
  })

  it("torrent uploaded with name", async function () {
    if (client.features.uploadOptions?.renameTorrent !== true) return this.skip()
    const torrentName = "my awesome torrent"
    const torrent = await this.app.uploadTorrent({ filename: this.torrentPath, askUploadOptions: true });
    await this.app.uploadTorrentModalSubmit({ name: torrentName })
    await torrent.isExisting()
    await eventually(() => torrent.getColumn("decodedName")).equals(torrentName)
    await torrent.delete()
  })

  it("saved location added from upload modal persists", async function () {
    this.timeout(300 * 1000)
    if (client.features.uploadOptions?.saveLocation !== true) return this.skip()

    const saveLocation = `${client.saveLocation || "/tmp/custom/save/location"}-saved`
    await backend.exec(["rm", "-rf", saveLocation])
    await backend.exec(["test", "!", "-e", saveLocation])

    const torrent = await this.app.uploadTorrent({ filename: this.torrentPath, askUploadOptions: true });
    await this.app.addUploadModalSavedLocation({ path: saveLocation, icon: "folder open" })
    await this.app.uploadTorrentModalSubmit()
    await torrent.waitForExist({ timeout: 20 * 1000 })
    await browser.pause(20000)
    await torrent.waitForState("Seeding", { timeout: 120 * 1000 })
    await backend.waitForExec(["test", "-e", saveLocation], 20 * 1000)
    await torrent.delete()
  })
})
