import { configureSpec, getTestFixture } from "../../framework/fixture"

const fixture = getTestFixture()
const client = fixture.client

describe("rtorrent basic authentication", function () {
  configureSpec({ login: false })

  it("logs in through HTTP basic auth", async function () {
    if (!client.authProxyHostPort) {
      throw new Error("The rtorrent basic auth proxy port is not configured")
    }

    await this.app.login({
      ...client,
      port: client.authProxyHostPort,
    })

    await this.app.torrentsPageIsVisible()
  })
})
