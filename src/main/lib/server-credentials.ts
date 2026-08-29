import type { PublicServerConfig, ResolvedServerConfig, ServerConfigBase } from "@shared/ipc-contract"

export type PersistedPassword =
    | { cipher: "plaintext"; value: string }
    | { cipher: "electron-safe-storage"; value: string }

export interface PersistedServerConfig extends ServerConfigBase {
    encryptedPassword?: PersistedPassword
}

export interface SafeStorageAdapter {
    isEncryptionAvailable(): boolean
    encryptString(value: string): Buffer
    decryptString(value: Buffer): string
}

export class StoredPasswordError extends Error {
    readonly kind = "credential"

    constructor() {
        super("The stored password could not be decrypted. Re-enter the password.")
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value)
}

function decodePassword(value: unknown): PersistedPassword | undefined {
    if (!isRecord(value) || typeof value.value !== "string") {
        return undefined
    }
    if (value.cipher === "plaintext" || value.cipher === "electron-safe-storage") {
        return { cipher: value.cipher, value: value.value }
    }
    return undefined
}

export function decodePersistedServer(value: unknown): PersistedServerConfig {
    const input = isRecord(value) ? value : {}
    const { password, newPassword: _newPassword, hasPassword: _hasPassword, encryptedPassword, ...base } = input
    const decodedPassword = decodePassword(encryptedPassword)
        ?? (typeof password === "string" && password ? { cipher: "plaintext" as const, value: password } : undefined)
    return {
        ...(base as unknown as ServerConfigBase),
        ...(decodedPassword ? { encryptedPassword: decodedPassword } : {}),
    }
}

export function encryptPassword(password: string, storage: SafeStorageAdapter): PersistedPassword | undefined {
    if (!password) {
        return undefined
    }
    if (!storage.isEncryptionAvailable()) {
        return { cipher: "plaintext", value: password }
    }
    return {
        cipher: "electron-safe-storage",
        value: storage.encryptString(password).toString("base64"),
    }
}

export function upgradePassword(server: PersistedServerConfig, storage: SafeStorageAdapter): boolean {
    if (server.encryptedPassword?.cipher !== "plaintext" || !storage.isEncryptionAvailable()) {
        return false
    }
    try {
        server.encryptedPassword = encryptPassword(server.encryptedPassword.value, storage)
        return true
    } catch (_error) {
        return false
    }
}

export function toPublicServer(server: PersistedServerConfig): PublicServerConfig {
    const { encryptedPassword, ...base } = server
    return {
        ...base,
        hasPassword: encryptedPassword !== undefined,
    }
}

export function applyPublicPassword(
    submitted: PublicServerConfig,
    previous: PersistedServerConfig | undefined,
    storage: SafeStorageAdapter,
): PersistedPassword | undefined {
    if (!Object.prototype.hasOwnProperty.call(submitted, "newPassword")) {
        return previous?.encryptedPassword
    }
    return encryptPassword(typeof submitted.newPassword === "string" ? submitted.newPassword : "", storage)
}

function decryptPassword(password: PersistedPassword | undefined, storage: SafeStorageAdapter): string {
    if (!password) {
        return ""
    }
    if (password.cipher === "plaintext") {
        return password.value
    }
    try {
        return storage.decryptString(Buffer.from(password.value, "base64"))
    } catch (_error) {
        throw new StoredPasswordError()
    }
}

export function resolveServer(
    submitted: PublicServerConfig & { certificateData?: Uint8Array },
    previous: PersistedServerConfig | undefined,
    storage: SafeStorageAdapter,
): ResolvedServerConfig {
    const { hasPassword: _hasPassword, newPassword, ...base } = submitted
    const password = Object.prototype.hasOwnProperty.call(submitted, "newPassword")
        ? (typeof newPassword === "string" ? newPassword : "")
        : decryptPassword(previous?.encryptedPassword, storage)
    return { ...base, password }
}

export async function connectAndPersistPassword<T>(
    submitted: PublicServerConfig & { certificateData?: Uint8Array },
    previous: PersistedServerConfig | undefined,
    storage: SafeStorageAdapter,
    connect: (server: ResolvedServerConfig) => Promise<T | null>,
    persistPassword: (id: string, password: string) => void | Promise<void>,
): Promise<T | null> {
    const resolvedServer = resolveServer(submitted, previous, storage)
    const connection = await connect(resolvedServer)
    if (connection !== null && Object.prototype.hasOwnProperty.call(submitted, "newPassword")) {
        await persistPassword(submitted.id, typeof submitted.newPassword === "string" ? submitted.newPassword : "")
    }
    return connection
}
