import path = require("path");
import e2e = require("./e2e");
import { FeatureSet, waitForHttp } from "./testutil"
import { dockerComposeHooks, startApplicationHooks } from "./shared"
import { backendHooks } from "./shared/backend.hook";

interface TestSuiteOptionsOptional {
  client: string,
  fixture: string,
  username: string,
  password: string,
  host?: string,
  port: number,
  proxyPort?: number,
  acceptHttpStatus?: number,
  timeout?: number,
  stopLabel?: string,
  downloadLabel?: string,
  unsupportedFeatures: FeatureSet[]
}

const TEST_SUITE_OPTIONS_DEFAULTS = {
  username: "admin",
  password: "admin",
  host: "localhost",
  port: 8080,
  acceptHttpStatus: 200,
  timeout: 10*1000,
  stopLabel: "Stopped",
  downloadLabel: "Downloading",
}

/**
 * Options given to a test suite execution with information about the backend bittorrent service
 * to be tested, login information, features etc.
 */
export type TestSuiteOptions = TestSuiteOptionsOptional & (typeof TEST_SUITE_OPTIONS_DEFAULTS)

/**
 * Make sure the current test suite defined in `options` supports a certain `feature`. If not,
 * skip all test in the current mocha context
 * @param options test suite options
 * @param feature the feature that is required to continue
 */
function requireFeatureHook(options: TestSuiteOptions, feature: FeatureSet) {
  before(function() {
    if (options.unsupportedFeatures.includes(feature)) {
      this.skip()
    }
  })
}

export function createTestSuite(optionsArg: TestSuiteOptionsOptional) {
  const options: TestSuiteOptions = Object.assign({}, TEST_SUITE_OPTIONS_DEFAULTS, optionsArg)

  describe(`given ${options.client} service is running (docker-compose)`, function () {
    backendHooks([__dirname, options.fixture])

    before(async function () {
      this.timeout(20 * 1000)
      await waitForHttp({ url: `http://${options.host}:${options.port}`, statusCode: options.acceptHttpStatus})
    });

    describe("given tls/ssl reverse proxy is running (docker-compose)", function() {
      // The service name in the docker-compose.yml must be equal to the name of the folder in which it resides
      const backendServiceName = path.basename(options.fixture)

      dockerComposeHooks([__dirname, "shared", "nginx"], {
        env: {
          ... process.env,
          "PROXY_HOST": backendServiceName,
          "PROXY_PORT": (options.proxyPort || options.port).toString(),
        },
      })

      describe("given application is running", function() {
        startApplicationHooks()

        it("user is logging in with https", async function() {
          this.retries(3)
          await this.app.login({ ...options, https: true, port: 8443 })
          await this.app.certificateModalIsVisible()
        })

        it("self signed certificate is accepted", async function() {
          await this.app.acceptCertificate()
          await this.app.torrentsPageIsVisible()
        })
      })
    })

    describe("given application is running", function() {
      startApplicationHooks()

      describe("given user is logged in", function() {

        before(async function() {
          this.retries(3)
          await this.app.login(options)
          await this.app.torrentsPageIsVisible()
        })

        describe("given new torrent is uploaded", async function() {
          let torrent: e2e.Torrent

          before(async function() {
            let filename = path.join(__dirname, 'shared/opentracker/data/shared/test-100k.bin.torrent')
            torrent = await this.app.uploadTorrent({ filename: filename });
          })

          after(async function() {
            if (torrent) {
              await torrent.clickContextMenu("delete");
              await torrent.waitForGone();
            }
          })

          it("torrent should be visible in table", () => {
            return torrent.waitForExist();
          })

          it("wait for download to begin", () => {
            return torrent.waitForState(options.downloadLabel);
          });

          it("torrent should be in downloading tab", () => {
            return torrent.checkInState(["all", "downloading"]);
          });

          it("torrent is stopped and resumed", async function() {
            this.timeout(25 * 1000)
            await torrent.stop({ state: options.stopLabel });
            await torrent.waitForState(options.stopLabel)
            await torrent.checkInState(["all", "stopped"]);
            await torrent.resume({ state: options.downloadLabel });
            await torrent.waitForState(options.downloadLabel)
            await torrent.checkInState(["all", "downloading"])
          })

          describe("given labels are supported", function () {
            requireFeatureHook(options, FeatureSet.Labels)

            it("apply new label", async function () {
              const label = "testlabel123";
              await torrent.newLabel(label);
              await this.app.waitForLabelInDropdown(label);
              await this.app.getAllSidebarLabels().should.eventually.have.length(1);
            });

            it("apply another new label", async function () {
              const label = "someotherlabel123";
              await torrent.newLabel(label);
              await this.app.waitForLabelInDropdown(label);
              await torrent.checkInFilterLabel(label);
              await this.app.getAllSidebarLabels().should.eventually.have.length(2);
            });

            it("change back to previous label", async function () {
              const label = "testlabel123";
              await torrent.changeLabel(label);
              await torrent.checkInFilterLabel(label);
            });
          });
        })
      })
    })

    describe("given advanced upload options are supported", async function() {
      requireFeatureHook(options, FeatureSet.AdvancedUploadOptions)

      describe("given application is running", function() {
        startApplicationHooks()

        describe("given user is logged in", function() {

          this.timeout(20 * 1000)

          before(async function() {
            this.retries(3)
            await this.app.login(options)
            await this.app.torrentsPageIsVisible()
          })

          const filename = path.join(__dirname, 'shared/opentracker/data/shared/test-100k.bin.torrent')

          it("torrent uploaded with default options", async function() {
            let torrent = await this.app.uploadTorrent({ filename: filename, askUploadOptions: true });
            await this.app.uploadTorrentModalSubmit()
            await torrent.waitForExist()
            await torrent.waitForState(options.downloadLabel)
            await torrent.delete()
          })

          it("torent uploaded with preexisting label", async function() {
            const labelName = "mylabel#1"
            let torrent = await this.app.uploadTorrent({ filename: filename });
            await torrent.newLabel(labelName)
            await torrent.delete()

            torrent = await this.app.uploadTorrent({ filename: filename, askUploadOptions: true });
            await this.app.uploadTorrentModalSubmit({ label: labelName })
            await torrent.waitForExist()
            await torrent.getLabel().should.eventually.equal(labelName)
            await torrent.delete()
          })

          it("torrent uploaded in stopped state", async function() {
            let torrent = await this.app.uploadTorrent({ filename: filename, askUploadOptions: true });
            await this.app.uploadTorrentModalSubmit({ start: false })
            await torrent.isExisting()
            await torrent.waitForState(options.stopLabel)
            await torrent.delete()
          })

          it("torrent uploaded with name", async function() {
            const torrentName = "my awesome torrent"
            let torrent = await this.app.uploadTorrent({ filename: filename, askUploadOptions: true });
            await this.app.uploadTorrentModalSubmit({ name: torrentName })
            await torrent.isExisting()
            await torrent.getColumn("decodedName").should.eventually.equal(torrentName)
            await torrent.delete()
          })

          it("torrent uploaded with save location", async function() {
            const saveLocation = "/tmp/custom/save/location"
            await this.backend.exec(["test", "!", "-e", saveLocation])
            let torrent = await this.app.uploadTorrent({ filename: filename, askUploadOptions: true });
            await this.app.uploadTorrentModalSubmit({ saveLocation: saveLocation })
            await torrent.isExisting()
            await torrent.waitForState(options.downloadLabel)
            await this.backend.waitForExec(["test", "-e", saveLocation])
            await torrent.delete()
          })
        })
      })
    })
  })
};
