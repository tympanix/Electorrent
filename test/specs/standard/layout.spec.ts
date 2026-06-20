import chai from "chai"
import { $, browser } from "@wdio/globals"
import { configureSpec } from "../../framework/fixture"
import { restartApplication } from "../../shared"

const assert: Chai.AssertStatic = chai.assert

describe("layout", function () {
  configureSpec()

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

  it("can change layout columns", async function () {
    await this.app.openSettings()
    await this.app.settingsGotoTab("layout")

    const layoutColumns = await this.app.getLayoutColumns()
    const targetColumn = layoutColumns.find((column) => column.enabled && column.name !== "Name")
    assert.isOk(targetColumn, "expected at least one enabled column")

    await this.app.setLayoutColumnEnabled(targetColumn!.name, false)
    const updatedColumns = await this.app.getLayoutColumns()
    assert.isFalse(updatedColumns.find((column) => column.name === targetColumn!.name)!.enabled)

    await this.app.settingsSave()
    await this.app.torrentsPageIsVisible()

    await this.app.openSettings()
    await this.app.settingsGotoTab("layout")
    const persistedColumns = await this.app.getLayoutColumns()
    assert.isFalse(persistedColumns.find((column) => column.name === targetColumn!.name)!.enabled)
  })

  it("can enable compact listings", async function () {
    await this.app.openSettings()
    await this.app.settingsGotoTab("general")
    const initialState = await this.app.getGeneralToggleState("Compact Listings")
    await this.app.setGeneralToggle("Compact Listings", !initialState)
    assert.equal(await this.app.getGeneralToggleState("Compact Listings"), !initialState)

    await this.app.settingsSave()
    await this.app.torrentsPageIsVisible()

    await browser.waitUntil(async () => {
      const className = await $("#torrentTable").getAttribute("class")
      return (className || "").includes("compact") === !initialState
    })
  })
})
