import chai from "chai"
import { browser } from "@wdio/globals"
import { Torrent } from "../../e2e"
import { configureSpec, getTestFixture } from "../../framework/fixture"

const assert: Chai.AssertStatic = chai.assert

describe("mock torrent size", function () {
  configureSpec()

  it("leaves the size blank while metadata is unavailable", async function () {
    const hash = "0000000000000000000000000000000000000001"
    await browser.execute(async (torrent) => {
      await (window as any).electorrent.bittorrent.invokeAction({
        action: "addMockedTorrent",
        args: [torrent],
      })
    }, {
      hash,
      name: "Magnet awaiting metadata",
      size: -1,
      state: "metaDL",
    })

    const torrent = new Torrent({ hash, app: getTestFixture().app })
    await torrent.waitForExist()

    assert.equal((await torrent.getColumn("size")).trim(), "")
  })
})
