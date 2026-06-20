import chai from "chai"
import { $, browser } from "@wdio/globals"
import { configureSpec, enabledFeaturePaths, getTestFixture } from "../../framework/fixture"
import { CLIENT_METADATA } from "../../../src/shared/client-metadata"

const { assert } = chai
const fixture = getTestFixture()
const client = fixture.client

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

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
    assert.match(await version.getText(), new RegExp(`^${escapeRegExp(CLIENT_METADATA[client.clientId].name)}\\s+\\S+`))
  })

  it("shows free disk space in the footer for clients that support it", async function () {
    if (client.features.freeDiskSpace !== true) {
      return this.skip()
    }

    await browser.waitUntil(async () => {
      const footerText = await this.app.getTorrentsFooterText()
      return footerText.includes("Free:")
    })
  })

  it("toggles alternative rate limits from the status bar", async function () {
    if (client.features.alternativeSpeedLimits !== true) {
      return this.skip()
    }

    const button = $("[data-role='alternative-speed-limits']")
    await button.waitForDisplayed()

    const isActive = async () => ((await button.getAttribute("class")) || "").split(/\s+/).includes("active")
    const initial = await isActive()

    try {
      await button.waitForClickable()
      await button.click()
      await browser.waitUntil(async () => await isActive() !== initial)
    } finally {
      if (await isActive() !== initial) {
        await button.waitForClickable()
        await button.click()
        await browser.waitUntil(async () => await isActive() === initial)
      }
    }
  })
})
