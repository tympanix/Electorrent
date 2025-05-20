import { App } from "./e2e_app"
import { ClickOptions } from "webdriverio";
import { browser, $, $$, expect } from '@wdio/globals'

export type ColumnName = "decodedName" | "label" | "percent"

export class Torrent {
  app: App
  hash: string
  query: string
  timeout: number

  constructor({ hash, app }) {
    this.app = app;
    this.hash = hash;
    this.query = `#torrentTable tbody tr[data-hash="${hash}"]`;
    this.timeout = 8 * 1000;
  }

  async isExisting() {
    let elem = await $(this.query)
    return await elem.isExisting()
  }

  async waitForExist() {
    let elem = await $(this.query)
    await elem.waitForExist({ timeout: this.timeout })
  }

  async waitForGone() {
    let elem = await $(this.query)
    await elem.waitForExist({ timeout: this.timeout, reverse: true })
  }

  async getAllColumns(): Promise<Record<string, string>> {
    let elem = $$(this.query + " td")
    const columns = {}
    for await (const e of elem) {
      let colName = await e.getAttribute("data-col")
      let colText = await e.getText()
      columns[colName] = colText
    }
    return columns
  }

  async getColumn(column: ColumnName) {
    let torrent = await $(this.query)
    let elem = await torrent.$(`td[data-col='${column}']`)
    return await elem.getText()
  }

  async waitForState(state: string) {
    await browser.waitUntil(async () => {
      let percent = await this.getColumn("percent")
      return percent.toLowerCase().includes(state.toLowerCase());
    }, { timeout: this.timeout });
  }

  async performAction({ action, state }) {
    const button = `#torrent-action-header a[data-role=${action}]`;

    let elem = await $(this.query)
    await elem.waitForExist({ timeout: this.timeout })
    await elem.click()

    let buttonElem = await $(button)
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

    let elem = await $(this.query)
    await elem.click()

    let labelsElem = await $(labels)
    await labelsElem.click()

    let newLabelelem = await labelsElem.$("div[data-role=new-label]")
    await newLabelelem.waitForDisplayed()
    await newLabelelem.click()

    let modal = await $("#newLabelModal")
    await modal.waitForDisplayed()

    let labelNameElem = await modal.$("input[name=label]")
    await labelNameElem.setValue(labelName)

    let submit = await modal.$("button[type=submit]")
    await submit.click()
    await modal.waitForDisplayed({ reverse: true })

    await browser.waitUntil(async () => {
      return await this.getLabel() === labelName
    });
  }

  async changeLabel(labelName: string) {
    const labels = "#torrent-action-header div[data-role=labels]";

    let elem = await $(this.query)
    await elem.click()

    let labelsElem = await $(labels)
    await labelsElem.click()

    let labelItemElem = await labelsElem.$(`div[data-label='${labelName}']`)
    await labelItemElem.waitForDisplayed()
    await labelItemElem.click()
    await labelItemElem.waitForDisplayed({ reverse: true })

    await browser.waitUntil(async () => {
      return await this.getLabel() === labelName
    });
  }

  async click(options: ClickOptions) {
    let elem = await $(this.query)
    await elem.click(options)
  }

  async clickContextMenu(roleName: string) {
    const button = `#contextmenu a[data-role=${roleName}]`;

    let elem = await $(this.query)
    await elem.waitForExist()
    await elem.click({ button: "right" })

    let contextMeny = await $("#contextmenu")
    await contextMeny.waitForDisplayed()

    let buttonElem = await $(button)
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

    for (let state of allStates.reverse()) {
      let stateBtn = await $(`#page-torrents li[data-state=${state}]`)
      await stateBtn.click()
      await browser.pause(50)
      let elem = await $(this.query)
      await elem.waitForExist({ reverse: !states.includes(state) })
    }
  }

  async checkInFilterLabel(labelName) {
    let allLabels = await this.app.getAllSidebarLabels();
    for (const label of allLabels) {
      await this.app.filterLabel(label);
      let elem = await $(this.query)

      if (labelName === label) {
        await elem.waitForExist()
      } else {
        await elem.waitForExist({ reverse: true })
      }
    }
    await this.app.filterLabel()
  }
}
