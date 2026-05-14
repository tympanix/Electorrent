import { browser } from '@wdio/globals'
import { App } from "../e2e"

let hasReusedInitialSession = false
const APPLICATION_SESSION_TIMEOUT = 30 * 1000

function isInvalidSessionError(err: unknown) {
  return err instanceof Error && err.message.includes('invalid session id')
}

async function closeApplicationSession() {
  if (!browser.sessionId) {
    return
  }

  let handles: string[]

  try {
    handles = await browser.getWindowHandles()
  } catch (err) {
    if (isInvalidSessionError(err)) {
      return
    }

    throw err
  }

  for (const handle of handles) {
    await browser.switchToWindow(handle)
    await browser.closeWindow()
  }
}

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

  after(async function () {
    this.timeout(APPLICATION_SESSION_TIMEOUT)
    await closeApplicationSession()
  })

}

export async function restartApplication(context: Mocha.Context) {
  await browser.refresh()
}
