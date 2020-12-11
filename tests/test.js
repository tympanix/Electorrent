const path = require("path");
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

const testlib = require("./testlib");

global.before(function () {
  chai.should();
  chai.use(chaiAsPromised);
});

testlib.testclient({
  client: "transmission",
  dockerContainer: "linuxserver/transmission",
  dockerEnv: {
    USER: 'username',
    PASS: 'password'
  },
  host: "127.0.0.1",
  port: 9091,
  containerPort: 9091,
  username: "username",
  password: "password",
  acceptHttpStatus: 401,
  skipTests: ["labels"]
});

testlib.testclient({
  client: "deluge",
  dockerContainer: "spritsail/deluge:1.3.15",
  host: "127.0.0.1",
  port: 8112,
  containerPort: 8112,
  username: "admin",
  password: "deluge",
  stopLabel: "Paused",
  skipTests: ["labels"],
});

testlib.testclient({
  client: "utorrent",
  dockerContainer: "ekho/utorrent",
  host: "127.0.0.1",
  port: 8080,
  containerPort: 8080,
  username: "admin",
  password: "",
  acceptHttpStatus: 400,
});

testlib.testclient({
  client: "rtorrent",
  dockerContainer: "linuxserver/rutorrent",
  host: "127.0.0.1",
  port: 80,
  containerPort: 80,
  acceptHttpStatus: 200,
  username: "admin",
  password: "admin",
});

testlib.testclient({
  client: "qbittorrent",
  dockerContainer: "linuxserver/qbittorrent",
  host: "127.0.0.1",
  containerPort: 8080,
  port: 8080,
  username: "admin",
  password: "adminadmin",
});
