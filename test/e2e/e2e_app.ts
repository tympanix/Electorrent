import { Application, SpectronClient } from "spectron";

import fs = require("fs");
import path = require("path");
import { Torrent } from "./e2e_torrent";
import parseTorrent = require("parse-torrent")

/**
 * Options to use during the login screen of the app to connect to your torrent client
 */
export interface LoginOptions {
  host: string
  username: string
  password: string
  port: number
  client: string
  https?: boolean
}

/**
 * Class to perform various app-related actions with WebDriverIO
 */
export class App {
  spectron: Application
  client: SpectronClient
  torrents: Array<Torrent>
  timeout: number

  constructor(spectron: Application) {
    this.spectron = spectron;
    this.client = this.spectron.client;
    this.torrents = [];
    this.timeout = 5 * 1000;
  }

  async login(options: LoginOptions) {
    let hostForm = await this.client.$("#connection-host")
    await hostForm.setValue(options.host)

    let protoField = await this.client.$("#connection-proto")
    await protoField.click()

    let proto = options.https ? 'https' : 'http'
    let protoHttp = await this.client.$(`#connection-proto-${proto}`)
    await protoHttp.waitForExist()
    await protoHttp.click()

    let user = await this.client.$("#connection-user")
    await user.setValue(options.username)

    let pass = await this.client.$("#connection-password")
    await pass.setValue(options.password);

    let clientForm = await this.client.$("#connection-client")
    await clientForm.click();

    let clientFormSelect = await this.client.$(`#connection-client-${options.client}`)
    await clientFormSelect.waitForExist()
    await clientFormSelect.click()

    let portForm = await this.client.$("#connection-port")
    await portForm.setValue(options.port);

    let submit = await this.client.$("#connection-submit")
    await submit.click();
  }

  async torrentsPageIsVisible() {
    let pageTorrents = await this.client.$("#page-torrents")
    await pageTorrents.waitForDisplayed({ timeout: this.timeout })
  }

  async certificateModalIsVisible() {
    let certificateModal = await this.client.$("#certificateModal")
    await certificateModal.waitForExist()
    await certificateModal.waitForDisplayed({ timeout: this.timeout })
    return certificateModal
  }

  async acceptCertificate() {
    let certificateModal = await this.certificateModalIsVisible()
    let submit = await certificateModal.$("button.ok")
    await submit.waitForExist()
    await submit.waitForDisplayed()
    await submit.waitForClickable()
    await submit.waitForEnabled()
    await submit.click()
  }

  async getNotificationError() {
      let msg = await this.client.$("#notifications .negative")
      try {
        await msg.waitForExist({ timeout: 1000 })
        return {
          title: await (await msg.$(".header")).getText(),
          message: await (await msg.$("p")).getText()
        }
      } catch {
        return null
      }
  }

  async uploadTorrentModalVisible() {
    let modal = await this.client.$("#uploadTorrnetModal")
    await modal.waitForDisplayed()
    return modal
  }

  async uploadTorrentModalSubmit(options?: { label?: string, start?: boolean, name?: string }) {
    let modal = await this.uploadTorrentModalVisible()
    await this.client.pause(200)

    if (options?.name) {
      let nameInput = await modal.$("input[data-action='rename-torrent']")
      await nameInput.waitForDisplayed()
      await nameInput.setValue(options.name)
    }

    if (options?.start !== undefined) {
      let startToggle = await modal.$(`div[data-action="start-torrent"] > input`)
      await startToggle.waitForExist()
      if (await startToggle.isSelected() !== options.start) {
        await startToggle.click()
      }
    }

    if (options?.label) {
      let labelElem = await modal.$("div[title=Label]")
      await labelElem.waitForClickable()
      await labelElem.click()
      let labelItemElem = await labelElem.$(`div[data-label='${options.label}']`)
      await labelItemElem.waitForDisplayed()
      await labelItemElem.click()
    }

    await this.client.pause(250)
    let submitBtn = await modal.$("button[type=submit]")
    await submitBtn.click()
    await modal.waitForDisplayed({ reverse: true })
  }

  async uploadTorrent({ filename, askUploadOptions }: { filename: string, askUploadOptions?: boolean }) {
    let data = fs.readFileSync(path.join(filename));
    let info = parseTorrent(data)
    let hash = info.infoHash
    let torrent = new Torrent({ hash: hash, spectron: this.spectron, app: this });
    await torrent.isExisting().should.eventually.be.false;
    /**
     * Note: we're not sending the torrent data directory from the main process. Since the
     * spectron test framework communicates with the browser intance, the webContents module
     * is actually retrieved from the browser (using @electron/remote), meaning the IPC calls will
     * take the following route/steps:
     * renderer -> main -> renderer
     * The multiple serialization of the IPC data behaves oddly with objects. We use a plain javascript
     * array here to make the serialization behave properly.
     */
    this.spectron.webContents.send("torrentfiles", Array.from(data), path.basename(filename), askUploadOptions);
    this.torrents.push(torrent);
    return torrent;
  }

  async waitForLabelInDropdown(labelName) {
    const labels = "#torrent-action-header div[data-role=labels]";
    const labelBtn = `div[data-label='${labelName}']`;

    let labelsElem = await this.client.$(labels)
    await labelsElem.click()

    let labelBtnElem = await labelsElem.$(labelBtn)
    await labelBtnElem.waitForDisplayed()

    let labelText = await labelBtnElem.getText()
    labelText.should.contain(labelName)

    await this.client.pause(200)
    await labelsElem.click()
    await labelBtnElem.waitForDisplayed({ reverse: true })
  }

  async getTorrents() {
    const table = "#torrentTable tbody tr";
    let torrents = await this.client.$$(table)
    let data = torrents.map(
      async (e) => new Torrent({ hash: await e.getAttribute("data-hash"), spectron: this.spectron, app: this })
    );
    return await Promise.all(data)
  }

  async getSelectedTorrents() {
    const table = "#torrentTable tbody tr.active";
    let tableElem = await this.client.$$(table)
    let data = tableElem.map(async (e) => {
      return new Torrent({ hash: await e.getAttribute("data-hash"), spectron: this.spectron, app: this })
    })
    return await Promise.all(data)
  }

  async filterLabel(labelName?) {
    const label = `#torrent-sidebar-labels li[data-label="${labelName}"]`;
    const clear = `#torrent-sidebar-labels [data-role="labels-clear"]`;

    if (labelName === undefined) {
      await (await this.client.$(clear)).click()
    } else {
      await (await this.client.$(label)).click()
    }
  }

  async getAllSidebarLabels() {
    let labelsElem = await this.client.$$("#torrent-sidebar-labels li")
    let data = labelsElem.map(async (e) => await e.getAttribute("data-label"));
    return await Promise.all(data)
  }
}
