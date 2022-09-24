import axios from "axios"
import readline from "readline"

/**
 * Enum representing the different features of a bittorrent client to be tested
 */
export enum FeatureSet {
  Labels,
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
