'use strict';

const gulp = require('gulp');
const electron = require('electron-connect').server.create();
const useref = require('gulp-useref');
const clean = require('gulp-clean');
const runSequence = require('run-sequence');
const run = require('gulp-run');

const OUT = "./app";
const CLEAN = ['!' + OUT + '/package.json', '!' + OUT + '/node_modules', OUT + '/*'];

gulp.task('serve', function () {

    // Start browser process
    electron.start();

    // Restart browser process
    gulp.watch('app.js', electron.restart);

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

gulp.task('build:views', function() {
    return gulp.src(['./views/**/*', './lib/**/*'], { base: './'})
    .pipe(gulp.dest(OUT))
})

gulp.task('build:assets' , function () {
    return gulp.src('./bower_components/semantic/dist/themes/default/assets/**')
    .pipe(gulp.dest(OUT + '/css/themes/default/assets'))
});

gulp.task('build', function() {
    runSequence('build:clean', ['build:concat', 'build:app', 'build:assets', 'build:views']);
});

gulp.task('pack:win64', ['build'], function(){
    return run('electron-packager ./dist Electorrent --icon=./icon.ico --platform=win32 --arch=x64 --out=./build --overwrite').exec()
});

gulp.task('pack:win32', ['build'], function(){
    return run('electron-packager ./dist Electorrent --icon=./icon.ico --platform=win32 --arch=ia32 --out=./build --overwrite').exec()
});
