import { configureSpec, getTestFixture } from "../../framework/fixture"

const fixture = getTestFixture()

describe("connection host path", function () {
  configureSpec({ login: false })

  it("connects when the host includes the root path", async function () {
    await this.app.login({
      ...fixture.client,
      host: `http://${fixture.client.host}:${fixture.client.port}/`,
      port: 1,
    })
    await this.app.torrentsPageIsVisible()
  })
})
