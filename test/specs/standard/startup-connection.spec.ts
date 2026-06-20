import chai from "chai"
import { $ } from "@wdio/globals"
import { configureSpec } from "../../framework/fixture"
import { restartApplication } from "../../shared"

const { assert } = chai

describe("startup connection", function () {
  configureSpec()

  let initialConnectionMode: string

  before(async function () {
    await restartApplication(this)
    await this.app.torrentsPageIsVisible()
    await this.app.openSettings()
    await this.app.settingsGotoTab("general")
    initialConnectionMode = await this.app.getGeneralDropdownValue("Startup Connection")
    await this.app.selectGeneralDropdownValue("Startup Connection", "Ask")
    await this.app.settingsSave()
    await this.app.torrentsPageIsVisible()
    await restartApplication(this)
  })

  after(async function () {
    const torrentsPage = $("#page-torrents")
    if (!await torrentsPage.isDisplayed()) {
      await this.app.connectServerSelection(0)
      await this.app.torrentsPageIsVisible()
    }

    if (initialConnectionMode !== "Ask") {
      await this.app.openSettings()
      await this.app.settingsGotoTab("general")
      await this.app.selectGeneralDropdownValue("Startup Connection", initialConnectionMode)
      await this.app.settingsSave()
      await this.app.torrentsPageIsVisible()
    }
  })

  it("lists saved servers and can connect", async function () {
    await this.app.serverSelectionPageIsVisible()

    const serverNames = await this.app.getServerSelectionNames()
    assert.isAtLeast(serverNames.length, 1, "at least one server should be listed")
    assert.isNotEmpty(serverNames[0], "server should have a name")

    await this.app.connectServerSelection(0)
    await this.app.torrentsPageIsVisible()
  })
})
