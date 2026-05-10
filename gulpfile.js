'use strict';

const startApp = require("gulp-run-electron")
const fs = require('fs');
const gulp = require('gulp');
const clean = require('gulp-clean');
const less = require('gulp-less');
const concat = require('gulp-concat');
const path = require('path');
const merge = require('merge-stream');
const iconfont = require('gulp-iconfont');
const webpack = require('webpack-stream')
const compiler = require('webpack');

const OUT = "./app";
const CLEAN = [`${OUT}/*`, `!${OUT}/package.json`, `!${OUT}/node_modules`];
const SEMANTIC = './node_modules/semantic-ui-less'

function dummy(done) {
  if (done instanceof Function) {
    done()
  }
}

function watch({ updateMainCallback = dummy, updateRendererCallback = dummy }) {
  // Restart application
  gulp.watch('src/main/main.js', gulp.series('build:app', updateMainCallback))
  gulp.watch('src/main/lib/*.js', gulp.series('build:lib', updateMainCallback))

  // Reload renderer process
  gulp.watch(['src/renderer/assets/css/**/*'], gulp.series('build:less', updateRendererCallback))

  return compileWebpack({ watch: true })
}

function compileWebpack({ watch = false }) {
  const config = require('./webpack.config.js')
  return gulp.src('src/renderer/app.ts')
    .pipe(webpack({ ...config, watch }, compiler))
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
        .pipe(clean());
})

gulp.task('build:app', function() {
  return gulp.src('src/main/main.js')
    .pipe(gulp.dest(OUT));
})

gulp.task('build:lib', function() {
    return gulp.src('src/main/lib/**/*', {base: 'src/main'})
        .pipe(gulp.dest(OUT))
})

gulp.task('build:fonts', function() {
  let runTimestamp = Math.round(Date.now()/1000)
  return gulp.src(['src/renderer/assets/css/fonts/icons/*.svg'], {base:'src/renderer/assets'})
    .pipe(iconfont({
      fontName: 'bittorrent',
      normalize: true,
      fontHeight: 1024,
      prependedUnicode: true,
      formats: ['ttf', 'eot', 'woff', 'svg'],
      timestamp: runTimestamp,
    }))
    .on('glyphs', function(glyphs, options) {
      /* Creates a uppercase hex number with at least length digits from a given number */
      function unicodeEscape(str) {
        return str.replace(/[\s\S]/g, function (escape) {
          return '\\u' + ('0000' + escape.charCodeAt().toString(16)).slice(-4);
        });
      }
      /*
      for (let g of glyphs) {
        console.log(g.name.padEnd(24), unicodeEscape(g.unicode[0]))
      }
      */
    })
    .pipe(gulp.dest(path.join(OUT, 'css', 'fonts')))
})

gulp.task('semantic:src', function() {
  return gulp.src([
    path.join(SEMANTIC, '**'),
    '!'+path.join(SEMANTIC, 'themes/**'),
    '!'+path.join(SEMANTIC, 'themes/')
  ], {base: SEMANTIC}).pipe(gulp.dest('src/renderer/assets/css/semantic'))
})

gulp.task('semantic:default', function() {
  let themes = ['default']
  return gulp.src(themes.map(t => path.join(SEMANTIC, 'themes', t, '**')),
   {base: path.join(SEMANTIC, 'themes')})
    .pipe(gulp.dest('src/renderer/assets/css/themes'))
})

gulp.task('build:semantic', gulp.parallel('semantic:src', 'semantic:default'))

gulp.task('build:less', function() {
  let dir = 'src/renderer/assets/css/themes'
  let themes = fs.readdirSync(dir)
    .filter(function(file) {
      let stat = fs.statSync(path.join(dir, file))
      return stat.isDirectory() && file !== 'default'
    })

  let tasks = themes.map(function(theme) {
    return gulp.src(['src/renderer/assets/css/semantic/semantic.less', 'src/renderer/assets/css/styles.less'])
      .pipe(less({
        paths: [SEMANTIC],
        globalVars: {
          "@renderTheme": theme
        }
      }))
      .pipe(concat(theme + '.css'))
      .pipe(gulp.dest(path.join(OUT, 'css', 'themes')))
  })

  return merge(tasks)
})

gulp.task('build:styles', gulp.series(gulp.parallel('build:semantic', 'build:fonts'), 'build:less'))

gulp.task('build', gulp.parallel('build:styles', 'build:webpack'));

gulp.task('install', gulp.parallel('build:semantic'))

gulp.task('develop', gulp.series("build", function() {
  watch({})
  return gulp.src(OUT)
    .pipe(startApp(["--inspect=9229", "--", "--debug"], { cwd: OUT }))
}))

gulp.task('default', gulp.parallel('develop'));
