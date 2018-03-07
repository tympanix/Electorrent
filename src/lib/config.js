const fs = require('fs');
const path = require('path');
const {app, dialog, shell} = require('electron');
var data = null;

var defaultSettings = {
    ui: {
        resizeMode: 'FixedResizer',
        notifications: true,
        theme: 'light'
    }
};

const dataFilePath = path.join(app.getPath('userData'), 'config.json');

load();

function deleteConfig() {
    if (fs.existsSync(dataFilePath)) {
        fs.unlinkSync(dataFilePath)
    }
}

function showCorruptDialog() {
    let button = dialog.showMessageBox({
        type: "error",
        buttons: ["Delete Configuration", "Open Folder", "Exit"],
        defaultId: 2,
        title: "Corrupt configuration",
        message: "The configuration file could not be loaded",
        detail: "This may be due to your configuration file being corrupt. Deleting the corrupt configuration file will most likely solve the problem. However your settings will be permanently gone."
    })
    if (button === 0 /* delete */) {
        deleteConfig()
    } else if (button === 1 /* open folder */) {
        shell.showItemInFolder(dataFilePath)
        app.exit()
    } else {
        app.exit()
    }
}

function load() {
    if (data !== null) {
        return;
    }

    if (!fs.existsSync(dataFilePath)) {
        data = copy(defaultSettings);
        return;
    }

    file = fs.readFileSync(dataFilePath, 'utf-8')

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
    fs.writeFile(dataFilePath, JSON.stringify(data, null, 4), callback);
}

function saveSync() {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 4));
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

exports.put = function (key, value, callback) {
    load();
    data[key] = value;
    save(callback);
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
    save(callback)
}

exports.get = function (key) {
    load();
    var value = null;
    if (data && key in data) {
        value = copy(data[key]);
    }
    return value;
}

exports.unset = function (key, callback) {
    load();
    if (key in data) {
        delete data[key];
        save(callback);
    }
}
