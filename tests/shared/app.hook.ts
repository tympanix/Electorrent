import path = require("path");
import { Application } from "spectron";
import { App } from "../e2e"

/**
 * Mocha hooks to start and stop Electron application before and after each suite. This function register the
 * `before` and `after` hooks in Mocha.
 */
export function startApplicationHooks() {

  var electronPath = path.join(__dirname, "..", "..", "node_modules", ".bin", "electron");

  if (process.platform === "win32") {
    electronPath += ".cmd";
  }

  var appPath = path.join(__dirname, "..", "..", "app");

  before(async function () {
    this.spectron = new Application({
      path: electronPath,
      args: ['--inspect=5858', appPath],
      webdriverOptions: {

        deprecationWarnings: false,
      },
      chromeDriverArgs: [
        "no-sandbox"
      ]
    });
    await this.spectron.start()
    await this.spectron.client.setTimeout({ implicit: 0 });
    await this.spectron.client.waitUntilWindowLoaded();
    this.app = new App(this.spectron);
  })

  afterEach(async function() {
    let logs  = await this.spectron.client.getMainProcessLogs()
    if (process.env.DEBUG) {
      console.log(logs.join("\n"))
    }
  })

  after(async function () {
    if (this.spectron && this.spectron.isRunning()) {
      await this.spectron.stop();
    }
  })

}