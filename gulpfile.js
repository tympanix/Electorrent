'use strict';

const fs = require('fs');
const gulp = require('gulp');
const {server} = require('electron-connect')
const useref = require('gulp-useref');
const clean = require('gulp-clean');
const rename = require('gulp-rename');
const run = require('run-sequence');
const util = require('gulp-util');
const less = require('gulp-less');
const path = require('path');
const merge = require('merge-stream');

const PROD = process.env.NODE_ENV === 'production' || !!util.env.production
const OUT = "./app";
const CLEAN = [`!${OUT}/package.json`, `!${OUT}/node_modules`, `${OUT}/*`];
const semantic = './bower_components/semantic/src'

gulp.task('serve', function () {
    let electron = server.create({
      path: 'app'
    });

    // Start browser process
    electron.start('--debug');

    // Restart browser process
    gulp.watch('src/app.js', () => run('build:app', electron.restart))
    gulp.watch('src/lib/*.js', () => run('build:lib', electron.restart))

    // Reload renderer process
    gulp.watch(['src/*.html', 'src/scripts/**'], () => run('build:concat', electron.reload));
    gulp.watch(['src/views/**/*'], () => run('build:views', electron.reload));
});

gulp.task('default', ['serve']);

gulp.task('build:clean', function() {
    return gulp.src(CLEAN, {read: false})
    .pipe(clean());
});

gulp.task('build:concat', function() {
    return gulp.src('src/*.html')
    .pipe(useref({
      dev: function(content) {
        return PROD ? '' : content
      }
    }))
    .pipe(gulp.dest(OUT))
});

gulp.task('build:app', function() {
  return gulp.src('src/app.js')
    .pipe(gulp.dest(OUT));
});

gulp.task('build:views', function() {
  return gulp.src('src/views/**/*', {base: 'src'})
    .pipe(gulp.dest(OUT))
})

gulp.task('build:lib', function() {
  return gulp.src('src/lib/**/*', {base: 'src'})
    .pipe(gulp.dest(OUT))
})

gulp.task('build:others', function() {
  return gulp.src(['src/css/fonts/**/*', 'src/img/**/*', 'build/**/*'], {base: 'src'})
    .pipe(gulp.dest(OUT))
})

gulp.task('build:assets' , function () {
    return gulp.src('./bower_components/semantic/dist/themes/default/assets/**')
    .pipe(gulp.dest(OUT + '/css/themes/default/assets'))
});

gulp.task('build:static', ['build:app', 'build:views', 'build:lib', 'build:others', 'build:assets'])

gulp.task('src:semantic', function() {
  return gulp.src([
    path.join(semantic, '**'),
    '!'+path.join(semantic, 'themes/**'),
    '!'+path.join(semantic, 'themes/')
  ]).pipe(gulp.dest('src/css/semantic'))
})

gulp.task('themes:semantic', function() {
  let themes = ['default']
  return gulp.src(themes.map(t => path.join(semantic, 'themes', t, '/**')),
   {base: path.join(semantic, 'themes')})
    .pipe(gulp.dest('src/css/themes'))
})

gulp.task('semantic', ['src:semantic', 'themes:semantic'])

gulp.task('build:less', ['semantic'], function() {
  return gulp.src('src/css/semantic/semantic.less')
    .pipe(less({
      paths: [semantic],
      globalVars: {
        "@renderTheme": 'dark'
      }
    }))
    .pipe(gulp.dest(`${OUT}/css`))
})

gulp.task('themes:all', ['semantic'], function() {
  let dir = 'src/css/themes'
  let themes = fs.readdirSync(dir)
    .filter(function(file) {
      let stat = fs.statSync(path.join(dir, file))
      return stat.isDirectory() && file !== 'default'
    })

  let tasks = themes.map(function(theme) {
    return gulp.src('src/css/semantic/semantic.less')
      .pipe(less({
        paths: [semantic],
        globalVars: {
          "@renderTheme": theme
        }
      }))
      .pipe(rename({
        basename: theme
      }))
      .pipe(gulp.dest(path.join(OUT, 'css', 'themes')))
  })

  return merge(tasks)
})

gulp.task('styles', function() {
  return gulp.src('src/css/styles.less')
    .pipe(less({
      globalVars: {
        "@renderTheme": 'dark'
      }
    }))
    .pipe(gulp.dest(`${OUT}/css`))
})

gulp.task('theme', ['build:less', 'styles'])

gulp.task('build', ['build:concat', 'build:static', 'build:less']);

gulp.task('install', ['semantic'])
