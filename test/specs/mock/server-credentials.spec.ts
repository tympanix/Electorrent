import chai from "chai"
import type { PublicServerConfig, ServerConfigBase } from "../../../src/shared/ipc-contract"
import {
  applyPublicPassword,
  connectAndPersistPassword,
  decodePersistedServer,
  encryptPassword,
  resolveServer,
  StoredPasswordError,
  toPublicServer,
  upgradePassword,
  type SafeStorageAdapter,
} from "../../../src/main/lib/server-credentials"

const assert: Chai.AssertStatic = chai.assert

const base: ServerConfigBase = {
  id: "server-1",
  ip: "localhost",
  proto: "http",
  port: 8080,
  user: "user",
  client: "mock",
  path: "",
  columns: [],
}

function storage(available = true): SafeStorageAdapter {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (value) => Buffer.from(`protected:${value}`),
    decryptString: (value) => {
      const decoded = value.toString()
      if (!decoded.startsWith("protected:")) throw new Error("unavailable key")
      return decoded.slice("protected:".length)
    },
  }
}

describe("server credentials", function() {
  it("decodes legacy plaintext without retaining renderer secret fields", function() {
    const persisted = decodePersistedServer({
      ...base,
      password: "legacy-secret",
      newPassword: "transient-secret",
      hasPassword: false,
    })

    assert.deepEqual(persisted.encryptedPassword, { cipher: "plaintext", value: "legacy-secret" })
    assert.notProperty(persisted, "password")
    assert.notProperty(persisted, "newPassword")
    assert.notProperty(persisted, "hasPassword")
  })

  it("uses plaintext envelopes only while safe storage is unavailable", function() {
    assert.deepEqual(encryptPassword("secret", storage(false)), { cipher: "plaintext", value: "secret" })
    assert.deepEqual(encryptPassword("", storage(false)), undefined)
    assert.deepEqual(encryptPassword("secret", storage()), {
      cipher: "electron-safe-storage",
      value: Buffer.from("protected:secret").toString("base64"),
    })
  })

  it("upgrades plaintext and leaves it intact when migration fails", function() {
    const persisted = decodePersistedServer({ ...base, encryptedPassword: { cipher: "plaintext", value: "secret" } })
    assert.isTrue(upgradePassword(persisted, storage()))
    assert.equal(persisted.encryptedPassword?.cipher, "electron-safe-storage")

    const failing = storage()
    failing.encryptString = () => { throw new Error("keychain unavailable") }
    const retained = decodePersistedServer({ ...base, encryptedPassword: { cipher: "plaintext", value: "secret" } })
    assert.isFalse(upgradePassword(retained, failing))
    assert.deepEqual(retained.encryptedPassword, { cipher: "plaintext", value: "secret" })
  })

  it("preserves, clears, and replaces only from newPassword intent", function() {
    const previous = decodePersistedServer({ ...base, encryptedPassword: { cipher: "plaintext", value: "old" } })
    const publicServer: PublicServerConfig = { ...base, hasPassword: false }

    assert.strictEqual(applyPublicPassword(publicServer, previous, storage()), previous.encryptedPassword)
    assert.isUndefined(applyPublicPassword({ ...publicServer, newPassword: "" }, previous, storage()))
    assert.equal(applyPublicPassword({ ...publicServer, newPassword: "new" }, previous, storage())?.cipher, "electron-safe-storage")
  })

  it("derives public state and never returns persisted secret representations", function() {
    const publicServer = toPublicServer(decodePersistedServer({
      ...base,
      encryptedPassword: { cipher: "plaintext", value: "secret" },
    }))

    assert.isTrue(publicServer.hasPassword)
    assert.notProperty(publicServer, "password")
    assert.notProperty(publicServer, "newPassword")
    assert.notProperty(publicServer, "encryptedPassword")
  })

  it("resolves plaintext for runtimes and ignores submitted hasPassword", function() {
    const previous = decodePersistedServer({ ...base, encryptedPassword: encryptPassword("stored", storage()) })
    assert.equal(resolveServer({ ...base, hasPassword: false }, previous, storage()).password, "stored")
    assert.equal(resolveServer({ ...base, hasPassword: true, newPassword: "replacement" }, previous, storage()).password, "replacement")
    assert.equal(resolveServer({ ...base, hasPassword: true, newPassword: "" }, previous, storage()).password, "")
  })

  it("retains undecryptable ciphertext and requests credential re-entry", function() {
    const persisted = decodePersistedServer({
      ...base,
      encryptedPassword: { cipher: "electron-safe-storage", value: Buffer.from("invalid").toString("base64") },
    })

    assert.throws(() => resolveServer({ ...base, hasPassword: false }, persisted, storage()), StoredPasswordError)
    assert.equal(persisted.encryptedPassword?.cipher, "electron-safe-storage")
    assert.isTrue(toPublicServer(persisted).hasPassword)
  })

  it("persists a submitted password only after a successful connection", async function() {
    const submitted: PublicServerConfig = { ...base, hasPassword: false, newPassword: "replacement" }
    const persistedPasswords: string[] = []

    let connectionError: unknown
    try {
      await connectAndPersistPassword(
        submitted,
        undefined,
        storage(),
        async () => { throw new Error("connection failed") },
        (_id, password) => { persistedPasswords.push(password) },
      )
    } catch (error) {
      connectionError = error
    }
    assert.equal((connectionError as Error).message, "connection failed")
    assert.deepEqual(persistedPasswords, [])

    const events: string[] = []
    const connection = await connectAndPersistPassword(
      submitted,
      undefined,
      storage(),
      async (resolved) => {
        assert.equal(resolved.password, "replacement")
        events.push("connected")
        return { version: "1.0.0" }
      },
      (_id, password) => {
        assert.equal(password, "replacement")
        events.push("persisted")
      },
    )

    assert.deepEqual(connection, { version: "1.0.0" })
    assert.deepEqual(events, ["connected", "persisted"])
  })
})
