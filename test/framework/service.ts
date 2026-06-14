import compose from "docker-compose"
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

export default class ElectorrentTestService {
  private composeEnvironments: Array<{ cwd: string, env: NodeJS.ProcessEnv }> = []

  async onPrepare(
    _config: WebdriverIO.Config,
    capabilities: ElectorrentCapabilities[],
  ) {
    const clients = new Map(
      capabilities
        .map((capability) => capability["electorrent:client"])
        .filter((client): client is TestClient => Boolean(client))
        .map((client) => [client.key, client]),
    )

    for (const client of clients.values()) {
      const { clientIndex, commonEnv, proxyPort, trackerPort } = this.getClientEnvironment(client)

      await this.startCompose(path.join(testDir, "shared", "opentracker"), {
        ...commonEnv,
        TRACKER_PORT: String(trackerPort),
      })
      await this.startCompose(path.join(testDir, client.fixture), {
        ...commonEnv,
        VERSION: client.version,
        HOST_PORT: String(client.port),
        RPC_PORT: String(52000 + clientIndex),
        PEER_PORT: String(53000 + clientIndex),
        PEER_UDP_PORT: String(54000 + clientIndex),
      })
      await waitForHttp({
        url: `http://${client.host}:${client.port}`,
        statusCode: client.acceptHttpStatus,
      })
      await this.startCompose(path.join(testDir, "shared", "nginx"), {
        ...commonEnv,
        HOST_PORT: String(proxyPort),
        PROXY_HOST: path.basename(client.fixture),
        PROXY_PORT: String(client.proxyPort ?? client.containerPort),
      })
    }
  }

  async beforeSession(
    _config: WebdriverIO.Config,
    capabilities: ElectorrentCapabilities,
  ) {
    const client = capabilities["electorrent:client"]
    if (!client) {
      return
    }

    const { commonEnv, proxyPort, trackerPort } = this.getClientEnvironment(client)

    initializeTestFixture({
      client,
      backend: new DockerComposeService(path.join(testDir, client.fixture), {}, { env: commonEnv }),
      tracker: new DockerComposeService(
        path.join(testDir, "shared", "opentracker"),
        { serviceName: "peer" },
        { env: { ...commonEnv, TRACKER_PORT: String(trackerPort) } },
      ),
      proxyPort,
    })
  }

  async onComplete() {
    if (!process.env.MOCHA_DOCKER_CLEANUP) {
      return
    }
    for (const options of [...this.composeEnvironments].reverse()) {
      await compose.downAll({ ...options, log: false })
    }
  }

  private getClientEnvironment(client: TestClient) {
    const suffix = client.key.replace(/[^a-z0-9]+/gi, "-").toLowerCase()
    const clientIndex = Object.keys(TEST_CLIENTS).indexOf(client.key)
    const networkName = `electorrent-p2p-${suffix}`
    const proxyPort = 50000 + clientIndex
    const trackerPort = 51000 + clientIndex
    const commonEnv = {
      ...process.env,
      COMPOSE_PROJECT_NAME: `electorrent-${suffix}`,
      NETWORK_NAME: networkName,
    }

    return { clientIndex, commonEnv, proxyPort, trackerPort }
  }

  private async startCompose(cwd: string, env: NodeJS.ProcessEnv) {
    const options = { cwd, env, log: false }
    await compose.downAll({ ...options, commandOptions: ["--volumes"] })
    await compose.upAll(options)
    this.composeEnvironments.push({ cwd, env })
  }
}
