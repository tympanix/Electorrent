import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { webfont } from 'webfont'

const root = path.resolve(import.meta.dirname, '..')
const iconsDirectory = path.join(root, 'src/renderer/styles/assets/fonts/icons')
const outputDirectory = path.join(root, 'app/css/fonts')

const iconNames = ['deluge', 'downloadstation', 'qbittorrent', 'rtorrent', 'transmission', 'utorrent', 'aria2']
const result = await webfont({
  files: iconNames.map((name) => path.join(iconsDirectory, `${name}.svg`).replaceAll('\\', '/')),
  fontName: 'bittorrent',
  formats: ['eot', 'woff', 'ttf', 'svg'],
  normalize: true,
  fontHeight: 1024,
  startUnicode: 'EA01',
  sort: false,
})

await mkdir(outputDirectory, { recursive: true })
await Promise.all([
  writeFile(path.join(outputDirectory, 'bittorrent.eot'), result.eot),
  writeFile(path.join(outputDirectory, 'bittorrent.woff'), result.woff),
  writeFile(path.join(outputDirectory, 'bittorrent.ttf'), result.ttf),
  writeFile(path.join(outputDirectory, 'bittorrent.svg'), result.svg),
])
