import { configureSpec, getTestFixture } from "../../framework/fixture"

const fixture = getTestFixture()

describe("tls connection", function () {
  configureSpec({ login: false })

  it("accepts a self-signed certificate", async function () {
    this.retries(3)
    await this.app.login({
      ...fixture.client,
      https: true,
      port: fixture.proxyPort,
    })
    await this.app.certificateModalIsVisible()
    await this.app.acceptCertificate()
    await this.app.torrentsPageIsVisible()
  })
})
