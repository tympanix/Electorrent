import gulp from 'gulp'
import clean from 'gulp-clean'
import startApp from 'gulp-run-electron'
import webpackStream from 'webpack-stream'
import compiler from 'webpack'

import webpackConfig from './webpack.config.js'

const OUT = './app'
const CLEAN = [`${OUT}/*`, `!${OUT}/package.json`, `!${OUT}/node_modules`]

function compileWebpack({ watch = false }) {
  return gulp.src('src/renderer/app.ts')
    .pipe(webpackStream({ config: webpackConfig, watch }, compiler))
    .pipe(gulp.dest(OUT))
}

gulp.task('watch', function() {
  return compileWebpack({ watch: true })
})

gulp.task('build:webpack', function() {
  return compileWebpack({ watch: false })
})

gulp.task('clean', function() {
  return gulp.src(CLEAN, { read: false })
    .pipe(clean())
})

gulp.task('build:app', function() {
  return compileWebpack({ watch: false })
})

gulp.task('build:lib', function() {
  return compileWebpack({ watch: false })
})

gulp.task('build', gulp.parallel('build:webpack'))

gulp.task('install', function(done) {
  done()
})

gulp.task('develop', gulp.series('build', function() {
  compileWebpack({ watch: true })

  return gulp.src(OUT)
    .pipe(startApp(['--inspect=9229', '--', '--debug'], { cwd: OUT }))
}))

gulp.task('default', gulp.parallel('develop'))
