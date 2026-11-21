/**
 * UI performance benchmark for large torrent lists (see issue #843).
 *
 * Not part of the regular test suite. Run against the mock client with:
 *
 *   BENCH_TORRENTS=1000 npm run test -- --client mock --spec test/benchmarks/ui-performance.bench.ts --headless --mochaOpts.timeout 600000
 *
 * Set `BENCH_BACKEND=transmission` to connect to a fake Transmission RPC server with realistic
 * payloads (files, peers, pieces, ...) instead of the in-process mock client.
 *
 * Results are printed to the console and, when `BENCH_OUTPUT` is set, written to that JSON file.
 * Other knobs: `BENCH_IDLE_SECONDS`, `BENCH_CLICKS`, `BENCH_CPU_THROTTLE` (renderer CPU slowdown factor,
 * emulates slower machines) and `BENCH_PROFILE` (path for a renderer `.cpuprofile` of the last idle phase).
 * Run with `--mochaOpts.timeout 600000` since seeding and measuring exceed the default timeout.
 */
import fs from "node:fs"
import { $, $$, browser } from "@wdio/globals"
import type { CDPSession } from "puppeteer-core"
import { App } from "../e2e"
import { eventually } from "../e2e/eventually"
import { configureSpec } from "../framework/fixture"
import { startFakeTransmission } from "./fake-transmission"

const BACKEND = (process.env.BENCH_BACKEND || "mock") as "mock" | "transmission"
const FAKE_TRANSMISSION_PORT = Number(process.env.BENCH_TRANSMISSION_PORT || 49091)
const TORRENT_COUNT = Number(process.env.BENCH_TORRENTS || 1000)
const IDLE_SECONDS = Number(process.env.BENCH_IDLE_SECONDS || 10)
const CLICK_COUNT = Number(process.env.BENCH_CLICKS || 15)
const OUTPUT = process.env.BENCH_OUTPUT
const PROFILE = process.env.BENCH_PROFILE
const CPU_THROTTLE = Number(process.env.BENCH_CPU_THROTTLE || 1)

interface BenchWindow {
  __bench: {
    digests: number[]
    longTasks: number[]
    events: Array<{ name: string, duration: number, processing: number }>
  }
}

function stats(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right)
  const sum = sorted.reduce((acc, value) => acc + value, 0)
  const pick = (quantile: number) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * quantile))] : 0
  return {
    count: sorted.length,
    total: Math.round(sum),
    mean: sorted.length ? Number((sum / sorted.length).toFixed(2)) : 0,
    p50: Number(pick(0.5).toFixed(2)),
    p95: Number(pick(0.95).toFixed(2)),
    max: Number((sorted[sorted.length - 1] || 0).toFixed(2)),
  }
}

let cdpSession: CDPSession | undefined

async function rendererSession() {
  if (!cdpSession) {
    const puppeteer = await browser.getPuppeteer()
    const pages = await puppeteer.pages()
    const page = pages.find((candidate) => candidate.url().includes("index.html")) || pages[0]
    cdpSession = await page.createCDPSession()
  }
  return cdpSession
}

async function invokeMockAction(action: string, ...args: unknown[]) {
  await browser.execute(async (request) => {
    await (window as any).electorrent.bittorrent.invokeAction(request)
  }, { action, args })
}

async function installInstrumentation() {
  await browser.execute(() => {
    const benchWindow = window as unknown as BenchWindow & { angular: any }
    const bench = { digests: [] as number[], longTasks: [] as number[], events: [] as BenchWindow["__bench"]["events"] }
    benchWindow.__bench = bench

    const $rootScope = benchWindow.angular.element(document.documentElement).injector().get("$rootScope")
    const proto = Object.getPrototypeOf($rootScope)
    if (!proto.__benchDigest) {
      proto.__benchDigest = proto.$digest
      proto.$digest = function benchDigest(this: unknown) {
        const startedAt = performance.now()
        try {
          return proto.__benchDigest.call(this)
        } finally {
          (window as unknown as BenchWindow).__bench.digests.push(performance.now() - startedAt)
        }
      }
    }

    new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => (window as unknown as BenchWindow).__bench.longTasks.push(entry.duration))
    }).observe({ type: "longtask", buffered: false })

    new PerformanceObserver((list) => {
      list.getEntries().forEach((entry: any) => {
        (window as unknown as BenchWindow).__bench.events.push({
          name: entry.name,
          duration: entry.duration,
          processing: entry.processingEnd - entry.processingStart,
        })
      })
    }).observe({ type: "event", durationThreshold: 16, buffered: false } as PerformanceObserverInit)
  })
}

