import path = require("path");
import e2e = require("./e2e");
import compose = require("docker-compose")
import { FeatureSet, waitForHttp } from "./testutil"
import { startApplicationHooks } from "./shared"

interface TestSuiteOptions {
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

const TEST_SUITE_OPTIONS_DEFAULT = {
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

export function createTestSuite(optionsArg: TestSuiteOptions) {
  const options = Object.assign({}, TEST_SUITE_OPTIONS_DEFAULT, optionsArg)

  describe(`given ${options.client} service is running (docker-compose)`, function () {
    this.timeout(500 * 1000);

    before(async function () {
      const composeDir = path.join(__dirname, options.fixture)
      await compose.upAll({ cwd: composeDir, log: !!process.env.DEBUG, commandOptions: ['--build'] })
      await waitForHttp({ url: `http://${options.host}:${options.port}`, statusCode: options.acceptHttpStatus})
    });

    after(async function () {
      if (!process.env.MOCHA_DOCKER_KEEP) {
        await compose.down({ cwd: path.join(__dirname, options.fixture), log: !!process.env.DEBUG })
      }
    });

    describe("given tls/ssl reverse proxy is running (docker-compose)", function() {
      this.timeout(500 * 1000);

      // The service name in the docker-compose.yml must be equal to the name of the folder in which it resides
      const backendServiceName = path.basename(options.fixture)

      const dockerComposeArgs: compose.IDockerComposeOptions = {
        cwd: path.join(__dirname, "fixtures", "nginx-proxy"),
        env: {
          ... process.env,
          "PROXY_HOST": backendServiceName,
          "PROXY_PORT": (options.proxyPort || options.port).toString(),
        },
        log: !!process.env.DEBUG
      }

      before(async function () {
        await compose.upAll({ ...dockerComposeArgs, commandOptions: ['--build'] })
      });

      after(async function () {
        if (!process.env.MOCHA_DOCKER_KEEP) {
          await compose.down({ ...dockerComposeArgs })
        }
      });

      describe("given application is running", function() {
        startApplicationHooks()

        it("user is logging in with https", async function() {
          this.retries(3)
          await this.app.login({
            username: options.username,
            password: options.password,
            host: options.host,
            port: 8443,
            client: options.client,
            https: true,
          });
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
          await this.app.login({
            username: options.username,
            password: options.password,
            host: options.host,
            port: options.port,
            client: options.client,
          });
          await this.app.torrentsPageIsVisible()
        })

        describe("given new torrent is uploaded", async function() {
          let torrent: e2e.Torrent

          before(async function() {
            let filename = path.join(__dirname, 'data/shared/test-100k.bin.torrent')
            torrent = await this.app.uploadTorrent({ filename: filename });
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

        describe("given torrent uploaded with advanced options", async function() {
          let torrent: e2e.Torrent

          before(async function() {
            let filename = path.join(__dirname, 'data/shared/test-100k.bin.torrent')
            torrent = await this.app.uploadTorrent({ filename: filename, askUploadOptions: true });
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
};
