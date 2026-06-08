import type { BrowserWindow, BrowserWindowConstructorOptions, Rectangle } from 'electron'

interface StoredWindowState extends Rectangle {
    fullscreen?: boolean
}

interface WindowStateSettings {
    get: (key: string) => unknown
    put: (key: string, value: unknown) => void
    write: () => void
}

const WINDOW_STATE_KEY = 'windowsize'

function isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function getNumber(value: Record<string, unknown>, key: keyof Rectangle): number | undefined {
    const property = value[key]
    return typeof property === 'number' ? property : undefined
}

function getStoredBounds(value: unknown): Partial<Rectangle> {
    if (!isObject(value)) {
        return {}
    }

    const bounds: Partial<Rectangle> = {}
    for (const key of ['x', 'y', 'width', 'height'] as const) {
        const property = getNumber(value, key)
        if (property !== undefined) {
            bounds[key] = property
        }
    }

    return bounds
}

export function getWindowBoundsOptions(value: unknown): BrowserWindowConstructorOptions {
    return getStoredBounds(value)
}

export function shouldRestoreFullscreen(value: unknown): boolean {
    return isObject(value) && value.fullscreen === true
}

export function getStoredWindowState(settings: Pick<WindowStateSettings, 'get'>): unknown {
    return settings.get(WINDOW_STATE_KEY)
}

export function saveWindowState(window: BrowserWindow, settings: WindowStateSettings) {
    const fullscreen = window.isFullScreen()
    const bounds = fullscreen
        ? window.getNormalBounds()
        : window.getBounds()
    const windowState: StoredWindowState = {
        ...bounds,
        fullscreen,
    }

    settings.put(WINDOW_STATE_KEY, windowState)
    settings.write()
}
