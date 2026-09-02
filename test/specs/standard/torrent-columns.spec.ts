import chai from "chai"
import fs from "node:fs"
import parseTorrent from "parse-torrent"
import { $, $$ } from "@wdio/globals"
import * as e2e from "../../e2e"
import { eventually } from "../../e2e/eventually"
import { createTorrentFile } from "../../torrent"
import { configureSpec, createUniqueLabel, formatBytes, getTestFixture } from "../../framework/fixture"

const { assert } = chai
const fixture = getTestFixture()
const client = fixture.client
const tracker = fixture.tracker
const minimumColumnWidth = 25

const builtInColumns = [
  "Name",
  "Size",
  "Down",
  "Up",
  "Upload total",
  "Progress",
  "Label",
  "Date Added",
  "Date Completed",
  "Peers",
  "Seeds",
  "Queue",
  "ETA",
  "Ratio",
]

const dateIsSensible = (value: string) => value.length > 0 && !/1969|1970/.test(value)
const decodeTorrentName = (name: string) => name.replace(/[._]/g, " ").replace(/(\[[^\]]*\])(.*)$/, "$2 $1").trim()
const connectedPeers = (value: string) => Number(value.match(/^(\d+) of \d+$/)?.[1] ?? 0)
const totalPeers = (value: string) => Number(value.match(/^\d+ of (\d+)$/)?.[1] ?? 0)

function assertSpeed(value: string) {
  assert.match(value, /^\d+(?:\.\d+)? [KMGT]?B\/s$/)
}

