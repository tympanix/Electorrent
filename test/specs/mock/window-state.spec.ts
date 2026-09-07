import chai from "chai"
import { browser } from "@wdio/globals"
import type { Rectangle } from "electron"
import { configureSpec } from "../../framework/fixture"

const assert: Chai.AssertStatic = chai.assert

interface WindowState {
  bounds: Rectangle
  normalBounds: Rectangle
  fullscreen: boolean
  maximized: boolean
}

async function getWindowState(): Promise<WindowState> {
  return browser.electron.execute((electron) => {
    const window = electron.BrowserWindow.getAllWindows().find((candidate) => !candidate.isDestroyed())
    if (!window) {
      throw new Error("Application window is not available")
    }

    return {
      bounds: window.getBounds(),
      normalBounds: window.getNormalBounds(),
      fullscreen: window.isFullScreen(),
      maximized: window.isMaximized(),
    }
  })
}

async function setNormalBounds(bounds: Rectangle) {
  await browser.electron.execute((electron, nextBounds) => {
    const window = electron.BrowserWindow.getAllWindows().find((candidate) => !candidate.isDestroyed())
    if (!window) {
      throw new Error("Application window is not available")
    }

    window.setFullScreen(false)
    window.unmaximize()
    window.setBounds(nextBounds)
  }, bounds)
}

async function restartApplication() {
  await browser.reloadSession()
  await browser.waitUntil(async () => {
    return browser.electron.execute((electron) => electron.BrowserWindow.getAllWindows().length > 0)
  })
}

describe("window state", function () {
  configureSpec({ login: false })

  it("restores ordinary window bounds", async function () {
    const bounds = { x: 120, y: 90, width: 900, height: 650 }
    await setNormalBounds(bounds)

    await restartApplication()

    const restored = await getWindowState()
    assert.deepEqual(restored.bounds, bounds)
    assert.isFalse(restored.maximized)
    assert.isFalse(restored.fullscreen)
  })

  it("restores maximized state and the normal bounds", async function () {
    const bounds = { x: 140, y: 110, width: 920, height: 670 }
    await setNormalBounds(bounds)
    await browser.electron.execute((electron) => {
      electron.BrowserWindow.getAllWindows()[0]?.maximize()
    })
    await browser.waitUntil(async () => (await getWindowState()).maximized)

    await restartApplication()

    const restored = await getWindowState()
    assert.isTrue(restored.maximized)
    assert.isFalse(restored.fullscreen)
    assert.deepEqual(restored.normalBounds, bounds)
  })

  it("restores fullscreen state and the normal bounds", async function () {
    const bounds = { x: 160, y: 130, width: 940, height: 690 }
    await setNormalBounds(bounds)
    await browser.electron.execute((electron) => {
      electron.BrowserWindow.getAllWindows()[0]?.setFullScreen(true)
    })
    await browser.waitUntil(async () => (await getWindowState()).fullscreen)

    await restartApplication()

    const restored = await getWindowState()
    assert.isTrue(restored.fullscreen)
    assert.isFalse(restored.maximized)
    assert.deepEqual(restored.normalBounds, bounds)
  })
})
