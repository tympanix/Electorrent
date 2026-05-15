import fs from 'fs'
import path from 'path'

import concat from 'gulp-concat'
import clean from 'gulp-clean'
import gulp from 'gulp'
import less from 'gulp-less'
import startApp from 'gulp-run-electron'
import merge from 'merge-stream'
import webpackStream from 'webpack-stream'
import compiler from 'webpack'

import webpackConfig from './webpack.config.mjs'

const OUT = './app'
const CLEAN = [`${OUT}/*`, `!${OUT}/package.json`, `!${OUT}/node_modules`]
const SEMANTIC = './node_modules/semantic-ui-less'

function dummy(done) {
  if (done instanceof Function) {
    done()
  }
}

function watch({ updateMainCallback = dummy, updateRendererCallback = dummy }) {
  gulp.watch('src/main/**/*.ts', gulp.series('build:webpack', updateMainCallback))
  gulp.watch(['src/renderer/assets/css/**/*'], gulp.series('build:less', updateRendererCallback))

  return compileWebpack({ watch: true })
}

function compileWebpack({ watch = false }) {
  return gulp.src('src/renderer/app.ts')
    .pipe(webpackStream({ config: webpackConfig, watch }, compiler))
    .pipe(gulp.dest(OUT))
}

gulp.task('watch', function() {
  return watch({})
})

gulp.task('build:webpack', function() {
  return compileWebpack({ watch: false })
})

gulp.task('clean', function() {
    return gulp.src(CLEAN, {read: false})
        .pipe(clean())
})

gulp.task('build:app', function() {
  return compileWebpack({ watch: false })
})

gulp.task('build:lib', function() {
    return compileWebpack({ watch: false })
})

gulp.task('semantic:src', function() {
  return gulp.src([
    path.join(SEMANTIC, '**'),
    '!' + path.join(SEMANTIC, 'themes/**'),
    '!' + path.join(SEMANTIC, 'themes/'),
  ], {base: SEMANTIC}).pipe(gulp.dest('src/renderer/assets/css/semantic'))
})

gulp.task('semantic:default', function() {
  const themes = ['default']
  return gulp.src(themes.map((theme) => path.join(SEMANTIC, 'themes', theme, '**')),
   {base: path.join(SEMANTIC, 'themes')})
    .pipe(gulp.dest('src/renderer/assets/css/themes'))
})

gulp.task('build:semantic', gulp.parallel('semantic:src', 'semantic:default'))

gulp.task('build:less', function() {
  const dir = 'src/renderer/assets/css/themes'
  const themes = fs.readdirSync(dir)
    .filter(function(file) {
      const stat = fs.statSync(path.join(dir, file))
      return stat.isDirectory() && file !== 'default'
    })

  const tasks = themes.map(function(theme) {
    return gulp.src(['src/renderer/assets/css/semantic/semantic.less', 'src/renderer/assets/css/styles.less'])
      .pipe(less({
        paths: [SEMANTIC],
        globalVars: {
          '@renderTheme': theme,
        },
      }))
      .pipe(concat(`${theme}.css`))
      .pipe(gulp.dest(path.join(OUT, 'css', 'themes')))
  })

  return merge(tasks)
})

gulp.task('build:styles', gulp.series('build:semantic', 'build:less'))

gulp.task('build', gulp.parallel('build:styles', 'build:webpack'))

gulp.task('install', gulp.parallel('build:semantic'))

gulp.task('develop', gulp.series('build', function() {
  watch({})
  return gulp.src(OUT)
    .pipe(startApp(['--inspect=9229', '--', '--debug'], { cwd: OUT }))
}))

gulp.task('default', gulp.parallel('develop'))
