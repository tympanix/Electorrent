import { App } from "./e2e_app"
import { ClickOptions } from "webdriverio";
import { browser, $, $$ } from '@wdio/globals'

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
    this.timeout = 10 * 1000;
  }

  async isExisting() {
    const elem = $(this.query)
    return await elem.isExisting()
  }

  async waitForExist({ timeout = this.timeout } = {}) {
    const elem = $(this.query)
    await elem.waitForExist({ timeout: timeout })
  }

  async waitForGone() {
    const elem = $(this.query)
    await elem.waitForExist({ timeout: this.timeout, reverse: true })
  }

  async getAllColumns(): Promise<Record<string, string>> {
    const elem = $$(this.query + " td")
    const columns = {}
    for await (const e of elem) {
      const colName = await e.getAttribute("data-col")
      const colText = await e.getText()
      columns[colName] = colText
    }
    return columns
  }

  async getColumn(column: ColumnName) {
    const torrent = $(this.query)
    const elem = torrent.$(`td[data-col='${column}']`)
    return await elem.getText()
  }

  async waitForState(state: string, { timeout = this.timeout } = {}) {
    await browser.waitUntil(async () => {
      const percent = await this.getColumn("percent")
      return percent.toLowerCase().includes(state.toLowerCase());
    }, {
      timeout: timeout,
      timeoutMsg: `Torrent ${this.hash} did not reach state ${state} within ${timeout}ms`
    });
  }

  async performAction({ action, state }) {
    const button = `#torrent-action-header a[data-role=${action}]`;

    const elem = $(this.query)
    await elem.waitForExist({ timeout: this.timeout })
    await elem.click()

    const buttonElem = $(button)
    await buttonElem.waitForEnabled()
    await buttonElem.click()
    await this.waitForState(state)
  }

  async delete() {
    await this.confirmDelete();
    await this.waitForGone();
  }

  async openDeleteConfirmation() {
    await this.clickContextMenu("delete");

    const modal = $("#deleteTorrentModal");
    await modal.waitForDisplayed();
    return modal;
  }

  async confirmDelete() {
    const modal = await this.openDeleteConfirmation();
    const submit = modal.$("button.approve");
    await submit.waitForDisplayed();
    await submit.waitForClickable();
    await submit.waitForEnabled();
    await submit.click();
    await modal.waitForDisplayed({ reverse: true });
  }

  async stop({ state = "Stopped" }) {
    await this.performAction({ action: "stop", state: state })
  }

  async resume({ state = "Downloading" }) {
    await this.performAction({ action: "resume", state: state })
  }

  async getLabel() {
    const cols = await this.getAllColumns();
    return cols["label"]
  }

  async openLabelsDropdown() {
    const elem = $(this.query)
    await elem.waitForExist()
    await elem.waitForDisplayed()
    await elem.click()

    const labelsElem = $("#torrent-action-header div[data-role=labels]")
    await labelsElem.waitForDisplayed()
    await labelsElem.waitForClickable()
    await labelsElem.click()

    return labelsElem
  }

  async newLabel(labelName: string) {
    const labelsElem = await this.openLabelsDropdown()

    const newLabelelem = labelsElem.$("div[data-role=new-label]")
    await newLabelelem.waitForDisplayed()
    await newLabelelem.click()

    const modal = $("#newLabelModal")
    await modal.waitForDisplayed()

    const labelNameElem = modal.$("input[name=label]")
    await labelNameElem.setValue(labelName)

    const submit = modal.$("button.approve")
    await submit.waitForDisplayed()
    await submit.waitForClickable()
    await submit.waitForEnabled()
    await submit.click()
    await modal.waitForDisplayed({ reverse: true })

    await browser.waitUntil(async () => {
      return await this.getLabel() === labelName
    });
  }

  async changeLabel(labelName: string) {
    const labelsElem = await this.openLabelsDropdown()

    const labelItemElem = labelsElem.$(`div[data-label='${labelName}']`)
    await labelItemElem.waitForDisplayed()
    await labelItemElem.click()
    await labelItemElem.waitForDisplayed({ reverse: true })

    await browser.waitUntil(async () => {
      return await this.getLabel() === labelName
    });
  }

  async click(options: ClickOptions) {
    const elem = $(this.query)
    await elem.click(options)
  }

  async openContextMenu() {
    const elem = $(this.query)
    await elem.waitForExist()
    await elem.waitForDisplayed()
    await elem.click({ button: "right" })

    const contextMeny = $("#contextmenu")
    await contextMeny.waitForDisplayed()
  }

  async clickContextMenu(roleName: string) {
    const button = `#contextmenu a[data-role=${roleName}]`;

    await this.openContextMenu()

    const contextMeny = $("#contextmenu")

    const buttonElem = $(button)
    const visible = await buttonElem.isDisplayed()

    if (!visible) {
      // if not directly visible, move to submenu by hovering mouse
      const submenu = buttonElem.$("..").$("..")
      await submenu.moveTo()
      const firstItem = submenu.$(".item:first-child")
      await firstItem.moveTo()
    }

    await buttonElem.waitForEnabled()
    await buttonElem.click()
    await contextMeny.waitForDisplayed({ reverse: true })
  }

  async checkInState(states: string[]) {
    const allStates = ["all", "downloading", "finished", "seeding", "stopped", "error"];

    for (const state of allStates.reverse()) {
      const stateBtn = $(`#page-torrents li[data-state=${state}]`)
      await stateBtn.click()
      await browser.pause(50)
      const elem = $(this.query)
      await elem.waitForExist({ reverse: !states.includes(state) })
    }
  }

  async checkInFilterLabel(labelName) {
    const allLabels = await this.app.getAllSidebarLabels();
    for (const label of allLabels) {
      await this.app.filterLabel(label);
      const elem = $(this.query)

      if (labelName === label) {
        await elem.waitForExist()
      } else {
        await elem.waitForExist({ reverse: true })
      }
    }
    await this.app.filterLabel()
  }
}
