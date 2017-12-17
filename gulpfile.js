'use strict';

const gulp = require('gulp');
const electron = require('electron-connect').server.create();
const useref = require('gulp-useref');
const clean = require('gulp-clean');
const runSequence = require('run-sequence');
const less = require('gulp-less');
const path = require('path');

const OUT = "./app";
const CLEAN = [`!${OUT}/package.json`, `!${OUT}/node_modules`, `${OUT}/*`];

gulp.task('serve', function () {

    // Start browser process
    electron.start('--debug');

    // Restart browser process
    gulp.watch(['app.js', 'lib/*.js'], electron.restart);

    // Reload renderer process
    gulp.watch(['main.js', 'index.html', 'css/**/*', 'scripts/**/*', 'views/**/*'], electron.reload);
});

gulp.task('default', ['serve']);

gulp.task('build:clean', function() {
    return gulp.src(CLEAN, {read: false})
    .pipe(clean());
});

gulp.task('build:concat', function() {
    return gulp.src('./*.html')
    .pipe(useref())
    .pipe(gulp.dest(OUT))
});

gulp.task('build:app', function() {
    return gulp.src(['./app.js'])
    .pipe(gulp.dest(OUT));
});

gulp.task('build:static', function() {
    return gulp.src(['./views/**/*', './lib/**/*', './css/fonts/**/*', './img/**/*', './build/**/*'], { base: './'})
    .pipe(gulp.dest(OUT))
})

gulp.task('build:assets' , function () {
    return gulp.src('./bower_components/semantic/dist/themes/default/assets/**')
    .pipe(gulp.dest(OUT + '/css/themes/default/assets'))
});

const semantic = './bower_components/semantic/src'

gulp.task('src:semantic', function() {
  return gulp.src([
    path.join(semantic, '**'),
    '!'+path.join(semantic, 'themes/**'),
    '!'+path.join(semantic, 'themes/')
  ]).pipe(gulp.dest('css/semantic'))
})

gulp.task('themes:semantic', function() {
  let themes = ['default']
  return gulp.src(themes.map(t => path.join(semantic, 'themes', t, '/**')),
   {base: path.join(semantic, 'themes')})
    .pipe(gulp.dest('css/themes'))
})

gulp.task('semantic', ['src:semantic', 'themes:semantic'])

gulp.task('build:less', ['semantic'], function() {
  return gulp.src('css/semantic/semantic.less')
    .pipe(less({
      paths: [semantic],
      globalVars: {
        "@renderTheme": 'slate'
      }
    }))
    .pipe(gulp.dest(`${OUT}/css`))
})

gulp.task('styles', function() {
  return gulp.src('css/styles.less')
    .pipe(less({
      globalVars: {
        "@renderTheme": 'slate'
      }
    }))
    .pipe(gulp.dest(`${OUT}/css`))
})

gulp.task('theme', ['build:less', 'styles'])

gulp.task('build', function() {
    runSequence('build:clean', ['build:concat', 'build:app', 'build:assets', 'build:static', 'build:less']);
});

gulp.task('install', ['semantic'])
