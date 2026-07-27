import chai from "chai"
import { $, browser } from "@wdio/globals"
import { eventually } from "../../e2e/eventually"
import { waitForModalClose, waitForModalOpen } from "../../e2e/modal"
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
    await eventually(async () => $("#torrentTable tbody tr[data-id]").isExisting()).equals(true)
  })

  it("contains the mock client's context actions and follows torrent selection", async function () {
    const initial = await getActionsMenu()
    assert.includeMembers(initial.labels, [
      "Start",
      "Pause",
      "Details",
      "Recheck",
      "Queue",
      "Sequential Download",
      "Set Location",
      "Set Label",
      "Set Speed Limits",
      "Set Ratio",
      "Remove",
      "Remove And Delete",
    ])
    assert.isTrue(initial.disabled)

    const row = $("#torrentTable tbody tr[data-id]")
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

  it("exposes common start and pause shortcuts in the title menu", async function () {
    await browser.keys("Escape")

    const actionsMenu = $("//button[contains(@class, 'title-bar-menu-trigger') and normalize-space(.)='Actions']")
    await actionsMenu.waitForClickable()
    await actionsMenu.click()

    const startShortcut = $("//button[contains(@class, 'title-bar-menu-item')][.//span[normalize-space(.)='Start']]//span[contains(@class, 'title-bar-menu-accelerator')]")
    const pauseShortcut = $("//button[contains(@class, 'title-bar-menu-item')][.//span[normalize-space(.)='Pause']]//span[contains(@class, 'title-bar-menu-accelerator')]")
    await startShortcut.waitForDisplayed()
    await pauseShortcut.waitForDisplayed()
    assert.include(await startShortcut.getText(), "S")
    assert.include(await pauseShortcut.getText(), "P")
  })

  it("exposes the label action and shortcut in the title menu", async function () {
    await browser.keys("Escape")

    const actionsMenu = $("//button[contains(@class, 'title-bar-menu-trigger') and normalize-space(.)='Actions']")
    await actionsMenu.waitForClickable()
    await actionsMenu.click()

    const labelAction = $("//button[contains(@class, 'title-bar-menu-item')][.//span[normalize-space(.)='Set Label']]")
    await labelAction.waitForEnabled()
    assert.include(await labelAction.$(".title-bar-menu-accelerator").getText(), "L")
  })

  it("opens submenu items in a flyout to the right", async function () {
    await browser.keys("Escape")

    const row = $("#torrentTable tbody tr[data-id]")
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

  it("closes modals with Escape and submits the Set Label form with Enter", async function () {
    const modal = await openSetLabelModal()

    await browser.keys("Escape")
    await waitForModalClose(modal)

    await openSetLabelModal()
    await browser.keys("Enter")
    await waitForModalClose(modal)

    const label = await $("#torrentTable tbody tr[data-id] td[data-col='label']").getText()
    assert.equal(label.trim(), "mock-label-1")
  })
})

async function openSetLabelModal() {
  const row = $("#torrentTable tbody tr[data-id]")
  await row.waitForClickable()
  await row.click({ button: "right" })

  const action = $("#contextmenu a[data-role='set-label']")
  await action.waitForDisplayed()
  await action.waitForClickable()
  await action.click()

  const modal = $("#setLabelModal")
  await waitForModalOpen(modal)
  return modal
}

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
