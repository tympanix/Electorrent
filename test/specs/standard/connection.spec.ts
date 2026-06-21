import chai from "chai"
import { $, browser } from "@wdio/globals"
import { configureSpec, getTestFixture } from "../../framework/fixture"
import { restartApplication } from "../../shared"
import { HTTP_LOGIN_TIMEOUT } from "../../../src/main/lib/bittorrent/helpers"

const CONNECT_FAILURE_TIMEOUT = HTTP_LOGIN_TIMEOUT
const CONNECT_FAILURE_BUFFER = 10 * 1000
const CONNECT_FAILURE_TEST_TIMEOUT = CONNECT_FAILURE_TIMEOUT + CONNECT_FAILURE_BUFFER + 10 * 1000

const { assert } = chai
const fixture = getTestFixture()
const client = fixture.client
const backend = fixture.backend

describe("connection", function () {
  this.timeout(CONNECT_FAILURE_TEST_TIMEOUT)
  configureSpec()

  it("automatically reconnects after restarting the app", async function () {
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
      await browser.waitUntil(async () => {
        return await $("#page-settings-connection input[name='ip']").getValue() === client.host
      })
      assert.equal(await $("#page-settings-connection input[name='ip']").getValue(), client.host)
      assert.equal(await $("#page-settings-connection input[name='port']").getValue(), String(client.port))
      assert.equal(await $("#page-settings-connection input[name='username']").getValue(), client.username)
      assert.equal(await $("#page-settings-connection input[name='password']").getValue(), client.password)
    } finally {
      await backend.unpause()
    }
    await restartApplication(this)
    await this.app.torrentsPageIsVisible()
  })
})
