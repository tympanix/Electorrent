import compose, { IDockerComposeOptions } from "docker-compose"
import path from "path"

/**
 * Mocha hooks to start up and shut down a docker-compose service using the "before" and
 * "after" hooks. This means the services described in your docker-compose.yml file will
 * be running for the entire current mocha context
 * @param composeDir the directory containing your docker-compose.yml file
 * @param extraOpts additonal options to the docker-compose invocation
 */
export function dockerComposeHooks(composeDir: string | string[], extraOpts?: IDockerComposeOptions) {

  if (Array.isArray(composeDir)) {
    composeDir = path.join(...composeDir)
  }

  const composeOpts: IDockerComposeOptions = {
    cwd: composeDir,
    log: !!process.env.DEBUG,
  }

  before(async function() {
    this.timeout(60 * 1000)
    await compose.upAll({ ...composeOpts, ...extraOpts, commandOptions: ['--build'] })
  })

  after(async function() {
    this.timeout(60 * 1000)
    if (!process.env.MOCHA_DOCKER_KEEP) {
      await compose.down({ ...composeOpts, ...extraOpts })
    }
  })
}