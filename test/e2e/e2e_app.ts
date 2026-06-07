import fs from "fs";
import path from "path";
import magnet from "magnet-uri"
import { Torrent } from "./e2e_torrent";
import parseTorrent from "parse-torrent"
import { browser, $, $$, expect } from '@wdio/globals'
import { TorrentClient } from "../../src/renderer/app/bittorrent"
import { waitForModalClose, waitForModalOpen } from "./modal"

/**
 * Options to use during the login screen of the app to connect to your torrent client
 */
export interface LoginOptions {
  host: string
  username: string
  password: string
  port: number
  client: TorrentClient
  https?: boolean
}

/**
 * Class to perform various app-related actions with WebDriverIO
 */
export class App {
  torrents: Array<Torrent>
  timeout: number

  constructor() {
    this.torrents = [];
    this.timeout = 5 * 1000;
  }

  async login(options: LoginOptions) {
    const hostForm = $("#connection-host")
    await hostForm.waitForDisplayed()
    await hostForm.setValue(options.host)

    const protoField = $("#connection-proto")
    await protoField.waitForDisplayed()
    await protoField.waitForClickable()
    await protoField.click()

    const proto = options.https ? 'https' : 'http'
    const protoHttp = $(`#connection-proto-${proto}`)
    await protoHttp.waitForDisplayed()
    await protoHttp.waitForClickable()
    await protoHttp.click()

    const user = $("#connection-user")
    await user.waitForDisplayed()
    await user.setValue(options.username)

    const pass = $("#connection-password")
    await pass.waitForDisplayed()
    await pass.setValue(options.password);

    const clientForm = $("#connection-client")
    await clientForm.waitForDisplayed()
    await clientForm.waitForClickable()
    await clientForm.click();

    const clientFormSelect = $(`#connection-client-${options.client.id}`)
    await clientFormSelect.waitForDisplayed()
    await clientFormSelect.waitForClickable()
    await clientFormSelect.click()

    const portForm = $("#connection-port")
    await portForm.waitForDisplayed()
    await portForm.setValue(options.port);

    const submit = $("#connection-submit")
    await submit.waitForDisplayed()
    await submit.waitForClickable()
    await submit.click();
  }

  async torrentsPageIsVisible(opts?: { timeout: number }) {
    const pageTorrents = $("#page-torrents")
    await pageTorrents.waitForDisplayed({ timeout: opts?.timeout ?? this.timeout })
  }

  async settingsPageIsVisible(opts?: { timeout: number }) {
    const settingsPage = $("#page-settings")
    await settingsPage.waitForDisplayed({ timeout: opts?.timeout ?? this.timeout })
  }

  async settingsPageIsHidden(opts?: { timeout: number }) {
    const settingsPage = $("#page-settings")
    await settingsPage.waitForDisplayed({ reverse: true, timeout: opts?.timeout ?? this.timeout })
  }

  async settingsPageConnectionIsVisible() {
    const settingsPage = $("#page-settings-connection")
    await settingsPage.waitForDisplayed({ timeout: this.timeout })
  }

  async serverSelectionPageIsVisible(opts?: { timeout: number }) {
    const serverSelectionPage = $("#page-server-selection")
    await serverSelectionPage.waitForDisplayed({ timeout: opts?.timeout ?? this.timeout })
  }

  async getServerSelectionNames(): Promise<string[]> {
    await this.serverSelectionPageIsVisible()
    const serverCards = await $$("#page-server-selection .server.list .card")
    const names: string[] = []
    for (const card of serverCards) {
      names.push((await card.$(".header").getText()).trim())
    }
    return names
  }

  async connectServerSelection(serverIndex: number) {
    await this.serverSelectionPageIsVisible()
    const serverCards = await $$("#page-server-selection .server.list .card")
    const serverCard = serverCards[serverIndex]
    if (!serverCard) {
      throw new Error(`Server card at index ${serverIndex} was not found`)
    }

    const connectButton = serverCard.$(".bottom.attached.button")
    await connectButton.waitForDisplayed()
    await connectButton.waitForClickable()
    await connectButton.click()
  }

