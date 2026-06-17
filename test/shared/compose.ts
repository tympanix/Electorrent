import compose, { IDockerComposeOptions } from "docker-compose";
import { waitUntil } from "../testutil";

/**
 * Backend is a utility class to interact with a service in the test docker compose project.
 */
export class DockerComposeService {

  composeProjectDir: string
  serviceName: string
  composeOptions: IDockerComposeOptions

  constructor(
    composeProjectDir: string,
    { serviceName }: { serviceName: string },
    composeOptions: Partial<IDockerComposeOptions> = {},
  ) {
    this.composeProjectDir = composeProjectDir
    this.serviceName = serviceName
    this.composeOptions = {
      cwd: this.composeProjectDir,
      log: true,
      ...composeOptions,
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
