const fs = require("fs");
const path = require("path");
const sync = require("@wdio/sync").default;
const { Torrent } = require("./e2e_torrent");
const parseTorrent = require("parse-torrent")

/**
 * Class to perform various app-related actions with WebDriverIO
 */
class App {
  constructor(spectron) {
    this.spectron = spectron;
    this.browser = this.spectron.client;
    this.$ = this.browser.$.bind(this.browser);
    this.$$ = this.browser.$$.bind(this.browser);
    this.torrents = [];
    this.timeout = 5 * 1000;
  }

  async login({ host, username, password, port, client }) {
    return sync(() => {
      this.$("#connection-host").setValue(host);
      this.$("#connection-proto").click();
      this.$("#connection-proto-http").waitForExist();
      this.$("#connection-proto-http").click();
      this.$("#connection-user").setValue(username);
      this.$("#connection-password").setValue(password);
      this.$("#connection-client").click();
      this.$(`#connection-client-${client}`).waitForExist();
      this.$(`#connection-client-${client}`).click();
      this.$("#connection-port").setValue(port);
      this.$("#connection-submit").click();

      let err = this.getNotificationError()
      if (err) {
        throw new Error(err.title)
      }
      this.$("#page-torrents").waitForDisplayed({ timeout: this.timeout });
    });
  }

  getNotificationError() {
      let msg = this.$("#notifications .negative")
      try {
        msg.waitForExist({ timeout: 1000 })
        return {
          title: msg.$(".header").getText(),
          message: msg.$("p").getText()
        }
      } catch {
        return null
      }
  }

  async uploadTorrent({ filename, askUploadOptions }) {
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
    const labelBtn = labels + ` div[data-label='${labelName}']`;

    return sync(() => {
      this.$(labels).click();
      this.$(labelBtn).waitForDisplayed();
      this.$(labelBtn).getText().should.contain(labelName);
      this.$(labels).click();
      this.$(labelBtn).waitForDisplayed({ reverse: true });
    });
  }

  async getTorrents() {
    const table = "#torrentTable tbody tr";
    return sync(() => {
      return this.$$(table).map(
        (e) => new Torrent({ hash: e.getAttribute("data-hash"), spectron: this.spectron, app: this })
      );
    });
  }

  async getSelectedTorrents() {
    const table = "#torrentTable tbody tr.active";
    return sync(() => {
      return this.$$(table).map(
        (e) => new Torrent({ hash: e.getAttribute("data-hash"), spectron: this.spectron, app: this })
      );
    });
  }

  async filterLabel(labelName) {
    const label = `#torrent-sidebar-labels li[data-label="${labelName}"]`;
    const clear = `#torrent-sidebar-labels [data-role="labels-clear"]`;

    return sync(() => {
      if (labelName === undefined) {
        this.$(clear).click();
      } else {
        this.$(label).click();
      }
    });
  }

  async getAllSidebarLabels() {
    const labels = `#torrent-sidebar-labels li`;
    return sync(() => {
      return this.$$(labels).map((e) => e.getAttribute("data-label"));
    });
  }
}

module.exports = {
  App,
};
