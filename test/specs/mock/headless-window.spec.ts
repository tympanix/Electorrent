import chai from "chai"
import { browser } from "@wdio/globals"
import { configureSpec } from "../../framework/fixture"

const assert: Chai.AssertStatic = chai.assert

describe("headless window", function () {
  configureSpec({ login: false })

  it("keeps the application window hidden when Electron is launched headless", async function () {
    const state = await browser.electron.execute((electron) => ({
      isHeadless: electron.app.commandLine.hasSwitch("headless"),
      isVisible: electron.BrowserWindow.getAllWindows().some((window) => window.isVisible()),
    }))

    if (!state.isHeadless) {
      return this.skip()
    }

    assert.isFalse(state.isVisible)
    assert.fail("Temporary CI probe: verify failed-test video artifact upload")
  })
})
