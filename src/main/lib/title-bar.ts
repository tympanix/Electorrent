import type { BrowserWindow, BrowserWindowConstructorOptions } from 'electron'
import type { ThemePreference } from '@shared/ipc-contract'
import { resolveTheme } from './themes'

const TITLE_BAR_HEIGHT = 38

const THEME_COLORS = {
    dark: {
        background: '#272b30',
        foreground: '#ffffff',
    },
    light: {
        background: '#f0f0f0',
        foreground: '#1b1c1d',
    },
}

function getThemeColors(theme?: ThemePreference) {
    return THEME_COLORS[resolveTheme(theme)]
}

export function getTitleBarWindowOptions(theme?: ThemePreference): BrowserWindowConstructorOptions {
    const colors = getThemeColors(theme)
    const options: BrowserWindowConstructorOptions = {
        titleBarStyle: 'hidden',
        backgroundColor: colors.background,
    }

    if (process.platform !== 'darwin') {
        options.titleBarOverlay = {
            color: colors.background,
            symbolColor: colors.foreground,
            height: TITLE_BAR_HEIGHT,
        }
    }

    return options
}

export function updateTitleBarOverlay(window: BrowserWindow, theme?: ThemePreference) {
    if (process.platform === 'darwin' || window.isDestroyed()) {
        return
    }

    const colors = getThemeColors(theme)
    window.setTitleBarOverlay({
        color: colors.background,
        symbolColor: colors.foreground,
        height: TITLE_BAR_HEIGHT,
    })
}
