import compose, { type IDockerComposeOptions } from "docker-compose"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { TEST_CLIENTS, type TestClient } from "../clients"
import { initializeTestFixture } from "./fixture"
import { DockerComposeService } from "../shared/compose"
import { waitForHttp } from "../testutil"

const testDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const stackComposeFile = path.join(testDir, "docker-compose.yml")

function shouldCleanupCompose() {
  return process.argv.some((argument) => argument === "--cleanup" || argument === "--cleanup=true")
}

interface ElectorrentCapabilities extends WebdriverIO.Capabilities {
  "electorrent:client"?: TestClient
}

export default class ElectorrentTestService {
  private workerComposeOptions?: IDockerComposeOptions

  async beforeSession(
    _config: WebdriverIO.Config,
    capabilities: ElectorrentCapabilities,
    _specs?: string[],
    cid = "0-0",
  ) {
    const client = capabilities["electorrent:client"]
    if (!client) {
      return
    }

    const { composeOptions, clientPort, proxyPort } = this.getClientEnvironment(client, cid)
    this.workerComposeOptions = composeOptions
    const workerClient = { ...client, port: clientPort }

    await compose.upMany(
      ["tracker", "peer", this.getClientServiceName(client), "nginx"],
      composeOptions,
    )
    await waitForHttp({
      url: `http://${workerClient.host}:${workerClient.port}`,
      statusCode: workerClient.acceptHttpStatus,
    })

    initializeTestFixture({
      client: workerClient,
      backend: new DockerComposeService(
        testDir,
        { serviceName: this.getClientServiceName(client) },
        composeOptions,
      ),
      tracker: new DockerComposeService(
        testDir,
        { serviceName: "peer" },
        composeOptions,
      ),
      proxyPort,
    })
  }

  async afterSession() {
    if (!this.workerComposeOptions) {
      return
    }

    if (shouldCleanupCompose()) {
      await compose.down(this.workerComposeOptions)
    }
    this.workerComposeOptions = undefined
  }

  private getClientEnvironment(client: TestClient, cid: string) {
    const suffix = client.key.replace(/[^a-z0-9]+/gi, "-").toLowerCase()
    const workerSuffix = cid.replace(/[^a-z0-9]+/gi, "-").toLowerCase()
    const projectName = `electorrent-${suffix}-${workerSuffix}`
    const clientIndex = Object.keys(TEST_CLIENTS).indexOf(client.key)
    const workerIndex = this.getWorkerIndex(cid)
    const portOffset = (clientIndex * 100) + workerIndex
    const clientPort = 40000 + portOffset
    const proxyPort = 41000 + portOffset
    const trackerPort = 42000 + portOffset
    const env = {
      ...process.env,
      COMPOSE_PROJECT_NAME: projectName,
      VERSION: client.version,
      CLIENT_HOST_PORT: String(clientPort),
      TRACKER_PORT: String(trackerPort),
      NGINX_HOST_PORT: String(proxyPort),
      PROXY_HOST: this.getClientServiceName(client),
      PROXY_PORT: String(client.proxyPort ?? client.containerPort),
      RPC_PORT: String(43000 + portOffset),
      PEER_PORT: String(44000 + portOffset),
      PEER_UDP_PORT: String(45000 + portOffset),
    }
    const composeOptions: IDockerComposeOptions = {
      cwd: testDir,
      config: stackComposeFile,
      composeOptions: ["--project-name", projectName],
      env,
      log: false,
    }

    return { composeOptions, clientPort, proxyPort }
  }

  private getWorkerIndex(cid: string) {
    const parts = cid.split("-")
    const index = Number(parts[parts.length - 1])
    return Number.isFinite(index) ? index : 0
  }

  private getClientServiceName(client: TestClient) {
    return path.basename(client.fixture)
  }
}
