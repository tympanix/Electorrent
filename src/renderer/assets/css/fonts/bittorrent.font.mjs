import path from 'path'

export default {
  files: ['./icons/*.svg'],
  fontName: 'bittorrent',
  types: ['eot', 'woff', 'ttf', 'svg'],
  fileName: 'css/fonts/[fontname].[ext]',
  normalize: true,
  fontHeight: 1024,
  rename(filePath) {
    return path.basename(filePath, '.svg').replace(/^icon_/, '')
  },
  codepoints: {
    deluge: 0xEA01,
    downloadstation: 0xEA02,
    qbittorrent: 0xEA03,
    rtorrent: 0xEA04,
    transmission: 0xEA05,
    utorrent: 0xEA06,
  },
}
