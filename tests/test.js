const path = require("path");
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

const testlib = require("./testlib");

global.before(function () {
  chai.should();
  chai.use(chaiAsPromised);
});

testlib.testclient({
  client: "qbittorrent",
  dockerContainer: "linuxserver/qbittorrent",
  host: "127.0.0.1",
  port: 8080,
  username: "admin",
  password: "adminadmin",
});
