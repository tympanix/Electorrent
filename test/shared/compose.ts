import compose, { IDockerComposeOptions } from "docker-compose";
import path from "path";
import { waitUntil } from "../testutil";

/**
 * Backend is a utility class to interact with the docker-compose containers runing the Bittorrent
 * backend being tested
 */
export class DockerComposeService {

  composeDir: string
  serviceName: string
  composeOptions: IDockerComposeOptions

  constructor(composeDir: string | string[], { serviceName = "" } = {}) {
    this.composeDir = Array.isArray(composeDir) ? path.join(...composeDir) : composeDir
    this.serviceName = serviceName || path.basename(this.composeDir)
    this.composeOptions = {
      cwd: this.composeDir,
      log: true,
    }
  }

  async exec(command: string | string[]) {
    try {
      return await compose.exec(this.serviceName, command, this.composeOptions)
    } catch (err: any) {
      throw new Error(`command for ${this.serviceName} container exited with code ${err.exitCode}: ${err}`)
    }
  }

  async waitForExec(command: string | string[], timeout?: number, step?: number) {
    await waitUntil(async () => await this.exec(command), timeout, step)
  }

  async pause() {
    await compose.pauseOne(this.serviceName, this.composeOptions)
  }

  async unpause() {
    await compose.unpauseOne(this.serviceName, this.composeOptions)
  }

}
