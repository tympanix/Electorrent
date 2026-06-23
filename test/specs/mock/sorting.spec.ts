import chai from "chai"
import { $, $$, browser } from "@wdio/globals"
import { eventually } from "../../e2e/eventually"
import { configureSpec } from "../../framework/fixture"
import { restartApplication } from "../../shared"

const assert: Chai.AssertStatic = chai.assert

const byteUnits: Record<string, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 ** 2,
  GB: 1024 ** 3,
  TB: 1024 ** 4,
}

type MockTorrent = {
  hash: string
  name: string
  size: number
  progress: number
  state: string
}

describe("mock torrent table sorting", function () {
  configureSpec({ clearTorrents: false })

  const sortingScenario: MockTorrent[] = [
    mockTorrent(1, "Zeta Linux ISO", 900, 0.45, "downloading"),
    mockTorrent(2, "Alpha Archive", 120, 0.12, "downloading"),
    mockTorrent(3, "Omega Dataset", 760, 0.76, "stalledDL"),
    mockTorrent(4, "Beta Movie", 340, 1, "uploading"),
    mockTorrent(5, "Gamma Ebook", 220, 1, "pausedUP"),
    mockTorrent(6, "Delta Album", 560, 0, "downloading"),
    mockTorrent(7, "Epsilon Photos", 640, 0, "pausedDL"),
    mockTorrent(8, "Theta Backup", 420, 0.33, "downloading"),
    mockTorrent(9, "Iota Course", 810, 0.91, "stalledDL"),
    mockTorrent(10, "Kappa Source", 150, 0.22, "downloading"),
    mockTorrent(11, "Lambda Manual", 990, 0.66, "downloading"),
    mockTorrent(12, "Mu Sample", 300, 0.55, "downloading"),
  ]

  beforeEach(async function () {
    await resetMockedTorrents()
    await addMockedTorrents(sortingScenario)
    await waitForMockRows(sortingScenario.length)
  })

  function mockTorrent(index: number, name: string, sizeMb: number, progress: number, state: string): MockTorrent {
    return {
      hash: index.toString(16).padStart(40, "0"),
      name,
      size: sizeMb * 1024 * 1024,
      progress,
      state,
    }
  }

  async function invokeMockAction(action: string, ...args: any[]) {
    await browser.execute(async (request) => {
      await (window as any).electorrent.bittorrent.invokeAction(request)
    }, { action, args })
  }

  async function resetMockedTorrents() {
    await invokeMockAction("clearMockedTorrents")
  }

  async function addMockedTorrents(torrents: MockTorrent[]) {
    for (const torrent of torrents) {
      await invokeMockAction("addMockedTorrent", torrent)
    }
  }

  async function waitForMockRows(expectedCount = 1) {
    await eventually(async () => (await $$("#torrentTable tbody tr[data-hash]")).length)
      .satisfies(`be at least ${expectedCount}`, (count) => count >= expectedCount)
  }

  async function getColumnHeader(columnName: string) {
    const header = $(`//table[@id='torrentTable']//th[contains(normalize-space(.), '${columnName}')]`)
    await header.waitForDisplayed()
    await header.waitForClickable()
    return header
  }

  async function clickColumn(columnName: string) {
    const header = await getColumnHeader(columnName)
    await header.click()
    await waitForMockRows(sortingScenario.length)
  }

  async function sortColumn(columnName: string, descending: boolean) {
    const header = await getColumnHeader(columnName)
    const sortClass = descending ? "sortdown" : "sortup"
    if (!(await header.getAttribute("class")).split(/\s+/).includes(sortClass)) {
      await header.click()
    }
    await eventually(() => header.getAttribute("class"))
      .satisfies(`include ${sortClass}`, (className) => (className || "").split(/\s+/).includes(sortClass), { timeout: 5 * 1000 })
    await waitForMockRows(sortingScenario.length)
  }

  async function getColumnValues(column: string) {
    await waitForMockRows(sortingScenario.length)
    const cells = await $$(`#torrentTable tbody tr[data-hash] td[data-col='${column}']`)
    const values: string[] = []
    for (const cell of cells) {
      values.push((await cell.getText()).trim())
    }
    return values
  }

  function parseBytes(value: string) {
    const match = value.match(/^(\d+(?:\.\d+)?)\s+([KMGT]?B)$/)
    assert.isNotNull(match, `Expected byte value, got ${value}`)
    return Number(match![1]) * byteUnits[match![2]]
  }

  function parseProgress(value: string) {
    const match = value.match(/^(.+?)\s+(\d+(?:\.\d+)?)%$/)
    if (!match) {
      return {
        status: value,
        progress: 0,
      }
    }
    return {
      status: match[1],
      progress: Number(match[2]),
    }
  }

  async function getProgressRows() {
    await waitForMockRows(sortingScenario.length)
    const cells = await $$("#torrentTable tbody tr[data-hash] td[data-col='percent']")
    const values: Array<{ progress: number, status: string }> = []
    for (const cell of cells) {
      values.push(parseProgress((await cell.getText()).trim()))
    }
    return values
  }

  function assertSorted<T>(values: T[], compare: (left: T, right: T) => number, format = (value: T) => String(value)) {
    assert.isAtLeast(values.length, 2)
    for (let index = 1; index < values.length; index += 1) {
      assert.isAtMost(compare(values[index - 1], values[index]), 0, `Values are not sorted at index ${index}: ${values.map(format).join(", ")}`)
    }
  }

  function compareProgressStatus(descendingProgress: boolean) {
    return (left: { progress: number, status: string }, right: { progress: number, status: string }) => {
      const progressCompare = descendingProgress
        ? right.progress - left.progress
        : left.progress - right.progress
      return progressCompare || left.status.localeCompare(right.status)
    }
  }

  function formatProgressRow(row: { progress: number, status: string }) {
    return `${row.status} ${row.progress}%`
  }

  function assertHasStatusTie(rows: Array<{ progress: number, status: string }>) {
    assert.isTrue(rows.some((row, index) => {
      return rows.slice(index + 1).some((other) => row.progress === other.progress && row.status !== other.status)
    }), "Expected at least one equal-progress group with different statuses")
  }

  it("sorts by size and persists that sort after restart", async function () {
    await clickColumn("Size")

    const sizes = (await getColumnValues("size")).map(parseBytes)
    assertSorted(sizes, (left, right) => right - left)

    await restartApplication(this)
    await this.app.torrentsPageIsVisible({ timeout: 10 * 1000 })
    await addMockedTorrents(sortingScenario)
    await waitForMockRows(sortingScenario.length)

    const persistedSizes = (await getColumnValues("size")).map(parseBytes)
    assertSorted(persistedSizes, (left, right) => right - left)
  })

  it("sorts by name in the opposite direction and persists after restart", async function () {
    await clickColumn("Name")
    await clickColumn("Name")

    const names = await getColumnValues("decodedName")
    assertSorted(names, (left, right) => right.localeCompare(left))

    await restartApplication(this)
    await this.app.torrentsPageIsVisible({ timeout: 10 * 1000 })
    await addMockedTorrents(sortingScenario)
    await waitForMockRows(sortingScenario.length)

    const persistedNames = await getColumnValues("decodedName")
    assertSorted(persistedNames, (left, right) => right.localeCompare(left))
  })

  it("sorts the progress column by progress descending, then status", async function () {
    await sortColumn("Progress", true)

    const rows = await getProgressRows()
    assertHasStatusTie(rows)
    assertSorted(rows, compareProgressStatus(true), formatProgressRow)
  })

  it("sorts the progress column by progress ascending, then status", async function () {
    await sortColumn("Progress", false)

    const rows = await getProgressRows()
    assertHasStatusTie(rows)
    assertSorted(rows, compareProgressStatus(false), formatProgressRow)
  })
})
