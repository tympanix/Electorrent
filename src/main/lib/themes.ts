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

function capitalize(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1)
}

export default function themes() {
    const themeFiles = fs.readdirSync(DIR)
        .filter(function(file: string) {
            const stat = fs.statSync(path.join(DIR, file))
            return stat.isFile() && path.extname(file) === '.css'
        })

    return themeFiles.map(function(theme: string) {
        return {
            css: path.join(DIR, theme),
            basename: path.basename(theme, '.css'),
            theme: capitalize(path.basename(theme, '.css')),
        }
    })
}
