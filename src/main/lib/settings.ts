import { app, dialog, shell, type BrowserWindow, type MessageBoxOptions } from 'electron'
import fs from 'fs'
import path from 'path'

import type { AppSettings } from '@shared/ipc-contract'
import * as electorrent from './electorrent'

let data: any = null

type MainAppSettings = AppSettings & {
    debugMode?: boolean
    autoRemoveTorrents?: boolean
    alwaysPromptUploadOptions?: boolean
}

const defaultSettings: MainAppSettings = {
    startup: 'default',
    refreshRate: 2000,
    servers: [],
    certificates: [],
    automaticUpdates: true,
    debugMode: false,
    autoRemoveTorrents: false,
    alwaysPromptUploadOptions: false,
    ui: {
        resizeMode: 'FixedResizer',
        notifications: true,
        displaySize: 'normal',
        displayCompact: false,
        cleanNames: true,
        fixedHeader: false,
        theme: 'light',
    },
}

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

function load() {
    if (data !== null) {
        return
    }

    if (!fs.existsSync(CONF_PATH)) {
        data = copy(defaultSettings)
        return
    }

    const file = fs.readFileSync(CONF_PATH, 'utf-8')

    if (!file) {
        data = copy(defaultSettings)
        return
    }

    try {
        data = JSON.parse(file)
    } catch (_e) {
        if (app.isReady()) {
            showCorruptDialog()
        } else {
            app.on('ready', function() {
                showCorruptDialog()
            })
        }
    }
}

function save(callback: (err?: Error | null) => void) {
    fs.writeFile(CONF_PATH, JSON.stringify(data, null, 4), callback)
}

function saveSync() {
    fs.writeFileSync(CONF_PATH, JSON.stringify(data, null, 4))
}

function copy(object: any): any {
    if (object === null) {
        return object
    } else if (typeof object === 'object') {
        if (Array.isArray(object)) {
            return copyArray(object)
        }

        return copyObject(object)
    }

    return object
}

function copyObject(_obj: Record<string, any>) {
    const copyObj: Record<string, any> = {}
    for (const key in _obj) {
        if (Object.prototype.hasOwnProperty.call(_obj, key)) {
            copyObj[key] = copy(_obj[key])
        }
    }
    return copyObj
}

function copyArray(_obj: any[]) {
    const copiedArray: any[] = []
    for (let i = 0; i < _obj.length; i++) {
        copiedArray[i] = copy(_obj[i])
    }
    return copiedArray
}

export function put(key: string, value: any, callback?: (err?: Error | null) => void) {
    load()
    data[key] = value
    if (callback !== undefined) {
        save(callback)
    }
}

export function getAllSettings() {
    load()
    return copy(data)
}

export function getDefaultSettings() {
    return copy(defaultSettings)
}

export function settingsReference() {
    return data
}

export function write() {
    saveSync()
}

export function saveAll(settings: any, callback?: (err?: Error | null) => void) {
    load()
    data = settings
    if (callback !== undefined) {
        save(callback)
    }
}

export function get(key: string) {
    load()
    let value: any = null
    if (data && key in data) {
        value = copy(data[key])
    }
    return value
}

export function getServer(id: string) {
    load()
    return data.servers.find((s: { id: string }) => s.id === id)
}

export function saveServer(server: { id: string }, callback: (err?: Error | null) => void) {
    load()
    let ok = false
    data.servers = data.servers.map((s: { id: string }) => {
        if (s.id === server.id) {
            ok = true
            return Object.assign(s, server)
        }
        return s
    })

    if (!ok) {
        return callback(new Error('Could not save server. Server not found'))
    }

    save(callback)
}

export function unset(key: string, callback: (err?: Error | null) => void) {
    load()
    if (key in data) {
        delete data[key]
        save(callback)
    }
}
