import { Application } from "spectron"
const { askQuestion } = require("./testutil")
import path = require("path");
import http = require("http");
import e2e = require("./e2e");
import compose = require("docker-compose")

var electronPath = path.join(__dirname, "..", "node_modules", ".bin", "electron");

if (process.platform === "win32") {
  electronPath += ".cmd";
}

const sleep = (time: number) => new Promise((resolve) => setTimeout(resolve, time));

function httpGet(options: http.RequestOptions): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    let req = http.get(options, (res) => {
      res.on("end", () => resolve(res));
    });
    req.on("error", (err) => reject(err));
  });
}

/**
 *
 * @param param0
 */
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

interface TestSuiteOptions {
  test: string,
  client: string,
  fixture: string,
  username: string,
  password: string,
  host: string,
  port: number,
  acceptHttpStatus: number,
  timeout: number,
  stopLabel: string,
  downloadLabel: string,
  skipTests: Array<string>,
}

const TEST_SUITE_OPTIONS_DEFAULT: Partial<TestSuiteOptions> = {
  username: "admin",
  password: "admin",
  host: "127.0.0.1",
  port: 8080,
  acceptHttpStatus: 200,
  timeout: 10*1000,
  stopLabel: "Stopped",
  downloadLabel: "Downloading",
  skipTests: [],
}

exports.testclient = function (optionsArg: TestSuiteOptions) {
  let options = Object.assign({}, TEST_SUITE_OPTIONS_DEFAULT, optionsArg)

  describe(`given ${options.test || options.client} service is running (docker-compose)`, function () {
    this.timeout(500 * 1000);

    before(async function () {
      const composeDir = path.join(__dirname, options.fixture)
      await compose.upAll({ cwd: composeDir, log: !!process.env.DEBUG, commandOptions: ['--build'] })
      waitForHttp({ url: `http://${options.host}:${options.port}`, statusCode: options.acceptHttpStatus})
    });

    after(async function () {
      if (!process.env.MOCHA_DOCKER_KEEP) {
        await compose.down({ cwd: path.join(__dirname, options.fixture), log: !!process.env.DEBUG })
      }
    });

    describe("given application is running", function() {
      let app;
      let $;
      let $$;
      let tapp: e2e.App;

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
          this.retries(5)
          await tapp.login({
            username: options.username,
            password: options.password,
            host: options.host,
            port: options.port,
            client: options.client,
          });
        })

        describe("given new torrent is uploaded", async function() {
          let torrent: e2e.Torrent

          before(async function() {
            try {
              this.retries(3)
              let filename = path.join(__dirname, 'data/shared/test-100k.bin.torrent')
              torrent = await tapp.uploadTorrent({ filename: filename });
            } finally {
              this.timeout(Math.pow(2, 32))
              await askQuestion("Test paused. Press any key to continue: ")
            }
          })

          after(async function() {
            if (torrent) {
              await torrent.clickContextMenu("delete");
              await torrent.waitForGone();
            }
          })

          it("wait for download to begin", () => {
            return torrent.waitForState(options.downloadLabel);
          });

          it("torrent should be in downloading tab", () => {
            return torrent.checkInState(["all", "downloading"]);
          });

          it("stop the torrent", async () => {
            await torrent.stop({ state: options.stopLabel });
          });

          it("check torrent in stopped tab", () => {
            return torrent.checkInState(["all", "stopped"]);
          });

          it("resume the torrent", async () => {
            await torrent.resume({ state: options.downloadLabel });
          });

          describe("given labels are supported", function () {
            before(function () {
              if (options.skipTests.includes("labels")) return this.skip();
            });

            it("apply new label", async function () {
              const label = "testlabel123";
              await torrent.newLabel(label);
              await tapp.waitForLabelInDropdown(label);
              await tapp.getAllSidebarLabels().should.eventually.have.length(1);
            });

            it("apply another new label", async () => {
              const label = "someotherlabel123";
              await torrent.newLabel(label);
              await tapp.waitForLabelInDropdown(label);
              await torrent.checkInFilterLabel(label);
              await tapp.getAllSidebarLabels().should.eventually.have.length(2);
            });

            it("change back to previous label", async () => {
              const label = "testlabel123";
              await torrent.changeLabel(label);
              await torrent.checkInFilterLabel(label);
            });
          });
        })

        describe("given advanced upload options are supported", async function() {

          before(async function() {
            return this.skip()
            //if (options.skipTests.includes("upload options")) return this.skip();
          })

          describe("given torrent uploaded with advanced options", async function() {
            let torrent: e2e.Torrent

            before(async function() {
              let filename = path.join(__dirname, 'data/shared/test-100k.bin.torrent')
              torrent = await tapp.uploadTorrent({ filename: filename, askUploadOptions: true });
            })

            after(async function() {
              if (torrent) {
                await torrent.clickContextMenu("delete");
                await torrent.waitForGone();
              }
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
