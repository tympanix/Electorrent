import aria2 from "./aria2"
import deluge from "./deluge"
import qbittorrent from "./qbittorrent"
import mock from "./mock"
import rtorrent from "./rtorrent"
import transmission from "./transmission"
import utorrent from "./utorrent"
import type { TestClient } from "./types"

export type { TestClient, TestClientInput } from "./types"

export const TEST_CLIENTS = {
  ...aria2,
  ...deluge,
  ...qbittorrent,
  ...mock,
  ...transmission,
  ...rtorrent,
  ...utorrent,
} satisfies Record<string, TestClient>
