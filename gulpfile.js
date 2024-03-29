'use strict';

const startApp = require("gulp-run-electron")
const fs = require('fs');
const gulp = require('gulp');
const useref = require('gulp-useref');
const clean = require('gulp-clean');
const sourcemaps = require('gulp-sourcemaps')
const lazypipe = require('lazypipe')
const less = require('gulp-less');
const concat = require('gulp-concat');
const path = require('path');
const merge = require('merge-stream');
const iconfont = require('gulp-iconfont');
const webpack = require('webpack-stream')
const compiler = require('webpack');

const PROD = process.env.NODE_ENV === 'production'
const OUT = "./app";
const CLEAN = [`${OUT}/*`, `!${OUT}/package.json`, `!${OUT}/node_modules`];
const SEMANTIC = './bower_components/semantic/src'

function dummy(done) {
  if (done instanceof Function) {
    done()
  }
}

function watch({ updateMainCallback = dummy, updateRendererCallback = dummy }) {
  // Restart application
  gulp.watch('src/app.js', gulp.series('build:app', updateMainCallback))
  gulp.watch('src/lib/*.js', gulp.series('build:lib', updateMainCallback))

  // Reload renderer process
  gulp.watch(['src/**/*.html'], gulp.series('build:useref', updateRendererCallback))
  gulp.watch(['src/views/**/*.html'], gulp.series('build:views', updateRendererCallback))
  gulp.watch(['src/css/**/*'], gulp.series('build:less', updateRendererCallback))
  gulp.watch(['src/scripts/workers/*.js'], gulp.series('build:workers', updateRendererCallback))

  return compileWebpack({ watch: true })
}

function compileWebpack({ watch = false }) {
  const config = require('./webpack.config.js')
  return gulp.src('src/main.ts')
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

gulp.task('build:useref', function() {
    var conf = {dev: c => PROD ? '' : c}
    var maps = lazypipe().pipe(sourcemaps.init, { loadMaps: true})

    return gulp.src('src/*.html')
        .pipe(useref(conf, maps))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest(OUT))
})

gulp.task('build:app', function() {
  return gulp.src('src/app.js')
    .pipe(gulp.dest(OUT));
})

gulp.task('build:views', function() {
    return gulp.src('src/views/**/*', {base: 'src'})
        .pipe(gulp.dest(OUT))
})

gulp.task('build:workers', function() {
    return gulp.src('src/scripts/workers/*.js', {base: 'src'})
        .pipe(gulp.dest(OUT))
})

gulp.task('build:lib', function() {
    return gulp.src('src/lib/**/*', {base: 'src'})
        .pipe(gulp.dest(OUT))
})

gulp.task('build:fonts', function() {
  let runTimestamp = Math.round(Date.now()/1000)
  return gulp.src(['src/css/fonts/icons/*.svg'], {base:'src'})
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

gulp.task('build:others', function() {
  return gulp.src(['src/img/**/*'], {base: 'src'})
    .pipe(gulp.dest(OUT))
})

gulp.task('build:build', function() {
  return gulp.src(['build/**/*'])
    .pipe(gulp.dest(path.join(OUT, 'build')))
})

gulp.task('build:assets' , function () {
    return gulp.src('./bower_components/semantic/dist/themes/default/assets/**')
    .pipe(gulp.dest(OUT + '/css/themes/default/assets'))
})

gulp.task('semantic:src', function() {
  return gulp.src([
    path.join(SEMANTIC, '**'),
    '!'+path.join(SEMANTIC, 'themes/**'),
    '!'+path.join(SEMANTIC, 'themes/')
  ], {base: SEMANTIC}).pipe(gulp.dest('src/css/semantic'))
})

gulp.task('semantic:default', function() {
  let themes = ['default']
  return gulp.src(themes.map(t => path.join(SEMANTIC, 'themes', t, '**')),
   {base: path.join(SEMANTIC, 'themes')})
    .pipe(gulp.dest('src/css/themes'))
})

gulp.task('build:semantic', gulp.parallel('semantic:src', 'semantic:default'))

gulp.task('build:static', gulp.parallel('build:useref', 'build:app', 'build:views', 'build:lib', 'build:others', 'build:assets', 'build:workers', 'build:build'))

gulp.task('build:less', function() {
  let dir = 'src/css/themes'
  let themes = fs.readdirSync(dir)
    .filter(function(file) {
      let stat = fs.statSync(path.join(dir, file))
      return stat.isDirectory() && file !== 'default'
    })

  let tasks = themes.map(function(theme) {
    return gulp.src(['src/css/semantic/semantic.less', 'src/css/styles.less'])
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

gulp.task('build', gulp.parallel('build:static', 'build:styles', 'build:webpack'));

gulp.task('install', gulp.parallel('build:semantic'))

gulp.task('develop', gulp.series("build", function() {
  watch({})
  return gulp.src(OUT)
    .pipe(startApp(["--debug"], { cwd: OUT }))
}))

gulp.task('default', gulp.parallel('develop'));