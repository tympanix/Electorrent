import chai from "chai"
import { $, browser } from "@wdio/globals"
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

  it("server with an unavailable client", async function () {
    const unavailableClientId = "unavailable-client"
    const originalSettings = await browser.execute(async () => {
      return await (window as any).electorrent.settings.getAll()
    })
    const serverId = originalSettings.servers[0].id

    try {
      await browser.execute(async ({ clientId, id }) => {
        const settings = await (window as any).electorrent.settings.getAll()
        settings.startup = "default"
        settings.servers.forEach((server: any) => {
          server.default = server.id === id
        })
        settings.servers.find((server: any) => server.id === id).client = clientId
        await (window as any).electorrent.settings.saveAll(settings)
      }, { clientId: unavailableClientId, id: serverId })

      await restartApplication(this)
      await this.app.serverSelectionPageIsVisible()

      const persistedClientId = await browser.execute(async (id) => {
        const settings = await (window as any).electorrent.settings.getAll()
        return settings.servers.find((server: any) => server.id === id)?.client
      }, serverId)
      assert.equal(persistedClientId, unavailableClientId)

      const warning = $("#page-server-selection i.icon.exclamation")
      await warning.waitForDisplayed()
      assert.include(await warning.getAttribute("title"), unavailableClientId)
    } finally {
      await browser.execute(async (settings) => {
        await (window as any).electorrent.settings.saveAll(settings)
      }, originalSettings)
      await restartApplication(this)
    }
  })
})