async function resetMainLag() {
  await browser.electron.execute((electron) => {
    const target = globalThis as any
    target.__benchCpu = {
      startedAt: Date.now(),
      metrics: Object.fromEntries(electron.app.getAppMetrics().map((metric) => [metric.pid, metric.cpu.cumulativeCPUUsage || 0])),
    }
    if (target.__benchLagTimer) {
      clearInterval(target.__benchLagTimer)
    }
    target.__benchLag = []
    let expected = Date.now() + 10
    target.__benchLagTimer = setInterval(() => {
      const now = Date.now()
      target.__benchLag.push(Math.max(0, now - expected))
      expected = now + 10
    }, 10)
  })
}

async function collectMainLag(): Promise<{ lag: number[], cpuPercent: Record<string, number> }> {
  return browser.electron.execute((electron) => {
    const target = globalThis as any
    const elapsedSeconds = (Date.now() - target.__benchCpu.startedAt) / 1000
    const cpuPercent: Record<string, number> = {}
    electron.app.getAppMetrics().forEach((metric) => {
      const start = target.__benchCpu.metrics[metric.pid] || 0
      cpuPercent[metric.type] = (cpuPercent[metric.type] || 0) + ((metric.cpu.cumulativeCPUUsage || 0) - start) / elapsedSeconds * 100
    })
    Object.keys(cpuPercent).forEach((type) => {
      cpuPercent[type] = Number(cpuPercent[type].toFixed(1))
    })
    return { lag: target.__benchLag.filter((lag: number) => lag > 0), cpuPercent }
  })
}

async function resetInstrumentation() {
  await resetMainLag()
  await browser.execute(() => {
    const bench = (window as unknown as BenchWindow).__bench
    bench.digests = []
    bench.longTasks = []
    bench.events = []
  })
}

async function collectInstrumentation() {
  const mainLag = await collectMainLag()
  const renderer = await browser.execute(() => {
    const benchWindow = window as unknown as BenchWindow & { angular: any }
    const $rootScope = benchWindow.angular.element(document.documentElement).injector().get("$rootScope")
    let watchers = 0
    const visit = (scope: any) => {
      for (let current = scope; current; current = current.$$nextSibling) {
        watchers += current.$$watchers ? current.$$watchers.length : 0
        if (current.$$childHead) {
          visit(current.$$childHead)
        }
      }
    }
    visit($rootScope)
    return {
      ...JSON.parse(JSON.stringify(benchWindow.__bench)),
      watchers,
      domNodes: document.getElementsByTagName("*").length,
      rows: document.querySelectorAll("#torrentTable tbody tr[data-id]").length,
      heapMB: Math.round(((performance as any).memory?.usedJSHeapSize || 0) / 1024 / 1024),
    }
  })
  return { ...renderer, mainLag }
}

function summarize(phase: string, data: Awaited<ReturnType<typeof collectInstrumentation>>) {
  const clickEvents = data.events.filter((event: any) => ["click", "pointerdown", "pointerup", "mousedown", "mouseup", "keydown"].includes(event.name))
  return {
    phase,
    watchers: data.watchers,
    domNodes: data.domNodes,
    rows: data.rows,
    heapMB: data.heapMB,
    digestMs: stats(data.digests),
    longTaskMs: stats(data.longTasks),
    slowInputEventMs: stats(clickEvents.map((event: any) => event.duration)),
    mainProcessLagMs: stats(data.mainLag.lag),
    cpuPercent: data.mainLag.cpuPercent,
  }
}

