import { configureSpec, getTestFixture } from "../../framework/fixture"

const fixture = getTestFixture()

describe("tls connection host scheme", function () {
  configureSpec({ login: false })

  it("accepts a self-signed certificate when the host includes an https scheme", async function () {
    this.retries(3)
    await this.app.login({
      ...fixture.client,
      host: `https://${fixture.client.host}:${fixture.proxyPort}/`,
      https: false,
      port: 1,
    })
    await this.app.certificateModalIsVisible()
    await this.app.acceptCertificate()
    await this.app.torrentsPageIsVisible()
  })
})
