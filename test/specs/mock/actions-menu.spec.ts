import chai from "chai"
import { $, browser } from "@wdio/globals"
import { eventually } from "../../e2e/eventually"
import { configureSpec } from "../../framework/fixture"

const assert: Chai.AssertStatic = chai.assert

describe("mock Actions menu", function () {
  configureSpec({ clearTorrents: false })

  before(async function () {
    await browser.execute(async () => {
      await (window as any).electorrent.bittorrent.invokeAction({
        action: "addMockedTorrent",
        args: [{ hash: "a".repeat(40), name: "Actions menu torrent" }],
      })
    })
    await eventually(async () => $("#torrentTable tbody tr[data-hash]").isExisting()).equals(true)
  })

  it("contains the mock client's context actions and follows torrent selection", async function () {
    const initial = await getActionsMenu()
    assert.includeMembers(initial.labels, [
      "Details",
      "Files",
      "Recheck",
      "Queue",
      "Sequential Download",
      "Set Location",
      "Set Speed Limits",
      "Set Ratio",
      "Remove",
      "Remove And Delete",
    ])
    assert.isTrue(initial.disabled)

    const row = $("#torrentTable tbody tr[data-hash]")
    await row.waitForClickable()
    await row.click()

    await eventually(async () => (await getActionsMenu()).disabled).equals(false)
  })

  it("renders platform-localized shortcuts in the title menu", async function () {
    const actionsMenu = $("//button[contains(@class, 'title-bar-menu-trigger') and normalize-space(.)='Actions']")
    await actionsMenu.waitForClickable()
    await actionsMenu.click()

    const detailsShortcut = $("//button[contains(@class, 'title-bar-menu-item')][.//span[normalize-space(.)='Details']]//span[contains(@class, 'title-bar-menu-accelerator')]")
    await detailsShortcut.waitForDisplayed()
    assert.notInclude(await detailsShortcut.getText(), "CmdOrCtrl")
  })

  it("opens submenu items in a flyout to the right", async function () {
    await browser.keys("Escape")

    const row = $("#torrentTable tbody tr[data-hash]")
    await row.waitForClickable()
    await row.click()

    const actionsMenu = $("//button[contains(@class, 'title-bar-menu-trigger') and normalize-space(.)='Actions']")
    await actionsMenu.waitForClickable()
    await actionsMenu.click()

    const queueTrigger = $("//button[contains(@class, 'title-bar-menu-submenu-trigger')][.//span[normalize-space(.)='Queue']]")
    await queueTrigger.waitForEnabled()
    assert.isTrue(await queueTrigger.$(".title-bar-menu-submenu-arrow").isExisting())

    const queueFlyout = queueTrigger.$("..").$(".title-bar-menu-flyout")
    assert.isFalse(await queueFlyout.isDisplayed())

    await queueTrigger.moveTo()
    await queueFlyout.waitForDisplayed()
    assert.equal(await queueFlyout.$(".title-bar-menu-label").getText(), "Move Up Queue")

    const triggerX = await queueTrigger.getLocation("x")
    const triggerWidth = await queueTrigger.getSize("width")
    const flyoutX = await queueFlyout.getLocation("x")
    assert.isAtLeast(flyoutX, triggerX + triggerWidth - 2)
  })
})

async function getActionsMenu() {
  return browser.electron.execute((electron) => {
    const menu = electron.Menu.getApplicationMenu()
    const actions = menu?.items.find((item) => item.id === "actions")
    if (!actions?.submenu) throw new Error("Actions menu is unavailable")
    return {
      labels: actions.submenu.items.map((item) => item.label),
      disabled: actions.submenu.items.filter((item) => item.type !== "separator")
        .every((item) => !item.enabled),
    }
  })
}