describe("UI performance benchmark", function () {
  configureSpec({ clearTorrents: false, login: BACKEND === "mock" })

  const results: any = { backend: BACKEND, torrents: TORRENT_COUNT, phases: [] }
  let fakeTransmission: Awaited<ReturnType<typeof startFakeTransmission>> | undefined

  before(async function () {
    this.timeout(10 * 60 * 1000)
    if (BACKEND === "transmission") {
      fakeTransmission = await startFakeTransmission(FAKE_TRANSMISSION_PORT, TORRENT_COUNT)
      const app = new App()
      await app.login({ host: "127.0.0.1", port: FAKE_TRANSMISSION_PORT, username: "", password: "", clientId: "transmission" })
      await app.torrentsPageIsVisible()
    } else {
      await invokeMockAction("clearMockedTorrents")
      for (let created = 0; created < TORRENT_COUNT; created += 100) {
        await invokeMockAction("generateMockedTorrents")
      }
    }
    await eventually(async () => (await $$("#torrentTable tbody tr[data-id]").length) >= 20)
      .equals(true, { interval: 1000, timeout: 60000 })
    await installInstrumentation()
    if (CPU_THROTTLE > 1) {
      const session = await rendererSession()
      await session.send("Emulation.setCPUThrottlingRate", { rate: CPU_THROTTLE })
    }
  })

  after(async function () {
    if (fakeTransmission) {
      const bytes = fakeTransmission.stats.torrentGetBytes
      results.torrentGetResponseKB = stats(bytes.map((value) => value / 1024))
      await fakeTransmission.close()
    }
    if (OUTPUT) {
      fs.writeFileSync(OUTPUT, JSON.stringify(results, null, 2))
    }
    console.log(`\n=== UI benchmark (${BACKEND}, ${TORRENT_COUNT} torrents) ===\n${JSON.stringify(results, null, 2)}`)
  })

  it("measures snapshot round trip", async function () {
    this.timeout(5 * 60 * 1000)
    const timings = await browser.execute(async (iterations) => {
      const bridge = (window as any).electorrent.bittorrent
      const $rootScope = (window as any).angular.element(document.documentElement).injector().get("$rootScope")
      const ipc: number[] = []
      const client: number[] = []
      for (let index = 0; index < iterations; index += 1) {
        let startedAt = performance.now()
        await bridge.getSnapshot({ fullUpdate: true })
        ipc.push(performance.now() - startedAt)
        startedAt = performance.now()
        await $rootScope.$btclient.torrents(true)
        client.push(performance.now() - startedAt)
      }
      return { ipc, client }
    }, 5)
    results.snapshotIpcMs = stats(timings.ipc)
    results.snapshotClientMs = stats(timings.client)
  })

  it("measures idle polling cost", async function () {
    this.timeout(5 * 60 * 1000)
    await resetInstrumentation()
    await browser.pause(IDLE_SECONDS * 1000)
    results.phases.push(summarize("idle-polling", await collectInstrumentation()))
  })

  it("measures row selection latency", async function () {
    this.timeout(5 * 60 * 1000)
    await resetInstrumentation()
    const rows = await $$("#torrentTable tbody tr[data-id]")
    for (let index = 0; index < CLICK_COUNT; index += 1) {
      await rows[index % (await rows.length)].click()
    }
    results.phases.push(summarize("row-clicks", await collectInstrumentation()))
  })

  it("measures sidebar filter latency", async function () {
    this.timeout(5 * 60 * 1000)
    await resetInstrumentation()
    for (const state of ["downloading", "finished", "seeding", "all", "downloading", "all"]) {
      await $(`.torrent.sidebar li[data-state='${state}']`).click()
    }
    results.phases.push(summarize("sidebar-filters", await collectInstrumentation()))
  })

  it("measures scrolling through the list", async function () {
    this.timeout(5 * 60 * 1000)
    await resetInstrumentation()
    for (let step = 0; step < 10; step += 1) {
      const rows = await $$("#torrentTable tbody tr[data-id]")
      await rows[(await rows.length) - 1].scrollIntoView()
      await browser.pause(300)
    }
    results.phases.push(summarize("scroll", await collectInstrumentation()))
  })

  it("measures idle polling cost after scrolling", async function () {
    this.timeout(5 * 60 * 1000)
    await resetInstrumentation()
    if (PROFILE) {
      const session = await rendererSession()
      await session.send("Profiler.enable")
      await session.send("Profiler.setSamplingInterval", { interval: 200 })
      await session.send("Profiler.start")
      await browser.pause(IDLE_SECONDS * 1000)
      const { profile } = await session.send("Profiler.stop")
      fs.writeFileSync(PROFILE, JSON.stringify(profile))
    } else {
      await browser.pause(IDLE_SECONDS * 1000)
    }
    results.phases.push(summarize("idle-polling-scrolled", await collectInstrumentation()))
  })
})
