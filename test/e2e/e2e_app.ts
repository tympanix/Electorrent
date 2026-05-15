import { assert } from 'chai'
import fs from 'fs'
import magnet from 'magnet-uri'
import parseTorrent from 'parse-torrent'
import path from 'path'

import { $, $$, browser, expect } from '@wdio/globals'
import { TorrentClient } from '../../src/renderer/app/bittorrent'
import { Torrent } from './e2e_torrent'

/**
 * Options to use during the login screen of the app to connect to your torrent client
 */
export interface LoginOptions {
  host: string
  username: string
  password: string
  port: number
  client: TorrentClient
  https?: boolean
}

/**
 * Class to perform various app-related actions with WebDriverIO
 */
export class App {
  torrents: Array<Torrent>
  timeout: number

  constructor() {
    this.torrents = []
    this.timeout = 5 * 1000
  }

  async login(options: LoginOptions) {
    const hostForm = $('#connection-host')
    await hostForm.waitForDisplayed()
    await hostForm.setValue(options.host)

    const protoField = $('#connection-proto')
    await protoField.waitForDisplayed()
    await protoField.waitForClickable()
    await protoField.click()

    const proto = options.https ? 'https' : 'http'
    const protoHttp = $(`#connection-proto-${proto}`)
    await protoHttp.waitForDisplayed()
    await protoHttp.waitForClickable()
    await protoHttp.click()

    const user = $('#connection-user')
    await user.waitForDisplayed()
    await user.setValue(options.username)

    const pass = $('#connection-password')
    await pass.waitForDisplayed()
    await pass.setValue(options.password)

    const clientForm = $('#connection-client')
    await clientForm.waitForDisplayed()
    await clientForm.waitForClickable()
    await clientForm.click()

    const clientFormSelect = $(`#connection-client-${options.client.id}`)
    await clientFormSelect.waitForDisplayed()
    await clientFormSelect.waitForClickable()
    await clientFormSelect.click()

    const portForm = $('#connection-port')
    await portForm.waitForDisplayed()
    await portForm.setValue(options.port)

    const submit = $('#connection-submit')
    await submit.waitForDisplayed()
    await submit.waitForClickable()
    await submit.click()
  }

  async torrentsPageIsVisible(opts?: { timeout: number }) {
    const pageTorrents = $('#page-torrents')
    await pageTorrents.waitForDisplayed({ timeout: opts?.timeout ?? this.timeout })
  }

  async settingsPageIsVisible(opts?: { timeout: number }) {
    const settingsPage = $('#page-settings')
    await settingsPage.waitForDisplayed({ timeout: opts?.timeout ?? this.timeout })
  }

  async settingsPageConnectionIsVisible() {
    const settingsPage = $('#page-settings-connection')
    await settingsPage.waitForDisplayed({ timeout: this.timeout })
  }

  async certificateModalIsVisible() {
    const certificateModal = $('#certificateModal')
    await certificateModal.waitForExist()
    await certificateModal.waitForDisplayed({ timeout: this.timeout })
    return certificateModal
  }

  async acceptCertificate() {
    const certificateModal = await this.certificateModalIsVisible()
    const submit = certificateModal.$('button.approve')
    await submit.waitForExist()
    await submit.waitForDisplayed()
    await submit.waitForClickable()
    await submit.waitForEnabled()
    await submit.click()
  }

  async getNotificationError() {
      const msg = $('#notifications .negative')
      try {
        await msg.waitForExist({ timeout: 1000 })
        return {
          title: await msg.$('.header').getText(),
          message: await msg.$('p').getText(),
        }
      } catch {
        return null
      }
  }

  async uploadTorrentModalVisible() {
    const modal = $('#uploadTorrentModal')
    await modal.waitForDisplayed()
    return modal
  }

