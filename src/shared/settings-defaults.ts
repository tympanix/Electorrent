import type { AppSettings } from '@shared/ipc-contract'

const DEFAULT_SETTINGS: AppSettings = {
    startup: 'default',
    systemStartup: 'disabled',
    refreshRate: 2000,
    servers: [],
    certificates: [],
    automaticUpdates: true,
    closeToTray: true,
    debugMode: false,
    autoRemoveTorrents: false,
    alwaysPromptUploadOptions: false,
    watchDirectory: '',
    ui: {
        resizeMode: 'OverflowResizer',
        notifications: true,
        displaySize: 'normal',
        displayCompact: false,
        cleanNames: true,
        fixedHeader: false,
        theme: 'system',
        sidebarCollapsed: false,
    },
}

function clone<T>(value: T): T {
    if (value === null || typeof value !== 'object') {
        return value
    }

    if (Array.isArray(value)) {
        return value.map((item) => clone(item)) as T
    }

    const clonedValue: Record<string, unknown> = {}
    for (const key of Object.keys(value)) {
        clonedValue[key] = clone((value as Record<string, unknown>)[key])
    }
    return clonedValue as T
}

function mergeWithDefaults<T>(defaults: T, value: unknown): T {
    if (value === undefined) {
        return clone(defaults)
    }

    if (defaults === null || typeof defaults !== 'object') {
        return clone(value) as T
    }

    if (Array.isArray(defaults)) {
        return (Array.isArray(value) ? clone(value) : clone(defaults)) as T
    }

    const mergedValue: Record<string, unknown> = value !== null && typeof value === 'object' && !Array.isArray(value)
        ? clone(value as Record<string, unknown>)
        : {}

    for (const key of Object.keys(defaults)) {
        mergedValue[key] = mergeWithDefaults(
            (defaults as Record<string, unknown>)[key],
            mergedValue[key],
        )
    }

    return mergedValue as T
}

export function createDefaultSettings(): AppSettings {
    return clone(DEFAULT_SETTINGS)
}

export function normalizeSettings(value: unknown): AppSettings {
    return mergeWithDefaults(DEFAULT_SETTINGS, value)
}
