const fs = require("fs");
const Application = require("spectron").Application;
const path = require("path");
const Docker = require("dockerode");
const http = require("http");
const https = require("https");
const e2e = require("./e2e");
const sync = require("@wdio/sync").default;

var docker = new Docker();

var electronPath = path.join(__dirname, "..", "node_modules", ".bin", "electron");

if (process.platform === "win32") {
  electronPath += ".cmd";
}

const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time));

function httpget(options) {
  return new Promise((resolve, reject) => {
    let req = http.get(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve(res);
      });
    });

    req.on("error", (err) => {
      reject(err);
    });
  });
}

function pullImage(image) {
  console.log(`=> Pulling ${image}`);
  return new Promise((resolve, reject) => {
    docker.pull(image, (err, stream) => {
      let message = "";
      if (err) return reject(err);
      stream.on("data", (data) => (message += data));
      stream.on("end", () => resolve(message));
      stream.on("error", (err) => reject(err));
    });
  });
}

async function startDockerContainer({ image, hostPort, containerPort, env}) {
  await pullImage(image);
  console.log("Pulled image");
  portMap = `${containerPort}/tcp`;
  let = container = await docker.createContainer({
    Image: image,
    Env: Object.keys(env).map(v => `${v}=${env[v]}`),
    HostConfig: {
      AutoRemove: true,
      PortBindings: {
        [portMap]: [
          {
            HostPort: hostPort.toString(),
          },
        ],
      },
    },
  });
  await container.start({});
  return container
}

var appPath = path.join(__dirname, "..", "app");
exports.testclient = function ({
  test,
  client,
  dockerContainer,
  dockerEnv = {},
  username = "admin",
  password = "admin",
  host = "127.0.0.1",
  port = 8080,
  containerPort = 8080,
  acceptHttpStatus = 200,
  timeout = 10 * 1000,
  stopLabel = "Stopped",
  downloadLabel = "Downloading",
  skipTests = [],
}) {
  describe(`test ${test || client}`, function () {
    let app;
    let container;
    let $;
    let $$;
    let tapp;
    this.timeout(500 * 1000);

    before(async function () {
      if (!process.env.CI) {
        container = await startDockerContainer({
          image: dockerContainer,
          hostPort: port,
          containerPort: containerPort,
          env: dockerEnv,
        })
      }
      app = new Application({
        path: electronPath,
        args: [appPath],
        webdriverOptions: {
          deprecationWarnings: false,
        },
        chromeDriverArgs: [
          "no-sandbox"
        ]
      });
      let i = 0;
      while (true) {
        if (i > 100) {
          throw Error("Service never started");
        }
        try {
          let res = await httpget(`http://${host}:${port}`);
          console.log("Polling http:", res.statusCode);
          if (res.statusCode === acceptHttpStatus) {
            break;
          }
        } catch (err) {
          console.log("... waiting for serivce");
        }
        await sleep(1000);
        i++;
      }
      await app.start();
      $ = app.client.$.bind(app.client);
      $$ = app.client.$$.bind(app.client);
      tapp = new e2e.App(app);
      await app.client.setTimeout({ implicit: 0 });
    });

    after(async function () {
      app.client.getRenderProcessLogs().then(function (logs) {
        logs.forEach(function (log) {
          console.log(log.message)
          console.log(log.source)
          console.log(log.level)
        })
      })
      if (app && app.isRunning()) {
        await app.stop();
      }
      if (container) {
        await container.stop();
      }
    });

    afterEach(function() {
      if (this.currentTest.state == 'failed') {
        app.client.getRenderProcessLogs().then(function (logs) {
          logs.forEach(function (log) {
            console.log(log.message)
            console.log(log.source)
            console.log(log.level)
          })
        })
      }
    })

    it("open the app", async function () {
      return app.client.waitUntilWindowLoaded();
    });

    it("tests the title", async function () {
      return sync(() => {
        app.client.waitUntilWindowLoaded();
        app.client.getTitle().should.equal("Electorrent");
      });
    });

    it("login to the client", async () => {
      return tapp.login({
        username: username,
        password: password,
        host: host,
        port: port,
        client: client,
      });
    });

    it("upload torrent file", async () => {
      let filename = "ubuntu-20.04-live-server-amd64.iso.torrent";
      let hash = "c44f931b1a3986851242d755d0ac46e9fa3c5d32";
      await tapp.uploadTorrent({ filename, hash });
    });

    it("wait for download to begin", () => {
      return tapp.torrents[0].waitForState(downloadLabel);
    });

    it("torrent should be in downloading tab", () => {
      let t = tapp.torrents[0];
      return t.checkInState(["all", "downloading"]);
    });

    it("stop the torrent", async () => {
      let t = tapp.torrents[0];
      await t.stop({ state: stopLabel });
    });

    it("check torrent in stopped tab", () => {
      let t = tapp.torrents[0];
      return t.checkInState(["all", "stopped"]);
    });

    it("resume the torrent", async () => {
      let t = tapp.torrents[0];
      await t.resume({ state: downloadLabel });
    });

    describe("test labels", function () {
      before(function () {
        if (skipTests.includes("labels")) return this.skip();
      });

      it("apply new label", async function () {
        const label = "testlabel123";
        let t = tapp.torrents[0];
        await t.newLabel(label);
        await tapp.waitForLabelInDropdown(label);
        await tapp.getAllSidebarLabels().should.eventually.have.length(1);
      });

      it("apply another new label", async () => {
        const label = "someotherlabel123";
        let t = tapp.torrents[0];
        await t.newLabel(label);
        await tapp.waitForLabelInDropdown(label);
        await t.checkInFilterLabel(label);
        await tapp.getAllSidebarLabels().should.eventually.have.length(2);
      });

      it("change back to previous label", async () => {
        const label = "testlabel123";
        let t = tapp.torrents[0];
        await t.changeLabel(label);
        await t.checkInFilterLabel(label);
      });
    });

    describe("clean up", async function () {
      it("delete torrent", async function () {
        let torrent = tapp.torrents[0];
        await torrent.clickContextMenu("delete");
        await torrent.waitForGone();
      });
    });
  });
};
