const fs = require("fs");
const Application = require("spectron").Application;
const path = require("path");
const http = require("http");
const https = require("https");
const e2e = require("./e2e");
const sync = require("@wdio/sync").default;
const compose = require("docker-compose")

var electronPath = path.join(__dirname, "..", "node_modules", ".bin", "electron");

if (process.platform === "win32") {
  electronPath += ".cmd";
}

const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time));

function httpGet(options) {
  return new Promise((resolve, reject) => {
    let req = http.get(options, (res) => {
      res.on("end", () => resolve(res));
    });
    req.on("error", (err) => reject(err));
  });
}

async function waitForHttp({ url, statusCode=200, timeout=20000, step=1000 }) {
  let timeSpent = 0;
  while (true) {
    if (timeSpent > timeout) {
      throw Error(`Timeout waiting for ${url}`);
    }
    try {
      let res = await httpGet(url);
      if (res.statusCode === statusCode) {
        break;
      }
    } catch (err) { }
    await sleep(step)
    timeSpent += step
  }
}

var appPath = path.join(__dirname, "..", "app");

exports.testclient = function ({
  test,
  client,
  fixture,
  username = "admin",
  password = "admin",
  host = "127.0.0.1",
  port = 8080,
  acceptHttpStatus = 200,
  timeout = 10 * 1000,
  stopLabel = "Stopped",
  downloadLabel = "Downloading",
  skipTests = [],
}) {
  describe(`given ${test || client} service is running (docker-compose)`, function () {
    this.timeout(500 * 1000);

    before(async function () {
      const composeDir = path.join(__dirname, fixture)
      await compose.upAll({ cwd: composeDir, log: process.env.DEBUG, commandOptions: ['--build'] })
      waitForHttp({ url: `http://${host}:${port}`, statusCode: acceptHttpStatus})

      it("Test something", function() {
        throw Error("Oh noes!")
      })
    });

    after(async function () {
      if (!process.env.MOCHA_DOCKER_KEEP) {
        await compose.down({ cwd: path.join(__dirname, fixture), log: process.env.DEBUG })
      }
    });

    describe("given application is running", function() {
      let app;
      let $;
      let $$;
      let tapp;

      before(async function() {
        app = new Application({
          path: electronPath,
          args: [appPath],
          webdriverOptions: {
            deprecationWarnings: false,
          },
          chromeDriverArgs: [
            "no-sandbox"
          ]
        });
        await app.start();
        $ = app.client.$.bind(app.client);
        $$ = app.client.$$.bind(app.client);
        tapp = new e2e.App(app);
        await app.client.setTimeout({ implicit: 0 });
        await app.client.waitUntilWindowLoaded();
      })

      after(async function() {
        if (app && app.isRunning()) {
          await app.stop();
        }
      })

      describe("given user is logged in", function() {

        before(async function() {
          await tapp.login({
            username: username,
            password: password,
            host: host,
            port: port,
            client: client,
          });
        })

        describe("given torrent is uploaded", async function() {

          before(async function() {
            let filename = path.join(__dirname, 'data/shared/test-100k.bin.torrent')
            await tapp.uploadTorrent({ filename: filename });
          })

          after(async function() {
            let torrent = tapp.torrents[0];
            await torrent.clickContextMenu("delete");
            await torrent.waitForGone();
          })

          it("wait for download to begin", () => {
            return tapp.torrents[0].waitForState(downloadLabel);
          });

          it("torrent should be in downloading tab", () => {
            let t = tapp.torrents[0];
            return t.checkInState(["all", "downloading"]);
          });

          it("stop the torrent", async () => {
            let t = tapp.torrents[0];
            await t.stop({ state: stopLabel });
          });

          it("check torrent in stopped tab", () => {
            let t = tapp.torrents[0];
            return t.checkInState(["all", "stopped"]);
          });

          it("resume the torrent", async () => {
            let t = tapp.torrents[0];
            await t.resume({ state: downloadLabel });
          });

          describe("given labels are supported", function () {
            before(function () {
              if (skipTests.includes("labels")) return this.skip();
            });

            it("apply new label", async function () {
              const label = "testlabel123";
              let t = tapp.torrents[0];
              await t.newLabel(label);
              await tapp.waitForLabelInDropdown(label);
              await tapp.getAllSidebarLabels().should.eventually.have.length(1);
            });

            it("apply another new label", async () => {
              const label = "someotherlabel123";
              let t = tapp.torrents[0];
              await t.newLabel(label);
              await tapp.waitForLabelInDropdown(label);
              await t.checkInFilterLabel(label);
              await tapp.getAllSidebarLabels().should.eventually.have.length(2);
            });

            it("change back to previous label", async () => {
              const label = "testlabel123";
              let t = tapp.torrents[0];
              await t.changeLabel(label);
              await t.checkInFilterLabel(label);
            });
          });
        })

        describe("given advanced upload options are supported", async function() {

          before(async function() {
            if (skipTests.includes("upload options")) return this.skip();
          })

          describe("given torrent uploaded with advanced options", async function() {

            before(async function() {
              let filename = path.join(__dirname, 'data/shared/test-100k.bin.torrent')
              await tapp.uploadTorrent({ filename: filename, askUploadOptions: true });
            })

            after(async function() {
              let torrent = tapp.torrents[0];
              await torrent.clickContextMenu("delete");
              await torrent.waitForGone();
            })

            it("torrent has label already set", function() {
              // TODO: Check that torrent label is set
            })
          })
        })
      })
    })
  });
};
