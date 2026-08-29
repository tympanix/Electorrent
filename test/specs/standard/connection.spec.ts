import chai from "chai"
import { $ } from "@wdio/globals"
import { PASSWORD_MASK } from "../../../src/shared/ipc-contract"
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
      assert.equal(await $("#page-settings-connection input[name='password']").getValue(), client.password ? PASSWORD_MASK : "")
    } finally {
      await backend.unpause()
    }
    await restartApplication(this)
    await this.app.torrentsPageIsVisible()
  })
})

describe("connection authentication", function () {
  configureSpec({ login: false })

  it("shows a connection problem when username and password are wrong", async function () {
    this.timeout(15 * 1000)

    await this.app.login({
      ...client,
      username: `wrong-${client.username || "user"}`,
      password: `wrong-${client.password || "password"}`,
    })

    const error = await this.app.getNotificationError({ timeout: 5 * 1000 })

    if (!error) {
      throw new Error("Expected a connection problem notification")
    }
    assert.equal(error.title, "Connection problem")
    assert.equal(error.message, "Incorrect username or password.")
    await this.app.welcomePageIsVisible()
  })
})

describe("connection host path", function () {
  configureSpec({ login: false })

  it("connects when the host includes the root path", async function () {
    await this.app.login({
      ...client,
      host: `http://${client.host}:${client.port}/`,
      port: 1,
    })
    await this.app.torrentsPageIsVisible()
  })
})

describe("connection host port", function () {
  configureSpec({ login: false })

  it("connects when the host includes the port", async function () {
    await this.app.login({
      ...client,
      host: `${client.host}:${client.port}`,
      port: 1,
    })
    await this.app.torrentsPageIsVisible()
  })
})

describe("connection host scheme", function () {
  configureSpec({ login: false })

  it("connects when the host includes an http scheme", async function () {
    await this.app.login({
      ...client,
      host: `http://${client.host}`,
    })
    await this.app.torrentsPageIsVisible()
  })
})

describe("insecure tls connection", function () {
  configureSpec({ login: false })

  it("connects when certificate identity verification fails", async function () {
    this.retries(3)
    await this.app.login({
      ...client,
      host: "127.0.0.1",
      https: true,
      port: fixture.proxyPort,
    })
    await this.app.certificateModalIsVisible()
    await this.app.openInsecureTlsConfirmation()
    await this.app.acceptInsecureTls()
    await this.app.torrentsPageIsVisible()
  })
})

describe("tls connection host scheme", function () {
  configureSpec({ login: false })

  it("accepts a self-signed certificate when the host includes an https scheme", async function () {
    this.retries(3)
    await this.app.login({
      ...client,
      host: `https://${client.host}:${fixture.proxyPort}/`,
      https: false,
      port: 1,
    })
    await this.app.certificateModalIsVisible()
    await this.app.acceptCertificate()
    await this.app.torrentsPageIsVisible()
  })
})

describe("tls connection", function () {
  configureSpec({ login: false })

  it("accepts a self-signed certificate", async function () {
    this.retries(3)
    await this.app.login({
      ...client,
      https: true,
      port: fixture.proxyPort,
    })
    await this.app.certificateModalIsVisible()
    await this.app.acceptCertificate()
    await this.app.torrentsPageIsVisible()
  })
})
