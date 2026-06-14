import chai from "chai"
import { $, browser } from "@wdio/globals"
import { configureSpec, enabledFeaturePaths, getTestFixture } from "../framework/fixture"
import { restartApplication } from "../shared"
import { CLIENT_METADATA } from "../../src/shared/client-metadata"

const { assert } = chai
const fixture = getTestFixture()
const client = fixture.client
const backend = fixture.backend

describe("application", function () {
  configureSpec()
  it("reports expected client features", async function () {
    const actualFeatures = await browser.execute(() => {
      const angular = (window as any).angular
      return angular.element(document.documentElement).injector().get("$rootScope").$btclient.features
    })
    const missingFeatures = enabledFeaturePaths(client.features as Record<string, unknown>)
      .filter((path) => path.split(".").reduce((value, key) => value?.[key], actualFeatures) !== true)

    assert.deepEqual(missingFeatures, [], `Missing enabled client features: ${missingFeatures.join(", ")}`)
  })

  it("shows client version in status bar", async function () {
    const version = $(".status-bar .client-version")
    await version.waitForDisplayed()
    assert.match(
      await version.getText(),
      new RegExp(`^${CLIENT_METADATA[client.clientId].name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+\\S+`),
    )
  })

  it("automatically connect when restarting app", async function () {
    await restartApplication(this)
    await this.app.torrentsPageIsVisible()
  })

  it("sidebar can be collapsed and restored after refresh", async function () {
    await this.app.setTorrentSidebarCollapsed(false)
    await this.app.setTorrentSidebarCollapsed(true)

    assert.isTrue(await this.app.isTorrentSidebarCollapsed())
    await $("[data-role='torrent-sidebar-labels-toggle']").waitForDisplayed()

    await restartApplication(this)
    await this.app.torrentsPageIsVisible()
    assert.isTrue(await this.app.isTorrentSidebarCollapsed())

    await this.app.setTorrentSidebarCollapsed(false)
    assert.isFalse(await this.app.isTorrentSidebarCollapsed())
  })

  it("show settings when connection error after restarting app", async function () {
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

  if (client.clientId === "qbittorrent") {
    it("keeps qBittorrent free space in the footer after incremental syncs", async function () {
      await browser.waitUntil(async () => {
        const footerText = await this.app.getTorrentsFooterText();
        return footerText.includes("Free:");
      });
    });
  }
})
