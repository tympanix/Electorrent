import { CLIENT_METADATA } from './client-metadata'
import type { EditCommand, MenuAction, TorrentUploadOptionsEnable, WindowCommand } from './ipc-contract'

export type MenuLayout = 'darwin' | 'standard'
export type MenuAcceleratorStyle = 'electron' | 'browser'

export interface MenuModelServer {
    id: string
    name?: string
    client?: string
    ip?: string
}

export type NativeMenuRole =
    | 'about'
    | 'services'
    | 'hide'
    | 'hideOthers'
    | 'unhide'
    | 'quit'
    | 'undo'
    | 'redo'
    | 'cut'
    | 'copy'
    | 'paste'
    | 'close'
    | 'minimize'
    | 'zoom'
    | 'front'
    | 'window'
    | 'help'

export type MenuCommand =
    | { type: 'menu-action'; action: MenuAction }
    | { type: 'edit-command'; command: EditCommand }
    | { type: 'window-command'; command: WindowCommand }
    | { type: 'app-command'; command: 'quit' }

export interface MenuModelItem {
    id?: string
    label?: string
    accelerator?: string
    separator?: boolean
    type?: 'radio'
    checked?: boolean
    enabled?: boolean
    visible?: boolean
    role?: NativeMenuRole
    command?: MenuCommand
    submenu?: MenuModelItem[]
}

export interface MenuModelMenu {
    id?: string
    label: string
    role?: NativeMenuRole
    items: MenuModelItem[]
}

export interface MenuModel {
    menus: MenuModelMenu[]
}

export interface MenuModelOptions {
    layout: MenuLayout
    acceleratorStyle: MenuAcceleratorStyle
    appName: string
    isDebug?: boolean
    activeServerId?: string | null
    activeClientId?: string | null
    supportsUploadOptions?: boolean
    servers?: MenuModelServer[]
}

const ELECTORRENT_URL = 'https://github.com/tympanix/Electorrent'

export function uploadOptionsEnabled(uploadOptions: TorrentUploadOptionsEnable | null | undefined) {
    return Object.values(uploadOptions || {}).some(Boolean)
}

export function isMenuItemVisible(item: MenuModelItem) {
    return item.visible !== false
}

export function getMenuServerLabel(server: MenuModelServer) {
    const clientName = server.client ? CLIENT_METADATA[server.client]?.name || server.client : 'Server'
    const address = server.ip || 'unknown host'
    return server.name || `${clientName} @ ${address}`
}

function menuAction(action: MenuAction): MenuCommand {
    return { type: 'menu-action', action }
}

function editCommand(command: EditCommand): MenuCommand {
    return { type: 'edit-command', command }
}

function windowCommand(command: WindowCommand): MenuCommand {
    return { type: 'window-command', command }
}

function appCommand(command: 'quit'): MenuCommand {
    return { type: 'app-command', command }
}

function separator(): MenuModelItem {
    return { separator: true }
}

function commandKey(options: MenuModelOptions) {
    return options.acceleratorStyle === 'browser' ? 'Ctrl' : 'CmdOrCtrl'
}

function standardAccelerator(options: MenuModelOptions, key: string) {
    return `${commandKey(options)}+${key}`
}

function shiftedAccelerator(options: MenuModelOptions, key: string) {
    return `Shift+${commandKey(options)}+${key}`
}

function advancedUploadAccelerator(options: MenuModelOptions, key: string) {
    if (options.acceleratorStyle === 'browser') {
        return `Ctrl+Shift+${key}`
    }

    return options.layout === 'darwin'
        ? `CmdOrCtrl+Alt+${key}`
        : `CmdOrCtrl+Shift+${key}`
}

function fullScreenAccelerator(options: MenuModelOptions) {
    if (options.acceleratorStyle === 'browser') {
        return 'F11'
    }

    return options.layout === 'darwin' ? 'Ctrl+Command+F' : 'F11'
}

function devToolsAccelerator(options: MenuModelOptions) {
    if (options.acceleratorStyle === 'browser') {
        return 'Ctrl+Shift+I'
    }

    return options.layout === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I'
}

function supportsAdvancedUpload(options: MenuModelOptions) {
    if (typeof options.supportsUploadOptions === 'boolean') {
        return options.supportsUploadOptions
    }

    return !!options.activeClientId && !!CLIENT_METADATA[options.activeClientId]?.showAdvancedUploadMenu
}

function serverAccelerator(options: MenuModelOptions, index: number) {
    if (index > 0 && index <= 10) {
        return `${commandKey(options)}+${index % 10}`
    }

    return undefined
}

function hasActiveServer(options: MenuModelOptions) {
    return !!options.activeServerId
}

function fileMenuItems(options: MenuModelOptions) {
    const advancedUpload = supportsAdvancedUpload(options)

    return [
        {
            label: 'Add Torrent',
            accelerator: standardAccelerator(options, 'O'),
            command: menuAction({ type: 'open-add-torrent', askUploadOptions: false }),
        },
        {
            label: 'Add Torrent (Advanced)',
            accelerator: advancedUploadAccelerator(options, 'O'),
            visible: advancedUpload,
            enabled: advancedUpload,
            command: menuAction({ type: 'open-add-torrent', askUploadOptions: true }),
        },
        {
            label: 'Paste Torrent URL',
            accelerator: standardAccelerator(options, 'I'),
            command: menuAction({ type: 'paste-torrent-url', askUploadOptions: false }),
        },
        {
            label: 'Paste Torrent URL (Advanced)',
            accelerator: advancedUploadAccelerator(options, 'I'),
            visible: advancedUpload,
            enabled: advancedUpload,
            command: menuAction({ type: 'paste-torrent-url', askUploadOptions: true }),
        },
    ]
}

