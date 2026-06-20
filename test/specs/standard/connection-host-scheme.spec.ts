import { configureSpec, getTestFixture } from "../../framework/fixture"

const fixture = getTestFixture()

describe("connection host scheme", function () {
  configureSpec({ login: false })

  it("connects when the host includes an http scheme", async function () {
    await this.app.login({
      ...fixture.client,
      host: `http://${fixture.client.host}`,
    })
    await this.app.torrentsPageIsVisible()
  })
})
