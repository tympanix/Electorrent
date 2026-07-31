import { app, dialog, safeStorage, shell, type BrowserWindow, type MessageBoxOptions } from 'electron'
import fs from 'fs'
import path from 'path'

import { PASSWORD_MASK, type AppSettings, type BittorrentConnectServer, type RendererServerConfig, type ServerConfigBase } from '@shared/ipc-contract'
import { createDefaultSettings, normalizeSettings } from '@shared/settings-defaults'
import type { ResolvedServerConfig } from './bittorrent/types'
import * as electorrent from './electorrent'
import type { StoredWindowState } from './window-state'

export type PersistedPassword =
    | { cipher: 'plaintext'; value: string }
    | { cipher: 'electron-safe-storage'; value: string }

export interface PersistedServerConfig extends ServerConfigBase {
    encryptedPassword?: PersistedPassword
}

export interface PersistedSettings extends AppSettings<PersistedServerConfig> {
    windowsize?: StoredWindowState
}

let data: PersistedSettings | null = null
let needsSettingsRewrite = false
const changeListeners = new Set<() => void>()

const CONF_PATH = path.join(app.getPath('userData'), 'config.json')

load()

function deleteConfig() {
    if (fs.existsSync(CONF_PATH)) {
        fs.unlinkSync(CONF_PATH)
    }
}

function decodeSettings(raw: unknown): PersistedSettings {
    const normalized = normalizeSettings(raw) as AppSettings<RendererServerConfig>
    return {
        ...normalized,
        servers: normalized.servers.map((server) => {
            const input = server as RendererServerConfig & {
                password?: unknown
                encryptedPassword?: unknown
            }
            const {
                password: legacyPassword,
                encryptedPassword: encodedPassword,
                hasPassword: _hasPassword,
                newPassword: _newPassword,
                ...publicServer
            } = input

            if (isPersistedPassword(encodedPassword)) {
                return { ...publicServer, encryptedPassword: encodedPassword }
            }

            // Decode configs written by the short-lived versioned safeStorage format.
            if (encodedPassword && typeof encodedPassword === 'object') {
                const legacyEncrypted = encodedPassword as { version?: unknown; provider?: unknown; data?: unknown }
                if (legacyEncrypted.version === 1
                    && legacyEncrypted.provider === 'electron-safe-storage'
                    && typeof legacyEncrypted.data === 'string'
                    && legacyEncrypted.data.length > 0) {
                    needsSettingsRewrite = true
                    return {
                        ...publicServer,
                        encryptedPassword: { cipher: 'electron-safe-storage', value: legacyEncrypted.data },
                    }
                }
            }

            if (typeof legacyPassword === 'string') {
                needsSettingsRewrite = true
                return legacyPassword.length > 0
                    ? { ...publicServer, encryptedPassword: { cipher: 'plaintext', value: legacyPassword } }
                    : publicServer
            }
            return publicServer
        }),
    }
}

export function showCorruptDialog() {
    const window: BrowserWindow | null = electorrent.getWindow()
    const dialogSettings: MessageBoxOptions = {
        type: 'error',
        buttons: ['Delete Configuration', 'Open Folder', 'Exit'],
        defaultId: 2,
        title: 'Corrupt configuration',
        message: 'The configuration file could not be loaded',
        detail: 'This may be due to your configuration file being corrupt. Deleting the corrupt configuration file will most likely solve the problem. However your settings will be permanently gone.',
    }

    const button = window
        ? dialog.showMessageBoxSync(window, dialogSettings)
        : dialog.showMessageBoxSync(dialogSettings)

    if (button === 0) {
        deleteConfig()
    } else if (button === 1) {
        shell.showItemInFolder(CONF_PATH)
        app.exit()
    } else {
        app.exit()
    }
}

function load(): PersistedSettings {
    if (data !== null) {
        return data
    }

    if (!fs.existsSync(CONF_PATH)) {
        data = createDefaultSettings() as PersistedSettings
        return data
    }

    const file = fs.readFileSync(CONF_PATH, 'utf-8')

    if (!file) {
        data = createDefaultSettings() as PersistedSettings
        return data
    }

    try {
        data = decodeSettings(JSON.parse(file))
    } catch (_e) {
        data = createDefaultSettings() as PersistedSettings
        if (app.isReady()) {
            showCorruptDialog()
        } else {
            app.on('ready', function() {
                showCorruptDialog()
            })
        }
    }

    return data
}

function save(callback: (err?: Error | null) => void) {
    fs.writeFile(CONF_PATH, JSON.stringify(data, null, 4), callback)
}

function saveSync() {
    fs.writeFileSync(CONF_PATH, JSON.stringify(data, null, 4))
}

function copy<T>(object: T): T {
    if (object === null) {
        return object
    } else if (typeof object === 'object') {
        if (Array.isArray(object)) {
            return copyArray(object) as T
        }

        return copyObject(object)
    }

    return object
}

function copyObject<T extends object>(_obj: T): T {
    const copyObj: Record<string, unknown> = {}
    for (const key in _obj) {
        if (Object.prototype.hasOwnProperty.call(_obj, key)) {
            copyObj[key] = copy(_obj[key])
        }
    }
    return copyObj as T
}

function copyArray<T>(array: T[]): T[] {
    const copiedArray: T[] = []
    for (let i = 0; i < array.length; i++) {
        copiedArray[i] = copy(array[i])
    }
    return copiedArray
}

