import type { TestClient, TestClientInput } from "./types"

export function defineClient(client: TestClientInput): TestClient {
  return {
    host: "localhost",
    acceptHttpStatus: 200,
    stopLabel: "Stopped",
    downloadLabel: "Downloading",
    ...client,
  }
}
