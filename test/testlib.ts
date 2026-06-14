import chai from "chai"
import fs from "fs"
import { describe, it, before, after, beforeEach } from "mocha";
import path from "path";
import { fileURLToPath } from "url";
import chaiAsPromised from "chai-as-promised";
import parseTorrent from "parse-torrent"
import * as e2e from "./e2e";
import { setupMochaHooks, waitForHttp } from "./testutil"
import { dockerComposeHooks, startApplicationHooks, restartApplication } from "./shared"
import { browser, $ } from '@wdio/globals'
import { createTorrentFile } from "./torrent";
import { waitForModalClose, waitForModalOpen } from "./e2e/modal"
import { CLIENT_METADATA, type ClientId } from "../src/shared/client-metadata"
import type { TorrentClientFeatures } from "../src/shared/ipc-contract"

const { assert } = chai
const __dirname = path.dirname(fileURLToPath(import.meta.url))


interface TestSuiteOptionsOptional {
  clientId: ClientId
  features: TorrentClientFeatures
  fixture: string,
  version?: string,
  username: string,
  password: string,
  host?: string,
  port: number,
  proxyPort?: number,
  acceptHttpStatus?: number,
  timeout?: number,
  stopLabel?: string,
  downloadLabel?: string,
  saveLocation?: string,
}

const TEST_SUITE_OPTIONS_DEFAULTS = {
  username: "admin",
  password: "admin",
  version: "latest",
  host: "localhost",
  port: 8080,
  acceptHttpStatus: 200,
  timeout: 10*1000,
  stopLabel: "Stopped",
  downloadLabel: "Downloading",
}

