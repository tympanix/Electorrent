import path from "path"
import chai from "chai"
import chaiAsPromised from "chai-as-promised";
import { askQuestion } from "../testutil";
import { dockerComposeHooks } from ".";

process.on('unhandledRejection', (reason) => { throw reason });

export {}

global.before(function () {
  chai.should();
  chai.use(chaiAsPromised);
});

// set up root mocha hooks to start opentracker docker-compose services
dockerComposeHooks([__dirname, "opentracker"])

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