  async certificateModalIsVisible() {
    const certificateModal = $("#certificateModal")
    await certificateModal.waitForExist()
    await waitForModalOpen(certificateModal, this.timeout)
    return certificateModal
  }

  async acceptCertificate() {
    const certificateModal = await this.certificateModalIsVisible()
    const submit = certificateModal.$("button.approve")
    await submit.waitForExist()
    await submit.waitForDisplayed()
    await submit.waitForClickable()
    await submit.waitForEnabled()
    await submit.click()
    await waitForModalClose(certificateModal, this.timeout)
  }

  async getNotificationError() {
      const msg = $("#notifications .negative")
      try {
        await msg.waitForExist({ timeout: 1000 })
        return {
          title: await msg.$(".header").getText(),
          message: await msg.$("p").getText()
        }
      } catch {
        return null
      }
  }

  async uploadTorrentModalVisible() {
    const modal = $("#uploadTorrentModal")
    await waitForModalOpen(modal, this.timeout)
    return modal
  }

  async isUploadSavedLocationDropdownOpen() {
    const modal = await this.uploadTorrentModalVisible()
    const dropdown = modal.$("#upload-options-saved-location")
    await dropdown.waitForDisplayed()
    return (await dropdown.getAttribute("class")).includes("active visible")
  }

  private async setUploadToggle(modal: WebdriverIO.Element, action: string, enabled: boolean) {
    const toggle = modal.$(`div[data-action="${action}"]`)
    const toggleInput = toggle.$("input")
    await toggle.waitForDisplayed()
    await toggleInput.waitForExist()
    await toggleInput.scrollIntoView()
    if (await toggleInput.isSelected() !== enabled) {
      await toggleInput.click()
      await browser.waitUntil(async () => (await toggleInput.isSelected()) === enabled, {
        timeout: 5_000,
        timeoutMsg: `Expected ${action} toggle to become ${enabled}`,
      })
    }
  }

  private async setUploadNumberInput(modal: WebdriverIO.Element, action: string, value: number) {
    const input = modal.$(`input[data-action='${action}']`)
    await input.waitForDisplayed()
    await input.setValue(String(value))
  }

  async uploadTorrentModalSubmit(options?: {
    label?: string
    start?: boolean
    name?: string
    savedLocationPath?: string
    peerLimit?: number
    sequentialDownload?: boolean
    firstAndLastPiecePrio?: boolean
    downloadSpeedLimit?: number
    uploadSpeedLimit?: number
  }) {
    const modal = await this.uploadTorrentModalVisible()
    await browser.pause(200)

    if (options?.name) {
      const nameInput = modal.$("input[data-action='rename-torrent']")
      await nameInput.waitForDisplayed()
      await nameInput.setValue(options.name)
    }

    if (options?.savedLocationPath) {
      const savedLocationDropdown = modal.$("#upload-options-saved-location")
      await savedLocationDropdown.waitForDisplayed()
      await savedLocationDropdown.waitForClickable()
      await savedLocationDropdown.click()
      await savedLocationDropdown.getHTML(false)
      await browser.execute((path) => {
        const dropdown = document.querySelector("#upload-options-saved-location")
        const item = dropdown?.querySelector(`[data-path="${path}"]`) as HTMLElement | null
        item?.click()
      }, options.savedLocationPath)
      const selectedText = savedLocationDropdown.$(".text")
      await browser.waitUntil(async () => {
        return (await selectedText.getText()).includes(options.savedLocationPath || "")
      }, {
        timeout: 5_000,
        timeoutMsg: `Expected saved location dropdown to select ${options.savedLocationPath}`,
      })
    }

    if (options?.start !== undefined) {
      await this.setUploadToggle(modal, "start-torrent", options.start)
    }

    if (options?.sequentialDownload !== undefined) {
      await this.setUploadToggle(modal, "sequential-download", options.sequentialDownload)
    }

    if (options?.firstAndLastPiecePrio !== undefined) {
      await this.setUploadToggle(modal, "first-last-piece-prio", options.firstAndLastPiecePrio)
    }

    if (options?.downloadSpeedLimit !== undefined) {
      await this.setUploadNumberInput(modal, "download-speed-limit", options.downloadSpeedLimit)
    }

    if (options?.uploadSpeedLimit !== undefined) {
      await this.setUploadNumberInput(modal, "upload-speed-limit", options.uploadSpeedLimit)
    }

    if (options?.peerLimit !== undefined) {
      await this.setUploadNumberInput(modal, "peer-limit", options.peerLimit)
    }

    if (options?.label) {
      const labelElem = modal.$("div[title=Label]")
      await labelElem.waitForClickable()
      await labelElem.click()
      const labelItemElem = labelElem.$(`div[data-label='${options.label}']`)
      await labelItemElem.waitForDisplayed()
      await labelItemElem.click()
    }

    await browser.pause(250)
    const submitBtn = modal.$("button[type=submit]")
    await submitBtn.click()
    await waitForModalClose(modal, this.timeout)
  }

