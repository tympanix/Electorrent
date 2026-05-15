import { browser } from '@wdio/globals'
import { App } from "../e2e"

let hasReusedInitialSession = false
const APPLICATION_SESSION_TIMEOUT = 30 * 1000

/**
 * Mocha hooks to start and stop Electron application before and after each suite. This function register the
 * `before` and `after` hooks in Mocha.
 */
export function startApplicationHooks() {

  before(async function (this: Mocha.Context) {
    this.timeout(APPLICATION_SESSION_TIMEOUT)

    if (hasReusedInitialSession) {
      await browser.reloadSession()
    } else {
      hasReusedInitialSession = true
    }

    this.app = new App();
  })
}

export async function restartApplication(context: Mocha.Context) {
  await browser.refresh()
}
