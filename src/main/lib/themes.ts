import fs from 'fs'
import path from 'path'
import { nativeTheme } from 'electron'

import type { ColorTheme, ThemeInfo, ThemePreference } from '@shared/ipc-contract'

function resolveThemesDir() {
    const candidates = [
        path.join(__dirname, './css/themes'),
        path.join(__dirname, '../css/themes'),
    ]

    const directory = candidates.find((candidate: string) => fs.existsSync(candidate))
    if (!directory) {
        throw new Error(`Theme directory not found. Tried: ${candidates.join(', ')}`)
    }

    return directory
}

const DIR = resolveThemesDir()
const THEME_NAMES = ['light', 'dark']

function capitalize(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1)
}

export function getSystemTheme(): ColorTheme {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
}

export function resolveTheme(theme?: ThemePreference): ColorTheme {
    return theme === 'system' || !theme ? getSystemTheme() : theme
}

export default function themes(): ThemeInfo[] {
    const installedThemes = THEME_NAMES
        .filter(function(theme: string) {
            return fs.existsSync(path.join(DIR, `${theme}.css`))
        })
        .map(function(theme: string) {
            return {
                css: path.join(DIR, `${theme}.css`),
                basename: theme as ColorTheme,
                theme: capitalize(theme),
            }
        })

    return [
        {
            css: path.join(DIR, `${getSystemTheme()}.css`),
            basename: 'system',
            theme: 'System',
        },
        ...installedThemes,
    ]
}