  async uploadTorrent({ filename, askUploadOptions, sourcePath }: { filename: string, askUploadOptions?: boolean, sourcePath?: string }) {
    const data = fs.readFileSync(path.join(filename));
    const info = parseTorrent(data)
    const hash = info.infoHash
    const torrent = new Torrent({ hash: hash, app: this });
    await expect(await torrent.isExisting()).toBe(false);
    await browser.execute((data, filename, askUploadOptions, sourcePath) => {
      const injector = angular.element(document.body).injector()
      const $rootScope = injector.get("$rootScope")
      $rootScope.$broadcast("torrents:add", {
        type: "file",
        data: new Uint8Array(data),
        filename,
        sourcePath,
      }, !!askUploadOptions)
      $rootScope.$apply()
    }, Array.from(data), path.basename(filename), askUploadOptions, sourcePath)
    this.torrents.push(torrent);
    return torrent;
  }

  async uploadMagnetLink({ magnetUri, filename, askUploadOptions }: { magnetUri?: string, filename?: string, askUploadOptions?: boolean }) {
    if (!magnetUri && filename) {
      const data = fs.readFileSync(filename)
      const info = parseTorrent(data)
      magnetUri = magnet.encode({
        xt: [`urn:btih:${info.infoHash}`],
        dn: info.name,
        tr: info.announce,
      })
    }
    if (!magnetUri) throw new Error("invalid arguments passed to generate magnet uri")
    const info = parseTorrent(magnetUri)
    const torrent = new Torrent({ hash: info.infoHash, app: this })
    await browser.execute((magnetUri, askUploadOptions) => {
      const injector = angular.element(document.body).injector()
      const $rootScope = injector.get("$rootScope")
      $rootScope.$broadcast("torrents:add", {
        type: "link",
        uri: magnetUri,
      }, !!askUploadOptions)
      $rootScope.$apply()
    }, magnetUri, askUploadOptions)
    this.torrents.push(torrent)
    return torrent
  }

  async uploadTorrentModalLabel() {
    const modal = await this.uploadTorrentModalVisible()
    return modal.$(".content .sub.header").getText()
  }

  async waitForLabelInDropdown(labelName) {
    const labels = "#torrent-action-header div[data-role=labels]";
    const labelBtn = `div[data-label='${labelName}']`;

    const labelsElem = $(labels)
    await labelsElem.click()

    const labelBtnElem = labelsElem.$(labelBtn)
    await labelBtnElem.waitForDisplayed()

    const labelText = await labelBtnElem.getText()
    labelText.should.contain(labelName)

    await browser.pause(200)
    await labelsElem.click()
    await labelBtnElem.waitForDisplayed({ reverse: true })
  }

