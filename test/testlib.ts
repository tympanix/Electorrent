import chai, { assert } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { after, afterEach, before, beforeEach, describe, it } from 'mocha'
import path from 'path'

import * as e2e from './e2e'
import { dockerComposeHooks, restartApplication, startApplicationHooks } from './shared'
import { createTorrentFile } from './torrent'
import { FeatureSet, setupMochaHooks, waitForHttp } from './testutil'
import { TorrentClient } from '../src/renderer/app/bittorrent'
import { $, $$, browser } from '@wdio/globals'

interface TestSuiteOptionsOptional {
  client: TorrentClient
  fixture: string,
  version?: string,
  username: string,
  password: string,
  host?: string,
  port: number,
  proxyPort?: number,
  acceptHttpStatus?: number,
  timeout?: number,
  stopLabel?: string,
  downloadLabel?: string,
  unsupportedFeatures: FeatureSet[]
}

const TEST_SUITE_OPTIONS_DEFAULTS = {
  username: 'admin',
  password: 'admin',
  version: 'latest',
  host: 'localhost',
  port: 8080,
  acceptHttpStatus: 200,
  timeout: 10*1000,
  stopLabel: 'Stopped',
  downloadLabel: 'Downloading',
}

function createUniqueLabel(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Options given to a test suite execution with information about the backend bittorrent service
 * to be tested, login information, features etc.
 */
export type TestSuiteOptions = TestSuiteOptionsOptional & (typeof TEST_SUITE_OPTIONS_DEFAULTS)

/**
 * Make sure the current test suite defined in `options` supports a certain `feature`. If not,
 * skip all test in the current mocha context
 * @param options test suite options
 * @param feature the feature that is required to continue
 */
function requireFeatureHook(options: TestSuiteOptions, feature: FeatureSet) {
  before(function() {
    if (options.unsupportedFeatures.includes(feature)) {
      this.skip()
    }
  })
}

export function createTestSuite(optionsArg: TestSuiteOptionsOptional) {
  const options: TestSuiteOptions = Object.assign({}, TEST_SUITE_OPTIONS_DEFAULTS, optionsArg)

  setupMochaHooks()

  global.before(function () {
    chai.should()
    chai.use(chaiAsPromised)
  })

  describe(`given ${options.client.id}-${options.version} service is running (docker-compose)`, function () {

    // start up opentracker docker-compose services
    const tracker = dockerComposeHooks([__dirname, 'shared', 'opentracker'], {}, { serviceName: 'peer' })

    // start up the backend service to be tested
    const backend = dockerComposeHooks([__dirname, options.fixture], {
      env: Object.assign({}, process.env, {
        VERSION: options.version,
      }),
    })

    before(async function () {
      this.timeout(20 * 1000)
      await waitForHttp({ url: `http://${options.host}:${options.port}`, statusCode: options.acceptHttpStatus})
    })

    describe('given tls/ssl reverse proxy is running (docker-compose)', function() {
      // The service name in the docker-compose.yml must be equal to the name of the folder in which it resides
      const backendServiceName = path.basename(options.fixture)

      dockerComposeHooks([__dirname, 'shared', 'nginx'], {
        env: {
          ... process.env,
          'PROXY_HOST': backendServiceName,
          'PROXY_PORT': (options.proxyPort || options.port).toString(),
        },
      })

      describe('given application is running', function() {
        startApplicationHooks()

        it('user is logging in with https', async function() {
          this.retries(3)
          await this.app.login({ ...options, https: true, port: 8443 })
          await this.app.certificateModalIsVisible()
        })

        it('self signed certificate is accepted', async function() {
          await this.app.acceptCertificate()
          await this.app.torrentsPageIsVisible()
        })
      })
    })

    describe('given application is running', function() {
      startApplicationHooks()

        describe('given user is logged in', function() {

        before(async function() {
          this.retries(3)
          await this.app.login(options)
          await this.app.torrentsPageIsVisible()
        })

        it('automatically connect when restarting app', async function() {
          await restartApplication(this)
          await this.app.torrentsPageIsVisible()
        })

        it('show settings when connection error after restarting app', async function() {
          this.timeout(25 * 1000)
          await backend.pause()
          await restartApplication(this)
          await this.app.settingsPageIsVisible({ timeout: 10 * 1000})
          await this.app.settingsPageConnectionIsVisible()
          await backend.unpause()
          await restartApplication(this)
          await this.app.torrentsPageIsVisible()
        })

        if (options.client.id === 'qbittorrent') {
          it('shows qBittorrent free space in the footer', async function() {
            await browser.waitUntil(async () => {
              const footerText = await this.app.getTorrentsFooterText()
              return footerText.includes('Free:')
            })
          })
        }

        describe('settings page', function() {

          beforeEach(async function() {
            this.timeout(10 * 1000)
            await this.app.openSettings()
          })

          it('settings page is visible', async function() {
            await this.app.settingsPageIsVisible()
          })

          it('general settings tab is shown by default', async function() {
            const generalTab = $('#page-settings-general')
            await generalTab.waitForDisplayed()
          })

          it('can navigate to the connection tab', async function() {
            await this.app.settingsGotoTab('connection')
            const connTab = $('#page-settings-connection')
            await connTab.waitForDisplayed()
          })

          it('can navigate to the layout tab', async function() {
            await this.app.settingsGotoTab('layout')
            const layoutTab = $('#page-settings-layout')
            await layoutTab.waitForDisplayed()
          })

          it('can navigate to the about tab', async function() {
            await this.app.settingsGotoTab('about')
            const aboutTab = $('#page-settings-about')
            await aboutTab.waitForDisplayed()
          })
        })

        describe('given a torrent file is uploaded', function() {
          let torrent: e2e.Torrent

          before(async function() {
            torrent = await this.app.uploadTorrent({
              filename: path.join(__dirname, 'shared', 'ubuntu.torrent'),
            })
          })

          it('torrent is visible in the torrent list', async function() {
            await torrent.waitForVisible()
          })

          it('torrent is downloading', async function() {
            await browser.waitUntil(async () => {
              return await torrent.getStatus() === options.downloadLabel
            }, {
              timeout: options.timeout,
            })
          })

          it('torrent can be removed', async function() {
            await torrent.removeAndDelete()
            await torrent.waitForNotExisting()
          })
        })

        describe('given a new torrent label exists', function() {
          const labelName = createUniqueLabel('test-label')

          before(async function() {
            await this.app.openNewLabelModal()
            await this.app.createLabel({ label: labelName })
          })

          it('label is shown in the labels dropdown', async function() {
            await this.app.waitForLabelInDropdown(labelName)
          })

          it('label can be assigned while adding a torrent', async function() {
            const torrentFile = await createTorrentFile({
              announce: [tracker.url],
              name: 'ubuntu.torrent',
            })
            const torrent = await this.app.uploadTorrent({ filename: torrentFile, askUploadOptions: true })
            await this.app.uploadTorrentModalSubmit({ label: labelName, start: true })
            await torrent.waitForVisible()
            await assert.eventually.equal(torrent.getLabel(), labelName)
          })
        })
      })
    })
  })
}
