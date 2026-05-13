const fs = require('fs')
const path = require('path')
const DIR = path.join(__dirname, '../css/themes')

function capitalize(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1)
}

function themes() {
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

module.exports = themes
