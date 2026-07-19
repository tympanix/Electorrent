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
