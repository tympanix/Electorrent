import chai from "chai"
import { $, $$ } from "@wdio/globals"
import { configureSpec, getTestFixture } from "../../framework/fixture"
import { restartApplication } from "../../shared"

const assert: Chai.AssertStatic = chai.assert
const savedServerHost = "saved-mock.local"

describe("mock saved servers", function () {
  configureSpec({ clearTorrents: false })

  it("adds, persists, and removes a saved server through Settings", async function () {
    const app = getTestFixture().app
    const serverMenu = $("//button[contains(@class, 'title-bar-menu-trigger') and normalize-space(.)='Servers']")
    await serverMenu.waitForClickable()
    await serverMenu.click()

    const addServer = $("//button[contains(@class, 'title-bar-menu-item')][.//span[normalize-space(.)='Add new server...']]")
    await addServer.waitForClickable()
    await addServer.click()
    await app.welcomePageIsVisible()

    await app.login({
      host: savedServerHost,
      username: "",
      password: "",
      port: 1,
      clientId: "mock",
    })
    await app.torrentsPageIsVisible()

    await app.openSettings()
    await app.settingsGotoTab("servers")
    assert.include(await getSettingsServerHosts(), savedServerHost)
    await app.settingsCancel()

    await restartApplication(this)
    await app.serverSelectionPageIsVisible()
    assert.isTrue(
      (await getServerSelectionAddresses()).some((address) => address.endsWith(`@ ${savedServerHost}`)),
      `expected the server selection to include ${savedServerHost}`,
    )

    await app.connectServerSelection(0)
    await app.torrentsPageIsVisible()
    await app.openSettings()
    await app.settingsGotoTab("servers")
    await removeSettingsServer(savedServerHost)
    await app.settingsSave()
    await app.torrentsPageIsVisible()

    await restartApplication(this)
    await app.torrentsPageIsVisible()
    await app.openSettings()
    await app.settingsGotoTab("servers")
    assert.notInclude(await getSettingsServerHosts(), savedServerHost)
    assert.equal(await app.getSettingsServerCount(), 1)
  })
})

async function getSettingsServerHosts() {
  const rows = await $$("#page-settings-servers tbody tr")
  const hosts: string[] = []
  for (const row of rows) {
    hosts.push((await row.$("td:nth-child(3)").getText()).trim())
  }
  return hosts
}

async function getServerSelectionAddresses() {
  const cards = await $$("#page-server-selection .server.list .card")
  const hosts: string[] = []
  for (const card of cards) {
    hosts.push((await card.$(".meta").getText()).trim())
  }
  return hosts
}

async function removeSettingsServer(host: string) {
  const rows = await $$("#page-settings-servers tbody tr")
  for (const row of rows) {
    if ((await row.$("td:nth-child(3)").getText()).trim() === host) {
      const removeButton = row.$("button.circular.red")
      await removeButton.waitForClickable()
      await removeButton.click()
      return
    }
  }
  assert.fail(`Saved server ${host} was not found`)
}
