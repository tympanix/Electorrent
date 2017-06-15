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
  <a href="http://www.somsubhra.com/github-release-stats/?username=tympanix&repository=Electorrent">
    <img src="https://img.shields.io/github/downloads/Tympanix/Electorrent/total.svg?maxAge=86400">
  </a>
</p>

# Electorrent
No more! Stop copy/pasting magnet links and uploading torrent files through a tedious webinterface. Electorrent is your new dekstop remote torrenting application. Remote control your NAS, VPS, seedbox - you name it.

## Support
Electorrent can connect to the following bittorrent clients:
* [µTorrent](http://www.utorrent.com/)
* [qBittorrent](http://www.qbittorrent.org/)
* [Transmission](https://transmissionbt.com)
* [rTorrent](https://rakshasa.github.io/rtorrent/)

## Downloads
*Please note: I do not own code signing certificates which may results in anti-virus warnings!*
* [Windows](https://electorrent.herokuapp.com/download/win32) (64 bit only)
* [MacOS](https://electorrent.herokuapp.com/download/osx)
* [Linux/debian](https://electorrent.herokuapp.com/download/linux)

## Features
* Connects to your favorite torrent client
* Handles the magnet link protocol when browsing websites
* Upload local torrent files by browsing your filesystem (Ctrl/Cmd+O)
* Drag-and-drop support for torrent files
* Paste magnet links directly from your clipboard (Ctrl/Cmd+I)
* Multiple servers
* Native desktop notifications
* Easy one click installer using Squirrel framework
* Automatic updates straight from the GitHub repository!

## Screenshots
<p align="center">
  <a href="https://github.com/Tympanix/Electorrent/blob/master/assets/screen0-win.png?raw=true">
    <img src="assets/screen0-win.png" width="75%">
  </a>
</p>
<p align="center">
  <a href="https://github.com/Tympanix/Electorrent/blob/master/assets/screen1-win.png?raw=true">
    <img src="assets/screen1-win.png" width="75%">
  </a>
</p>
<p align="center">
  <a href="https://github.com/Tympanix/Electorrent/blob/master/assets/screen2-win.png?raw=true">
    <img src="assets/screen2-win.png" width="75%">
  </a>
</p> 

## FAQ
 * **Your program sucks. It doesn't support my bittorrent client**
 
 What an opportunity! Now open an issue telling me which bittorrent client you would like to see next :)
 
 * **What kind of technologies are used to build this?**
 
 The application is build around [Electron](http://electron.atom.io/), [AngularJS](https://angularjs.org/) and [SemanticUI](http://semantic-ui.com/)

* **I can't connect to rTorrent what is wrong?**

 When using rTorrent you have to configure your http server correctly. Electorrent will listen on _host_:_port_/RPC2. Follow [this guide](https://github.com/rakshasa/rtorrent/wiki/RPC-Setup-XMLRPC) to make sure you have it set up correctly