  async uploadTorrentModalSubmit(options?: { label?: string, start?: boolean, name?: string, saveLocation?: string }) {
    const modal = await this.uploadTorrentModalVisible()
    await browser.pause(200)

    if (options?.name) {
      const nameInput = modal.$("input[data-action='rename-torrent']")
      await nameInput.waitForDisplayed()
      await nameInput.setValue(options.name)
    }

    if (options?.saveLocation) {
      const saveLocationInput = modal.$("input[data-action='save-location']")
      await saveLocationInput.waitForDisplayed()
      await saveLocationInput.setValue(options.saveLocation)
    }

    if (options?.start !== undefined) {
      const startToggle = modal.$('div[data-action="start-torrent"]')
      const startToggleInput = startToggle.$('input')
      await startToggle.waitForDisplayed()
      await startToggleInput.waitForExist()
      await startToggleInput.scrollIntoView()
      if (await startToggleInput.isSelected() !== options.start) {
        await startToggleInput.click()
        await browser.waitUntil(async () => (await startToggleInput.isSelected()) === options.start, {
          timeout: 5_000,
          timeoutMsg: `Expected start torrent toggle to become ${options.start}`,
        })
      }
    }

    if (options?.label) {
      const labelElem = modal.$('div[title=Label]')
      await labelElem.waitForClickable()
      await labelElem.click()
      const labelItemElem = labelElem.$(`div[data-label='${options.label}']`)
      await labelItemElem.waitForDisplayed()
      await labelItemElem.click()
    }

    await browser.pause(250)
    const submitBtn = modal.$('button[type=submit]')
    await submitBtn.click()
    await modal.waitForDisplayed({ reverse: true })
  }

  async uploadTorrent({ filename, askUploadOptions }: { filename: string, askUploadOptions?: boolean }) {
    const data = fs.readFileSync(path.join(filename))
    const info = parseTorrent(data)
    const hash = info.infoHash
    const torrent = new Torrent({ hash: hash, app: this })
    await expect(await torrent.isExisting()).toBe(false)
    await browser.execute((fileData, fileName, uploadOptions) => {
      const injector = angular.element(document.body).injector()
      const $rootScope = injector.get('$rootScope')
      $rootScope.$broadcast('torrents:add', {
        type: 'file',
        data: new Uint8Array(fileData),
        filename: fileName,
      }, !!uploadOptions)
      $rootScope.$apply()
    }, Array.from(data), path.basename(filename), askUploadOptions)
    this.torrents.push(torrent)
    return torrent
  }

  async uploadMagnetLink({ magnetUri, filename, options }: { magnetUri?: string, filename?: string, options?: magnet.Instance }) {
    if (!magnetUri && filename) {
      const data = fs.readFileSync(filename)
      const info = parseTorrent(data)
      magnetUri = magnet.encode({
        xt: [`urn:btih:${info.infoHash}`],
        tr: info.announce,
      })
    }
    if (!magnetUri) throw new Error('invalid arguments passed to generate magnet uri')
    const info = parseTorrent(magnetUri)
    const torrent = new Torrent({ hash: info.infoHash, app: this })
    await browser.execute((uri) => {
      const injector = angular.element(document.body).injector()
      const $rootScope = injector.get('$rootScope')
      $rootScope.$broadcast('torrents:add', {
        type: 'link',
        uri,
      }, false)
      $rootScope.$apply()
    }, magnetUri)
    this.torrents.push(torrent)
    return torrent
  }

  async waitForLabelInDropdown(labelName) {
    const labelDropdown = $('div[title=Label]')
    await labelDropdown.waitForDisplayed()
    await labelDropdown.click()
    const labelDropdownItem = labelDropdown.$(`div[data-label='${labelName}']`)
    await labelDropdownItem.waitForDisplayed({ timeout: this.timeout })
  }

  async openNewLabelModal() {
    const labelDropdown = $('div[title=Label]')
    await labelDropdown.waitForDisplayed()
    await labelDropdown.click()
    const newLabelButton = $('div[title=Label] .create-label-btn')
    await newLabelButton.waitForDisplayed()
    await newLabelButton.click()
  }

  async createLabel({ label }: { label: string }) {
    const labelModal = $('#newLabelModal')
    await labelModal.waitForDisplayed()
    const labelInput = labelModal.$('input')
    await labelInput.setValue(label)
    const submit = labelModal.$('button[type=submit]')
    await submit.click()
    await labelModal.waitForDisplayed({ reverse: true })
  }

  async openSettings() {
    const settingsButton = $('.ui.button[data-action=settings]')
    await settingsButton.waitForDisplayed()
    await settingsButton.click()
  }

  async settingsGotoTab(tabName: string) {
    const target = $(`#settings-tab-${tabName}`)
    await target.waitForDisplayed()
    await target.click()
  }

  async getTorrentsFooterText() {
    const footer = $('#page-torrents .ui.bottom.fixed.menu')
    await footer.waitForDisplayed()
    return footer.getText()
  }
}
