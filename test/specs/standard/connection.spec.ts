import chai from "chai"
import fs from "node:fs"
import path from "node:path"
import { $, browser } from "@wdio/globals"
import { eventually } from "../../e2e/eventually"
import { configureSpec, getTestFixture } from "../../framework/fixture"
import { restartApplication } from "../../shared"
import { HTTP_LOGIN_TIMEOUT, HTTP_REQUEST_TIMEOUT } from "../../../src/main/lib/bittorrent/helpers"

const CONNECT_FAILURE_TIMEOUT = HTTP_LOGIN_TIMEOUT
const CONNECT_FAILURE_BUFFER = 10 * 1000
const TORRENT_PAGE_FAILURE_TEST_TIMEOUT = HTTP_REQUEST_TIMEOUT + CONNECT_FAILURE_BUFFER + 20 * 1000
const CONNECT_FAILURE_TEST_TIMEOUT = CONNECT_FAILURE_TIMEOUT + CONNECT_FAILURE_BUFFER + 10 * 1000
const CONNECTION_SPEC_TIMEOUT = Math.max(CONNECT_FAILURE_TEST_TIMEOUT, TORRENT_PAGE_FAILURE_TEST_TIMEOUT)

const assert: Chai.AssertStatic = chai.assert
const fixture = getTestFixture()
const client = fixture.client
const backend = fixture.backend
const expectedPassword = client.password ? "••••••••" : ""

describe("connection", function () {
  this.timeout(CONNECTION_SPEC_TIMEOUT)
  configureSpec()

  it("automatically reconnects after restarting the app", async function () {
    await restartApplication(this)
    await this.app.torrentsPageIsVisible()
  })

  it("keeps stored passwords out of renderer settings", async function () {
    const rendererServer = await browser.execute(async () => {
      const settings = await (window as any).electorrent.settings.getAll()
      return settings.servers[0]
    })

    assert.equal(rendererServer.hasPassword, Boolean(client.password))
    assert.notProperty(rendererServer, "password")
    assert.notProperty(rendererServer, "newPassword")
    assert.notProperty(rendererServer, "encryptedPassword")

    const storage = await browser.electron.execute((electron) => ({
      available: electron.safeStorage.isEncryptionAvailable(),
      userDataPath: electron.app.getPath("userData"),
    }))
    const persistedSettings = JSON.parse(fs.readFileSync(path.join(storage.userDataPath, "config.json"), "utf8"))
    const persistedServer = persistedSettings.servers[0]

    if (!client.password) {
      assert.notProperty(persistedServer, "password")
      assert.notProperty(persistedServer, "encryptedPassword")
    } else if (storage.available) {
      assert.notProperty(persistedServer, "password")
      assert.deepInclude(persistedServer.encryptedPassword, {
        cipher: "electron-safe-storage",
      })
      assert.isNotEmpty(persistedServer.encryptedPassword.value)
    } else {
      assert.notProperty(persistedServer, "password")
      assert.deepEqual(persistedServer.encryptedPassword, {
        cipher: "plaintext",
        value: client.password,
      })
    }
  })

  it("migrates a legacy plaintext password into the password envelope", async function () {
    if (!client.password) {
      this.skip()
    }

    const storage = await browser.electron.execute((electron) => ({
      available: electron.safeStorage.isEncryptionAvailable(),
      userDataPath: electron.app.getPath("userData"),
    }))
    const configPath = path.join(storage.userDataPath, "config.json")
    const legacySettings = JSON.parse(fs.readFileSync(configPath, "utf8"))
    delete legacySettings.servers[0].encryptedPassword
    legacySettings.servers[0].password = client.password
    fs.writeFileSync(configPath, JSON.stringify(legacySettings, null, 4))

    await restartApplication(this)
    await this.app.torrentsPageIsVisible()

    const migratedServer = JSON.parse(fs.readFileSync(configPath, "utf8")).servers[0]
    assert.notProperty(migratedServer, "password")
    assert.equal(
      migratedServer.encryptedPassword.cipher,
      storage.available ? "electron-safe-storage" : "plaintext",
    )
    assert.isNotEmpty(migratedServer.encryptedPassword.value)
  })

  it("shows a connection indicator before the disconnect overlay on the torrent page", async function () {
    this.timeout(TORRENT_PAGE_FAILURE_TEST_TIMEOUT)
    await this.app.torrentsPageIsVisible()
    await backend.pause()
    try {
      const indicator = $(".title-bar-sync-connection-indicator")
      await indicator.waitForDisplayed({ timeout: 5 * 1000 })
      assert.include(await indicator.getAttribute("class"), "is-slow")

      const disconnectOverlay = $("#page-torrents > .popup")
      await disconnectOverlay.waitForDisplayed({ timeout: HTTP_REQUEST_TIMEOUT + CONNECT_FAILURE_BUFFER })
      assert.include(await indicator.getAttribute("class"), "is-broken")
    } finally {
      await backend.unpause()
    }
    await restartApplication(this)
    await this.app.torrentsPageIsVisible()
  })

  it("shows settings when reconnecting fails after the backend HTTP timeout", async function () {
    this.timeout(CONNECT_FAILURE_TEST_TIMEOUT)
    await backend.pause()
    try {
      await restartApplication(this)
      await this.app.settingsPageIsVisible({ timeout: CONNECT_FAILURE_TIMEOUT + CONNECT_FAILURE_BUFFER })
      await this.app.settingsPageConnectionIsVisible()
      await eventually(() => $("#page-settings-connection input[name='ip']").getValue()).equals(client.host)
      assert.equal(await $("#page-settings-connection input[name='ip']").getValue(), client.host)
      assert.equal(await $("#page-settings-connection input[name='port']").getValue(), String(client.port))
      assert.equal(await $("#page-settings-connection input[name='username']").getValue(), client.username)
      assert.equal(await $("#page-settings-connection input[name='password']").getValue(), expectedPassword)
    } finally {
      await backend.unpause()
    }
    await restartApplication(this)
    await this.app.torrentsPageIsVisible()
  })
})
