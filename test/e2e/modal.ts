import type { ChainablePromiseElement } from "webdriverio"
import { eventually } from "./eventually"

type ModalElement = ChainablePromiseElement

async function hasAnimatingClass(modal: ModalElement): Promise<boolean> {
  const className = (await modal.getAttribute("class")) || ""
  return className.split(/\s+/).includes("animating")
}

export async function waitForModalOpen(modal: ModalElement, timeout = 10_000) {
  await modal.waitForDisplayed({ timeout })
  await eventually(async () => ({
    displayed: await modal.isDisplayed(),
    animating: await hasAnimatingClass(modal),
  })).satisfies(
    "be displayed and not animating",
    ({ displayed, animating }) => displayed && !animating,
    { timeout },
  )
}

export async function waitForModalClose(modal: ModalElement, timeout = 10_000) {
  await eventually(async () => {
    if (!await modal.isExisting()) {
      return { existing: false, displayed: false, animating: false }
    }

    return {
      existing: true,
      displayed: await modal.isDisplayed(),
      animating: await hasAnimatingClass(modal),
    }
  }).satisfies(
    "not be displayed or animating",
    ({ existing, displayed, animating }) => !existing || (!displayed && !animating),
    { timeout },
  )
}
