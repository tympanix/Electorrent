import fs from 'fs'
import path from 'path'

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

export default function themes() {
    return THEME_NAMES
        .filter(function(theme: string) {
            return fs.existsSync(path.join(DIR, `${theme}.css`))
        })
        .map(function(theme: string) {
        return {
            css: path.join(DIR, `${theme}.css`),
            basename: theme,
            theme: capitalize(theme),
        }
    })
}
