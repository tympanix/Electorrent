import chai from "chai"
import { $$, browser } from "@wdio/globals"
import { Torrent } from "../../e2e"
import { eventually } from "../../e2e/eventually"
import { configureSpec, getTestFixture } from "../../framework/fixture"

const assert: Chai.AssertStatic = chai.assert

// The "Saved Settings" notification overlaps the settings button while it is
// on screen, so wait it out before navigating back into the settings page.
async function waitForNotificationsToClear() {
  await eventually(async () => (await $$(".ui.message.positive")).length).equals(0, { timeout: 20 * 1000 })
}

describe("mock speed units", function () {
  configureSpec()

  it("defaults to bytes per second", async function () {
    const app = getTestFixture().app

    await app.openSettings()
    await app.settingsGotoTab("general")
    assert.equal(await app.getGeneralDropdownValue("Speed Units"), "Bytes (MB/s)")
    await app.settingsCancel()
  })

  it("renders transfer speeds in the configured unit", async function () {
    const hash = "0000000000000000000000000000000000000002"
    await browser.execute(async (torrent) => {
      await (window as any).electorrent.bittorrent.invokeAction({
        action: "addMockedTorrent",
        args: [torrent],
      })
    }, {
      hash,
      name: "Speed unit torrent",
      state: "downloading",
      dl_speed: 1024 * 1024,
      up_speed: 512 * 1024,
    })

    const app = getTestFixture().app
    const torrent = new Torrent({ hash, app })
    await torrent.waitForExist()

    const downloadSpeed = async () => (await torrent.getColumn("downloadSpeed")).trim()
    const uploadSpeed = async () => (await torrent.getColumn("uploadSpeed")).trim()

    await eventually(downloadSpeed).equals("1 MB/s")
    await eventually(uploadSpeed).equals("512 KB/s")

    await app.openSettings()
    await app.settingsGotoTab("general")
    await app.selectGeneralDropdownValue("Speed Units", "Bits (Mb/s)")
    await app.settingsSave()
    await app.torrentsPageIsVisible()
    await waitForNotificationsToClear()

    await eventually(downloadSpeed).equals("8.4 Mb/s")
    await eventually(uploadSpeed).equals("4.2 Mb/s")

    await app.openSettings()
    await app.settingsGotoTab("general")
    await app.selectGeneralDropdownValue("Speed Units", "Bytes (MB/s)")
    await app.settingsSave()
    await app.torrentsPageIsVisible()
    await waitForNotificationsToClear()

    await eventually(downloadSpeed).equals("1 MB/s")
  })
})
