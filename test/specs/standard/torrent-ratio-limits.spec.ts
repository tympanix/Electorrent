import chai from 'chai'
import { browser } from '@wdio/globals'
import { createTorrentFile } from '../../torrent'
import { configureSpec, createUniqueLabel, getTestFixture, requireFeature } from '../../framework/fixture'

const { assert } = chai

const fixture = getTestFixture()
const client = fixture.client
const tracker = fixture.tracker

describe('torrent ratio limits', function () {
  configureSpec()
  requireFeature(({ features }) => features.ratioLimits === true)

  let torrent

  before(async function () {
    await this.app.openSettings()
    await this.app.settingsGotoTab('layout')
    await this.app.setLayoutColumnEnabled('Ratio Limit', true)
    await this.app.settingsSave()
    await this.app.torrentsPageIsVisible()
  })

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

  it('sets ratio limit from context menu', async function () {
    const ratioLimit = 1.5
    await torrent.setRatioLimit(ratioLimit)

    await browser.waitUntil(async () => await torrent.getColumn('ratioLimit') === ratioLimit.toFixed(2), {
      timeout: 10 * 1000,
      timeoutMsg: `Expected ratio limit column to show ${ratioLimit.toFixed(2)}`,
    })

    assert.equal(await torrent.getRatioModalValue(), String(ratioLimit))
  })
})
