const fs = require('fs');
var data = null;

var dataFilePath = null;

function load() {
    if (data !== null) {
        return;
    }

    if (!fs.existsSync(dataFilePath)) {
        data = {};
        return;
    }

    data = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
}

function save(callback) {
    fs.writeFile(dataFilePath, JSON.stringify(data), callback);
}

exports.init = function(filepath) {
    dataFilePath = filepath;
    load();
}

exports.put = function (key, value, callback) {
    load();
    data[key] = value;
    save(callback);
}

exports.get = function (key) {
    load();
    var value = null;
    if (key in data) {
        value = data[key];
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
