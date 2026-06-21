import { browser } from '@wdio/globals'
import { createTorrentFile } from '../../torrent'
import { configureSpec, createUniqueLabel, getTestFixture, requireFeature } from '../../framework/fixture'

const fixture = getTestFixture()
const client = fixture.client
const tracker = fixture.tracker

describe('torrent ratio limits', function () {
  configureSpec()
  requireFeature(({ features }) => features.ratioLimits === true)

  let torrent

  beforeEach(async function () {
    const filename = await createTorrentFile(tracker, { torrentName: createUniqueLabel('torrent-ratio-limits') })
    torrent = await this.app.uploadTorrent({ filename })
    await torrent.waitForStates([client.downloadLabel, 'Seeding'])
  })

  afterEach(async function () {
    if (torrent) {
      await torrent.delete().catch(() => undefined)
      torrent = null
    }
  })

  it('sets ratio target from context menu', async function () {
    const ratioLimit = 1.5
    await torrent.setRatioLimit(ratioLimit)

    await browser.waitUntil(async () => await torrent.getRatioModalValue() === String(ratioLimit), {
      timeout: 10 * 1000,
      timeoutMsg: `Expected ratio modal to show ratio target ${ratioLimit}`,
    })
  })
})
