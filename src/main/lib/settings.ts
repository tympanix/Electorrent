import { app, dialog, safeStorage, shell, type BrowserWindow, type MessageBoxOptions } from 'electron'
import fs from 'fs'
import path from 'path'

import type { AppSettings, BittorrentServerConfig, StoredServerConfig } from '@shared/ipc-contract'
import { createDefaultSettings, normalizeSettings } from '@shared/settings-defaults'
import * as electorrent from './electorrent'
import type { StoredWindowState } from './window-state'

const ENCRYPTED_PASSWORD_VERSION = 1
const ENCRYPTED_PASSWORD_PROVIDER = 'electron-safe-storage'
export const PASSWORD_MASK = '••••••••'

export interface EncryptedPassword {
    version: typeof ENCRYPTED_PASSWORD_VERSION
    provider: typeof ENCRYPTED_PASSWORD_PROVIDER
    data: string
}

export interface PersistedServerConfig extends Omit<StoredServerConfig, 'password' | 'hasPassword'> {
    /** Backwards-compatible fallback used only when Electron safeStorage is unavailable. */
    password?: string
    encryptedPassword?: EncryptedPassword
}

export interface PersistedSettings extends AppSettings<PersistedServerConfig> {
    windowsize?: StoredWindowState
}

let data: PersistedSettings | null = null
const changeListeners = new Set<() => void>()

const CONF_PATH = path.join(app.getPath('userData'), 'config.json')

load()

function deleteConfig() {
    if (fs.existsSync(CONF_PATH)) {
        fs.unlinkSync(CONF_PATH)
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
        data = normalizeSettings(JSON.parse(file)) as PersistedSettings
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

export function getAllSettings(): AppSettings {
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

export function saveAll(settings: AppSettings, callback?: (err?: Error | null) => void) {
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

function hasEncryptedPassword(value: unknown): value is EncryptedPassword {
    if (!value || typeof value !== 'object') {
        return false
    }

    const encrypted = value as Partial<EncryptedPassword>
    return encrypted.version === ENCRYPTED_PASSWORD_VERSION
        && encrypted.provider === ENCRYPTED_PASSWORD_PROVIDER
        && typeof encrypted.data === 'string'
        && encrypted.data.length > 0
}

function encryptionAvailable() {
    try {
        return safeStorage.isEncryptionAvailable()
    } catch {
        return false
    }
}

function encryptPassword(password: string): EncryptedPassword | null {
    if (!encryptionAvailable()) {
        return null
    }

    try {
        return {
            version: ENCRYPTED_PASSWORD_VERSION,
            provider: ENCRYPTED_PASSWORD_PROVIDER,
            data: safeStorage.encryptString(password).toString('base64'),
        }
    } catch {
        return null
    }
}

function decryptPassword(server: PersistedServerConfig): string {
    if (hasEncryptedPassword(server.encryptedPassword)) {
        if (encryptionAvailable()) {
            try {
                return safeStorage.decryptString(Buffer.from(server.encryptedPassword.data, 'base64'))
            } catch {
                if (typeof server.password !== 'string') {
                    throw new Error(`Could not decrypt the password for server ${server.id}`)
                }
            }
        }

        if (typeof server.password !== 'string') {
            throw new Error(`Secure password storage is unavailable for server ${server.id}`)
        }
    }

    return typeof server.password === 'string' ? server.password : ''
}

function hasPassword(server: PersistedServerConfig) {
    return hasEncryptedPassword(server.encryptedPassword)
        || (typeof server.password === 'string' && server.password.length > 0)
}

function toRendererServer(server: PersistedServerConfig): StoredServerConfig {
    const { encryptedPassword: _encryptedPassword, ...publicServer } = server
    const passwordStored = hasPassword(server)
    return {
        ...publicServer,
        password: passwordStored ? PASSWORD_MASK : '',
        hasPassword: passwordStored,
    }
}

function withStoredPassword(server: Omit<PersistedServerConfig, 'password' | 'encryptedPassword'>, password: string): PersistedServerConfig {
    if (!password) {
        return server
    }

    const encryptedPassword = encryptPassword(password)
    if (encryptedPassword) {
        return { ...server, encryptedPassword }
    }

    return { ...server, password }
}

function toPersistedServer(server: StoredServerConfig, previous?: PersistedServerConfig): PersistedServerConfig {
    const {
        password,
        hasPassword: _hasPassword,
        encryptedPassword: _untrustedEncryptedPassword,
        ...publicServer
    } = server as StoredServerConfig & { encryptedPassword?: unknown }

    if ((password === PASSWORD_MASK || password === undefined) && previous) {
        const persisted = { ...publicServer } as PersistedServerConfig
        if (hasEncryptedPassword(previous.encryptedPassword)) {
            persisted.encryptedPassword = previous.encryptedPassword
        }
        if (typeof previous.password === 'string') {
            persisted.password = previous.password
        }
        return persisted
    }

    return withStoredPassword(publicServer, typeof password === 'string' ? password : '')
}

/** Encrypts legacy plaintext credentials once safeStorage becomes available after app ready. */
export function migratePasswords(): boolean {
    if (!encryptionAvailable()) {
        return false
    }

    const settings = load()
    let changed = false
    settings.servers = settings.servers.map((server) => {
        if (typeof server.password !== 'string') {
            return server
        }

        const encryptedPassword = server.password ? encryptPassword(server.password) : server.encryptedPassword
        if (server.password && !encryptedPassword) {
            return server
        }

        const { password: _password, ...publicServer } = server
        changed = true
        return encryptedPassword ? { ...publicServer, encryptedPassword } : publicServer
    })

    if (changed) {
        saveSync()
        notifyChanged()
    }
    return changed
}

/** Resolves a renderer-safe server request into credentials only inside the main process. */
export function resolveConnectionServer(server: BittorrentServerConfig): BittorrentServerConfig {
    let password = server.password
    if (password === PASSWORD_MASK || password === undefined) {
        const persistedServer = load().servers.find((candidate) => candidate.id === server.id)
        password = persistedServer ? decryptPassword(persistedServer) : ''
    }

    const {
        hasPassword: _hasPassword,
        encryptedPassword: _untrustedEncryptedPassword,
        ...connectionServer
    } = server as BittorrentServerConfig & { encryptedPassword?: unknown }
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
