const fs = require('fs');
const path = require('path');
const {app} = require('electron');
var data = null;

var defaultSettings = {
    server: {

    },
    ui: {
        resizeMode: 'FixedResizer'
    }
};

const dataFilePath = path.join(app.getPath('userData'), 'config.json');

load();

function load() {
    if (data !== null) {
        return;
    }

    if (!fs.existsSync(dataFilePath)) {
        data = copy(defaultSettings);
        return;
    }

    data = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
}

function save(callback) {
    fs.writeFile(dataFilePath, JSON.stringify(data), callback);
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

exports.saveAll = function(settings, callback) {
    load();
    data = settings;
    save(callback)
}

exports.get = function (key) {
    load();
    var value = null;
    if (key in data) {
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
