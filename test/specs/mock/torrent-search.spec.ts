import chai from "chai"
import { $, $$, browser } from "@wdio/globals"
import { eventually } from "../../e2e/eventually"
import { configureSpec } from "../../framework/fixture"

const assert: Chai.AssertStatic = chai.assert

const torrents = [
  { hash: "1234567890abcdef1234567890abcdef12345678", name: "Alpine Linux image" },
  { hash: "deadbeef0123456789abcdef0123456789abcdef", name: "Debian installation media" },
  { hash: "fedcba0987654321fedcba0987654321fedcba09", name: "Fedora workstation image" },
]

describe("mock torrent search", function () {
  configureSpec({ clearTorrents: false })

  before(async function () {
    await invokeMockAction("clearMockedTorrents")
    for (const torrent of torrents) {
      await invokeMockAction("addMockedTorrent", torrent)
    }
    await expectVisibleHashes(torrents.map(({ hash }) => hash))
  })

  it("filters torrents by name and info hash search", async function () {
    const searchInput = $("input[placeholder='Search torrents...']")
    await searchInput.waitForDisplayed()

    await expectSearchResults(searchInput, "Debian installation", [torrents[1].hash])

    await expectSearchResults(searchInput, "deadbeef", [torrents[1].hash])

    await expectSearchResults(searchInput, "", torrents.map(({ hash }) => hash))
    assert.equal(await searchInput.getValue(), "")
  })
})

async function invokeMockAction(action: string, ...args: any[]) {
  await browser.execute(async (request) => {
    await (window as any).electorrent.bittorrent.invokeAction(request)
  }, { action, args })
}

async function getVisibleHashes() {
  const rows = await $$("#torrentTable tbody tr[data-hash]")
  const hashes: string[] = []
  for (const row of rows) {
    hashes.push(await row.getAttribute("data-hash"))
  }
  return hashes
}

async function setSearch(searchInput: ReturnType<typeof $>, value: string) {
  await searchInput.setValue(value)
  await eventually(() => searchInput.getValue()).equals(value)
}

async function expectSearchResults(searchInput: ReturnType<typeof $>, search: string, expected: string[]) {
  const sortedExpected = [...expected].sort().join(",")
  await setSearch(searchInput, search)
  await eventually(async () => {
    if (await searchInput.getValue() !== search) {
      await setSearch(searchInput, search)
    }
    return (await getVisibleHashes()).sort().join(",")
  }).equals(sortedExpected)
}

async function expectVisibleHashes(expected: string[]) {
  await eventually(async () => (await getVisibleHashes()).sort().join(","))
    .equals([...expected].sort().join(","))
}
