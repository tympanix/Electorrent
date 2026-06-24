import path from "node:path"
import { fileURLToPath } from "node:url"
import * as e2e from "../../e2e"
import { configureSpec, createUniqueLabel, getTestFixture, requireFeature } from "../../framework/fixture"
import { createTorrentFile } from "../../torrent"

const testDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const tracker = getTestFixture().tracker
const noLabelFilter = "__electorrent_no_label__"

describe("torrent labels", function () {
  configureSpec()
  requireFeature(({ features }) => features.labels === true)

  const firstLabel = createUniqueLabel("testlabel")
  const secondLabel = createUniqueLabel("someotherlabel")
  let initialLabelCount = 0
  let torrent: e2e.Torrent
  let unlabeledTorrent: e2e.Torrent

  before(async function () {
    const filename = path.join(testDir, "shared/opentracker/data/shared/slow.torrent")
    const unlabeledFilename = await createTorrentFile(tracker, { torrentName: createUniqueLabel("unlabeled") })
    torrent = await this.app.uploadTorrent({ filename })
    unlabeledTorrent = await this.app.uploadTorrent({ filename: unlabeledFilename })
    await torrent.waitForExist()
    await unlabeledTorrent.waitForExist()
    initialLabelCount = (await this.app.getAllSidebarLabels()).length
  })

  after(async function () {
    if (torrent && await torrent.isExisting()) {
      await torrent.delete()
    }
    if (unlabeledTorrent && await unlabeledTorrent.isExisting()) {
      await unlabeledTorrent.delete()
    }
  })

  it("applies a new label", async function () {
    await torrent.newLabel(firstLabel)
    await this.app.waitForLabelInDropdown(firstLabel)
    const labels = await this.app.getAllSidebarLabels()
    labels.should.include(firstLabel)
    labels.should.have.length(initialLabelCount + 1)
  })

  it("applies another new label", async function () {
    await torrent.newLabel(secondLabel)
    await this.app.waitForLabelInDropdown(secondLabel)
    await torrent.checkInFilterLabel(secondLabel)
    const labels = await this.app.getAllSidebarLabels()
    labels.should.include(firstLabel)
    labels.should.include(secondLabel)
    labels.should.have.length(initialLabelCount + 2)
  })

  it("filters torrents without a label", async function () {
    await this.app.filterLabel(noLabelFilter)
    await unlabeledTorrent.waitForExist()
    await torrent.waitForGone()
    await this.app.filterLabel()
  })

  it("changes back to a previous label", async function () {
    await torrent.changeLabel(firstLabel)
    await torrent.checkInFilterLabel(firstLabel)
  })
})
