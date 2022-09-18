const path = require("path");
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const compose = require("docker-compose")
const { askQuestion } = require("./testutil")

process.on('unhandledRejection', (reason) => { throw reason });

export {}

global.before(function () {
  chai.should();
  chai.use(chaiAsPromised);
});


describe("given local private tracker service is running (docker-compose)", async function() {

  // Allow docker-compose up/down to complete
  this.timeout(25 * 1000)

  before(async function() {
    await compose.upAll({ cwd: path.join(__dirname), log: process.env.DEBUG, commandOptions: ['--build', '--remove-orphans'] })
  })

  require("./suites")()

  after(async function() {
    if (!process.env.MOCHA_DOCKER_KEEP) {
      await compose.down({ cwd: path.join(__dirname), log: process.env.DEBUG })
    }
  })

  afterEach(async function() {
    if (this.currentTest && this.currentTest.state === "failed") {
      if (process.env.MOCHA_HALT === "1") {
        // halt and wait until user decides to proceed (or very long timeout)
        this.timeout(Math.pow(2, 32))
        await askQuestion("Test failed. Press any key to continue: ")
      }
      return
    }
    if (process.env.MOCHA_STEP) {
        this.timeout(Math.pow(2, 32))
        await askQuestion("Test paused. Press any key to continue: ")
    }
  })

})
