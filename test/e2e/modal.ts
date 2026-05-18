import { browser } from "@wdio/globals"
import type { ChainablePromiseElement } from "webdriverio"

type ModalElement = ChainablePromiseElement<WebdriverIO.Element>

async function hasAnimatingClass(modal: ModalElement): Promise<boolean> {
  const className = (await modal.getAttribute("class")) || ""
  return className.split(/\s+/).includes("animating")
}

export async function waitForModalOpen(modal: ModalElement, timeout = 10_000) {
  await modal.waitForDisplayed({ timeout })
  await browser.waitUntil(async () => {
    if (!await modal.isDisplayed()) {
      return false
    }
    return !(await hasAnimatingClass(modal))
  }, {
    timeout,
    timeoutMsg: "Modal did not finish opening animation in time",
  })
}

export async function waitForModalClose(modal: ModalElement, timeout = 10_000) {
  await browser.waitUntil(async () => {
    if (!await modal.isExisting()) {
      return true
    }

    const displayed = await modal.isDisplayed()
    const animating = await hasAnimatingClass(modal)
    return !displayed && !animating
  }, {
    timeout,
    timeoutMsg: "Modal did not finish closing animation in time",
  })
}
