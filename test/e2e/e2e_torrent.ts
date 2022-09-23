import { App } from "./e2e_app"
import { Application, SpectronClient } from "spectron";

class Torrent {
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
    return await elem.waitForExist({ timeout: this.timeout })
  }

  async waitForGone() {
    let elem = await this.client.$(this.query)
    return await elem.waitForExist({ timeout: this.timeout, reverse: true })
  }

  async getColumns(): Promise<Record<string, any>> {
    let elem = await this.client.$$(this.query + " td")
    let dataPromise = elem.map(async (e) => {
      return {
        [await e.getAttribute("data-col")]: await e.getText(),
      };
    })
    let data = await Promise.all(dataPromise)
    return Object.assign({}, ...data)
  }

  async waitForState(state: string) {
    let self = this;
    return this.client.waitUntil(async () => {
      let cols = await self.getColumns();
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

  async stop({ state = "Stopped" }) {
    await this.performAction({ action: "stop", state: state })
  }

  async resume({ state = "Downloading" }) {
    await this.performAction({ action: "resume", state: state })
  }

  async newLabel(labelName) {
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
      let cols = await this.getColumns();
      return cols["label"] === labelName;
    });
  }

  async changeLabel(labelName) {
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
      let cols = await this.getColumns();
      return cols["label"] === labelName;
    });
  }

  async click(options) {
    let elem = await this.client.$(this.query)
    await elem.click(options)
  }

  async clickContextMenu(roleName) {
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

  async checkInState(states) {
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

export {
  Torrent
}