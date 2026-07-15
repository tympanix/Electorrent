import chai from "chai"
import { configureSpec, getTestFixture } from "../../framework/fixture"

const { assert } = chai
const fixture = getTestFixture()
const client = fixture.client

describe("connection authentication", function () {
  configureSpec({ login: false })

  it("shows a connection problem when username and password are wrong", async function () {
    this.timeout(15 * 1000)

    await this.app.login({
      ...client,
      username: `wrong-${client.username || "user"}`,
      password: `wrong-${client.password || "password"}`,
    })

    const error = await this.app.getNotificationError({ timeout: 5 * 1000 })

    if (!error) {
      throw new Error("Expected a connection problem notification")
    }
    assert.equal(error.title, "Connection problem")
    assert.equal(error.message, "Incorrect username or password.")
    await this.app.welcomePageIsVisible()
  })
})
