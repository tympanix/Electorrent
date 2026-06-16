import compose, { type IDockerComposeOptions } from "docker-compose"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { TEST_CLIENTS, type TestClient } from "../clients"
import { initializeTestFixture } from "./fixture"
import { DockerComposeService } from "../shared/compose"
import { waitForHttp } from "../testutil"

const testDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

interface ElectorrentCapabilities extends WebdriverIO.Capabilities {
  "electorrent:client"?: TestClient
}

interface ComposeEnvironment {
  cwd: string
  options: IDockerComposeOptions
}

export default class ElectorrentTestService {
  private composeEnvironments: ComposeEnvironment[] = []

  async beforeSession(
    _config: WebdriverIO.Config,
    capabilities: ElectorrentCapabilities,
    _specs: string[],
    cid = process.env.WDIO_WORKER_ID ?? "0-0",
  ) {
    const client = capabilities["electorrent:client"]
    if (!client) {
      return
    }

    const workerIndex = this.getWorkerIndex(cid)
    const { backendPort, commonEnv, composeOptions, proxyPort, sharedDir, trackerPort } = this.getClientEnvironment(
      client,
      workerIndex,
    )

    await this.startClientEnvironment(client, workerIndex)

    initializeTestFixture({
      client: { ...client, port: backendPort },
      backend: new DockerComposeService(path.join(testDir, client.fixture), {}, { env: commonEnv, composeOptions }),
      tracker: new DockerComposeService(
        path.join(testDir, "shared", "opentracker"),
        { serviceName: "peer" },
        { env: { ...commonEnv, SHARED_DIR: sharedDir, TRACKER_PORT: String(trackerPort) }, composeOptions },
      ),
      proxyPort,
      sharedDir,
    })
  }

  async afterSession() {
    await this.stopComposeEnvironments()
  }

  async onComplete() {
    await this.stopComposeEnvironments()
  }

  private async startClientEnvironment(client: TestClient, workerIndex: number) {
    const { backendPort, commonEnv, composeOptions, proxyPort, sharedDir, trackerPort } = this.getClientEnvironment(
      client,
      workerIndex,
    )

    const trackerEnv = {
      ...commonEnv,
      SHARED_DIR: sharedDir,
      TRACKER_PORT: String(trackerPort),
    }
    const clientEnv = {
      ...commonEnv,
      VERSION: client.version,
      HOST_PORT: String(backendPort),
      RPC_PORT: String(52000 + this.getPortOffset(client, workerIndex)),
      PEER_PORT: String(53000 + this.getPortOffset(client, workerIndex)),
      PEER_UDP_PORT: String(54000 + this.getPortOffset(client, workerIndex)),
    }
    const nginxEnv = {
      ...commonEnv,
      HOST_PORT: String(proxyPort),
      PROXY_HOST: path.basename(client.fixture),
      PROXY_PORT: String(client.proxyPort ?? client.containerPort),
    }
    const trackerDir = path.join(testDir, "shared", "opentracker")
    const clientDir = path.join(testDir, client.fixture)
    const nginxDir = path.join(testDir, "shared", "nginx")

    await this.stopCompose(nginxDir, nginxEnv, composeOptions)
    await this.stopCompose(clientDir, clientEnv, composeOptions)
    await this.stopCompose(trackerDir, trackerEnv, composeOptions)

    fs.rmSync(sharedDir, { recursive: true, force: true })
    fs.mkdirSync(sharedDir, { recursive: true })

    await this.startCompose(trackerDir, trackerEnv, composeOptions)
    await this.startCompose(clientDir, clientEnv, composeOptions)
    await waitForHttp({
      url: `http://${client.host}:${backendPort}`,
      statusCode: client.acceptHttpStatus,
    })
    await this.startCompose(nginxDir, nginxEnv, composeOptions)
  }

  private getClientEnvironment(client: TestClient, workerIndex: number) {
    const suffix = client.key.replace(/[^a-z0-9]+/gi, "-").toLowerCase()
    const projectName = `electorrent-${suffix}-worker-${workerIndex}`
    const networkName = `${projectName}-p2p`
    const portOffset = this.getPortOffset(client, workerIndex)
    const proxyPort = 50000 + portOffset
    const trackerPort = 51000 + portOffset
    const backendPort = 55000 + portOffset
    const commonEnv = {
      ...process.env,
      NETWORK_NAME: networkName,
    }
    const composeOptions = ["--project-name", projectName]
    const sharedDir = path.join(testDir, "shared", "opentracker", "data", projectName)

    return { backendPort, commonEnv, composeOptions, proxyPort, sharedDir, trackerPort }
  }

  private getPortOffset(client: TestClient, workerIndex: number) {
    const clientIndex = Object.keys(TEST_CLIENTS).indexOf(client.key)

    return (clientIndex * 100) + workerIndex
  }

  private getWorkerIndex(cid: string) {
    const cidParts = cid.split("-")
    const workerIndex = Number(cidParts[cidParts.length - 1])

    if (Number.isInteger(workerIndex) && workerIndex >= 0) {
      return workerIndex
    }

    return 0
  }

  private async startCompose(cwd: string, env: NodeJS.ProcessEnv, composeOptions: string[]) {
    const options = { cwd, env, composeOptions, log: false }
    await compose.upAll(options)
    this.composeEnvironments.push({ cwd, options })
  }

  private async stopCompose(cwd: string, env: NodeJS.ProcessEnv, composeOptions: string[]) {
    await compose.downAll({ cwd, env, composeOptions, commandOptions: ["--volumes"], log: false })
  }

  private async stopComposeEnvironments() {
    for (const { options } of [...this.composeEnvironments].reverse()) {
      await compose.downAll({ ...options, commandOptions: ["--volumes"], log: false })
    }
    this.composeEnvironments = []
  }
}
