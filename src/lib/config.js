const fs = require('fs');
const path = require('path');
const {app, dialog, shell} = require('electron');
const electorrent = require('./electorrent')
var data = null;

var defaultSettings = {
    servers: [],
    automaticUpdates: true,
    debugMode: false,
    autoRemoveTorrents: false,
    ui: {
        resizeMode: 'FixedResizer',
        notifications: true,
        theme: 'light'
    }
};

const CONF_PATH = path.join(app.getPath('userData'), 'config.json');

load();

function deleteConfig() {
    if (fs.existsSync(CONF_PATH)) {
        fs.unlinkSync(CONF_PATH)
    }
}

function showCorruptDialog() {
    let window = electorrent.getWindow()
    const config = {
        type: "error",
        buttons: ["Delete Configuration", "Open Folder", "Exit"],
        defaultId: 2,
        title: "Corrupt configuration",
        message: "The configuration file could not be loaded",
        detail: "This may be due to your configuration file being corrupt. Deleting the corrupt configuration file will most likely solve the problem. However your settings will be permanently gone."
    }
    let button = -1
    if (window) {
        button = dialog.showMessageBox(window, config)
    } else {
        button = dialog.showMessageBox(config)
    }
    
    if (button === 0 /* delete */) {
        deleteConfig()
    } else if (button === 1 /* open folder */) {
        shell.showItemInFolder(CONF_PATH)
        app.exit()
    } else {
        app.exit()
    }
}

function load() {
    if (data !== null) {
        return;
    }

    if (!fs.existsSync(CONF_PATH)) {
        data = copy(defaultSettings);
        return;
    }

    file = fs.readFileSync(CONF_PATH, 'utf-8')

    try {
        data = JSON.parse(file);
    } catch(e) {
        if (app.isReady()) {
            showCorruptDialog()
        } else {
            app.on('ready', function() {
                showCorruptDialog()
            })
        }
    }
}

function save(callback) {
    fs.writeFile(CONF_PATH, JSON.stringify(data, null, 4), callback);
}

function saveSync() {
    fs.writeFileSync(CONF_PATH, JSON.stringify(data, null, 4));
}

function copy(object) {
    if (object === null){
        return object;
    } else if (typeof object === 'object'){
        if (Array.isArray(object)){
            return copyArray(object);
        } else {
            return copyObject(object);
        }
    } else {
        return object;
    }
}

function copyObject(_obj){
    var copyObj = {}
    for (var key in _obj) {
        if (_obj.hasOwnProperty(key)) {
            copyObj[key] = copy(_obj[key])
        }
    }
    return copyObj;
}

function copyArray(_obj){
    var copyArray = []
    for (var i = 0; i < _obj.length; i++){
        copyArray[i] = copy(_obj[i])
    }
    return copyArray;
}

exports.showCorruptDialog = showCorruptDialog

exports.put = function (key, value, callback) {
    load();
    data[key] = value;
    if (callback != undefined) {
        save(callback);
    }
}

exports.getAllSettings = function() {
    load();
    return copy(data);
}

exports.settingsReference = function() {
    return data;
}

exports.write = function() {
    saveSync();
}

exports.saveAll = function(settings, callback) {
    load();
    data = settings;
    if (callback != undefined) {
        save(callback)
    }
}

exports.get = function (key) {
    load();
    var value = null;
    if (data && key in data) {
        value = copy(data[key]);
    }
    return value;
}

exports.getServer = function(id) {
    load();
    return data.servers.find(s => s.id === id)
}

exports.saveServer = function(server, callback) {
    load();
    let ok = false
    data.servers = data.servers.map(s => {
        if (s.id === server.id) {
            ok = true
            return Object.assign(s, server)
        } else {
            return s
        }
    })
    if (!ok) {
        return callback(new Error("Could not save server. Server not found"))
    }
    save(callback)
}

exports.unset = function (key, callback) {
    load();
    if (key in data) {
        delete data[key];
        save(callback);
    }
}
