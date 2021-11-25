const path = require("path");
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const compose = require("docker-compose")
const readline = require("readline")

global.before(function () {
  chai.should();
  chai.use(chaiAsPromised);
});

function askQuestion(query) {
  const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
      rl.close();
      resolve(ans);
  }))
}

describe("test clients", async function() {

  // Allow docker-compose up/down to complete
  this.timeout(25 * 1000)

  before(async function() {
    await compose.upAll({ cwd: path.join(__dirname), log: true })
  })

  require("./suites")()

  after(async function() {
    if (!process.env.MOCHA_DOCKER_KEEP) {
      await compose.down({ cwd: path.join(__dirname), log: true })
    }
  })

  afterEach(async function() {
    if (this.currentTest.state === "failed") {
      if (process.env.MOCHA_HALT) {
        // halt and wait until user decides to proceed (or very long timeout)
        this.timeout(Math.pow(2, 32))
        await askQuestion("Test failed. Press any key to continue")
      }
    }
  })
})
