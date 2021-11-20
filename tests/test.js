const path = require("path");
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const compose = require("docker-compose")

global.before(function () {
  chai.should();
  chai.use(chaiAsPromised);
});

describe("test clients", async function() {

  // Allow docker-compose up/down to complete
  this.timeout(25 * 1000)

  before(async function() {
      await compose.upAll({ cwd: path.join(__dirname), log: true })
  })

  require("./suites")()

  after(async function() {
      await compose.down({ cwd: path.join(__dirname), log: true })
  })
})