  async getTorrents() {
    const table = "#torrentTable tbody tr";
    const torrents = $$(table)
    const data = torrents.map(
      async (e) => new Torrent({ hash: await e.getAttribute("data-hash"), app: this })
    );
    return await data
  }

  async getSelectedTorrents() {
    const table = "#torrentTable tbody tr.active";
    const tableElem = $$(table)
    const data = tableElem.map(async (e) => {
      return new Torrent({ hash: await e.getAttribute("data-hash"), app: this })
    })
    return await data
  }

  async filterLabel(labelName?: string) {
    const label = `#torrent-sidebar-labels li[data-label="${labelName}"]`;
    const clear = `#torrent-sidebar-labels [data-role="labels-clear"]`;

    if (labelName === undefined) {
      await $(clear).click()
    } else {
      await $(label).click()
    }
  }

  async getAllSidebarLabels() {
    const labelsElem = $$("#torrent-sidebar-labels li")
    const data = labelsElem.map(async (e) => await e.getAttribute("data-label"));
    const labels = await data
    return labels || [];
  }

  async getTorrentsFooterText() {
    return await $("#page-torrents .status-bar").getText()
  }

  async isTorrentSidebarCollapsed() {
    const className = (await $("#page-torrents").getAttribute("class")) || ""
    return className.includes("is-sidebar-collapsed")
  }

  async setTorrentSidebarCollapsed(collapsed: boolean) {
    const toggle = $("[data-role='torrent-sidebar-toggle']")
    await toggle.waitForDisplayed()

    if (await this.isTorrentSidebarCollapsed() !== collapsed) {
      await toggle.waitForClickable()
      await toggle.click()
      await browser.waitUntil(async () => {
      return await this.isTorrentSidebarCollapsed() === collapsed
      }, {
      timeout: this.timeout,
      timeoutMsg: `Expected torrent sidebar collapsed state to become ${collapsed}`,
      })
    }
  }

  async openSettings() {
    const settingsPage = $("#page-settings")
    if (await settingsPage.isDisplayed()) {
      return
    }

    const settingsButton = $('button[data-role="show-settings"]')
    await settingsButton.waitForDisplayed()
    await settingsButton.waitForClickable()
    await settingsButton.click()
    await this.settingsPageIsVisible()
  }

  async settingsGotoTab(tab: string) {
    const settingsTab = $(`#page-settings [data-role="settings-tab-${tab}"]`)
    await settingsTab.waitForDisplayed()
    const className = (await settingsTab.getAttribute("class")) || ""
    if (!className.includes("active")) {
      await settingsTab.waitForClickable()
      await settingsTab.click()
    }
  }

  async settingsSave() {
    const saveBtn = $("#page-settings .actions.footer a.positive")
    await saveBtn.waitForDisplayed()
    await saveBtn.waitForClickable()
    await saveBtn.click()
    await this.settingsPageIsHidden()
  }

  async settingsCancel() {
    const cancelBtn = $("#page-settings .actions.footer a.deny")
    await cancelBtn.waitForDisplayed()
    await cancelBtn.waitForClickable()
    await cancelBtn.click()
    await this.settingsPageIsHidden()
  }

  async getSettingsServerCount(): Promise<number> {
    const serverRows = await $$("#page-settings-servers tbody tr")
    return serverRows.length
  }

  async getSettingsServerNames(): Promise<string[]> {
    const serverRows = await $$("#page-settings-servers tbody tr")
    const names: string[] = []
    for (const row of serverRows) {
      names.push((await row.$("td:nth-child(2)").getText()).trim())
    }
    return names
  }

  async openRenameSettingsServer(serverIndex: number) {
    const serverRows = await $$("#page-settings-servers tbody tr")
    const row = serverRows[serverIndex]
    await row.waitForDisplayed()

    const renameButton = row.$("button.circular.blue")
    await renameButton.waitForClickable()
    await renameButton.click()

    const modal = $("#renameModal")
    await waitForModalOpen(modal, this.timeout)
    return modal
  }

