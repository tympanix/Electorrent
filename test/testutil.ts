import axios from "axios"
import readline from "readline"
import { afterEach } from "mocha";

/**
 * Enum representing the different features of a bittorrent client to be tested
 */
export enum FeatureSet {
  Labels,
  MagnetLinks,
  AdvancedUploadOptions,
}

/**
 * Asks for a qestion is console and wait for answer
 * @param query Question to be asked
 */
export function askQuestion(query: string) {
  const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
  });
  return new Promise(resolve => rl.question(query, ans => {
      rl.close();
      resolve(ans);
  }))
}

/**
 * Returns a promise that always resolves after set milliseconds
 * @param time milliseconds before promise is resolved
 */
export const sleep: (time: number) => Promise<void>
  = (time: number) => new Promise(resolve => setTimeout(resolve, time));

/**
 * Continously performs http requests every `step` milliseconds for up to `timeout` milliseconds
 * until response has status code `statusCode`. If status code has not been observed within `timeout`
 * an exception is thrown
 */
export async function waitForHttp(
  { url, statusCode=200, timeout=30000, step=1000 }:
  { url: string, statusCode?: number, timeout?: number, step?: number })
{
  let timeSpent = 0;
  while (true) {
    if (timeSpent > timeout) {
      throw new Error(`Timeout waiting for ${url}`);
    }
    try {
      let res = await axios.get(url, {
        timeout: 1000,
        validateStatus: _ => true
      })
      if (res.status === statusCode) {
        return;
      }
    } catch (err) { }
    await sleep(step)
    timeSpent += step
  }
}

/**
 * Perform a test function multiple times until it succeeds without an exception
 * @param fn function to test
 * @param timeout time to wait for `fn` to return successfully without an exception
 * @param step time between calls of `fn`
 * @returns whatever `fn` returns
 */
export async function waitUntil(fn: () => Promise<any>, timeout?: number, step?: number) {
  let currentTime = 0
  let err: any
  timeout = timeout ? timeout : 5000
  step = step ? step : 500
  while (currentTime <= timeout) {
    try {
      return await fn()
    } catch (e) {
      err = e
    }
    await sleep(step)
    currentTime += step
  }
  throw new Error(`Timeout after ${timeout}ms while waiting for function to succeed: ${err}`)
}

/**
 * Sets up Mocha hooks for test execution. This function adds an `afterEach` hook
 * that performs specific actions based on the state of the test and environment variables.
 *
 * - If a test fails and the `MOCHA_HALT` environment variable is set to "1", the test execution
 *   will halt and wait for user input before proceeding.
 * - If the `MOCHA_STEP` environment variable is set, the test execution will pause after each test
 *   and wait for user input before proceeding.
 *
 * @example
 * setupMochaHooks();
 *
 * Environment Variables:
 * - `MOCHA_HALT`: Set to "1" to halt execution on test failure and wait for user input.
 * - `MOCHA_STEP`: Set to pause execution after each test and wait for user input.
 */
export function setupMochaHooks() {
  afterEach(async function() {
    if (this.currentTest && this.currentTest.state === "failed") {
      if (process.env.MOCHA_HALT === "1") {
        // halt and wait until user decides to proceed (or very long timeout)
        this.timeout(Math.pow(2, 32));
        await askQuestion("Test failed. Press any key to continue: ");
      }
      return;
    }
    if (process.env.MOCHA_STEP) {
      this.timeout(Math.pow(2, 32));
      await askQuestion("Test paused. Press any key to continue: ");
    }
  });
}
