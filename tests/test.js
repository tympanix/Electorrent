const path = require("path");
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

const testlib = require("./testlib");

global.before(function () {
  chai.should();
  chai.use(chaiAsPromised);
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
  port: 8080,
  containerPort: 80,
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