describe("torrent columns", function () {
  configureSpec()

  let torrent: e2e.Torrent
  let torrentName: string
  let expectedTorrentName: string

  before(async function () {
    this.timeout(120 * 1000)

    await this.app.openSettings()
    await this.app.settingsGotoTab("layout")
    for (const columnName of builtInColumns) {
      await this.app.setLayoutColumnEnabled(columnName, true)
    }
    await this.app.settingsSave()
    await this.app.torrentsPageIsVisible()

    torrentName = createUniqueLabel("torrent-columns")
    const torrentPath = await createTorrentFile(tracker, { fileSize: 1, torrentName })
    const torrentInfo = parseTorrent(fs.readFileSync(torrentPath))
    expectedTorrentName = decodeTorrentName(String(torrentInfo.name || torrentName))
    torrent = await this.app.uploadTorrent({ filename: torrentPath })
    await torrent.waitForExist({ timeout: 20 * 1000 })
  })

  after(async function () {
    if (torrent && await torrent.isExisting()) {
      await torrent.delete()
    }
  })

  it("shows a sensible Name column value", async function () {
    assert.equal((await torrent.getColumn("decodedName")).trim(), expectedTorrentName)
  })

  it("shows a sensible Size column value", async function () {
    assert.equal((await torrent.getColumn("size")).trim(), formatBytes(1024))
  })

  it("shows a sensible Down column value", async function () {
    assertSpeed((await torrent.getColumn("downloadSpeed")).trim())
  })

  it("shows a sensible Up column value", async function () {
    assertSpeed((await torrent.getColumn("uploadSpeed")).trim())
  })

  it("shows a sensible Upload total column value", async function () {
    assert.match((await torrent.getColumn("uploaded")).trim(), /^\d+(?:\.\d+)? [KMGT]?B$/)
  })

  it("shows a sensible Progress column value", async function () {
    const progress = (await torrent.getColumn("percent")).trim()
    assert.match(progress, /^[A-Za-z(): ]+(?: \d+(?:\.\d)?%)?$/)
  })

  it("shows a sensible Peers column value", async function () {
    await eventually(() => torrent.getColumn("peersConnected"))
      .satisfies("show a positive total peer count", (value) => totalPeers(value.trim()) > 0, { timeout: 20 * 1000 })

    assert.match((await torrent.getColumn("peersConnected")).trim(), /^\d+ of \d+$/)
  })

  it("shows a sensible Seeds column value", async function () {
    await eventually(() => torrent.getColumn("seedsConnected"))
      .satisfies("show a positive total seed count", (value) => totalPeers(value.trim()) > 0, { timeout: 20 * 1000 })

    assert.match((await torrent.getColumn("seedsConnected")).trim(), /^\d+ of \d+$/)
  })

  it("shows a connected peer in the Peers or Seeds column", async function () {
    this.timeout(60 * 1000)

    const filename = await createTorrentFile(tracker, {
      fileSize: 100_000,
      uploadSpeed: 1,
      seedDelay: 15,
    })
    const peerTorrent = await this.app.uploadTorrent({ filename })
    await peerTorrent.waitForExist()

    try {
      await eventually(async () => {
        const [peers, seeds] = await Promise.all([
          peerTorrent.getColumn("peersConnected"),
          peerTorrent.getColumn("seedsConnected"),
        ])
        return connectedPeers(peers.trim()) + connectedPeers(seeds.trim())
      }).satisfies("show a connected peer", (count) => count > 0, { timeout: 30_000 })
    } finally {
      if (await peerTorrent.isExisting()) {
        await peerTorrent.delete()
      }
    }
  })

  it("shows a sensible Queue column value", async function () {
    assert.match((await torrent.getColumn("torrentQueueOrder")).trim(), /^(|\d+)$/)
  })

  it("shows a sensible ETA column value", async function () {
    assert.match((await torrent.getColumn("eta")).trim(), /^(|a few seconds|a minute|\d+ minutes?|an hour|\d+ hours?|a day|\d+ days?)$/)
  })

  it("shows a sensible Ratio column value", async function () {
    await eventually(() => torrent.getColumn("ratio")).matches(/^-?\d+\.\d{2}$/, { timeout: 20 * 1000 })

    assert.match((await torrent.getColumn("ratio")).trim(), /^-?\d+\.\d{2}$/)
  })

  it("shows a sensible Label column value", async function () {
    if (client.features.labels !== true) {
      return this.skip()
    }

    const label = createUniqueLabel("column-label")
    await torrent.newLabel(label)
    assert.equal((await torrent.getColumn("label")).trim(), label)
  })

  it("finishes the torrent", async function () {
    this.timeout(120 * 1000)
    await torrent.waitForStates(["Seeding", "Finished"], { timeout: 90 * 1000 })
  })

  it("shows a sensible Date Added column value", async function () {
    await eventually(() => torrent.getColumn("dateAdded"))
      .satisfies("show a non-empty sensible date", (value) => dateIsSensible(value.trim()), { timeout: 20 * 1000 })
  })

  it("shows 100.0% progress when a torrent finishes", async function () {
    await eventually(() => torrent.getColumn("percent")).contains("100.0%", { timeout: 20 * 1000 })
  })

  it("shows Date Completed when a torrent finishes", async function () {
    await eventually(() => torrent.getColumn("dateCompleted"))
      .satisfies("show a completion date", (value) => dateIsSensible(value.trim()), { timeout: 20 * 1000 })
  })

  it("gives newly enabled columns a minimum width", async function () {
    this.timeout(60 * 1000)

    await this.app.openSettings()
    await this.app.settingsGotoTab("layout")
    await this.app.setLayoutColumnEnabled("Ratio", false)
    await this.app.settingsSave()
    await this.app.torrentsPageIsVisible()

    const nameHeader = $("#torrentTable thead th:first-child")
    const resizeHandle = nameHeader.$(".rz-handle")
    await resizeHandle.waitForDisplayed({ timeout: 10 * 1000 })
    await resizeHandle.dragAndDrop({ x: 40, y: 0 })

    await this.app.openSettings()
    await this.app.settingsGotoTab("layout")
    await this.app.setLayoutColumnEnabled("Ratio", true)
    await this.app.settingsSave()
    await this.app.torrentsPageIsVisible()

    const headers = await $$("#torrentTable thead th")
    for (const header of headers) {
      const columnName = (await header.getText()).trim()
      const width = (await header.getSize()).width
      assert.isAtLeast(width, minimumColumnWidth, `${columnName} column width`)
    }
  })
})
