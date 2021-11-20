const testlib = require("../testlib");

module.exports = function() {
  testlib.testclient({
    client: "transmission",
    fixture: "fixtures/transmission",
    host: "127.0.0.1",
    port: 9091,
    username: "username",
    password: "password",
    acceptHttpStatus: 401,
    skipTests: ["labels"]
  });

  testlib.testclient({
    client: "deluge",
    fixture: "fixtures/deluge",
    host: "127.0.0.1",
    port: 8112,
    username: "admin",
    password: "deluge",
    stopLabel: "Paused",
    skipTests: ["labels"],
  });

  testlib.testclient({
    client: "utorrent",
    fixture: "fixtures/utorrent",
    host: "127.0.0.1",
    port: 8080,
    username: "admin",
    password: "",
    acceptHttpStatus: 400,
  });

  testlib.testclient({
    client: "rtorrent",
    fixutre: "fixtures/rutorrent",
    host: "127.0.0.1",
    port: 8080,
    acceptHttpStatus: 200,
    username: "admin",
    password: "admin",
  });

  testlib.testclient({
    client: "qbittorrent",
    fixture: "fixtures/qbittorrent",
    host: "127.0.0.1",
    port: 8080,
    username: "admin",
    password: "adminadmin",
  });
}