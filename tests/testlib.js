const fs = require("fs");
const Application = require("spectron").Application;
const path = require("path");
const Docker = require("dockerode");
const http = require("http");
const https = require("https");
const e2e = require("./e2e");
const sync = require("@wdio/sync").default;
const Rtorrent = require("@electorrent/node-rtorrent")

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

var appPath = path.join(__dirname, "..", "app");
exports.testclient = function ({
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
  describe(`test ${client}`, function () {
    let app;
    let container;
    let $;
    let $$;
    let tapp;
    this.timeout(500 * 1000);

    before(async function () {
      await pullImage(dockerContainer);
      console.log("Pulled image");
      portMap = `${containerPort}/tcp`;
      container = await docker.createContainer({
        Image: dockerContainer,
        Env: Object.keys(dockerEnv).map(v => `${v}=${dockerEnv[v]}`),
        HostConfig: {
          AutoRemove: true,
          PortBindings: {
            [portMap]: [
              {
                HostPort: port.toString(),
              },
            ],
          },
        },
      });
      await container.start({});
      app = new Application({
        path: electronPath,
        args: [appPath],
        webdriverOptions: {
          deprecationWarnings: false,
        },
      });
      let i = 0;
      while (true) {
        if (i > 50) {
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
        await sleep(500);
        i++;
      }
      await app.start();
      $ = app.client.$.bind(app.client);
      $$ = app.client.$$.bind(app.client);
      tapp = new e2e.App(app);
      await app.client.setTimeout({ implicit: 0 });
    });

    after(async function () {
      if (app && app.isRunning()) {
        await app.stop();
      }
      if (container) {
        await container.stop();
      }
    });

    it("test login page", async function() {
      let r = new Rtorrent({
        port: 8080,
        user: "admin",
        pass: "admin",
      })

      for (i = 0; i < 10; i++) {
        await new Promise((resolve, reject) => {
          r.get("system.client_version", [], function (err, v) {
            console.log(arguments)
            resolve()
          });
        })
        await sleep(2000)
      }
    })

  });
};
