const fs = require("fs");
const Application = require("spectron").Application;
const path = require("path");
const Docker = require("dockerode");

var docker = new Docker();

var electronPath = path.join(__dirname, "..", "node_modules", ".bin", "electron");

if (process.platform === "win32") {
  electronPath += ".cmd";
}

var appPath = path.join(__dirname, "..", "app");
exports.testclient = function ({ client, dockerContainer, username, password, host, port }) {
  describe(`test ${client}`, function () {
    let app;
    let container;
    this.timeout(20000);

    before(async function () {
      container = await docker.createContainer({
        Image: dockerContainer,
        Env: ["PUID=1000", "PGID=1000", "TZ=Europe/London", "WEBUI_PORT=8080"],
        HostConfig: {
          PortBindings: {
            "8080/tcp": [
              {
                HostPort: "8080",
              },
            ],
          },
        },
      });
      await container.start({});
      app = new Application({
        path: electronPath,
        args: [appPath],
        webdriverOptions: {
          deprecationWarnings: false,
        },
      });
      return app.start();
    });

    after(async function () {
      if (app && app.isRunning()) {
        await app.stop();
      }
      if (container) {
        await container.stop();
        await container.remove();
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
        .setValue("#connection-host", host)
        .click("#connection-proto")
        .waitForExist("#connection-proto-http")
        .click("#connection-proto-http")
        .setValue("#connection-user", username)
        .setValue("#connection-password", password)
        .click("#connection-client")
        .waitForExist(`#connection-client-${client}`)
        .click(`#connection-client-${client}`)
        .setValue("#connection-port", port)
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
      }, 2500);
    });

    it("apply new label", async function () {
      const query = "#torrentTable tbody tr";
      const labels = "#torrent-action-header div[data-role=labels]";
      const testlabel = "testlabel123";

      await app.client
        .click(query)
        .click(labels)
        .waitForVisible(labels + " > div.menu")
        .click(labels + " div[data-role=new-label]")
        .waitForVisible("#newLabelModal")
        .setValue("#newLabelModal input[name=label]", testlabel)
        .click("#newLabelModal button[type=submit]");

      await app.client.waitUntil(async () => {
        let torrent = await app.client.getText(query);
        return torrent.includes(testlabel);
      }, 2500);
    });

    it("ensure label entry in dropdown", async function () {
      const query = "#torrentTable tbody tr";
      const labels = "#torrent-action-header div[data-role=labels]";
      const testlabel = "testlabel123";

      await app.client
        .click(query)
        .click(labels)
        .waitForExist(labels + ` div[data-label='${testlabel}']`);

      await app.client.getText(labels + ` div[data-label='${testlabel}']`).should.eventually.contain(testlabel);

      await app.client.click(labels);
    });

    it("apply another new label", async function () {
      const query = "#torrentTable tbody tr";
      const labels = "#torrent-action-header div[data-role=labels]";
      const testlabel = "someotherlabel123";

      await app.client
        .click(query)
        .click(labels)
        .waitForVisible(labels + " > div.menu")
        .click(labels + " div[data-role=new-label]")
        .waitForVisible("#newLabelModal")
        .setValue("#newLabelModal input[name=label]", testlabel)
        .click("#newLabelModal button[type=submit]");

      await app.client.waitUntil(async () => {
        let torrent = await app.client.getText(query);
        return torrent.includes(testlabel);
      });
    });

    it("change back to previous label", async function () {
      const query = "#torrentTable tbody tr";
      const labels = "#torrent-action-header div[data-role=labels]";
      const testlabel = "testlabel123";

      await app.client
        .click(query)
        .click(labels)
        .waitForVisible(labels + " > div.menu")
        .click(labels + ` div[data-label='${testlabel}']`);

      await app.client.waitUntil(async () => {
        let torrent = await app.client.getText(query);
        return torrent.includes(testlabel);
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
};
