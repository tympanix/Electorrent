import chai from "chai"
import { browser } from "@wdio/globals"
import { Torrent } from "../../e2e"
import { configureSpec } from "../../framework/fixture"

describe("torrent peers", function () {
  configureSpec()

  it("shows normalized peer data and its country flag", async function () {
    this.timeout(60 * 1000)

    const hash = "1".padStart(40, "0")
    await browser.execute(async (request) => {
      await (window as any).electorrent.bittorrent.invokeAction(request)
    }, { action: "addMockedTorrent", args: [{ hash, name: "Peer test" }] })

    const torrent = new Torrent({ hash, app: this.app })
    await torrent.waitForExist()

    const panel = await torrent.openDetailsPanel()
    await torrent.openDetailsTab("peers")

    const peersTable = panel.$("[data-role='torrent-details-peers-table']")
    await peersTable.waitForDisplayed()
    const row = peersTable.$("tbody tr")

    const countryCell = row.$("td[data-col='country']")
    await countryCell.waitForDisplayed()
    chai.assert.include(await countryCell.getText(), "United States")
    chai.assert.isTrue(await row.$("td[data-col='country'] i.us.flag").isExisting())
    chai.assert.equal(await row.$("td[data-col='ip']").getText(), "8.8.8.8")
    chai.assert.equal(await row.$("td[data-col='port']").getText(), "6881")
    chai.assert.equal(await row.$("td[data-col='client']").getText(), "Mock Peer 1.0")
    chai.assert.equal(await row.$("td[data-col='progress']").getText(), "75.0%")
    chai.assert.equal(await row.$("td[data-col='connection']").getText(), "Outgoing")
    chai.assert.equal(await row.$("td[data-col='flags']").getText(), "Interested, encrypted")

    await torrent.closeDetailsPanel()
    await torrent.delete()
  })
})
