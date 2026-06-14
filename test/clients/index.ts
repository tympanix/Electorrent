import deluge from "./deluge"
import qbittorrent from "./qbittorrent"
import rtorrent from "./rtorrent"
import transmission from "./transmission"
import utorrent from "./utorrent"
import type { TestClient } from "./types"

export type { TestClient, TestClientInput } from "./types"

export const TEST_CLIENTS = {
  ...deluge,
  ...qbittorrent,
  ...transmission,
  ...rtorrent,
  ...utorrent,
} satisfies Record<string, TestClient>
