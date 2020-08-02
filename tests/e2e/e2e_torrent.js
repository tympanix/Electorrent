const sync = require("@wdio/sync").default;

class Torrent {
  constructor({ hash, app }) {
    this.app = app;
    this.browser = this.app.client;
    this.$ = this.browser.$.bind(this.browser);
    this.$$ = this.browser.$$.bind(this.browser);
    this.hash = hash;
    this.query = `#torrentTable tbody tr[data-hash=${hash}]`;
    this.timeout = 5 * 1000;
  }

  isExisting() {
    return sync(() => {
      return this.$(this.query).isExisting();
    });
  }

  waitForExist() {
    return sync(() => {
      return this.$(this.query).waitForExist({ timeout: this.timeout });
    });
  }

  waitForGone() {
    return sync(() => {
      return this.$(this.query).waitForExist({ timeout: this.timeout, reverse: true });
    });
  }

  getColumns() {
    return sync(() => {
      let t = this.$$(this.query + " td").map((v) => {
        return {
          [v.getAttribute("data-col")]: v.getText(),
        };
      });
      return Object.assign({}, ...t);
    });
  }

  waitForState(state) {
    let self = this;
    return this.browser.waitUntil(async () => {
      let cols = await self.getColumns();
      return cols["percent"].includes(state);
    });
  }

  stop({ state = "Stopped" }) {
    const button = "#torrent-action-header a[data-role=stop]";

    return sync(() => {
      this.$(this.query).waitForExist();
      this.$(this.query).click();
      this.$(button).waitForEnabled();
      this.$(button).click();
      this.waitForState(state);
    });
  }

  resume({ state = "Downloading" }) {
    const button = "#torrent-action-header a[data-role=resume]";

    return sync(() => {
      this.$(this.query).waitForExist();
      this.$(this.query).click();
      this.$(button).waitForEnabled();
      this.$(button).click();
      this.waitForState(state);
    });
  }

  async newLabel(labelName) {
    const labels = "#torrent-action-header div[data-role=labels]";

    await sync(() => {
      this.$(this.query).click();
      this.$(labels).click();
      this.$(labels + " > div.menu").waitForDisplayed();
      this.$(labels + " div[data-role=new-label]").click();
      this.$("#newLabelModal").waitForDisplayed();
      this.$("#newLabelModal input[name=label]").setValue(labelName);
      this.$("#newLabelModal button[type=submit]").click();
    });

    await this.browser.waitUntil(async () => {
      let cols = await this.getColumns();
      return cols["label"] === labelName;
    });
  }

  async changeLabel(labelName) {
    const labels = "#torrent-action-header div[data-role=labels]";

    await sync(() => {
      this.$(this.query).click();
      this.$(labels).click();
      this.$(labels + " > div.menu").waitForDisplayed();
      this.$(labels + ` div[data-label='${labelName}']`).click();
    });

    await this.browser.waitUntil(async () => {
      let cols = await this.getColumns();
      return cols["label"] === labelName;
    });
  }

  async click(options) {
    return sync(() => {
      this.$(this.query).click(options);
    });
  }

  async clickContextMenu(roleName) {
    const button = `#contextmenu a[data-role=${roleName}]`;

    return sync(() => {
      this.$(this.query).waitForExist();
      this.$(this.query).click({ button: "right" });
      this.$("#contextmenu").waitForExist();

      let visible = this.$(button).isDisplayed();
      if (!visible) {
        let submenu = this.$(button).$("..").$("..");
        submenu.moveTo();
        let firstItem = submenu.$(".item:first-child");
        firstItem.moveTo();
      }

      this.$(button).click();
    });
  }
}

module.exports = {
  Torrent,
};
