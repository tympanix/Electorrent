import { configureSpec, getTestFixture } from "../../framework/fixture"

const client = getTestFixture().client

describe("qBittorrent HTTP Basic authentication", function () {
  configureSpec({ login: false })

  it("logs in through an HTTP Basic authenticated reverse proxy", async function () {
    await this.app.login(client)
    await this.app.torrentsPageIsVisible()
  })
})
