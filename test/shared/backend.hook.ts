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
  composeOptions: IDockerComposeOptions

  constructor(composeDir: string | string[]) {
    this.composeDir = Array.isArray(composeDir) ? path.join(...composeDir) : composeDir
    this.serviceName = path.basename(this.composeDir)
    this.composeOptions = {
      cwd: this.composeDir,
    }
  }

  async exec(command: string | string[]) {
    let result = await compose.exec(this.serviceName, command, this.composeOptions)
    if (result.exitCode !== 0) {
      throw new Error(`command for ${this.serviceName} container exited with code ${result.exitCode}`)
    }
    return result
  }

  async waitForExec(command: string | string[], timeout?: number, step?: number) {
    await waitUntil(async () => this.exec(command), timeout, step)
  }

  async pause() {
    await compose.pauseOne(this.serviceName, this.composeOptions)
  }

  async unpause() {
    await compose.unpauseOne(this.serviceName, this.composeOptions)
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
