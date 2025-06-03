import { browser } from '@wdio/globals'
import { App } from "../e2e"

/**
 * Mocha hooks to start and stop Electron application before and after each suite. This function register the
 * `before` and `after` hooks in Mocha.
 */
export function startApplicationHooks() {

  before(async function (this: Mocha.Context) {
    // Open the application
    await browser.reloadSession()
    this.timeout(10 * 1000)
    this.app = new App();
  })

  after(async function () {
    this.timeout(10 * 1000)
  })

}

export async function restartApplication(context: Mocha.Context) {
  await browser.refresh()
}