  async getRenameSettingsServerValue(serverIndex: number) {
    const modal = await this.openRenameSettingsServer(serverIndex)
    const input = modal.$("input[name='servername']")
    await input.waitForDisplayed()
    await browser.waitUntil(async () => {
      return (await input.getValue()).length > 0
    })
    const value = await input.getValue()

    const cancelButton = modal.$("button.deny")
    await cancelButton.waitForClickable()
    await cancelButton.click()
    await waitForModalClose(modal, this.timeout)

    return value
  }

  async renameSettingsServer(serverIndex: number, nextName: string) {
    const modal = await this.openRenameSettingsServer(serverIndex)

    const input = modal.$("input[name='servername']")
    await input.waitForDisplayed()
    await input.clearValue()
    await input.setValue(nextName)

    const approveButton = modal.$("button.approve")
    await approveButton.waitForEnabled()
    await approveButton.click()
    await waitForModalClose(modal, this.timeout)
  }

  async getLayoutColumns(): Promise<Array<{ name: string, enabled: boolean }>> {
    const rows = await $$("#page-settings-layout tbody tr")
    const columns: Array<{ name: string, enabled: boolean }> = []
    for (const row of rows) {
      const name = (await row.$("td:nth-child(3)").getText()).trim()
      const enabled = await row.$("td:nth-child(2) input[type='checkbox']").isSelected()
      columns.push({ name, enabled })
    }
    return columns
  }

  async setLayoutColumnEnabled(columnName: string, enabled: boolean) {
    const rows = await $$("#page-settings-layout tbody tr")
    for (const row of rows) {
      const name = (await row.$("td:nth-child(3)").getText()).trim()
      if (name !== columnName) {
        continue
      }

      const checkbox = row.$("td:nth-child(2) input[type='checkbox']")
      await checkbox.waitForExist()
      if (await checkbox.isSelected() !== enabled) {
        await checkbox.click()
      }
      return
    }

    throw new Error(`Layout column "${columnName}" was not found`)
  }

  async getTorrentTableColumns(): Promise<string[]> {
    const columns = await $$("#torrentTable thead th")
    const names: string[] = []
    for (const column of columns) {
      names.push((await column.getText()).trim())
    }
    return names
  }

  private async getGeneralSettingsCard(settingName: string) {
    const generalPage = $("#page-settings-general")
    await generalPage.waitForDisplayed()
    const card = $(`//*[@id='page-settings-general']//div[contains(@class, 'ui card')][.//*[contains(@class, 'header')][contains(., '${settingName}')]]`)
    await card.waitForDisplayed()
    return card
  }

  async getGeneralToggleState(settingName: string) {
    const card = await this.getGeneralSettingsCard(settingName)
    return await card.$("input[type='checkbox']").isSelected()
  }

  async setGeneralToggle(settingName: string, enabled: boolean) {
    const card = await this.getGeneralSettingsCard(settingName)
    const toggle = card.$("input[type='checkbox']")
    await toggle.waitForExist()
    if (await toggle.isSelected() !== enabled) {
      await toggle.click()
    }
  }

  async getGeneralDropdownValue(settingName: string) {
    const card = await this.getGeneralSettingsCard(settingName)
    const text = card.$(".ui.selection.dropdown .text")
    await text.waitForDisplayed()
    return (await text.getText()).trim()
  }

  async getGeneralDropdownOptions(settingName: string, minimumOptionCount = 1): Promise<string[]> {
    const card = await this.getGeneralSettingsCard(settingName)
    const dropdown = card.$(".ui.selection.dropdown")
    await dropdown.waitForClickable()
    await dropdown.click()

    await browser.waitUntil(async () => {
      const options = await dropdown.$$(".menu .item")
      return options.length >= minimumOptionCount
    }, {
      timeoutMsg: `expected at least ${minimumOptionCount} options in ${settingName} dropdown`,
    })

    const options = await dropdown.$$(".menu .item")
    const values: string[] = []
    for (const option of options) {
      values.push((await option.getText()).trim())
    }
    await dropdown.click()
    return values.filter(Boolean)
  }

