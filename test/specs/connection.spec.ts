import chai from "chai"
import { $, browser } from "@wdio/globals"
import { configureSpec, getTestFixture } from "../framework/fixture"
import { restartApplication } from "../shared"

const { assert } = chai
const fixture = getTestFixture()
const client = fixture.client
const backend = fixture.backend

describe("connection", function () {
  configureSpec()

  it("automatically reconnects after restarting the app", async function () {
    await restartApplication(this)
    await this.app.torrentsPageIsVisible()
  })

  it("shows settings when reconnecting fails", async function () {
    this.timeout(25 * 1000)
    await backend.pause()
    await restartApplication(this)
    await this.app.settingsPageIsVisible({ timeout: 10 * 1000 })
    await this.app.settingsPageConnectionIsVisible()
    await browser.waitUntil(async () => {
      return await $("#page-settings-connection input[name='ip']").getValue() === client.host
    })
    assert.equal(await $("#page-settings-connection input[name='ip']").getValue(), client.host)
    assert.equal(await $("#page-settings-connection input[name='port']").getValue(), String(client.port))
    assert.equal(await $("#page-settings-connection input[name='username']").getValue(), client.username)
    assert.equal(await $("#page-settings-connection input[name='password']").getValue(), client.password)
    await backend.unpause()
    await restartApplication(this)
    await this.app.torrentsPageIsVisible()
  })
})
