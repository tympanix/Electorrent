import chai from "chai"
import { $ } from "@wdio/globals"
import { eventually } from "../../e2e/eventually"
import { configureSpec, getTestFixture } from "../../framework/fixture"
import { restartApplication } from "../../shared"
import { HTTP_LOGIN_TIMEOUT, HTTP_REQUEST_TIMEOUT } from "../../../src/main/lib/bittorrent/helpers"

const CONNECT_FAILURE_TIMEOUT = HTTP_LOGIN_TIMEOUT
const CONNECT_FAILURE_BUFFER = 10 * 1000
const TORRENT_PAGE_FAILURE_TEST_TIMEOUT = HTTP_REQUEST_TIMEOUT + CONNECT_FAILURE_BUFFER + 20 * 1000
const CONNECT_FAILURE_TEST_TIMEOUT = CONNECT_FAILURE_TIMEOUT + CONNECT_FAILURE_BUFFER + 10 * 1000
const CONNECTION_SPEC_TIMEOUT = Math.max(CONNECT_FAILURE_TEST_TIMEOUT, TORRENT_PAGE_FAILURE_TEST_TIMEOUT)

const { assert } = chai
const fixture = getTestFixture()
const client = fixture.client
const backend = fixture.backend

describe("connection", function () {
  this.timeout(CONNECTION_SPEC_TIMEOUT)
  configureSpec()

  it("automatically reconnects after restarting the app", async function () {
    await restartApplication(this)
    await this.app.torrentsPageIsVisible()
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
      assert.equal(await $("#page-settings-connection input[name='password']").getValue(), client.password)
    } finally {
      await backend.unpause()
    }
    await restartApplication(this)
    await this.app.torrentsPageIsVisible()
  })
})
