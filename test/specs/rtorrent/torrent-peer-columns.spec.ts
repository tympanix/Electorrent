import * as e2e from "../../e2e"
import { eventually } from "../../e2e/eventually"
import { configureSpec, getTestFixture, requireFeature } from "../../framework/fixture"
import { createTorrentFile } from "../../torrent"

describe("rTorrent peer columns", function () {
  configureSpec()
  requireFeature(({ features }) => features.torrentPeers === true)

  it("shows connection direction and flags for a connected peer", async function () {
    this.timeout(60 * 1000)

    const filename = await createTorrentFile(getTestFixture().tracker, {
      fileSize: 100_000,
      downloadSpeed: 1,
      uploadSpeed: 1,
      seedDelay: 15,
    })
    const torrent: e2e.Torrent = await this.app.uploadTorrent({ filename })
    await torrent.waitForExist()

    let detailsPanelOpen = false
    try {
      const panel = await torrent.openDetailsPanel()
      detailsPanelOpen = true
      await torrent.openDetailsTab("peers")

      const peersTab = panel.$("[data-role='torrent-details-peers']")
      await eventually(async () => (await peersTab.$$("tbody td[data-col='ip']")).length).satisfies(
        "contain a connected peer row",
        (peerCount) => peerCount > 0,
        { timeout: 30_000 },
      )

      const connection = await peersTab.$("tbody td[data-col='connection']").getText()
      const flags = await peersTab.$("tbody td[data-col='flags']").getText()
      const validFlags = new Set([
        "Encrypted",
        "Obfuscated",
        "Snubbed",
        "Unwanted",
        "Preferred",
        "Banned",
        "None",
      ])

      new Set(["Incoming", "Outgoing"]).has(connection).should.equal(true)
      flags.should.not.equal("")
      flags.split(", ").every((flag) => validFlags.has(flag)).should.equal(true)
    } finally {
      if (detailsPanelOpen) {
        await torrent.closeDetailsPanel()
      }
      if (await torrent.isExisting()) {
        await torrent.delete()
      }
    }
  })
})
