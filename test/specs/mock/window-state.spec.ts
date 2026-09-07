import chai from "chai"
import type { BrowserWindow, Rectangle } from "electron"
import {
  getWindowBoundsOptions,
  saveWindowState,
  shouldRestoreFullscreen,
  shouldRestoreMaximized,
  type StoredWindowState,
} from "../../../src/main/lib/window-state"
import { configureSpec } from "../../framework/fixture"

const assert: Chai.AssertStatic = chai.assert

interface WindowFlags {
  fullscreen: boolean
  maximized: boolean
}

function persistWindowState(bounds: Rectangle, flags: WindowFlags): StoredWindowState {
  let storedKey: string | undefined
  let storedValue: unknown
  let writes = 0
  const window = {
    getNormalBounds: () => bounds,
    isFullScreen: () => flags.fullscreen,
    isMaximized: () => flags.maximized,
  } as BrowserWindow
  const settings = {
    get: () => null,
    put: (key: string, value: unknown) => {
      storedKey = key
      storedValue = value
    },
    write: () => {
      writes += 1
    },
  }

  saveWindowState(window, settings)

  assert.equal(storedKey, "windowsize")
  assert.equal(writes, 1)
  return storedValue as StoredWindowState
}

function assertRestoredBounds(state: StoredWindowState, bounds: Rectangle) {
  assert.deepEqual(getWindowBoundsOptions(state), bounds)
}

describe("window state", function () {
  configureSpec({ login: false })

  it("persists ordinary window bounds", function () {
    const bounds = { x: 120, y: 90, width: 900, height: 650 }
    const stored = persistWindowState(bounds, { fullscreen: false, maximized: false })

    assert.deepEqual(stored, { ...bounds, fullscreen: false, maximized: false })
    assertRestoredBounds(stored, bounds)
    assert.isFalse(shouldRestoreMaximized(stored))
    assert.isFalse(shouldRestoreFullscreen(stored))
  })

  it("persists maximized state with normal bounds", function () {
    const bounds = { x: 140, y: 110, width: 920, height: 670 }
    const stored = persistWindowState(bounds, { fullscreen: false, maximized: true })

    assert.deepEqual(stored, { ...bounds, fullscreen: false, maximized: true })
    assertRestoredBounds(stored, bounds)
    assert.isTrue(shouldRestoreMaximized(stored))
    assert.isFalse(shouldRestoreFullscreen(stored))
  })

  it("persists fullscreen state with normal bounds", function () {
    const bounds = { x: 160, y: 130, width: 940, height: 690 }
    const stored = persistWindowState(bounds, { fullscreen: true, maximized: false })

    assert.deepEqual(stored, { ...bounds, fullscreen: true, maximized: false })
    assertRestoredBounds(stored, bounds)
    assert.isFalse(shouldRestoreMaximized(stored))
    assert.isTrue(shouldRestoreFullscreen(stored))
  })
})
