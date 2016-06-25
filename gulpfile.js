'use strict';

const gulp = require('gulp');
const electron = require('electron-connect').server.create();
const useref = require('gulp-useref');
const processhtml = require('gulp-processhtml');
const clean = require('gulp-clean');
const runSequence = require('run-sequence');

gulp.task('serve', function () {

    // Start browser process
    electron.start();

    // Restart browser process
    gulp.watch('app.js', electron.restart);

    // Reload renderer process
    gulp.watch(['main.js', 'index.html', 'css/**/*.css', 'scripts/**/*.js'], electron.reload);
});

gulp.task('build:clean', function() {
    return gulp.src('./dist/*', {read: false})
    .pipe(clean());
});

gulp.task('build:concat', function() {
    return gulp.src('./*.html')
    .pipe(useref())
    .pipe(gulp.dest('./dist'))
});

gulp.task('build:app', function() {
    return gulp.src('./app.js')
    .pipe(gulp.dest('./dist'));
});

gulp.task('build:assets' , function () {
    return gulp.src('./bower_components/semantic/dist/themes/default/assets/**')
    .pipe(gulp.dest('./dist/css/themes/default/assets'))
});

gulp.task('build', function() {
    runSequence('build:clean', ['build:concat', 'build:app', 'build:assets']);
})
