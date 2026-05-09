import fs from 'fs'
import path from 'path'
import { browser } from '@wdio/globals'
import { App } from "../e2e"

const TEST_USER_DATA_DIR = path.join(process.cwd(), '.wdio', 'electron-user-data')

function resetApplicationState() {
  fs.rmSync(TEST_USER_DATA_DIR, { recursive: true, force: true })
}

async function shutdownApplication() {
  try {
    await browser.execute(() => {
      const remote = require('@electron/remote')
      remote.app.quit()
    })
  } catch {
    try {
      await browser.closeWindow()
    } catch {
      return
    }
  }

  try {
    await browser.waitUntil(async () => {
      try {
        return (await browser.getWindowHandles()).length === 0
      } catch {
        return true
      }
    }, {
      timeout: 5 * 1000,
      interval: 100,
      timeoutMsg: 'Electron app did not shut down cleanly before restart',
    })
  } catch {
    // If the webdriver session is already invalidated then the app has exited.
  }
}

async function relaunchApplication(context: Mocha.Context) {
  await shutdownApplication()
  await browser.reloadSession()
  context.app = new App()
}

/**
 * Mocha hooks to start and stop Electron application before and after each suite. This function register the
 * `before` and `after` hooks in Mocha.
 */
export function startApplicationHooks() {

  before(async function (this: Mocha.Context) {
    this.timeout(10 * 1000)
    resetApplicationState()
    await relaunchApplication(this)
  })

  after(async function () {
    this.timeout(10 * 1000)
    await shutdownApplication()
    resetApplicationState()
  })

}

export async function restartApplication(context: Mocha.Context) {
  await relaunchApplication(context)
}