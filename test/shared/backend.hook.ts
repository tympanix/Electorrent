import compose, { IDockerComposeOptions } from "docker-compose";
import path from "path";
import { waitUntil } from "../testutil";
import { dockerComposeHooks } from "./compose.hook";

/**
 * Backend is a utility class to interact with the docker-compose containers runing the Bittorrent
 * backend being tested
 */
export class Backend {

  composeDir: string
  serviceName: string

  constructor(composeDir: string | string[]) {
    this.composeDir = Array.isArray(composeDir) ? path.join(...composeDir) : composeDir
    this.serviceName = path.basename(this.composeDir)
  }

  async exec(command: string | string[]) {
    const options: IDockerComposeOptions = {
      cwd: this.composeDir,
    }
    let result = await compose.exec(this.serviceName, command, options)
    if (result.exitCode !== 0) {
      throw new Error(`command for ${this.serviceName} container exited with code ${result.exitCode}`)
    }
    return result
  }

  async waitForExec(command: string | string[], timeout?: number, step?: number) {
    await waitUntil(async () => this.exec(command), timeout, step)
  }

}

/**
 * Start the backend bittorrent service being tested using docker-compose
 * @param composeDir directory containing docker-compose.yml
 * @param extraOpts extra arguments to docker-compose
 */
export function backendHooks(composeDir: string | string[], extraOpts?: IDockerComposeOptions) {
  dockerComposeHooks(composeDir, extraOpts)

  before(async function() {
    this.backend = new Backend(composeDir)
  })
}
