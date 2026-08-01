import compose, { type IDockerComposeOptions } from "docker-compose"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { TEST_CLIENTS, type TestClient } from "../clients"
import { initializeTestFixture } from "./fixture"
import { DockerComposeService } from "../shared/compose"
import { waitForHttp } from "../testutil"

const testDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const stackComposeFile = path.join(testDir, "docker-compose.yml")
const fixturePortStride = 100

interface ElectorrentCapabilities extends WebdriverIO.Capabilities {
  "electorrent:client"?: TestClient
  "electorrent:fixtureSlot"?: number
}

export default class ElectorrentTestService {
  private readonly workerFixtures = new Map<string, { clientKey: string, slot: number }>()
  private readonly leasedSlots = new Map<string, Set<number>>()
  private readonly fixtureCounts = new Map<string, number>()

  async onPrepare(
    config: WebdriverIO.Config,
    capabilities: ElectorrentCapabilities[],
  ) {
    const clients = new Map(
      capabilities
        .map((capability) => capability["electorrent:client"])
        .filter((client): client is TestClient => Boolean(client))
        .filter((client) => Boolean(client.fixture))
        .map((client) => [client.key, client]),
    )

    const fixtureCount = config.maxInstancesPerCapability ?? 1

    await Promise.all(
      [...clients.values()].map(async (client) => {
        this.fixtureCounts.set(client.key, fixtureCount)

        // Start a bounded pool once, then reuse each fixture as WDIO schedules specs.
        for (let slot = 0; slot < fixtureCount; slot += 1) {
          const { client: isolatedClient, composeOptions } = this.getClientEnvironment(client, slot)

          await compose.upMany(
            ["tracker", "peer", this.getClientServiceName(client), "nginx"],
            composeOptions,
          )
          await waitForHttp({
            url: `http://${isolatedClient.host}:${isolatedClient.containerHostPort ?? isolatedClient.port}${isolatedClient.acceptHttpPath ?? ""}`,
            statusCode: isolatedClient.acceptHttpStatus,
          })
        }
      }),
    )
  }

  onWorkerStart(cid: string, capabilities: ElectorrentCapabilities) {
    const client = capabilities["electorrent:client"]
    if (!client?.fixture) {
      return
    }

    const fixtureCount = this.fixtureCounts.get(client.key)
    if (fixtureCount == null) {
      throw new Error(`Test fixture pool was not prepared for ${client.key}`)
    }

    const leasedSlots = this.leasedSlots.get(client.key) ?? new Set<number>()
    const slot = Array.from({ length: fixtureCount }, (_, index) => index)
      .find((candidate) => !leasedSlots.has(candidate))

    if (slot == null) {
      throw new Error(`No test fixture available for ${client.key}`)
    }

    leasedSlots.add(slot)
    this.leasedSlots.set(client.key, leasedSlots)
    this.workerFixtures.set(cid, { clientKey: client.key, slot })
    capabilities["electorrent:fixtureSlot"] = slot
  }

  onWorkerEnd(cid: string) {
    const fixture = this.workerFixtures.get(cid)
    if (!fixture) {
      return
    }

    this.leasedSlots.get(fixture.clientKey)?.delete(fixture.slot)
    this.workerFixtures.delete(cid)
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

    const slot = capabilities["electorrent:fixtureSlot"]
    if (slot == null) {
      throw new Error(`Test fixture slot was not assigned for ${client.key}`)
    }

    const { client: isolatedClient, composeOptions, proxyPort } = this.getClientEnvironment(client, slot)

    initializeTestFixture({
      client: isolatedClient,
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

  private getClientEnvironment(client: TestClient, slot: number) {
    const portOffset = slot * fixturePortStride
    const isolatedClient = {
      ...client,
      port: client.port + portOffset,
      ...(client.containerHostPort == null ? {} : { containerHostPort: client.containerHostPort + portOffset }),
      ...(client.authProxyHostPort == null ? {} : { authProxyHostPort: client.authProxyHostPort + portOffset }),
    }
    const suffix = client.key.replace(/[^a-z0-9]+/gi, "-").toLowerCase()
    const clientIndex = Object.keys(TEST_CLIENTS).indexOf(client.key)
    const proxyPort = 50000 + clientIndex + portOffset
    const trackerPort = 51000 + clientIndex + portOffset
    const authProxyPort = isolatedClient.authProxyHostPort ?? 55000 + clientIndex + portOffset
    const env = {
      ...process.env,
      COMPOSE_PROJECT_NAME: `electorrent-${suffix}${slot ? `-${slot + 1}` : ""}`,
      VERSION: client.version,
      CLIENT_HOST_PORT: String(isolatedClient.containerHostPort ?? isolatedClient.port),
      TRACKER_PORT: String(trackerPort),
      NGINX_HOST_PORT: String(proxyPort),
      NGINX_AUTH_HOST_PORT: String(authProxyPort),
      NGINX_AUTH_PORT: "8081",
      PROXY_HOST: this.getClientServiceName(client),
      PROXY_PORT: String(client.proxyPort ?? client.containerPort ?? client.port),
      RPC_PORT: String(52000 + clientIndex + portOffset),
      PEER_PORT: String(53000 + clientIndex + portOffset),
      PEER_UDP_PORT: String(54000 + clientIndex + portOffset),
    }
    const composeOptions: IDockerComposeOptions = {
      cwd: testDir,
      config: stackComposeFile,
      env,
      log: false,
    }

    return { client: isolatedClient, composeOptions, proxyPort }
  }

  private getClientServiceName(client: TestClient) {
    if (!client.fixture) {
      throw new Error(`Test client ${client.key} does not use a docker fixture`)
    }
    return path.basename(client.fixture)
  }
}
