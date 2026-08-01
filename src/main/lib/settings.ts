import { app, dialog, safeStorage, shell, type BrowserWindow, type MessageBoxOptions } from 'electron'
import fs from 'fs'
import path from 'path'

import type { AppSettings, PublicServerConfig } from '@shared/ipc-contract'
import { createDefaultSettings, normalizeSettings } from '@shared/settings-defaults'
import * as electorrent from './electorrent'
import type { StoredWindowState } from './window-state'
import {
    applyPublicPassword,
    decodePersistedServer,
    encryptPassword,
    toPublicServer,
    upgradePassword,
    type PersistedServerConfig,
} from './server-credentials'

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
        const parsed = JSON.parse(file)
        const normalized = normalizeSettings(parsed) as AppSettings<unknown>
        data = {
            ...normalized,
            servers: normalized.servers.map(decodePersistedServer),
        }
        const decodedLegacyInput = JSON.stringify(data) !== JSON.stringify(normalized)
        const upgraded = upgradeStoredPasswords()
        if (decodedLegacyInput || upgraded) {
            try {
                saveSync()
            } catch (_error) {
                // Migration is retried on the next settings access.
            }
        }
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
    const settings = load()
    if (upgradeStoredPasswords()) {
        try {
            saveSync()
        } catch (_error) {
            // Retain plaintext and retry when settings are accessed again.
        }
    }
    return {
        ...copy(settings),
        servers: settings.servers.map(toPublicServer),
    }
}

export function getDefaultSettings(): AppSettings {
    return createDefaultSettings()
}

export function write() {
    saveSync()
}

export function saveAll(settings: AppSettings<PublicServerConfig>, callback?: (err?: Error | null) => void) {
    const previousById = new Map(load().servers.map((server) => [server.id, server]))
    const normalized = normalizeSettings(settings) as AppSettings<PublicServerConfig>
    data = {
        ...normalized,
        servers: normalized.servers.map((server) => {
            const persisted = decodePersistedServer(server)
            delete persisted.encryptedPassword
            const encryptedPassword = applyPublicPassword(server, previousById.get(server.id), safeStorage)
            return {
                ...persisted,
                ...(encryptedPassword ? { encryptedPassword } : {}),
            }
        }),
    }
    notifyChanged()
    if (callback !== undefined) {
        save(callback)
    }
}

export function getPersistedServer(id: string) {
    return load().servers.find((server) => server.id === id)
}

export function saveConnectedPassword(id: string, password: string) {
    const server = getPersistedServer(id)
    if (!server) {
        return
    }
    const encryptedPassword = encryptPassword(password, safeStorage)
    if (encryptedPassword) {
        server.encryptedPassword = encryptedPassword
    } else {
        delete server.encryptedPassword
    }
    saveSync()
    notifyChanged()
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

function upgradeStoredPasswords() {
    if (!data) {
        return false
    }
    return data.servers.reduce((changed, server) => upgradePassword(server, safeStorage) || changed, false)
}