function editMenuItems(options: MenuModelOptions) {
    return [
        { label: 'Undo', accelerator: standardAccelerator(options, 'Z'), command: editCommand('undo') },
        { label: 'Redo', accelerator: shiftedAccelerator(options, 'Z'), command: editCommand('redo') },
        separator(),
        { label: 'Find', accelerator: standardAccelerator(options, 'F'), command: menuAction({ type: 'search-torrent' }) },
        { label: 'Cut', accelerator: standardAccelerator(options, 'X'), command: editCommand('cut') },
        { label: 'Copy', accelerator: standardAccelerator(options, 'C'), command: editCommand('copy') },
        { label: 'Paste', accelerator: standardAccelerator(options, 'V'), command: editCommand('paste') },
        { label: 'Remove', accelerator: 'Delete', command: menuAction({ type: 'remove-selected' }) },
        { label: 'Select All', accelerator: standardAccelerator(options, 'A'), command: menuAction({ type: 'select-all' }) },
    ]
}

function viewMenuItems(options: MenuModelOptions) {
    return [
        {
            label: 'Reload',
            visible: !!options.isDebug,
            accelerator: standardAccelerator(options, 'R'),
            command: windowCommand('reload'),
        },
        {
            label: 'Toggle Full Screen',
            accelerator: fullScreenAccelerator(options),
            command: windowCommand('toggle-full-screen'),
        },
        {
            label: 'Toggle Developer Tools',
            visible: !!options.isDebug,
            accelerator: devToolsAccelerator(options),
            command: windowCommand('toggle-dev-tools'),
        },
    ]
}

function serverMenuItems(options: MenuModelOptions) {
    const items: MenuModelItem[] = [
        {
            label: 'Add new server...',
            accelerator: standardAccelerator(options, 'N'),
            command: menuAction({ type: 'add-server' }),
        },
        {
            label: 'Set current as default',
            enabled: hasActiveServer(options),
            command: menuAction({ type: 'set-current-default-server' }),
        },
        separator(),
    ]

    if (!hasActiveServer(options)) {
        items.push({ label: 'Disabled...', enabled: false })
        return items
    }

    const servers = options.servers || []
    servers.forEach((server, index) => {
        items.push({
            label: getMenuServerLabel(server),
            accelerator: serverAccelerator(options, index + 1),
            type: 'radio',
            checked: server.id === options.activeServerId,
            command: menuAction({ type: 'connect-server', serverId: server.id }),
        })
    })

    return items
}

function helpMenuItems() {
    return [
        {
            label: 'Learn More',
            command: menuAction({ type: 'open-external', url: ELECTORRENT_URL }),
        },
        {
            label: 'Check For Updates',
            command: menuAction({ type: 'check-for-updates', verbose: true }),
        },
    ]
}

function standardMenus(options: MenuModelOptions): MenuModelMenu[] {
    return [
        {
            label: 'File',
            id: 'file',
            items: [
                ...fileMenuItems(options),
                separator(),
                {
                    label: 'Settings',
                    accelerator: 'Ctrl+,',
                    command: menuAction({ type: 'show-settings' }),
                },
                separator(),
                {
                    label: 'Exit',
                    command: appCommand('quit'),
                },
            ],
        },
        {
            label: 'Edit',
            items: editMenuItems(options),
        },
        {
            label: 'View',
            items: viewMenuItems(options),
        },
        {
            label: 'Servers',
            id: 'servers',
            items: serverMenuItems(options),
        },
        {
            label: 'Window',
            role: 'window',
            items: [
                {
                    label: 'Minimize',
                    accelerator: standardAccelerator(options, 'M'),
                    command: windowCommand('minimize'),
                },
                {
                    label: 'Close',
                    accelerator: standardAccelerator(options, 'W'),
                    command: windowCommand('close'),
                },
            ],
        },
        {
            label: 'Help',
            role: 'help',
            items: helpMenuItems(),
        },
    ]
}

function darwinMenus(options: MenuModelOptions): MenuModelMenu[] {
    const name = options.appName

    return [
        {
            label: name,
            items: [
                { label: `About ${name}`, role: 'about' },
                separator(),
                {
                    label: 'Preferences',
                    accelerator: 'Command+,',
                    command: menuAction({ type: 'show-settings' }),
                },
                { label: 'Services', role: 'services', submenu: [] },
                separator(),
                { label: `Hide ${name}`, accelerator: 'Command+H', role: 'hide' },
                { label: 'Hide Others', accelerator: 'Command+Alt+H', role: 'hideOthers' },
                { label: 'Show All', role: 'unhide' },
                separator(),
                { label: 'Quit', accelerator: 'Command+Q', role: 'quit' },
            ],
        },
        {
            label: 'File',
            id: 'file',
            items: fileMenuItems(options),
        },
        {
            label: 'Edit',
            items: editMenuItems(options),
        },
        {
            label: 'View',
            items: viewMenuItems(options),
        },
        {
            label: 'Servers',
            id: 'servers',
            items: serverMenuItems(options),
        },
        {
            label: 'Window',
            role: 'window',
            items: [
                { label: 'Close', accelerator: standardAccelerator(options, 'W'), role: 'close' },
                { label: 'Minimize', accelerator: standardAccelerator(options, 'M'), role: 'minimize' },
                { label: 'Zoom', role: 'zoom' },
                separator(),
                { label: 'Bring All to Front', role: 'front' },
            ],
        },
        {
            label: 'Help',
            role: 'help',
            items: helpMenuItems(),
        },
    ]
}

export function buildMenuModel(options: MenuModelOptions): MenuModel {
    return {
        menus: options.layout === 'darwin' ? darwinMenus(options) : standardMenus(options),
    }
}
