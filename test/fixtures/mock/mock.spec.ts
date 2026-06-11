import chai from "chai"
import { $, $$, browser } from "@wdio/globals"
import { before, describe, it } from "mocha"
import { App } from "../../e2e"
import { startApplicationHooks } from "../../shared"
import { setupMochaHooks } from "../../testutil"

const { assert } = chai
const TORRENT_COUNT = 100

setupMochaHooks()

describe("given mocked bittorrent backend is running", function () {
  startApplicationHooks()

  before(function () {
    chai.should()
  })

  it("renders 100 mocked torrents over IPC", async function () {
    this.app = this.app || new App()

    await this.app.login({
      clientId: "mock",
      host: "mock",
      username: "mock",
      password: "mock",
      port: 1,
    })
    await this.app.torrentsPageIsVisible({ timeout: 10 * 1000 })

    await revealAllTorrentRows()

    const rows = await $$("#torrentTable tbody tr")
    assert.lengthOf(rows, TORRENT_COUNT)

    const firstName = await getTorrentNameText("0000000000000000000000000000000000000001")
    const lastName = await getTorrentNameText("0000000000000000000000000000000000000064")
    assert.include(firstName, "Mock Torrent 001")
    assert.include(lastName, "Mock Torrent 100")
  })
})

async function revealAllTorrentRows() {
  let previousCount = 0

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const rows = await $$("#torrentTable tbody tr")
    if (rows.length >= TORRENT_COUNT) {
      return
    }

    if (rows.length === previousCount && rows.length > 0) {
      await rows[rows.length - 1].scrollIntoView()
    } else if (rows.length > 0) {
      previousCount = rows.length
      await rows[rows.length - 1].scrollIntoView()
    }

    await browser.pause(250)
  }

  throw new Error(`Expected ${TORRENT_COUNT} torrent rows to be rendered`)
}

async function getTorrentNameText(hash: string) {
  const row = $(`#torrentTable tbody tr[data-hash='${hash}']`)
  await row.waitForDisplayed()
  return row.$("td[data-col='decodedName']").getText()
}
