import { browser } from '@wdio/globals'

export async function restartApplication(context: Mocha.Context) {
  void context
  await browser.refresh()
}