function createUniqueLabel(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function formatBytes(bytes: number, fractionSize = 1) {
  if (!bytes) {
    return "0 B"
  }

  const k = 1024
  const decimals = fractionSize < 0 ? 0 : fractionSize
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`
}

/**
 * Options given to a test suite execution with information about the backend bittorrent service
 * to be tested, login information, features etc.
 */
export type TestSuiteOptions = TestSuiteOptionsOptional & (typeof TEST_SUITE_OPTIONS_DEFAULTS)

/**
 * Make sure the current test suite defined in `options` supports a certain `feature`. If not,
 * skip all test in the current mocha context
 * @param options test suite options
 * @param feature the feature that is required to continue
 */
function requireFeatureHook(options: TestSuiteOptions, isSupported: (features: TorrentClientFeatures) => boolean) {
  before(function() {
    if (!isSupported(options.features)) {
      this.skip()
    }
  })
}

function enabledFeaturePaths(features: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(features).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (value === true) {
      return [path]
    }
    if (value && typeof value === "object") {
      return enabledFeaturePaths(value as Record<string, unknown>, path)
    }
    return []
  })
}

export function createTestSuite(optionsArg: TestSuiteOptionsOptional) {
  const options: TestSuiteOptions = Object.assign({}, TEST_SUITE_OPTIONS_DEFAULTS, optionsArg)

  setupMochaHooks()

  global.before(function () {
    chai.should();
    chai.use(chaiAsPromised);
  });

  describe(`given ${options.clientId}-${options.version} service is running (docker-compose)`, function () {

    // start up opentracker docker-compose services
    const tracker = dockerComposeHooks([__dirname, "shared", "opentracker"], {}, { serviceName: "peer" })

    // start up the backend service to be tested
    const backend = dockerComposeHooks([__dirname, options.fixture], {
      env: Object.assign({}, process.env, {
        VERSION: options.version,
      }),
    })

    before(async function () {
      this.timeout(20 * 1000)
      await waitForHttp({ url: `http://${options.host}:${options.port}`, statusCode: options.acceptHttpStatus})
    });

    describe("given tls/ssl reverse proxy is running (docker-compose)", function() {
      // The service name in the docker-compose.yml must be equal to the name of the folder in which it resides
      const backendServiceName = path.basename(options.fixture)

      dockerComposeHooks([__dirname, "shared", "nginx"], {
        env: {
          ... process.env,
          "PROXY_HOST": backendServiceName,
          "PROXY_PORT": (options.proxyPort || options.port).toString(),
        },
      })

      describe("given application is running", function() {
        startApplicationHooks()

        it("user is logging in with https", async function() {
          this.retries(3)
          await this.app.login({ ...options, https: true, port: 8443 })
          await this.app.certificateModalIsVisible()
        })

        it("self signed certificate is accepted", async function() {
          await this.app.acceptCertificate()
          await this.app.torrentsPageIsVisible()
        })
      })
    })

    describe("given application is running", function() {
        startApplicationHooks()

        describe("given user is logged in", function() {

        before(async function() {
          this.retries(3)
          await this.app.login(options)
          await this.app.torrentsPageIsVisible()
        })

        it("reports expected client features", async function() {
          const actualFeatures = await browser.execute(() => {
            const angular = (window as any).angular
            return angular.element(document.documentElement).injector().get("$rootScope").$btclient.features
          })
          const missingFeatures = enabledFeaturePaths(options.features as Record<string, unknown>)
            .filter((path) => path.split(".").reduce((value, key) => value?.[key], actualFeatures) !== true)

          assert.deepEqual(missingFeatures, [], `Missing enabled client features: ${missingFeatures.join(", ")}`)
        })

        it("shows client version in status bar", async function() {
          const version = $(".status-bar .client-version")
          await version.waitForDisplayed()
          assert.match(
            await version.getText(),
            new RegExp(`^${CLIENT_METADATA[options.clientId].name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+\\S+`),
          )
        })

        it("automatically connect when restarting app", async function() {
          await restartApplication(this)
          await this.app.torrentsPageIsVisible()
        })

        it("sidebar can be collapsed and restored after refresh", async function() {
          await this.app.setTorrentSidebarCollapsed(false)
          await this.app.setTorrentSidebarCollapsed(true)

          assert.isTrue(await this.app.isTorrentSidebarCollapsed())
          await $("[data-role='torrent-sidebar-labels-toggle']").waitForDisplayed()

          await restartApplication(this)
          await this.app.torrentsPageIsVisible()
          assert.isTrue(await this.app.isTorrentSidebarCollapsed())

          await this.app.setTorrentSidebarCollapsed(false)
          assert.isFalse(await this.app.isTorrentSidebarCollapsed())
        })

        it("show settings when connection error after restarting app", async function() {
          this.timeout(25 * 1000)
          await backend.pause()
          await restartApplication(this)
          await this.app.settingsPageIsVisible({ timeout: 10 * 1000})
          await this.app.settingsPageConnectionIsVisible()
          await browser.waitUntil(async () => {
            return await $("#page-settings-connection input[name='ip']").getValue() === options.host
          })
          assert.equal(await $("#page-settings-connection input[name='ip']").getValue(), options.host)
          assert.equal(await $("#page-settings-connection input[name='port']").getValue(), String(options.port))
          assert.equal(await $("#page-settings-connection input[name='username']").getValue(), options.username)
          assert.equal(await $("#page-settings-connection input[name='password']").getValue(), options.password)
          await backend.unpause()
          await restartApplication(this)
          await this.app.torrentsPageIsVisible()
        })

        if (options.clientId === "qbittorrent") {
          it("keeps qBittorrent free space in the footer after incremental syncs", async function() {
            await browser.waitUntil(async () => {
              const footerText = await this.app.getTorrentsFooterText();
              return footerText.includes("Free:");
            });
          });
        }

        describe("settings page", function() {

          before(async function() {
            await restartApplication(this)
            await this.app.torrentsPageIsVisible()
          })

          beforeEach(async function() {
            this.timeout(10 * 1000)
            await this.app.openSettings()
          })

          it("settings page is visible", async function() {
            await this.app.settingsPageIsVisible()
          })

          it("general settings tab is shown by default", async function() {
            const generalTab = $("#page-settings-general")
            await generalTab.waitForDisplayed()
          })

          it("can navigate to the connection tab", async function() {
            await this.app.settingsGotoTab("connection")
            const connTab = $("#page-settings-connection")
            await connTab.waitForDisplayed()
          })

          it("can navigate to the layout tab", async function() {
            await this.app.settingsGotoTab("layout")
            const layoutTab = $("#page-settings-layout")
            await layoutTab.waitForDisplayed()
          })

          it("can navigate to the servers tab", async function() {
            await this.app.settingsGotoTab("servers")
            const serversTab = $("#page-settings-servers")
            await serversTab.waitForDisplayed()
          })

          it("can navigate to the advanced tab", async function() {
            await this.app.settingsGotoTab("advanced")
            const advancedTab = $("#page-settings-advanced")
            await advancedTab.waitForDisplayed()
          })

          it("can navigate to the about tab", async function() {
            await this.app.settingsGotoTab("about")
            const aboutTab = $("#page-settings-about")
            await aboutTab.waitForDisplayed()
          })

          it("servers tab shows the connected server", async function() {
            await this.app.settingsGotoTab("servers")
            const serverCount = await this.app.getSettingsServerCount()
            assert.isAtLeast(serverCount, 1, "at least one server should be listed")
          })

          it("can rename a server", async function() {
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

          it("can change layout columns", async function() {
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

          it("can enable compact listings", async function() {
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

          it("can toggle background tray mode", async function() {
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

          it("can enable always ask for upload options", async function() {
            const torrentFile = path.join(__dirname, "shared/opentracker/data/shared/slow.torrent")
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

          it("can change the theme", async function() {
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

          it("cancel button returns to the torrents page", async function() {
            await this.app.settingsCancel()
            await this.app.torrentsPageIsVisible()
          })

          it("save button returns to the torrents page", async function() {
            await this.app.settingsSave()
            await this.app.torrentsPageIsVisible()
          })

          it("persists system startup preference", async function() {
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

        describe("server selection page", function() {
          let initialConnectionMode: string

          before(async function() {
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

          after(async function() {
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

          it("lists saved servers and can connect", async function() {
            await this.app.serverSelectionPageIsVisible()

            const serverNames = await this.app.getServerSelectionNames()
            assert.isAtLeast(serverNames.length, 1, "at least one server should be listed")
            assert.isNotEmpty(serverNames[0], "server should have a name")

            await this.app.connectServerSelection(0)
            await this.app.torrentsPageIsVisible()
          })
        })

        describe("watched torrent directory", function() {
          it("uploads torrent files copied into the watched folder", async function() {
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

        describe("automatic torrent file removal", function() {
          it("removes local torrent file after successful upload", async function() {
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

        describe("when a magnet link is uploaded", async function() {
          let torrent: e2e.Torrent
          requireFeatureHook(options, (features) => features.magnetLinks === true)

          before(async function() {
            await restartApplication(this)
            const filename = path.join(__dirname, 'shared/opentracker/data/shared/slow.torrent')
            torrent = await this.app.uploadMagnetLink({ filename })
          })

          after(async function() {
            if (torrent && await torrent.isExisting()) {
              await torrent.delete()
            }
          })

          it("torrent should be visible in table", () => {
            return torrent.waitForExist()
          })

          it("torrent should begin downloading", () => {
            return torrent.waitForState(options.downloadLabel)
          })
        })

        describe("given new torrent is uploaded", async function() {
          let torrent: e2e.Torrent
          let torrentMetadata: parseTorrent.Instance

          before(async function() {
            const filename = path.join(__dirname, 'shared/opentracker/data/shared/slow.torrent')
            torrentMetadata = parseTorrent(fs.readFileSync(filename))
            torrent = await this.app.uploadTorrent({ filename: filename });
          })

          after(async function() {
            if (torrent) {
              await torrent.delete();
            }
          })

          it("torrent should be visible in table", () => {
            return torrent.waitForExist();
          })

          it("wait for download to begin", () => {
            return torrent.waitForState(options.downloadLabel);
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

          it("filters torrents by tracker", async function() {
            if (options.features.trackerFilter !== true) {
              this.skip()
            }

            const trackerItem = $("#torrent-sidebar-trackers li[data-tracker='tracker']")
            await trackerItem.waitForDisplayed()
            await this.app.filterTracker("tracker")
            await torrent.waitForExist()
            await this.app.filterTracker()
          })

          it("torrent is stopped and resumed", async function() {
            this.timeout(25 * 1000)
            await torrent.stop({ state: options.stopLabel });
            await torrent.waitForState(options.stopLabel)
            await torrent.checkInState(["all", "stopped"]);
            await torrent.resume({ state: options.downloadLabel });
            await torrent.waitForState(options.downloadLabel)
            await torrent.checkInState(["all", "downloading"])
          })

          describe("given file selection is supported", function () {
            before(function () {
              if (options.features.fileSelection !== true) {
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
              if (options.features.torrentDetails !== true) {
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
            requireFeatureHook(options, (features) => features.labels === true)
            const firstLabel = createUniqueLabel("testlabel")
            const secondLabel = createUniqueLabel("someotherlabel")
            let initialLabelCount = 0

            before(async function() {
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
              if (options.features.setLocation !== true) {
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
    })

    describe("given advanced upload options are supported", async function() {
      requireFeatureHook(options, (features) => Object.values(features.uploadOptions || {}).some((enabled) => enabled === true))

      describe("given application is running", function() {
        startApplicationHooks()

        describe("given user is logged in", function() {

          before(async function() {
            this.retries(3)
            await this.app.login(options)
            await this.app.torrentsPageIsVisible()
          })

          beforeEach(async function() {
            this.timeout(30 * 1000)
            this.torrentPath = await createTorrentFile(tracker, { fileSize: 1 })
            await restartApplication(this)
            await this.app.torrentsPageIsVisible()
          })

          it("torrent uploaded with default options", async function() {
            const torrent = await this.app.uploadTorrent({ filename: this.torrentPath, askUploadOptions: true });
            await this.app.uploadTorrentModalSubmit()
            await torrent.waitForExist()
            await torrent.waitForStates([options.downloadLabel, "Seeding"])
            await torrent.delete()
          })

          it("add torrent dialog uses current server default upload options", async function() {
            if (options.features.uploadOptions?.startTorrent !== true) return this.skip()

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
              await torrent.waitForState(options.stopLabel, { timeout: 20 * 1000 })
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

          it("magnet link opens upload options", async function() {
            const torrent = await this.app.uploadMagnetLink({ filename: this.torrentPath, askUploadOptions: true });
            const torrentMetadata = parseTorrent(fs.readFileSync(this.torrentPath))

            await this.app.uploadTorrentModalVisible()
            await this.app.uploadTorrentModalLabel().should.eventually.equal(torrentMetadata.name)
            await this.app.uploadTorrentModalSubmit()
            await torrent.waitForExist()
            await torrent.waitForStates([options.downloadLabel, "Seeding"], { timeout: 20 * 1000 })
            await torrent.delete()
          })

          it("torent uploaded with preexisting label", async function() {
            if (options.features.uploadOptions?.category !== true) return this.skip()
            const labelName = createUniqueLabel("mylabel")
            let torrent = await this.app.uploadTorrent({ filename: this.torrentPath });
            await torrent.newLabel(labelName)
            await torrent.delete()

            torrent = await this.app.uploadTorrent({ filename: this.torrentPath, askUploadOptions: true });
            await this.app.uploadTorrentModalSubmit({ label: labelName })
            await torrent.waitForExist()
            await torrent.getLabel().should.eventually.equal(labelName)
            await torrent.delete()
          })

          it("torrent uploaded in stopped state", async function() {
            this.timeout(30 * 1000)
            if (options.features.uploadOptions?.startTorrent !== true) return this.skip()
            const torrent = await this.app.uploadTorrent({ filename: this.torrentPath, askUploadOptions: true });
            await this.app.uploadTorrentModalSubmit({ start: false })
            await torrent.isExisting()
            await torrent.waitForState(options.stopLabel, { timeout: 20 * 1000 })
            await torrent.delete()
          })

          it("torrent uploaded with peer limit", async function() {
            this.timeout(30 * 1000)
            if (options.features.uploadOptions?.peerLimit !== true) return this.skip()
            const peerLimit = 8
            const torrent = await this.app.uploadTorrent({ filename: this.torrentPath, askUploadOptions: true });
            await this.app.uploadTorrentModalSubmit({ peerLimit })
            await torrent.waitForExist({ timeout: 20 * 1000 })
            await torrent.waitForStates([options.downloadLabel, "Seeding"], { timeout: 20 * 1000 })
            await torrent.openDetailsPanel()
            await browser.waitUntil(async () => (await torrent.getDetailsFieldValue("connections-limit")) === String(peerLimit), {
              timeout: 10 * 1000,
              timeoutMsg: `Expected peer limit to become ${peerLimit}`,
            })
            await torrent.closeDetailsPanel()
            await torrent.delete()
          })

          it("torrent uploaded with speed limits", async function() {
            this.timeout(30 * 1000)
            if (options.features.uploadOptions?.downloadSpeedLimit !== true && options.features.uploadOptions?.uploadSpeedLimit !== true) return this.skip()
            const downloadSpeedLimit = 111
            const uploadSpeedLimit = 37
            const torrent = await this.app.uploadTorrent({ filename: this.torrentPath, askUploadOptions: true });
            await this.app.uploadTorrentModalSubmit({
              downloadSpeedLimit: options.features.uploadOptions?.downloadSpeedLimit === true ? downloadSpeedLimit : undefined,
              uploadSpeedLimit: options.features.uploadOptions?.uploadSpeedLimit === true ? uploadSpeedLimit : undefined,
            })
            await torrent.waitForExist({ timeout: 20 * 1000 })
            await torrent.waitForStates([options.downloadLabel, "Seeding"], { timeout: 20 * 1000 })
            await torrent.openDetailsPanel()
            if (options.features.uploadOptions?.downloadSpeedLimit === true) {
              await browser.waitUntil(async () => (await torrent.getDetailsFieldValue("download-limit")) === String(downloadSpeedLimit), {
                timeout: 10 * 1000,
                timeoutMsg: `Expected download limit to become ${downloadSpeedLimit}`,
              })
            }
            if (options.features.uploadOptions?.uploadSpeedLimit === true) {
              await browser.waitUntil(async () => (await torrent.getDetailsFieldValue("upload-limit")) === String(uploadSpeedLimit), {
                timeout: 10 * 1000,
                timeoutMsg: `Expected upload limit to become ${uploadSpeedLimit}`,
              })
            }
            await torrent.closeDetailsPanel()
            await torrent.delete()
          })

          it("torrent uploaded with sequential download", async function() {
            this.timeout(30 * 1000)
            if (options.features.uploadOptions?.sequentialDownload !== true) return this.skip()
            const torrent = await this.app.uploadTorrent({ filename: this.torrentPath, askUploadOptions: true });
            await this.app.uploadTorrentModalSubmit({ sequentialDownload: true })
            await torrent.waitForExist({ timeout: 20 * 1000 })
            await torrent.waitForStates([options.downloadLabel, "Seeding"], { timeout: 20 * 1000 })
            await torrent.openDetailsPanel()
            await browser.waitUntil(async () => (await torrent.getDetailsFieldValue("sequential-download")) === "Yes", {
              timeout: 10 * 1000,
              timeoutMsg: "Expected sequential download to be enabled",
            })
            await torrent.closeDetailsPanel()
            await torrent.delete()
          })

          it("torrent uploaded with name", async function() {
            if (options.features.uploadOptions?.renameTorrent !== true) return this.skip()
            const torrentName = "my awesome torrent"
            const torrent = await this.app.uploadTorrent({ filename: this.torrentPath, askUploadOptions: true });
            await this.app.uploadTorrentModalSubmit({ name: torrentName })
            await torrent.isExisting()
            await torrent.getColumn("decodedName").should.eventually.equal(torrentName)
            await torrent.delete()
          })

          it("saved location added from upload modal persists", async function() {
            this.timeout(300 * 1000)
            if (options.features.uploadOptions?.saveLocation !== true) return this.skip()

            const saveLocation = `${options.saveLocation || "/tmp/custom/save/location"}-saved`
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
      })
    })
  })
}
