import compose, { type IDockerComposeOptions } from "docker-compose"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { TEST_CLIENTS, type TestClient } from "../clients"
import { initializeTestFixture } from "./fixture"
import { DockerComposeService } from "../shared/compose"
import { waitForHttp } from "../testutil"

const testDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const stackComposeFile = path.join(testDir, "docker-compose.yml")

interface ElectorrentCapabilities extends WebdriverIO.Capabilities {
  "electorrent:client"?: TestClient
}

export default class ElectorrentTestService {
  async onPrepare(
    _config: WebdriverIO.Config,
    capabilities: ElectorrentCapabilities[],
  ) {
    const clients = new Map(
      capabilities
        .map((capability) => capability["electorrent:client"])
        .filter((client): client is TestClient => Boolean(client))
        .filter((client) => Boolean(client.fixture))
        .map((client) => [client.key, client]),
    )

    await Promise.all(
      [...clients.values()].map(async (client) => {
        const { composeOptions } = this.getClientEnvironment(client)

        await compose.upMany(
          ["tracker", "peer", this.getClientServiceName(client), "nginx"],
          composeOptions,
        )
        await waitForHttp({
          url: `http://${client.host}:${client.port}`,
          statusCode: client.acceptHttpStatus,
        })
      }),
    )
  }

  async beforeSession(
    _config: WebdriverIO.Config,
    capabilities: ElectorrentCapabilities,
  ) {
    const client = capabilities["electorrent:client"]
    if (!client) {
      return
    }

    if (!client.fixture) {
      initializeTestFixture({ client, proxyPort: client.port })
      return
    }

    const { composeOptions, proxyPort } = this.getClientEnvironment(client)

    initializeTestFixture({
      client,
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

  private getClientEnvironment(client: TestClient) {
    const suffix = client.key.replace(/[^a-z0-9]+/gi, "-").toLowerCase()
    const clientIndex = Object.keys(TEST_CLIENTS).indexOf(client.key)
    const proxyPort = 50000 + clientIndex
    const trackerPort = 51000 + clientIndex
    const env = {
      ...process.env,
      COMPOSE_PROJECT_NAME: `electorrent-${suffix}`,
      VERSION: client.version,
      CLIENT_HOST_PORT: String(client.port),
      TRACKER_PORT: String(trackerPort),
      NGINX_HOST_PORT: String(proxyPort),
      PROXY_HOST: this.getClientServiceName(client),
      PROXY_PORT: String(client.proxyPort ?? client.containerPort ?? client.port),
      RPC_PORT: String(52000 + clientIndex),
      PEER_PORT: String(53000 + clientIndex),
      PEER_UDP_PORT: String(54000 + clientIndex),
    }
    const composeOptions: IDockerComposeOptions = {
      cwd: testDir,
      config: stackComposeFile,
      env,
      log: false,
    }

    return { composeOptions, proxyPort }
  }

  private getClientServiceName(client: TestClient) {
    if (!client.fixture) {
      throw new Error(`Test client ${client.key} does not use a docker fixture`)
    }
    return path.basename(client.fixture)
  }
}
