import { App } from "./e2e_app"
import { Application, SpectronClient } from "spectron";
import { ClickOptions } from "webdriverio";

export type ColumnName = "decodedName" | "label"

export class Torrent {
  app: App
  spectron: Application
  client: SpectronClient
  hash: string
  query: string
  timeout: number

  constructor({ hash, spectron, app }) {
    this.app = app;
    this.spectron = spectron;
    this.client = this.spectron.client;
    this.hash = hash;
    this.query = `#torrentTable tbody tr[data-hash="${hash}"]`;
    this.timeout = 10 * 1000;
  }

  async isExisting() {
    let elem = await this.client.$(this.query)
    return await elem.isExisting()
  }

  async waitForExist() {
    let elem = await this.client.$(this.query)
    await elem.waitForExist({ timeout: this.timeout })
  }

  async waitForGone() {
    let elem = await this.client.$(this.query)
    return await elem.waitForExist({ timeout: this.timeout, reverse: true })
  }

  async getAllColumns(): Promise<Record<string, string>> {
    let elem = await this.client.$$(this.query + " td")
    let dataPromise = elem.map(async (e) => {
      return {
        [await e.getAttribute("data-col")]: await e.getText(),
      };
    })
    let data = await Promise.all(dataPromise)
    return Object.assign({}, ...data)
  }

  async getColumn(column: ColumnName) {
    let torrent = await this.client.$(this.query)
    let elem = await torrent.$(`td[data-col='${column}']`)
    return await elem.getText()
  }

  async waitForState(state: string) {
    let self = this;
    return this.client.waitUntil(async () => {
      let cols = await self.getAllColumns();
      return cols["percent"].includes(state);
    }, { timeout: this.timeout });
  }

  async performAction({ action, state }) {
    const button = `#torrent-action-header a[data-role=${action}]`;

    let elem = await this.client.$(this.query)
    await elem.waitForExist({ timeout: this.timeout })
    await elem.click()

    let buttonElem = await this.client.$(button)
    await buttonElem.waitForEnabled()
    await buttonElem.click()
    await this.waitForState(state)
  }

  async delete() {
    await this.clickContextMenu("delete");
    await this.waitForGone();
  }

  async stop({ state = "Stopped" }) {
    await this.performAction({ action: "stop", state: state })
  }

  async resume({ state = "Downloading" }) {
    await this.performAction({ action: "resume", state: state })
  }

  async getLabel() {
    let cols = await this.getAllColumns();
    return cols["label"]
  }

  async newLabel(labelName: string) {
    const labels = "#torrent-action-header div[data-role=labels]";

    let elem = await this.client.$(this.query)
    await elem.click()

    let labelsElem = await this.client.$(labels)
    await labelsElem.click()

    let newLabelelem = await labelsElem.$("div[data-role=new-label]")
    await newLabelelem.waitForDisplayed()
    await newLabelelem.click()

    let modal = await this.client.$("#newLabelModal")
    await modal.waitForDisplayed()

    let labelNameElem = await modal.$("input[name=label]")
    await labelNameElem.setValue(labelName)

    let submit = await modal.$("button[type=submit]")
    await submit.click()
    await modal.waitForDisplayed({ reverse: true })

    await this.client.waitUntil(async () => {
      return await this.getLabel() === labelName
    });
  }

  async changeLabel(labelName: string) {
    const labels = "#torrent-action-header div[data-role=labels]";

    let elem = await this.client.$(this.query)
    await elem.click()

    let labelsElem = await this.client.$(labels)
    await labelsElem.click()

    let labelItemElem = await labelsElem.$(`div[data-label='${labelName}']`)
    await labelItemElem.waitForDisplayed()
    await labelItemElem.click()
    await labelItemElem.waitForDisplayed({ reverse: true })

    await this.client.waitUntil(async () => {
      return await this.getLabel() === labelName
    });
  }

  async click(options: ClickOptions) {
    let elem = await this.client.$(this.query)
    await elem.click(options)
  }

  async clickContextMenu(roleName: string) {
    const button = `#contextmenu a[data-role=${roleName}]`;

    let elem = await this.client.$(this.query)
    await elem.waitForExist()
    await elem.click({ button: "right" })

    let contextMeny = await this.client.$("#contextmenu")
    await contextMeny.waitForDisplayed()

    let buttonElem = await this.client.$(button)
    let visible = await buttonElem.isDisplayed()

    if (!visible) {
      // if not directly visible, move to submenu by hovering mouse
      let submenu = await (await buttonElem.$("..")).$("..")
      await submenu.moveTo()
      let firstItem = await submenu.$(".item:first-child")
      await firstItem.moveTo()
    }

    await buttonElem.waitForEnabled()
    await buttonElem.click()
    await contextMeny.waitForDisplayed({ reverse: true })
  }

  async checkInState(states: string[]) {
    let allStates = ["all", "downloading", "finished", "seeding", "stopped", "error"];

    for (const state of allStates.reverse()) {
      let stateBtn = await this.client.$(`#page-torrents li[data-state=${state}]`)
      await stateBtn.click()
      this.client.pause(200)
      let elem = await this.client.$(this.query)
      await elem.waitForExist({ reverse: !states.includes(state) })
    }
  }

  async checkInFilterLabel(labelName) {
    let allLabels = await this.app.getAllSidebarLabels();
    for (const label of allLabels) {
      await this.app.filterLabel(label);
      let elem = await this.client.$(this.query)

      if (labelName === label) {
        await elem.waitForExist()
      } else {
        await elem.waitForExist({ reverse: true })
      }
    }
    await this.app.filterLabel()
  }
}