  getThemeOptions(): readonly ["System", "Light", "Dark"] {
    return ["System", "Light", "Dark"] as const
  }

  async selectGeneralDropdownValue(settingName: string, optionText: string) {
    const card = await this.getGeneralSettingsCard(settingName)
    const dropdown = card.$(".ui.selection.dropdown")
    await dropdown.waitForClickable()
    await dropdown.click()

    const option = dropdown.$(`.//div[contains(@class, 'menu')]//div[contains(@class, 'item') and normalize-space(.)='${optionText}']`)
    await option.waitForDisplayed()
    await option.click()
  }

  async getAppliedThemeHref() {
    const themeLink = $("head link[ng-href]")
    await themeLink.waitForExist()
    return await themeLink.getAttribute("href")
  }

  async getSettingsWatchDirectory() {
    const input = $("#settings-watch-directory")
    await input.waitForDisplayed()
    return await input.getValue()
  }

  async setSettingsWatchDirectory(watchDirectory: string) {
    const input = $("#settings-watch-directory")
    await input.waitForDisplayed()
    await input.clearValue()
    if (watchDirectory) {
      await input.setValue(watchDirectory)
    }
  }

  async clearSettingsWatchDirectory() {
    const clearButton = $("#page-settings-advanced [data-role='settings-watch-directory-clear']")
    await clearButton.waitForDisplayed()
    if (await clearButton.isEnabled()) {
      await clearButton.click()
    }
  }

  async addSettingsSavedLocation({ path, icon }: { path: string, icon: string }) {
    const addButton = $("#page-settings-advanced [data-role='settings-saved-location-add']")
    await addButton.waitForDisplayed()
    await addButton.waitForClickable()
    await addButton.click()

    const modal = $("#settingsSavedLocationModal")
    await waitForModalOpen(modal, this.timeout)

    const pathInput = modal.$("input[data-role='saved-location-path']")
    await pathInput.waitForDisplayed()
    await pathInput.clearValue()
    await pathInput.setValue(path)

    const iconButton = modal.$(`button[data-role='saved-location-icon-option'][data-icon='${icon}']`)
    await iconButton.waitForDisplayed()
    await iconButton.click()

    const saveButton = modal.$("button[data-role='saved-location-save']")
    await saveButton.waitForEnabled()
    await saveButton.click()
    await waitForModalClose(modal, this.timeout)
  }

  async addUploadModalSavedLocation({ path, icon }: { path: string, icon: string }) {
    const modal = await this.uploadTorrentModalVisible()
    const addButton = modal.$("button[data-role='upload-add-saved-location']")
    await addButton.waitForDisplayed()
    await addButton.waitForClickable()
    await addButton.click()

    const savedLocationModal = $("#uploadSavedLocationModal")
    await waitForModalOpen(savedLocationModal, this.timeout)

    const pathInput = savedLocationModal.$("input[data-role='saved-location-path']")
    await pathInput.waitForDisplayed()
    await pathInput.clearValue()
    await pathInput.setValue(path)

    const iconButton = savedLocationModal.$(`button[data-role='saved-location-icon-option'][data-icon='${icon}']`)
    await iconButton.waitForDisplayed()
    await iconButton.click()

    const saveButton = savedLocationModal.$("button[data-role='saved-location-save']")
    await saveButton.waitForEnabled()
    await saveButton.click()
    await waitForModalClose(savedLocationModal, this.timeout)
  }

  async getStoredServerName(serverIndex: number) {
    return await browser.execute((index) => {
      const injector = angular.element(document.body).injector()
      const settingsService = injector.get("settingsService")
      return settingsService.getAllSettingsCopy().servers[index]?.name || ""
    }, serverIndex)
  }
}
