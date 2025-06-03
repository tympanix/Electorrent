import fs = require("fs");
import path = require("path");
import magnet from "magnet-uri"
import { Torrent } from "./e2e_torrent";
import parseTorrent = require("parse-torrent")
import { browser, $, $$, expect } from '@wdio/globals'
import { TorrentClient } from "../../src/scripts/bittorrent"
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
    await hostForm.setValue(options.host)

    let protoField = $("#connection-proto")
    await protoField.click()

    let proto = options.https ? 'https' : 'http'
    let protoHttp = $(`#connection-proto-${proto}`)
    await protoHttp.waitForExist()
    await protoHttp.click()

    let user = $("#connection-user")
    await user.setValue(options.username)

    let pass = $("#connection-password")
    await pass.setValue(options.password);

    let clientForm = $("#connection-client")
    await clientForm.click();

    let clientFormSelect = $(`#connection-client-${options.client.id}`)
    await clientFormSelect.waitForExist()
    await clientFormSelect.click()

    let portForm = $("#connection-port")
    await portForm.setValue(options.port);

    let submit = $("#connection-submit")
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
    let submit = certificateModal.$("button.ok")
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
    expect(await torrent.isExisting()).toBe(false);
    /**
     * Note: we're not sending the torrent data directory from the main process. Since the
     * WebdriverIO framework communicates with the browser intance, the webContents module
     * is actually retrieved from the browser (using @electron/remote), meaning the IPC calls will
     * take the following route/steps:
     * renderer -> main -> renderer
     * The multiple serialization of the IPC data behaves oddly with objects. We use a plain javascript
     * array here to make the serialization behave properly.
     */
    await browser.execute((data, filename, askUploadOptions) => {
      const remote = require('@electron/remote')
      remote.getCurrentWindow().webContents.send("torrentfiles", data, filename, askUploadOptions)
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
      const remote = require('@electron/remote')
      remote.getCurrentWindow().webContents.send("magnet", [magnetUri])
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
}
