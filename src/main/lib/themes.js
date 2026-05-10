const fs = require('fs')
const path = require('path')
const DIR = path.join(__dirname, '../css/themes')

function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function themes() {
  let themes = fs.readdirSync(DIR)
    .filter(function(file) {
      let stat = fs.statSync(path.join(DIR, file))
      return stat.isFile() && path.extname(file) === '.css'
    })

  return themes.map(function(theme) {
    return {
      css: path.join(DIR, theme),
      basename: path.basename(theme, '.css'),
      theme: capitalize(path.basename(theme, '.css'))
    }
  })
}

module.exports = themes