import path from "node:path"
import { fileURLToPath } from "node:url"
import * as e2e from "../e2e"
import { configureSpec, getTestFixture, requireFeature } from "../framework/fixture"
import { restartApplication } from "../shared"

const testDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const fixture = getTestFixture()
const client = fixture.client

describe("torrent uploads", function () {
  configureSpec()

  let torrent: e2e.Torrent
  before(async function () {
    const filename = path.join(testDir, "shared/opentracker/data/shared/slow.torrent")
    torrent = await this.app.uploadTorrent({ filename })
  })

  after(async function () {
    if (torrent && await torrent.isExisting()) {
      await torrent.delete()
    }
  })

  it("torrent is visible in the table", () => {
    return torrent.waitForExist()
  })

  it("torrent begins downloading", function () {
    return torrent.waitForState(client.downloadLabel)
  })

  it("torrent is in the downloading tab", function () {
    return torrent.checkInState(["all", "downloading"])
  })
})

describe("magnet link uploads", function () {
  configureSpec()
  requireFeature(({ features }) => features.magnetLinks === true)

  let torrent: e2e.Torrent

  before(async function () {
    await restartApplication(this)
    const filename = path.join(testDir, "shared/opentracker/data/shared/slow.torrent")
    torrent = await this.app.uploadMagnetLink({ filename })
  })

  after(async function () {
    if (torrent && await torrent.isExisting()) {
      await torrent.delete()
    }
  })

  it("torrent is visible in the table", () => {
    return torrent.waitForExist()
  })

  it("torrent begins downloading", () => {
    return torrent.waitForState(client.downloadLabel)
  })
})