export function put<K extends keyof PersistedSettings>(key: K, value: PersistedSettings[K], callback?: (err?: Error | null) => void) {
    const settings = load()
    settings[key] = copy(value)
    notifyChanged()
    if (callback !== undefined) {
        save(callback)
    }
}

export function getAllSettings(): AppSettings<RendererServerConfig> {
    const settings = normalizeSettings(load()) as PersistedSettings
    return {
        ...settings,
        servers: settings.servers.map(toRendererServer),
    }
}

export function getDefaultSettings(): AppSettings {
    return createDefaultSettings()
}

export function write() {
    saveSync()
}

export function saveAll(settings: AppSettings<RendererServerConfig>, callback?: (err?: Error | null) => void) {
    const previousSettings = load()
    const previousServers = new Map(previousSettings.servers.map((server) => [server.id, server]))
    const normalized = normalizeSettings(settings)
    data = {
        ...normalized,
        servers: normalized.servers.map((server) => toPersistedServer(server, previousServers.get(server.id))),
        windowsize: previousSettings.windowsize,
    }
    notifyChanged()
    if (callback !== undefined) {
        save(callback)
    }
}

function isPersistedPassword(value: unknown): value is PersistedPassword {
    if (!value || typeof value !== 'object') {
        return false
    }

    const password = value as Partial<PersistedPassword>
    return (password.cipher === 'plaintext' || password.cipher === 'electron-safe-storage')
        && typeof password.value === 'string'
        && password.value.length > 0
}

function encryptionAvailable() {
    try {
        return safeStorage.isEncryptionAvailable()
    } catch {
        return false
    }
}

function encryptSecurely(password: string): PersistedPassword | null {
    if (!encryptionAvailable()) {
        return null
    }

    try {
        return {
            cipher: 'electron-safe-storage',
            value: safeStorage.encryptString(password).toString('base64'),
        }
    } catch {
        return null
    }
}

function encryptPassword(password: string): PersistedPassword {
    return encryptSecurely(password) || { cipher: 'plaintext', value: password }
}

function decryptPassword(server: PersistedServerConfig): string {
    const password = server.encryptedPassword
    if (!password) {
        return ''
    }
    if (password.cipher === 'plaintext') {
        return password.value
    }
    if (!encryptionAvailable()) {
        throw new Error('Stored password is unavailable; please re-enter it.')
    }
    try {
        return safeStorage.decryptString(Buffer.from(password.value, 'base64'))
    } catch {
        throw new Error('Stored password is unavailable; please re-enter it.')
    }
}

function hasPassword(server: PersistedServerConfig) {
    return isPersistedPassword(server.encryptedPassword)
}

function toRendererServer(server: PersistedServerConfig): RendererServerConfig {
    const { encryptedPassword: _encryptedPassword, ...publicServer } = server
    return {
        ...publicServer,
        hasPassword: hasPassword(server),
    }
}

function withStoredPassword(server: ServerConfigBase, password: string): PersistedServerConfig {
    if (!password) {
        return server
    }

    return { ...server, encryptedPassword: encryptPassword(password) }
}

function toPersistedServer(server: RendererServerConfig, previous?: PersistedServerConfig): PersistedServerConfig {
    const {
        newPassword,
        hasPassword: _hasPassword,
        encryptedPassword: _untrustedEncryptedPassword,
        password: _untrustedPassword,
        ...publicServer
    } = server as RendererServerConfig & { encryptedPassword?: unknown; password?: unknown }

    if ((newPassword === PASSWORD_MASK || newPassword === undefined) && previous?.encryptedPassword) {
        return { ...publicServer, encryptedPassword: previous.encryptedPassword }
    }

    return withStoredPassword(publicServer, typeof newPassword === 'string' ? newPassword : '')
}

/** Encrypts legacy plaintext credentials once safeStorage becomes available after app ready. */
export function migratePasswords(): boolean {
    const settings = load()
    let changed = needsSettingsRewrite
    const servers = settings.servers.map((server) => {
        if (server.encryptedPassword?.cipher !== 'plaintext') {
            return server
        }

        const encryptedPassword = encryptSecurely(server.encryptedPassword.value)
        if (!encryptedPassword) {
            return server
        }
        changed = true
        return { ...server, encryptedPassword }
    })

    if (changed) {
        const migrated = { ...settings, servers }
        try {
            fs.writeFileSync(CONF_PATH, JSON.stringify(migrated, null, 4))
            data = migrated
            needsSettingsRewrite = false
            notifyChanged()
        } catch {
            return false
        }
    }
    return changed
}

/** Resolves a renderer-safe server request into credentials only inside the main process. */
export function resolveConnectionServer(server: BittorrentConnectServer): ResolvedServerConfig {
    let password = server.newPassword
    if (password === PASSWORD_MASK || password === undefined) {
        const persistedServer = load().servers.find((candidate) => candidate.id === server.id)
        password = persistedServer ? decryptPassword(persistedServer) : ''
    }

    const {
        hasPassword: _hasPassword,
        newPassword: _newPassword,
        encryptedPassword: _untrustedEncryptedPassword,
        password: _untrustedPassword,
        ...connectionServer
    } = server as BittorrentConnectServer & { encryptedPassword?: unknown; password?: unknown }
    return { ...connectionServer, password }
}

export function get<K extends keyof PersistedSettings>(key: K): PersistedSettings[K] | null {
    const settings = load()
    if (key in settings) {
        return copy(settings[key])
    }
    return null
}

export function subscribe(listener: () => void) {
    changeListeners.add(listener)
    return () => changeListeners.delete(listener)
}

function notifyChanged() {
    changeListeners.forEach((listener) => listener())
}
