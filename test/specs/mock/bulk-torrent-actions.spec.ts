import chai from "chai"
import { $, $$, browser } from "@wdio/globals"
import { Key } from "webdriverio"
import { eventually } from "../../e2e/eventually"
import { configureSpec } from "../../framework/fixture"

const assert: Chai.AssertStatic = chai.assert

const torrents = [
  { hash: "11".padStart(40, "0"), name: "Selected torrent one", state: "downloading" },
  { hash: "22".padStart(40, "0"), name: "Selected torrent two", state: "downloading" },
  { hash: "33".padStart(40, "0"), name: "Unselected torrent", state: "downloading" },
]

describe("mock bulk torrent actions", function () {
  configureSpec({ clearTorrents: false })

  before(async function () {
    await invokeMockAction("clearMockedTorrents")
    for (const torrent of torrents) {
      await invokeMockAction("addMockedTorrent", torrent)
    }
    await eventually(async () => (await $$("#torrentTable tbody tr[data-id]")).length)
      .equals(torrents.length)
  })

  it("applies a stop and resume action to every selected torrent", async function () {
    const firstSelected = await $(`#torrentTable tbody tr[data-id='${torrents[0].hash}']`)
    const secondSelected = await $(`#torrentTable tbody tr[data-id='${torrents[1].hash}']`)
    await firstSelected.waitForClickable()
    await firstSelected.click()
    await shiftClick(secondSelected)

    await eventually(getSelectedIds).satisfies(
      "include both selected torrents",
      (ids) => ids.length === 2
        && ids.includes(torrents[0].hash)
        && ids.includes(torrents[1].hash),
    )

    const stopButton = $("#torrent-action-header a[data-role='stop']")
    await stopButton.waitForClickable()
    await stopButton.click()

    await expectTorrentState(torrents[0].hash, "Stopped")
    await expectTorrentState(torrents[1].hash, "Stopped")
    assert.include(await getTorrentState(torrents[2].hash), "Downloading")

    const resumeButton = $("#torrent-action-header a[data-role='resume']")
    await resumeButton.waitForClickable()
    await resumeButton.click()

    await expectTorrentState(torrents[0].hash, "Downloading")
    await expectTorrentState(torrents[1].hash, "Downloading")
    assert.include(await getTorrentState(torrents[2].hash), "Downloading")
  })
})

async function invokeMockAction(action: string, ...args: any[]) {
  await browser.execute(async (request) => {
    await (window as any).electorrent.bittorrent.invokeAction(request)
  }, { action, args })
}

async function shiftClick(row: Awaited<ReturnType<typeof $>>) {
  await browser.actions([
    browser.action("key")
      .down(Key.Shift)
      .pause(0)
      .pause(0)
      .pause(0)
      .up(Key.Shift),
    browser.action("pointer")
      .pause(0)
      .move({ origin: row, duration: 0 })
      .down({ button: 0 })
      .up({ button: 0 })
      .pause(0),
  ])
}

async function getSelectedIds() {
  const rows = await $$("#torrentTable tbody tr.active[data-id]")
  const ids: string[] = []
  for (const row of rows) {
    ids.push(await row.getAttribute("data-id"))
  }
  return ids
}

async function getTorrentState(id: string) {
  return $(`#torrentTable tbody tr[data-id='${id}'] td[data-col='percent']`).getText()
}

async function expectTorrentState(id: string, expected: string) {
  await eventually(() => getTorrentState(id))
    .satisfies(`include ${expected}`, (state) => state.includes(expected))
}
