<p align="center">
  <img src="assets/electron-icon.png" width="256">
</p> 
<p align="center">
  <a href="https://travis-ci.org/Tympanix/Electorrent">
    <img src="https://travis-ci.org/Tympanix/Electorrent.svg?branch=master">
  </a>
  <a href="https://github.com/Tympanix/Electorrent/releases/latest">
    <img src="https://img.shields.io/github/release/Tympanix/Electorrent.svg?maxAge=86400">
  </a>
  <img src="https://img.shields.io/github/downloads/Tympanix/Electorrent/total.svg?maxAge=86400">
</p>

# Electorrent
An Electron/Node/AngularJS remote client app for uTorrent server

## Downloads
*Please note: I do not own code signing certificates which may results in anti-virus warnings!*
* [Windows](https://electorrent.herokuapp.com/download/win32)
* [MacOS](https://electorrent.herokuapp.com/download/osx)

## Features
* Connects to µTorrent WebUI with IP address/port and username/password
* Handles the magnet link protocol for easy integration
* Easy one click installer using Squirrel framework
* Automatic silent updates straight from the GitHub repository

## Screenshots

Torrents Screen              |  Settings Screen
:---------------------------:|:---------------------------:
![](assets/screen1-win.png)  | ![](assets/screen2-win.png)

## FAQ
 * **Can I use this program with a normal installation of µTorrent?**
 
 Yes. You can enable the WebUI in the µTorrent settings and connect to localhost to try it out
 
 * **Why doesn't automatic updates on MacOS work?**
 
 Unfortunately, this requires me to sign the code with a expensive certificate which I can't afford
 
 * **What kind of technologies are used to build this?**
 
 The application is build around [Electron](http://electron.atom.io/), [AngularJS](https://angularjs.org/) and [SemanticUI](http://semantic-ui.com/)
