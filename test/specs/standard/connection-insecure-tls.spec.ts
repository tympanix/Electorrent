import { configureSpec, getTestFixture } from "../../framework/fixture"

const fixture = getTestFixture()

describe("insecure tls connection", function () {
  configureSpec({ login: false })

  it("connects when certificate identity verification fails", async function () {
    this.retries(3)
    await this.app.login({
      ...fixture.client,
      host: "127.0.0.1",
      https: true,
      port: fixture.proxyPort,
    })
    await this.app.certificateModalIsVisible()
    await this.app.openInsecureTlsConfirmation()
    await this.app.acceptInsecureTls()
    await this.app.torrentsPageIsVisible()
  })
})
