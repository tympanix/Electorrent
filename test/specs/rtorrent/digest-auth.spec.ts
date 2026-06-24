import { configureSpec, getTestFixture } from "../../framework/fixture"

const fixture = getTestFixture()
const client = fixture.client

describe("rtorrent digest authentication", function () {
  configureSpec({ login: false })

  it("logs in through HTTP digest auth", async function () {
    if (!client.digestAuthProxyHostPort) {
      throw new Error("The rtorrent digest auth proxy port is not configured")
    }

    await this.app.login({
      ...client,
      port: client.digestAuthProxyHostPort,
    })

    await this.app.torrentsPageIsVisible()
  })
})
