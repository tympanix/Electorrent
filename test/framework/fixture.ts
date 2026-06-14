import { browser, $$ } from "@wdio/globals"
import chai from "chai"
import chaiAsPromised from "chai-as-promised"
import fs from "node:fs"
import path from "node:path"
import { App, Torrent } from "../e2e"
import { DockerComposeService } from "../shared/compose"
import { setupMochaHooks, waitUntil } from "../testutil"
import type { TestClient } from "../clients"

export interface TestFixture {
  client: TestClient
  backend: DockerComposeService
  tracker: DockerComposeService
  proxyPort: number
  app: App
}

let fixture: TestFixture | undefined

export function initializeTestFixture(value: Omit<TestFixture, "app">) {
  fixture = { ...value, app: new App() }
}

export function getTestFixture(): TestFixture {
  if (!fixture) {
    throw new Error("The test fixture has not been initialized by the WDIO service")
  }
  return fixture
}

export function configureSpec(options: { login?: boolean } = {}) {
  setupMochaHooks()

  before(async function() {
    this.timeout(60 * 1000)
    chai.should()
    chai.use(chaiAsPromised)

    const current = getTestFixture()
    const userDataPath = await waitUntil(async () => {
      try {
        return await browser.electron.execute((electron) => electron.app.getPath("userData"))
      } catch (error) {
        if (error instanceof Error && error.message.includes("Cannot find context with specified id")) {
          await browser.reloadSession()
        }
        throw error
      }
    }, 10 * 1000)
    fs.rmSync(path.join(userDataPath, "config.json"), { force: true })
    fs.rmSync(path.join(userDataPath, "certs"), { recursive: true, force: true })
    await browser.execute(() => window.localStorage.clear())
    await browser.reloadSession()

    current.app = new App()
    this.app = current.app
    this.backend = current.backend
    this.retries(3)
    if (options.login !== false) {
      await current.app.login(current.client)
      await current.app.torrentsPageIsVisible()
      await removeAllTorrents(current.app)
    }
  })
}

async function removeAllTorrents(app: App) {
  const rows = await $$("[data-hash]")
  const hashes: string[] = []
  for (let index = 0; index < rows.length; index += 1) {
    const hash = await rows[index].getAttribute("data-hash")
    if (hash) {
      hashes.push(hash)
    }
  }
  for (const hash of new Set(hashes.filter((value): value is string => Boolean(value)))) {
    const torrent = new Torrent({ hash, app })
    if (await torrent.isExisting()) {
      await torrent.delete()
    }
  }
}

export function requireFeature(isSupported: (client: TestClient) => boolean) {
  before(function() {
    if (!isSupported(getTestFixture().client)) {
      this.skip()
    }
  })
}

export function createUniqueLabel(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

export function formatBytes(bytes: number, fractionSize = 1) {
  if (!bytes) {
    return "0 B"
  }

  const decimals = fractionSize < 0 ? 0 : fractionSize
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
  const index = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${parseFloat((bytes / Math.pow(1024, index)).toFixed(decimals))} ${sizes[index]}`
}

export function enabledFeaturePaths(features: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(features).flatMap(([key, value]) => {
    const featurePath = prefix ? `${prefix}.${key}` : key
    if (value === true) {
      return [featurePath]
    }
    if (value && typeof value === "object") {
      return enabledFeaturePaths(value as Record<string, unknown>, featurePath)
    }
    return []
  })
}
