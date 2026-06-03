import chai from "chai";
import fs from "fs";
import { describe, it } from "mocha";
import { browser, expect } from "@wdio/globals";

import { setupMochaHooks } from "../../testutil";
import { startApplicationHooks, updateHooks } from "../../shared";
import {
  TEST_UPDATE_DOWNLOAD_ARTIFACT_PATH,
  TEST_UPDATE_INSTALL_MARKER_PATH,
  UPDATE_TEST_FIXTURE_OPTIONS,
} from "../../shared/update.hook";

const { assert } = chai;

describe("given application update is available", function () {
  setupMochaHooks();

  const updateFixture = updateHooks(UPDATE_TEST_FIXTURE_OPTIONS);
  startApplicationHooks();

  it("checks, downloads, and hands off the update installer", async function () {
    this.timeout(30 * 1000);
    this.app.timeout = 15 * 1000;

    await this.app.welcomePageIsVisible({ timeout: 10 * 1000 });

    const showItemInFolderMock = await browser.electron.mock("shell", "showItemInFolder");

    try {
      const appArgs = await browser.electron.execute(() => process.argv);
      assert.include(appArgs.join(" "), "--update-url=");
      assert.include(appArgs.join(" "), "--downloads-path=");

      await browser.waitUntil(async () => {
        return updateFixture.getRequestCounts().feed >= 1;
      }, {
        timeout: 10 * 1000,
        timeoutMsg: `Expected the update feed to be queried, saw: ${updateFixture.getRequestUrls().join(", ")}`,
      });

      await browser.waitUntil(async () => {
        return updateFixture.getRequestCounts().download >= 1;
      }, {
        timeout: 10 * 1000,
        timeoutMsg: "Expected the update artifact to be requested",
      });

      const updateModalText = await this.app.getUpdateModalContentText();
      assert.include(updateModalText, "99.0.0");
      assert.include(updateModalText, "Update fixture notes");

      await browser.waitUntil(async () => {
        return fs.existsSync(TEST_UPDATE_DOWNLOAD_ARTIFACT_PATH);
      }, {
        timeout: 10 * 1000,
        timeoutMsg: "Expected update artifact to be downloaded",
      });

      const downloadedPath = updateFixture.getDownloadedFilePath();

      assert.isAtLeast(updateFixture.getRequestCounts().feed, 1, "expected the update feed to be queried");
      assert.isAtLeast(updateFixture.getRequestCounts().download, 1, "expected the update artifact to be requested");

      fs.chmodSync(downloadedPath, 0o755);

      await this.app.installUpdate();

      await browser.waitUntil(async () => {
        return fs.existsSync(TEST_UPDATE_INSTALL_MARKER_PATH) || showItemInFolderMock.mock.calls.length > 0;
      }, {
        timeout: 10 * 1000,
        timeoutMsg: "Expected the installer handoff to run",
      });

      const installedPath = fs.readFileSync(TEST_UPDATE_INSTALL_MARKER_PATH, "utf8");
      assert.equal(installedPath, downloadedPath);
      await expect(showItemInFolderMock).not.toHaveBeenCalled();
    } finally {
      await browser.electron.restoreAllMocks();
    }
  });
});
