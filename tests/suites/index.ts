import { testclient } from "../testlib"

export default function() {
  testclient({
    client: "transmission",
    fixture: "fixtures/transmission",
    port: 9091,
    username: "username",
    password: "password",
    acceptHttpStatus: 401,
    skipTests: ["labels"]
  });

  testclient({
    client: "deluge",
    fixture: "fixtures/deluge",
    port: 8112,
    username: "admin",
    password: "deluge",
    stopLabel: "Paused",
    skipTests: ["labels"],
  });

  testclient({
    client: "utorrent",
    fixture: "fixtures/utorrent",
    port: 8080,
    username: "admin",
    password: "",
    acceptHttpStatus: 400,
  });

  testclient({
    client: "rtorrent",
    fixture: "fixtures/rutorrent",
    port: 8080,
    acceptHttpStatus: 200,
    username: "admin",
    password: "admin",
  });

  testclient({
    client: "qbittorrent",
    fixture: "fixtures/qbittorrent",
    port: 8080,
    username: "admin",
    password: "adminadmin",
  });
}