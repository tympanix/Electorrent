import chai from "chai"
import fs from "node:fs"
import http from "node:http"
import path from "node:path"
import { $, browser } from "@wdio/globals"
import { waitForModalClose, waitForModalOpen } from "../../e2e/modal"
import { configureSpec } from "../../framework/fixture"

const assert: Chai.AssertStatic = chai.assert
const updatePort = 43871
const updateFilename = "electorrent-test-update.dmg"
const updateContents = Buffer.from("Electorrent test update")
let updatePath: string | undefined

describe("software updates", function () {
  configureSpec()

  const server = http.createServer((request, response) => {
    if (request.url === "/update") {
      response.writeHead(200, { "Content-Type": "application/json" })
      response.end(JSON.stringify({
        name: "99.0.0",
        url: `http://127.0.0.1:${updatePort}/download`,
        notes: "Local update server release notes",
        pub_date: "2026-07-13T00:00:00.000Z",
      }))
      return
    }

    if (request.url === "/download") {
      response.writeHead(200, {
        "Access-Control-Allow-Origin": "*",
        "Content-Disposition": `attachment; filename="${updateFilename}"`,
        "Content-Length": updateContents.length,
        "Content-Type": "application/octet-stream",
      })
      response.end(updateContents)
      return
    }

    response.writeHead(404)
    response.end()
  })

  before(async function () {
    const downloadsPath = await browser.electron.execute((electron) => electron.app.getPath("downloads"))
    updatePath = path.join(downloadsPath, updateFilename)
    fs.rmSync(updatePath, { force: true })

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject)
      server.listen(updatePort, "127.0.0.1", resolve)
    })
  })

  after(async function () {
    if (updatePath) {
      fs.rmSync(updatePath, { force: true })
    }
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  })

  it("downloads a newer version and shows the update modal", async function () {
    const helpMenu = $("//button[contains(@class, 'title-bar-menu-trigger') and normalize-space(.)='Help']")
    await helpMenu.waitForClickable()
    await helpMenu.click()

    const checkForUpdates = $("//button[contains(@class, 'title-bar-menu-item')]//*[normalize-space(.)='Check For Updates']/parent::button")
    await checkForUpdates.waitForClickable()
    await checkForUpdates.click()

    const modal = $("#updateModal")
    await waitForModalOpen(modal, 20_000)

    assert.equal(await modal.$(".header").getText(), "Update Available")
    assert.include(await modal.$(".content").getText(), "99.0.0")
    assert.isDefined(updatePath)
    assert.deepEqual(fs.readFileSync(updatePath!), updateContents)

    await modal.$("button.deny").click()
    await waitForModalClose(modal)
  })
})
