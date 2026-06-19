import { browser } from '@wdio/globals'
import { createTorrentFile } from '../torrent'
import { configureSpec, createUniqueLabel, getTestFixture, requireFeature } from '../framework/fixture'

const fixture = getTestFixture()
const client = fixture.client
const tracker = fixture.tracker

describe('torrent speed limits', function () {
  configureSpec()
  requireFeature(({ features }) => features.speedLimits === true)

  let torrent

  beforeEach(async function () {
    const filename = await createTorrentFile(tracker, { torrentName: createUniqueLabel('torrent-speed-limits') })
    torrent = await this.app.uploadTorrent({ filename })
    await torrent.waitForStates([client.downloadLabel, 'Seeding'])
  })

  afterEach(async function () {
    if (torrent) {
      await torrent.delete().catch(() => undefined)
      torrent = null
    }
  })

  it('sets download speed limit from context menu', async function () {
    if (client.features.torrentDetails !== true) return this.skip()

    const downloadSpeedLimit = 41
    await torrent.setSpeedLimits({ downloadSpeedLimit })
    await torrent.openDetailsPanel()

    await browser.waitUntil(async () => (await torrent.getDetailsFieldValue('download-limit')) === `${downloadSpeedLimit} KB/s`, {
      timeout: 10 * 1000,
      timeoutMsg: `Expected download limit to become ${downloadSpeedLimit} KB/s`,
    })

    await torrent.closeDetailsPanel()
    await browser.waitUntil(async () => (await torrent.getSpeedLimitModalValues()).download === String(downloadSpeedLimit), {
      timeout: 10 * 1000,
      timeoutMsg: `Expected speed limit modal to show download limit ${downloadSpeedLimit}`,
    })
  })

  it('sets upload speed limit from context menu', async function () {
    if (client.features.torrentDetails !== true) return this.skip()

    const uploadSpeedLimit = 43
    await torrent.setSpeedLimits({ uploadSpeedLimit })
    await torrent.openDetailsPanel()

    await browser.waitUntil(async () => (await torrent.getDetailsFieldValue('upload-limit')) === `${uploadSpeedLimit} KB/s`, {
      timeout: 10 * 1000,
      timeoutMsg: `Expected upload limit to become ${uploadSpeedLimit} KB/s`,
    })

    await torrent.closeDetailsPanel()
    await browser.waitUntil(async () => (await torrent.getSpeedLimitModalValues()).upload === String(uploadSpeedLimit), {
      timeout: 10 * 1000,
      timeoutMsg: `Expected speed limit modal to show upload limit ${uploadSpeedLimit}`,
    })
  })
})
