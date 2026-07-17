import chai from "chai"
import { $, $$, browser } from "@wdio/globals"
import { eventually } from "../../e2e/eventually"
import { configureSpec } from "../../framework/fixture"
import { restartApplication } from "../../shared"
import type { BittorrentActionArguments } from "@shared/bittorrent-actions"

const assert: Chai.AssertStatic = chai.assert

interface MockTorrent {
  hash: string
  name: string
  size: number
  progress: number
  state: string
}

const mockServers = [
  { id: "mock-server-one", name: "Mock Server One", ip: "mock-one.local", torrentName: "Ubuntu Mock ISO" },
  { id: "mock-server-two", name: "Mock Server Two", ip: "mock-two.local", torrentName: "Fedora Mock ISO" },
  { id: "mock-server-three", name: "Mock Server Three", ip: "mock-three.local", torrentName: "Debian Mock ISO" },
]

describe("mock multiple servers", function () {
  configureSpec({ clearTorrents: false })

  before(async function () {
    await saveMockServers()
    await restartApplication(this)
    await this.app.serverSelectionPageIsVisible()
  })

  it("shows each server's torrent after changing servers", async function () {
    for (let index = 0; index < mockServers.length; index += 1) {
      await connectServer.call(this, index)
      await addMockedTorrent(mockTorrent(index))
      await expectOnlyTorrent(mockServers[index].torrentName)
    }

    for (let index = 0; index < mockServers.length; index += 1) {
      await connectServer.call(this, index)
      await expectOnlyTorrent(mockServers[index].torrentName)
    }
  })

  it("uploads launch magnets once across consecutive app invocations", async function () {
    const firstMagnet = "magnet:?xt=urn:btih:0000000000000000000000000000000000000356"
    const secondMagnet = "magnet:?xt=urn:btih:0000000000000000000000000000000000000357"
    const firstTorrentName = "Mock Magnet 0000000000000000000000000000000000000356"
    const secondTorrentName = "Mock Magnet 0000000000000000000000000000000000000357"

    await emitSecondInstanceDuringRendererReload(firstMagnet)
    await this.app.serverSelectionPageIsVisible()
    await this.app.connectServerSelection(0)
    await this.app.torrentsPageIsVisible()
    await eventually(getTorrentNames).satisfies(
      "include the first launch magnet",
      (names) => names.includes(firstTorrentName),
    )

    await emitSecondInstance(secondMagnet)
    await eventually(getTorrentNames).satisfies(
      "include both launch magnets",
      (names) => names.includes(firstTorrentName) && names.includes(secondTorrentName),
    )

    await openServerSelection()
    await this.app.connectServerSelection(1)
    await this.app.torrentsPageIsVisible()
    await eventually(getTorrentNames).satisfies(
      "not replay launch magnets on the second server",
      (names) => !names.includes(firstTorrentName) && !names.includes(secondTorrentName),
    )
  })
})

async function saveMockServers() {
  await browser.execute(async (servers) => {
    const settings = await (window as any).electorrent.settings.getAll()
    const baseServer = settings.servers[0]
    settings.startup = "ask"
    settings.servers = servers.map((server: any, index: number) => ({
      ...baseServer,
      id: server.id,
      name: server.name,
      ip: server.ip,
      proto: "http",
      port: 1,
      user: "",
      password: "",
      client: "mock",
      path: "/",
      default: index === 0,
      lastused: undefined,
    }))
    await (window as any).electorrent.settings.saveAll(settings)
  }, mockServers)
}

async function connectServer(this: Mocha.Context, serverIndex: number) {
  await restartApplication(this)
  await this.app.serverSelectionPageIsVisible()
  await this.app.connectServerSelection(serverIndex)
  await this.app.torrentsPageIsVisible()
  await eventually(() => this.app.getTitleBarServerName()).equals(mockServers[serverIndex].name)
}

function mockTorrent(index: number): MockTorrent {
  return {
    hash: (index + 1).toString(16).padStart(40, "0"),
    name: mockServers[index].torrentName,
    size: (index + 1) * 1024 * 1024,
    progress: index === 0 ? 0.25 : index === 1 ? 0.5 : 1,
    state: index === 2 ? "uploading" : "downloading",
  }
}

async function invokeMockAction<Action extends "addMockedTorrent" | "clearMockedTorrents">(
  action: Action,
  ...args: BittorrentActionArguments[Action]
) {
  await browser.execute(async (request) => {
    await (window as any).electorrent.bittorrent.invokeAction(request)
  }, { action, args })
}

async function emitSecondInstance(magnet: string) {
  await browser.electron.execute((electron, uri) => {
    electron.app.emit("second-instance", {} as Electron.Event, [electron.app.getPath("exe"), uri], process.cwd())
  }, magnet)
}

async function emitSecondInstanceDuringRendererReload(magnet: string) {
  await browser.electron.execute(async (electron, uri) => {
    const window = electron.BrowserWindow.getAllWindows()[0]
    await new Promise<void>((resolve) => {
      window.webContents.once("did-start-loading", () => {
        electron.app.emit("second-instance", {} as Electron.Event, [electron.app.getPath("exe"), uri], process.cwd())
        resolve()
      })
      window.webContents.reload()
    })
  }, magnet)
}

async function openServerSelection() {
  await browser.electron.execute((electron) => {
    electron.BrowserWindow.getAllWindows()[0]?.webContents.send("menu:action", { type: "show-servers" })
  })
  await $("#page-server-selection").waitForDisplayed()
}

async function addMockedTorrent(torrent: MockTorrent) {
  await invokeMockAction("clearMockedTorrents")
  await invokeMockAction("addMockedTorrent", torrent)
}

async function getTorrentNames() {
  const cells = await $$("#torrentTable tbody tr[data-hash] td[data-col='decodedName']")
  const names: string[] = []
  for (const cell of cells) {
    names.push((await cell.getText()).trim())
  }
  return names
}

async function expectOnlyTorrent(expectedName: string) {
  await eventually(getTorrentNames).satisfies(
    `only include ${expectedName}`,
    (names) => names.length === 1 && names[0] === expectedName,
  )
  assert.deepEqual(await getTorrentNames(), [expectedName])
}
