import path from "node:path"
import { fileURLToPath } from "node:url"
import * as e2e from "../../e2e"
import { configureSpec, createUniqueLabel, requireFeature } from "../../framework/fixture"

const testDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

describe("torrent labels", function () {
  configureSpec()
  requireFeature(({ features }) => features.labels === true)

  const firstLabel = createUniqueLabel("testlabel")
  const secondLabel = createUniqueLabel("someotherlabel")
  let initialLabelCount = 0
  let torrent: e2e.Torrent

  before(async function () {
    const filename = path.join(testDir, "shared/opentracker/data/shared/slow.torrent")
    torrent = await this.app.uploadTorrent({ filename })
    await torrent.waitForExist()
    initialLabelCount = (await this.app.getAllSidebarLabels()).length
  })

  after(async function () {
    if (torrent && await torrent.isExisting()) {
      await torrent.delete()
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

  it("changes back to a previous label", async function () {
    await torrent.changeLabel(firstLabel)
    await torrent.checkInFilterLabel(firstLabel)
  })

  it("removes the label", async function () {
    await torrent.removeLabel()
    const label = await torrent.getLabel()
    label.trim().should.equal("")
  })
})
