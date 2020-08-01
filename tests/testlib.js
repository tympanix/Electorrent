const fs = require("fs");
const Application = require("spectron").Application;
const path = require("path");
const Docker = require("dockerode");
const http = require("http");
const https = require("https");
const sync = require("@wdio/sync").default;

var docker = new Docker();

var electronPath = path.join(__dirname, "..", "node_modules", ".bin", "electron");

if (process.platform === "win32") {
  electronPath += ".cmd";
}

const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time));

function httpget(options) {
  return new Promise((resolve, reject) => {
    let req = http.get(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve(res);
      });
    });

    req.on("error", (err) => {
      reject(err);
    });
  });
}

function pullImage(image) {
  console.log(`=> Pulling ${image}`);
  return new Promise((resolve, reject) => {
    docker.pull(image, (err, stream) => {
      let message = "";
      if (err) return reject(err);
      stream.on("data", (data) => (message += data));
      stream.on("end", () => resolve(message));
      stream.on("error", (err) => reject(err));
    });
  });
}

var appPath = path.join(__dirname, "..", "app");
exports.testclient = function ({
  client,
  dockerContainer,
  username = "admin",
  password = "admin",
  host = "127.0.0.1",
  port = 8080,
  containerPort = 8080,
  acceptHttpStatus = 200,
  timeout = 10 * 1000,
  stopLabel = "Stopped",
  downloadLabel = "Downloading",
  skipTests = [],
}) {
  describe(`test ${client}`, function () {
    let app;
    let container;
    let $;
    let $$;
    this.timeout(500 * 1000);

    before(async function () {
      //await pullImage(dockerContainer);
      console.log("Pulled image");
      portMap = `${containerPort}/tcp`;
      container = await docker.createContainer({
        Image: dockerContainer,
        Env: ["PUID=1000", "PGID=1000", "TZ=Europe/London", "WEBUI_PORT=8080"],
        HostConfig: {
          PortBindings: {
            [portMap]: [
              {
                HostPort: port.toString(),
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
      let i = 0;
      while (true) {
        if (i > 50) {
          throw Error("Service never started");
        }
        try {
          let res = await httpget(`http://${host}:${port}`);
          console.log("Polling http:", res.statusCode);
          if (res.statusCode === acceptHttpStatus) {
            break;
          }
        } catch (err) {
          console.log("... waiting for serivce");
        }
        await sleep(500);
        i++;
      }
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
      $ = app.client.$.bind(app.client);
      $$ = app.client.$$.bind(app.client);

      console.log($.constructor.name);
      return app.client.waitUntilWindowLoaded();
    });

    it("tests the title", function () {
      //return app.client.waitUntilWindowLoaded().getTitle().should.eventually.equal("Electorrent");
    });

    it("login to the client", () => {
      return sync(() => {
        $("#connection-host").setValue(host);
        $("#connection-proto").click();
        $("#connection-proto-http").waitForExist();
        $("#connection-proto-http").click();
        $("#connection-user").setValue(username);
        $("#connection-password").setValue(password);
        $("#connection-client").click();
        $(`#connection-client-${client}`).waitForExist();
        $(`#connection-client-${client}`).click();
        $("#connection-port").setValue(port);
        $("#connection-submit").click();

        $("#page-torrents").waitForDisplayed({ timeout });
      });
    });

    it("upload torrent file", () => {
      return sync(() => {
        const query = "#torrentTable tbody tr td";

        console.log("Wait for empty list...");
        $(query).waitForExist({ timeout: 500, reverse: true });
        let filename = "ubuntu-20.04-live-server-amd64.iso.torrent";
        console.log("Reading data...");
        let data = fs.readFileSync(path.join(__dirname, "data", filename));
        app.webContents.send("torrentfiles", data, path.basename(filename));
        console.log("Uploaded torrent...");

        $(query).waitForExist({ timeout });
        let torrent = $$(query).map((v) => v.getText());
        torrent[0].should.contain("ubuntu");
      });
    });

    it("wait for download to begin", () => {
      return sync(() => {
        const query = "#torrentTable tbody tr";

        $(query).waitUntil(
          async function () {
            return (await this.getText()).includes(downloadLabel);
          },
          { timeout }
        );
      });
    });

    it("stop the torrent", () => {
      const query = "#torrentTable tbody tr";
      const button = "#torrent-action-header a[data-role=stop]";

      return sync(() => {
        $(query).waitForExist();
        $(query).click();
        $(button).waitForEnabled();
        $(button).click();

        $(query).waitUntil(
          async function () {
            return (await this.getText()).includes(stopLabel);
          },
          { timeout }
        );
      });
    });

    it("resume the torrent", () => {
      const query = "#torrentTable tbody tr";
      const button = "#torrent-action-header a[data-role=resume]";

      return sync(() => {
        $(query).waitForExist();
        $(query).click();
        $(button).waitForEnabled();
        $(button).click();

        $(query).waitUntil(
          async function () {
            return (await this.getText()).includes(downloadLabel);
          },
          { timeout }
        );
      });
    });

    describe("test labels", function () {
      before(function () {
        if (skipTests.includes("labels")) return this.skip();
      });

      it("apply new label", async function () {
        const query = "#torrentTable tbody tr";
        const labels = "#torrent-action-header div[data-role=labels]";
        const testlabel = "testlabel123";

        return sync(() => {
          $(query).click();
          $(labels).click();
          $(labels + " > div.menu").waitForDisplayed();
          $(labels + " div[data-role=new-label]").click();
          $("#newLabelModal").waitForDisplayed();
          $("#newLabelModal input[name=label]").setValue(testlabel);
          $("#newLabelModal button[type=submit]").click();

          $(query).waitUntil(
            async function () {
              return (await this.getText()).includes(testlabel);
            },
            { timeout }
          );
        });
      });

      it("ensure label entry in dropdown", function () {
        const query = "#torrentTable tbody tr";
        const labels = "#torrent-action-header div[data-role=labels]";
        const testlabel = "testlabel123";
        const labelBtn = labels + ` div[data-label='${testlabel}']`;

        return sync(() => {
          $(query).click();
          $(labels).click();
          $(labelBtn).waitForExist();
          $(labelBtn).getText().should.contain(testlabel);
          $(labels).click();
        });
      });

      it("apply another new label", async function () {
        const query = "#torrentTable tbody tr";
        const labels = "#torrent-action-header div[data-role=labels]";
        const testlabel = "someotherlabel123";

        return sync(() => {
          $(query).click();
          $(labels).click();
          $(labels + " > div.menu").waitForDisplayed();
          $(labels + " div[data-role=new-label]").click();
          $("#newLabelModal").waitForDisplayed();
          $("#newLabelModal input[name=label]").setValue(testlabel);
          $("#newLabelModal button[type=submit]").click();

          $(query).waitUntil(
            async function () {
              return (await this.getText()).includes(testlabel);
            },
            { timeout }
          );
        });
      });

      it("change back to previous label", async function () {
        const query = "#torrentTable tbody tr";
        const labels = "#torrent-action-header div[data-role=labels]";
        const testlabel = "testlabel123";

        return sync(() => {
          $(query).click();
          $(labels).click();
          $(labels + " > div.menu").waitForDisplayed();
          $(labels + ` div[data-label='${testlabel}']`).click();

          $(query).waitUntil(
            async function () {
              return (await this.getText()).includes(testlabel);
            },
            { timeout }
          );
        });
      });
    });

    describe("clean up", function () {
      it("delete torrent", async function () {
        const query = "#torrentTable tbody tr";
        const button = "#contextmenu a[data-role=delete]";

        return sync(() => {
          $(query).waitForExist();
          $(query).click({ button: "right" });
          $("#contextmenu").waitForExist();

          let visible = $(button).isDisplayed();

          if (!visible) {
            let submenu = $(button).$("..").$("..");
            submenu.moveTo();
            let firstItem = submenu.$(".item:first-child");
            firstItem.moveTo();
          }

          $("#contextmenu a[data-role=delete]").click();
          $(query).waitForExist({ timeout, reverse: true });
        });
      });
    });
  });
};
