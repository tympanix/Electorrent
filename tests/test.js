const fs = require("fs");
const Application = require("spectron").Application;
const path = require("path");
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const Docker = require("dockerode");

var docker = new Docker();

var electronPath = path.join(__dirname, "..", "node_modules", ".bin", "electron");

if (process.platform === "win32") {
  electronPath += ".cmd";
}

var appPath = path.join(__dirname, "..", "app");

global.before(function () {
  chai.should();
  chai.use(chaiAsPromised);
});

describe("test qbittorrentest", function() {
  let app;
  this.timeout(20000);

  before(function () {
    app = new Application({
      path: electronPath,
      args: [appPath],
      webdriverOptions: {
        "deprecationWarnings": false
      }
    });
    return app.start();
  });

  after(function () {
    if (app && app.isRunning()) {
      return app.stop();
    }
  });

  it("open the app", function () {
    return app.client.waitUntilWindowLoaded().getWindowCount().should.eventually.equal(1);
  });

  it("tests the title", function () {
    return app.client.waitUntilWindowLoaded().getTitle().should.eventually.equal("Electorrent");
  });

  it("login to the client", async function () {
    await app.client
      .setValue("#connection-host", "127.0.0.1")
      .click("#connection-proto")
      .waitForExist("#connection-proto-http")
      .click("#connection-proto-http")
      .setValue("#connection-user", "admin")
      .setValue("#connection-password", "adminadmin")
      .click("#connection-client")
      .waitForExist("#connection-client-qbittorrent")
      .click("#connection-client-qbittorrent")
      .setValue("#connection-port", 8080)
      .click("#connection-submit");

    await app.client.waitForVisible("#page-torrents", 5 * 1000);
  });

  it("upload torrent file", async function () {
    const query = "#torrentTable tbody tr td";

    await app.client.waitForExist(query, 500, true);
    let filename = "ubuntu-20.04-live-server-amd64.iso.torrent";
    let data = fs.readFileSync(path.join(__dirname, "data", filename));
    app.webContents.send("torrentfiles", data, path.basename(filename));

    await app.client.waitForExist(query, 2500);
    let torrent = await app.client.getText(query);
    await torrent[0].should.contain("ubuntu");
  });

  it("stop the torrent", async function () {
    const query = "#torrentTable tbody tr";
    const button = "#torrent-action-header a[data-role=stop]";

    await app.client.waitForExist(query).click(query).waitForEnabled(button).click(button);

    await app.client.waitUntil(async () => {
      let torrent = await app.client.getText(query);
      return torrent.includes("Stopped");
    });
  });

  it("resume the torrent", async function () {
    const query = "#torrentTable tbody tr";
    const button = "#torrent-action-header a[data-role=resume]";

    await app.client.waitForExist(query).click(query).waitForEnabled(button).click(button);

    await app.client.waitUntil(async () => {
      let torrent = await app.client.getText(query);
      return torrent.includes("Downloading");
    });
  });

  it("delete torrent", async function () {
    const query = "#torrentTable tbody tr";
    await app.client
      .waitForExist(query)
      .rightClick(query)
      .waitForExist("#contextmenu")
      .click("#contextmenu a[data-role=delete]")
      .waitForExist(query, 2500, true);
  });
});
