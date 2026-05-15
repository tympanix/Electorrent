import fs = require("fs");
import path = require("path");
import magnet from "magnet-uri"
import { Torrent } from "./e2e_torrent";
import parseTorrent = require("parse-torrent")
import { browser, $, $$, expect } from '@wdio/globals'
import { TorrentClient } from "../../src/renderer/app/bittorrent"
import { assert } from "chai";

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
    let hostForm = $("#connection-host")
    await hostForm.waitForDisplayed()
    await hostForm.setValue(options.host)

    let protoField = $("#connection-proto")
    await protoField.waitForDisplayed()
    await protoField.waitForClickable()
    await protoField.click()

    let proto = options.https ? 'https' : 'http'
    let protoHttp = $(`#connection-proto-${proto}`)
    await protoHttp.waitForDisplayed()
    await protoHttp.waitForClickable()
    await protoHttp.click()

    let user = $("#connection-user")
    await user.waitForDisplayed()
    await user.setValue(options.username)

    let pass = $("#connection-password")
    await pass.waitForDisplayed()
    await pass.setValue(options.password);

    let clientForm = $("#connection-client")
    await clientForm.waitForDisplayed()
    await clientForm.waitForClickable()
    await clientForm.click();

    let clientFormSelect = $(`#connection-client-${options.client.id}`)
    await clientFormSelect.waitForDisplayed()
    await clientFormSelect.waitForClickable()
    await clientFormSelect.click()

    let portForm = $("#connection-port")
    await portForm.waitForDisplayed()
    await portForm.setValue(options.port);

    let submit = $("#connection-submit")
    await submit.waitForDisplayed()
    await submit.waitForClickable()
    await submit.click();
  }

  async torrentsPageIsVisible(opts?: { timeout: number }) {
    let pageTorrents = $("#page-torrents")
    await pageTorrents.waitForDisplayed({ timeout: opts?.timeout ?? this.timeout })
  }

  async settingsPageIsVisible(opts?: { timeout: number }) {
    let settingsPage = $("#page-settings")
    await settingsPage.waitForDisplayed({ timeout: opts?.timeout ?? this.timeout })
  }

  async settingsPageConnectionIsVisible() {
    let settingsPage = $("#page-settings-connection")
    await settingsPage.waitForDisplayed({ timeout: this.timeout })
  }

  async certificateModalIsVisible() {
    let certificateModal = $("#certificateModal")
    await certificateModal.waitForExist()
    await certificateModal.waitForDisplayed({ timeout: this.timeout })
    return certificateModal
  }

  async acceptCertificate() {
    let certificateModal = await this.certificateModalIsVisible()
    let submit = certificateModal.$("button.approve")
    await submit.waitForExist()
    await submit.waitForDisplayed()
    await submit.waitForClickable()
    await submit.waitForEnabled()
    await submit.click()
  }

  async getNotificationError() {
      let msg = $("#notifications .negative")
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
    let modal = $("#uploadTorrentModal")
    await modal.waitForDisplayed()
    return modal
  }

  async uploadTorrentModalSubmit(options?: { label?: string, start?: boolean, name?: string, saveLocation?: string }) {
    let modal = await this.uploadTorrentModalVisible()
    await browser.pause(200)

    if (options?.name) {
      let nameInput = modal.$("input[data-action='rename-torrent']")
      await nameInput.waitForDisplayed()
      await nameInput.setValue(options.name)
    }

    if (options?.saveLocation) {
      let saveLocationInput = modal.$("input[data-action='save-location']")
      await saveLocationInput.waitForDisplayed()
      await saveLocationInput.setValue(options.saveLocation)
    }

    if (options?.start !== undefined) {
      let startToggle = modal.$(`div[data-action="start-torrent"] > input`)
      await startToggle.waitForExist()
      if (await startToggle.isSelected() !== options.start) {
        await startToggle.click()
      }
    }

    if (options?.label) {
      let labelElem = modal.$("div[title=Label]")
      await labelElem.waitForClickable()
      await labelElem.click()
      let labelItemElem = labelElem.$(`div[data-label='${options.label}']`)
      await labelItemElem.waitForDisplayed()
      await labelItemElem.click()
    }

    await browser.pause(250)
    let submitBtn = modal.$("button[type=submit]")
    await submitBtn.click()
    await modal.waitForDisplayed({ reverse: true })
  }

  async uploadTorrent({ filename, askUploadOptions }: { filename: string, askUploadOptions?: boolean }) {
    let data = fs.readFileSync(path.join(filename));
    let info = parseTorrent(data)
    let hash = info.infoHash
    let torrent = new Torrent({ hash: hash, app: this });
    await expect(await torrent.isExisting()).toBe(false);
    await browser.execute((data, filename, askUploadOptions) => {
      const injector = angular.element(document.body).injector()
      const $rootScope = injector.get("$rootScope")
      $rootScope.$broadcast("torrents:add", {
        type: "file",
        data: new Uint8Array(data),
        filename,
      }, !!askUploadOptions)
      $rootScope.$apply()
    }, Array.from(data), path.basename(filename), askUploadOptions)
    this.torrents.push(torrent);
    return torrent;
  }

  async uploadMagnetLink({ magnetUri, filename, options }: { magnetUri?: string, filename?: string, options?: magnet.Instance }) {
    if (!magnetUri && filename) {
      let data = fs.readFileSync(filename)
      let info = parseTorrent(data)
      magnetUri = magnet.encode({
        xt: [`urn:btih:${info.infoHash}`],
        tr: info.announce,
      })
    }
    if (!magnetUri) throw new Error("invalid arguments passed to generate magnet uri")
    let info = parseTorrent(magnetUri)
    let torrent = new Torrent({ hash: info.infoHash, app: this })
    await browser.execute((magnetUri) => {
      const injector = angular.element(document.body).injector()
      const $rootScope = injector.get("$rootScope")
      $rootScope.$broadcast("torrents:add", {
        type: "link",
        uri: magnetUri,
      }, false)
      $rootScope.$apply()
    }, magnetUri)
    this.torrents.push(torrent)
    return torrent
  }

  async waitForLabelInDropdown(labelName) {
    const labels = "#torrent-action-header div[data-role=labels]";
    const labelBtn = `div[data-label='${labelName}']`;

    let labelsElem = $(labels)
    await labelsElem.click()

    let labelBtnElem = labelsElem.$(labelBtn)
    await labelBtnElem.waitForDisplayed()

    let labelText = await labelBtnElem.getText()
    labelText.should.contain(labelName)

    await browser.pause(200)
    await labelsElem.click()
    await labelBtnElem.waitForDisplayed({ reverse: true })
  }

  async getTorrents() {
    const table = "#torrentTable tbody tr";
    let torrents = $$(table)
    let data = torrents.map(
      async (e) => new Torrent({ hash: await e.getAttribute("data-hash"), app: this })
    );
    return await data
  }

  async getSelectedTorrents() {
    const table = "#torrentTable tbody tr.active";
    let tableElem = $$(table)
    let data = tableElem.map(async (e) => {
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
    let labelsElem = $$("#torrent-sidebar-labels li")
    let data = labelsElem.map(async (e) => await e.getAttribute("data-label"));
    let labels = await data
    return labels || [];
  }

  async getTorrentsFooterText() {
    return await $("#page-torrents .status-bar").getText()
  }

  async openSettings() {
    await browser.execute(() => {
      const injector = angular.element(document.body).injector()
      const $rootScope = injector.get("$rootScope")
      $rootScope.$broadcast("show:settings")
      $rootScope.$apply()
    })
    await this.settingsPageIsVisible()
  }

  async settingsGotoTab(tab: string) {
    await browser.execute((tab) => {
      const scope = angular.element(document.querySelector('settings-page')).scope() as any
      scope.gotoPage(tab)
      scope.$apply()
    }, tab)
  }

  async settingsSave() {
    const saveBtn = $("#page-settings .actions.footer a.positive")
    await saveBtn.waitForDisplayed()
    await saveBtn.waitForClickable()
    await saveBtn.click()
  }

  async settingsCancel() {
    const cancelBtn = $("#page-settings .actions.footer a.deny")
    await cancelBtn.waitForDisplayed()
    await cancelBtn.waitForClickable()
    await cancelBtn.click()
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
    await modal.waitForDisplayed()
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
    await modal.waitForDisplayed({ reverse: true })

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
    await modal.waitForDisplayed({ reverse: true })
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

  async getGeneralDropdownOptions(settingName: string): Promise<string[]> {
    const card = await this.getGeneralSettingsCard(settingName)
    const dropdown = card.$(".ui.selection.dropdown")
    await dropdown.waitForClickable()
    await dropdown.click()

    const options = await dropdown.$$(".menu .item")
    const values: string[] = []
    for (const option of options) {
      values.push((await option.getText()).trim())
    }
    await dropdown.click()
    return values.filter(Boolean)
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

  async getStoredServerName(serverIndex: number) {
    return await browser.execute((index) => {
      const injector = angular.element(document.body).injector()
      const config = injector.get("configService")
      return config.getAllSettingsCopy().servers[index]?.name || ""
    }, serverIndex)
  }
}
