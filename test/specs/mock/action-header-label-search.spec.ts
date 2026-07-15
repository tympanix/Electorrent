import chai from "chai"
import { $, $$, browser } from "@wdio/globals"
import { eventually } from "../../e2e/eventually"
import { configureSpec } from "../../framework/fixture"

const assert: Chai.AssertStatic = chai.assert

const torrents = [
  { hash: "1".padStart(40, "0"), name: "Alpha torrent", category: "alpha-label" },
  { hash: "2".padStart(40, "0"), name: "Beta torrent", category: "beta-label" },
  { hash: "3".padStart(40, "0"), name: "Gamma torrent", category: "gamma-label" },
]

describe("mock action header label search", function () {
  configureSpec({ clearTorrents: false })

  before(async function () {
    await invokeMockAction("clearMockedTorrents")
    for (const torrent of torrents) {
      await invokeMockAction("addMockedTorrent", torrent)
    }

    await eventually(async () => (await $$("#torrentTable tbody tr[data-hash]")).length)
      .equals(torrents.length)
  })

  it("filters the labels in the action header dropdown", async function () {
    const torrentRow = $(`#torrentTable tbody tr[data-hash='${torrents[0].hash}']`)
    await torrentRow.waitForClickable()
    await torrentRow.click()

    const labelsDropdown = $("#torrent-action-header div[data-role='labels']")
    await labelsDropdown.waitForClickable()
    await labelsDropdown.click()

    const searchInput = labelsDropdown.$("input[placeholder='Search labels...']")
    await searchInput.waitForDisplayed()
    assert.notInclude(await searchInput.parentElement().getAttribute("class"), "search")
    await searchInput.setValue("beta")

    await eventually(getDisplayedLabels).satisfies(
      "only include beta-label",
      (labels) => labels.length === 1 && labels[0] === "beta-label",
    )
    assert.deepEqual(await getDisplayedLabels(), ["beta-label"])

    await searchInput.setValue("missing")
    await eventually(getDisplayedLabels).satisfies("be empty", (labels) => labels.length === 0)

    const noResults = labelsDropdown.$(".message")
    await noResults.waitForDisplayed()
    assert.equal(await noResults.getText(), "No results found")
  })
})

async function invokeMockAction(action: string, ...args: any[]) {
  await browser.execute(async (request) => {
    await (window as any).electorrent.bittorrent.invokeAction(request)
  }, { action, args })
}

async function getDisplayedLabels() {
  const options = await $$("#torrent-action-header [data-role='label-option']")
  const labels: string[] = []
  for (const option of options) {
    if (await option.isDisplayed()) {
      labels.push((await option.getAttribute("data-label")) || "")
    }
  }
  return labels
}
