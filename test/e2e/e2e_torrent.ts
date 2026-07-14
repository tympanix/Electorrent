import { App } from "./e2e_app"
import { ClickOptions } from "webdriverio";
import { browser, $, $$ } from '@wdio/globals'
import { eventually } from "./eventually"
import { waitForModalClose, waitForModalOpen } from "./modal"

export type ColumnName = "decodedName" | "size" | "downloadSpeed" | "uploadSpeed" | "downloadLimit" | "uploadLimit" | "percent" | "label" | "dateAdded" | "dateCompleted" | "peersConnected" | "seedsConnected" | "torrentQueueOrder" | "eta" | "ratio" | "ratioLimit"

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
    return this.waitForStates([state], { timeout })
  }

  async waitForStates(states: string[], { timeout = this.timeout } = {}) {
    await eventually(() => this.getColumn("percent")).satisfies(
      `include one of ${states.join(", ")}`,
      (percent) => states.some((state) => percent.toLowerCase().includes(state.toLowerCase())),
      { timeout },
    )
  }

  async waitForDownloading({ timeout = 20 * 1000 } = {}) {
    const downloadingState = $("#page-torrents li[data-state=downloading]")
    await downloadingState.click()

    const elem = $(this.query)
    try {
      await elem.waitForExist({
        timeout,
        timeoutMsg: `Torrent ${this.hash} did not appear in the downloading filter within ${timeout}ms`,
      })
    } catch (err: any) {
      const allState = $("#page-torrents li[data-state=all]")
      await allState.click()
      const currentValue = await elem.isExisting() ? await this.getColumn("percent") : "<missing>"
      throw new Error(`${err.message}. Current percent column: ${currentValue || "<empty>"}`)
    }
  }

  async performAction({ action, state, timeout = this.timeout }) {
    const button = `#torrent-action-header a[data-role=${action}]`;

    const elem = $(this.query)
    await elem.waitForExist({ timeout: this.timeout })
    await elem.click()

    const buttonElem = $(button)
    await buttonElem.waitForEnabled()
    await buttonElem.click()
    if (state) {
      await this.waitForState(state, { timeout })
    }
  }

  async delete() {
    await this.confirmDelete();
    await this.waitForGone();
  }

  async openDeleteConfirmation() {
    await this.clickContextMenu("delete");

    const modal = $("#deleteTorrentModal");
    await waitForModalOpen(modal, this.timeout);
    return modal;
  }

  async confirmDelete() {
    const modal = await this.openDeleteConfirmation();
    const submit = modal.$("button.approve");
    await submit.waitForDisplayed();
    await submit.waitForClickable();
    await submit.waitForEnabled();
    await submit.click();
    await waitForModalClose(modal, this.timeout);
  }

  async openSetLocationModal() {
    await this.openContextMenu()

    const contextMenu = $("#contextmenu")
    const action = contextMenu.$("a=Set Location")
    await action.waitForDisplayed()
    await action.click()
    await contextMenu.waitForDisplayed({ reverse: true })

    const modal = $("#setLocationModal");
    await waitForModalOpen(modal, this.timeout);
    return modal;
  }

  async openSetSpeedLimitModal() {
    await this.openContextMenu()

    const contextMenu = $("#contextmenu")
    const action = contextMenu.$("a=Set Speed Limits")
    await action.waitForDisplayed()
    await action.click()
    await contextMenu.waitForDisplayed({ reverse: true })

    const modal = $("#setSpeedLimitModal");
    await waitForModalOpen(modal, this.timeout);
    return modal;
  }

  async openSetRatioModal() {
    await this.openContextMenu()

    const contextMenu = $("#contextmenu")
    const action = contextMenu.$("a=Set Ratio")
    await action.waitForDisplayed()
    await action.click()
    await contextMenu.waitForDisplayed({ reverse: true })

    const modal = $("#torrent-set-ratio-modal");
    await waitForModalOpen(modal, this.timeout);
    return modal;
  }

  async openDetailsPanel() {
    await this.clickContextMenu("torrent-details")

    const panel = $("[data-role='torrent-details-panel']")
    await panel.waitForDisplayed({ timeout: this.timeout })
    return panel
  }

  async openDetailsTab(tab: "info" | "files") {
    const panel = $("[data-role='torrent-details-panel']")
    await panel.waitForDisplayed({ timeout: this.timeout })

    const tabButton = panel.$(`[data-role='torrent-details-tab-${tab}']`)
    await tabButton.waitForDisplayed({ timeout: this.timeout })
    await tabButton.click()
    return panel
  }

  async closeDetailsPanel() {
    const panel = $("[data-role='torrent-details-panel']")
    await panel.waitForDisplayed({ timeout: this.timeout })

    const closeButton = panel.$("[data-role='torrent-details-close']")
    await closeButton.waitForDisplayed({ timeout: this.timeout })
    await closeButton.click()
    await panel.waitForDisplayed({ timeout: this.timeout, reverse: true })
  }

  async getDetailsFieldValue(fieldId: string) {
    const panel = $("[data-role='torrent-details-panel']")
    await panel.waitForDisplayed({ timeout: this.timeout })

    const field = panel.$(`[data-role='torrent-details-field'][data-field-id='${fieldId}'] .value`)
    await field.waitForDisplayed({ timeout: this.timeout })
    return await field.getText()
  }

  async setLocation(location: string) {
    const modal = await this.openSetLocationModal();
    const input = modal.$("input[name='location']");
    await input.waitForDisplayed();
    await input.clearValue();
    await input.setValue(location);

    const approve = modal.$("button[data-role='set-location-apply']");
    await approve.waitForEnabled();
    await approve.click();
    await waitForModalClose(modal, this.timeout);
  }

  async setSpeedLimits({ downloadSpeedLimit, uploadSpeedLimit }: { downloadSpeedLimit?: number, uploadSpeedLimit?: number }) {
    const modal = await this.openSetSpeedLimitModal();
    if (downloadSpeedLimit !== undefined) {
      const input = modal.$("input[data-role='torrent-speed-limit-download']");
      await input.waitForDisplayed();
      await input.clearValue();
      await input.setValue(String(downloadSpeedLimit));
    }
    if (uploadSpeedLimit !== undefined) {
      const input = modal.$("input[data-role='torrent-speed-limit-upload']");
      await input.waitForDisplayed();
      await input.clearValue();
      await input.setValue(String(uploadSpeedLimit));
    }

    const approve = modal.$("button[data-role='torrent-speed-limit-apply']");
    await approve.waitForEnabled();
    await approve.click();
    await waitForModalClose(modal, this.timeout);
  }

  async getSpeedLimitModalValues() {
    const modal = await this.openSetSpeedLimitModal();
    const download = await modal.$("input[data-role='torrent-speed-limit-download']").getValue();
    const upload = await modal.$("input[data-role='torrent-speed-limit-upload']").getValue();
    const cancel = modal.$("button.deny");
    await cancel.waitForClickable();
    await cancel.click();
    await waitForModalClose(modal, this.timeout);
    return { download, upload };
  }

  async setRatioLimit(ratioLimit: number) {
    const modal = await this.openSetRatioModal();
    const input = modal.$("input[data-role='torrent-set-ratio-value']");
    await input.waitForDisplayed();
    await input.clearValue();
    await input.setValue(String(ratioLimit));

    const approve = modal.$("button[data-role='torrent-set-ratio-apply']");
    await approve.waitForEnabled();
    await approve.click();
    await waitForModalClose(modal, this.timeout);
  }

  async getRatioModalValue() {
    const modal = await this.openSetRatioModal();
    const ratio = await modal.$("input[data-role='torrent-set-ratio-value']").getValue();
    const cancel = modal.$("button.deny");
    await cancel.waitForClickable();
    await cancel.click();
    await waitForModalClose(modal, this.timeout);
    return ratio;
  }

  async stop({ state = "Stopped", timeout = this.timeout } = {}) {
    await this.performAction({ action: "stop", state: state, timeout })
  }

  async resume({ state = "Downloading", timeout = this.timeout, waitForState = true } = {}) {
    await this.performAction({ action: "resume", state: waitForState ? state : undefined, timeout })
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
    await waitForModalOpen(modal, this.timeout)

    const labelNameElem = modal.$("input[name=label]")
    await labelNameElem.setValue(labelName)

    const submit = modal.$("button[type='submit']")
    await submit.waitForDisplayed()
    await submit.waitForClickable()
    await submit.waitForEnabled()
    await submit.click()
    await waitForModalClose(modal, this.timeout)

    await eventually(() => this.getLabel()).equals(labelName)
  }

  async changeLabel(labelName: string) {
    const labelsElem = await this.openLabelsDropdown()

    const labelItemElem = labelsElem.$(`div[data-label='${labelName}']`)
    await labelItemElem.waitForDisplayed()
    await labelItemElem.click()
    await labelItemElem.waitForDisplayed({ reverse: true })

    await eventually(() => this.getLabel()).equals(labelName)
  }

  async removeLabel() {
    const labelsElem = await this.openLabelsDropdown()

    const removeLabelElem = labelsElem.$("div[data-role=remove-label]")
    await removeLabelElem.waitForDisplayed()
    await removeLabelElem.click()
    await removeLabelElem.waitForDisplayed({ reverse: true })

    await eventually(async () => (await this.getLabel()).trim()).equals("")
  }

  async click(options: ClickOptions) {
    const elem = $(this.query)
    await elem.click(options)
  }

  async openContextMenu(options: Partial<ClickOptions> = { button: "right" }) {
    const elem = $(this.query)
    await elem.waitForExist()
    await elem.waitForDisplayed()
    await elem.scrollIntoView({ block: "center", inline: "center" })
    await elem.moveTo()

    const contextMeny = $("#contextmenu")
    for (let attempt = 0; attempt < 3; attempt++) {
      await elem.click(options)
      if (await contextMeny.isDisplayed()) {
        return
      }
      await browser.pause(100)
    }

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
