import { browser, $ } from "@wdio/globals"
import chai from "chai"
import fs from "node:fs"
import path from "node:path"
import { PASSWORD_MASK } from "../../../src/shared/ipc-contract"
import { configureSpec, getTestFixture } from "../../framework/fixture"

const assert: Chai.AssertStatic = chai.assert

describe("password storage integration", function() {
  configureSpec({ login: false, clearTorrents: false })

  it("encrypts, redacts, preserves, masks, and explicitly clears a password", async function() {
    const app = getTestFixture().app
    await app.login({
      host: "password-storage.local",
      username: "credential-user",
      password: "credential-secret",
      port: 1,
      clientId: "mock",
    })
    await app.torrentsPageIsVisible()

    const { userDataPath, encryptionAvailable } = await browser.electron.execute((electron) => ({
      userDataPath: electron.app.getPath("userData"),
      encryptionAvailable: electron.safeStorage.isEncryptionAvailable(),
    }))
    const configPath = path.join(userDataPath, "config.json")
    const persisted = JSON.parse(fs.readFileSync(configPath, "utf8"))
    const persistedServer = persisted.servers[0]
    assert.notProperty(persistedServer, "password")
    assert.notProperty(persistedServer, "newPassword")
    assert.notProperty(persistedServer, "hasPassword")
    assert.equal(persistedServer.encryptedPassword.cipher, encryptionAvailable ? "electron-safe-storage" : "plaintext")
    if (encryptionAvailable) {
      assert.notInclude(JSON.stringify(persistedServer), "credential-secret")
    }

    await app.openSettings()
    await app.settingsGotoTab("connection")
    const passwordInput = $("#connection-password")
    assert.equal(await passwordInput.getValue(), PASSWORD_MASK)

    const originalCiphertext = persistedServer.encryptedPassword.value
    await app.settingsSave()
    await app.torrentsPageIsVisible()
    const preserved = JSON.parse(fs.readFileSync(configPath, "utf8"))
    assert.equal(preserved.servers[0].encryptedPassword.value, originalCiphertext)

    await app.openSettings()
    await app.settingsGotoTab("connection")
    await $("#connection-password").clearValue()
    await app.settingsSave()
    await app.torrentsPageIsVisible()
    const cleared = JSON.parse(fs.readFileSync(configPath, "utf8"))
    assert.notProperty(cleared.servers[0], "encryptedPassword")
  })
})
