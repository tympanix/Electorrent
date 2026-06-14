import chai from "chai"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import parseTorrent from "parse-torrent"
import { $, browser } from "@wdio/globals"
import * as e2e from "../e2e"
import { createTorrentFile } from "../torrent"
import { configureSpec, createUniqueLabel, getTestFixture } from "../framework/fixture"
import { restartApplication } from "../shared"

const { assert } = chai
const testDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const fixture = getTestFixture()
const tracker = fixture.tracker

describe("settings", function () {
  configureSpec()
  describe("settings page", function () {

    before(async function () {
      await restartApplication(this)
      await this.app.torrentsPageIsVisible()
    })

    beforeEach(async function () {
      this.timeout(10 * 1000)
      await this.app.openSettings()
    })

    it("settings page is visible", async function () {
      await this.app.settingsPageIsVisible()
    })

    it("general settings tab is shown by default", async function () {
      const generalTab = $("#page-settings-general")
      await generalTab.waitForDisplayed()
    })

    it("can navigate to the connection tab", async function () {
      await this.app.settingsGotoTab("connection")
      const connTab = $("#page-settings-connection")
      await connTab.waitForDisplayed()
    })

    it("can navigate to the layout tab", async function () {
      await this.app.settingsGotoTab("layout")
      const layoutTab = $("#page-settings-layout")
      await layoutTab.waitForDisplayed()
    })

    it("can navigate to the servers tab", async function () {
      await this.app.settingsGotoTab("servers")
      const serversTab = $("#page-settings-servers")
      await serversTab.waitForDisplayed()
    })

    it("can navigate to the advanced tab", async function () {
      await this.app.settingsGotoTab("advanced")
      const advancedTab = $("#page-settings-advanced")
      await advancedTab.waitForDisplayed()
    })

    it("can navigate to the about tab", async function () {
      await this.app.settingsGotoTab("about")
      const aboutTab = $("#page-settings-about")
      await aboutTab.waitForDisplayed()
    })

    it("servers tab shows the connected server", async function () {
      await this.app.settingsGotoTab("servers")
      const serverCount = await this.app.getSettingsServerCount()
      assert.isAtLeast(serverCount, 1, "at least one server should be listed")
    })

    it("can rename a server", async function () {
      await this.app.settingsGotoTab("servers")

      const originalNames = await this.app.getSettingsServerNames()
      assert.isAtLeast(originalNames.length, 1, "at least one server should be listed")

      const nextName = `Renamed ${Date.now()}`
      await this.app.renameSettingsServer(0, nextName)

      await this.app.settingsSave()
      await this.app.torrentsPageIsVisible()
      assert.equal(await this.app.getStoredServerName(0), nextName)
      assert.equal(await this.app.getTitleBarServerName(), nextName)

      await this.app.openSettings()
      await this.app.settingsGotoTab("servers")
      assert.equal(await this.app.getStoredServerName(0), nextName)
    })

    it("can change layout columns", async function () {
      await this.app.settingsGotoTab("layout")

      const layoutColumns = await this.app.getLayoutColumns()
      const targetColumn = layoutColumns.find((column) => column.enabled && column.name !== "Name")
      assert.isOk(targetColumn, "expected at least one enabled column")

      await this.app.setLayoutColumnEnabled(targetColumn!.name, false)
      const updatedColumns = await this.app.getLayoutColumns()
      assert.isFalse(updatedColumns.find((column) => column.name === targetColumn!.name)!.enabled)

      await this.app.settingsSave()
      await this.app.torrentsPageIsVisible()

      await this.app.openSettings()
      await this.app.settingsGotoTab("layout")
      const persistedColumns = await this.app.getLayoutColumns()
      assert.isFalse(persistedColumns.find((column) => column.name === targetColumn!.name)!.enabled)
    })

    it("can enable compact listings", async function () {
      await this.app.settingsGotoTab("general")
      const initialState = await this.app.getGeneralToggleState("Compact Listings")
      await this.app.setGeneralToggle("Compact Listings", !initialState)
      assert.equal(await this.app.getGeneralToggleState("Compact Listings"), !initialState)

      await this.app.settingsSave()
      await this.app.torrentsPageIsVisible()

      await browser.waitUntil(async () => {
        const className = await $("#torrentTable").getAttribute("class")
        return className.includes("compact") === !initialState
      })
    })

    it("can toggle background tray mode", async function () {
      await this.app.settingsGotoTab("general")
      const initialState = await this.app.getGeneralToggleState("Run in Background")
      const nextState = !initialState

      await this.app.setGeneralToggle("Run in Background", nextState)
      assert.equal(await this.app.getGeneralToggleState("Run in Background"), nextState)

      await this.app.settingsSave()
      await this.app.torrentsPageIsVisible()

      await this.app.openSettings()
      await this.app.settingsGotoTab("general")
      assert.equal(await this.app.getGeneralToggleState("Run in Background"), nextState)

      await this.app.setGeneralToggle("Run in Background", initialState)
      await this.app.settingsSave()
      await this.app.torrentsPageIsVisible()
    })

    it("can enable always ask for upload options", async function () {
      const torrentFile = path.join(testDir, "shared/opentracker/data/shared/slow.torrent")
      let torrent: e2e.Torrent | undefined

      await this.app.settingsGotoTab("general")
      const initialState = await this.app.getGeneralToggleState("Always prompt for upload options")
      await this.app.setGeneralToggle("Always prompt for upload options", true)
      assert.isTrue(await this.app.getGeneralToggleState("Always prompt for upload options"))

      await this.app.settingsSave()
      await this.app.torrentsPageIsVisible()

      try {
        torrent = await this.app.uploadTorrent({ filename: torrentFile })
        await this.app.uploadTorrentModalVisible()
        await this.app.uploadTorrentModalSubmit()
        await torrent.waitForExist()
      } finally {
        if (torrent && await torrent.isExisting()) {
          await torrent.delete()
        }
      }

      if (!initialState) {
        await this.app.openSettings()
        await this.app.settingsGotoTab("general")
        await this.app.setGeneralToggle("Always prompt for upload options", false)
        await this.app.settingsSave()
        await this.app.torrentsPageIsVisible()
      }
    })

    it("can change the theme", async function () {
      await this.app.settingsGotoTab("general")
      const initialTheme = await this.app.getGeneralDropdownValue("Theme")
      const initialThemeHref = await this.app.getAppliedThemeHref()
      const availableThemes = this.app.getThemeOptions()
      assert.deepEqual(availableThemes, ["System", "Light", "Dark"])
      assert.include(availableThemes, initialTheme, `expected a supported theme, got: ${initialTheme}`)
      const nextTheme = initialThemeHref.includes("/dark.css") ? "Light" : "Dark"

      await this.app.selectGeneralDropdownValue("Theme", nextTheme)
      assert.equal(await this.app.getGeneralDropdownValue("Theme"), nextTheme)

      await this.app.settingsSave()
      await this.app.torrentsPageIsVisible()

      await browser.waitUntil(async () => {
        return (await this.app.getAppliedThemeHref()) !== initialThemeHref
      })

      await this.app.openSettings()
      await this.app.settingsGotoTab("general")
      assert.equal(await this.app.getGeneralDropdownValue("Theme"), nextTheme)
    })

    it("cancel button returns to the torrents page", async function () {
      await this.app.settingsCancel()
      await this.app.torrentsPageIsVisible()
    })

    it("save button returns to the torrents page", async function () {
      await this.app.settingsSave()
      await this.app.torrentsPageIsVisible()
    })

    it("persists system startup preference", async function () {
      if (process.platform === "linux") {
        this.skip()
      }

      await this.app.settingsGotoTab("general")
      const initialSystemStartup = await this.app.getGeneralDropdownValue("System Startup")
      const nextSystemStartup = initialSystemStartup === "Start"
        ? "Disabled"
        : "Start"

      await this.app.selectGeneralDropdownValue("System Startup", nextSystemStartup)
      await this.app.settingsSave()
      await this.app.torrentsPageIsVisible()

      await this.app.openSettings()
      await this.app.settingsGotoTab("general")
      assert.equal(await this.app.getGeneralDropdownValue("System Startup"), nextSystemStartup)

      await this.app.selectGeneralDropdownValue("System Startup", initialSystemStartup)
      await this.app.settingsSave()
      await this.app.torrentsPageIsVisible()
    })

  })

  describe("server selection page", function () {
    let initialConnectionMode: string

    before(async function () {
      await restartApplication(this)
      await this.app.torrentsPageIsVisible()
      await this.app.openSettings()
      await this.app.settingsGotoTab("general")
      initialConnectionMode = await this.app.getGeneralDropdownValue("Startup Connection")
      await this.app.selectGeneralDropdownValue("Startup Connection", "Ask")
      await this.app.settingsSave()
      await this.app.torrentsPageIsVisible()
      await restartApplication(this)
    })

    after(async function () {
      const torrentsPage = $("#page-torrents")
      if (!await torrentsPage.isDisplayed()) {
        await this.app.connectServerSelection(0)
        await this.app.torrentsPageIsVisible()
      }

      if (initialConnectionMode !== "Ask") {
        await this.app.openSettings()
        await this.app.settingsGotoTab("general")
        await this.app.selectGeneralDropdownValue("Startup Connection", initialConnectionMode)
        await this.app.settingsSave()
        await this.app.torrentsPageIsVisible()
      }
    })

    it("lists saved servers and can connect", async function () {
      await this.app.serverSelectionPageIsVisible()

      const serverNames = await this.app.getServerSelectionNames()
      assert.isAtLeast(serverNames.length, 1, "at least one server should be listed")
      assert.isNotEmpty(serverNames[0], "server should have a name")

      await this.app.connectServerSelection(0)
      await this.app.torrentsPageIsVisible()
    })
  })

  describe("watched torrent directory", function () {
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
  })

  describe("automatic torrent file removal", function () {
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
})
