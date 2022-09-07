import { Application, SpectronClient } from "spectron";

import fs = require("fs");
import path = require("path");
import { Torrent } from "./e2e_torrent";
import parseTorrent = require("parse-torrent")

/**
 * Class to perform various app-related actions with WebDriverIO
 */
class App {
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

  async login({ host, username, password, port, client }) {
    let hostForm = await this.client.$("#connection-host")
    await hostForm.setValue(host)

    let proto = await this.client.$("#connection-proto")
    await proto.click()

    let protoHttp = await this.client.$("#connection-proto-http")
    await protoHttp.waitForExist()
    await protoHttp.click()

    let user = await this.client.$("#connection-user")
    await user.setValue(username)

    let pass = await this.client.$("#connection-password")
    await pass.setValue(password);

    let clientForm = await this.client.$("#connection-client")
    await clientForm.click();

    let clientFormSelect = await this.client.$(`#connection-client-${client}`)
    await clientFormSelect.waitForExist()
    await clientFormSelect.click()

    let portForm = await this.client.$("#connection-port")
    await portForm.setValue(port);

    let submit = await this.client.$("#connection-submit")
    await submit.click();

    let err = await this.getNotificationError()
    if (err) {
      throw new Error(err.title)
    }

    let pageTorrents = await this.client.$("#page-torrents")
    await pageTorrents.waitForDisplayed({ timeout: this.timeout });
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
    await torrent.waitForExist();
    await torrent.isExisting().should.eventually.be.true;
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

export {
  App
}