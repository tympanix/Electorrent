const electron = require('electron');

// Reference to the main window of the application
var mainWindow;

exports.setWindow = function(newWindow) {
    mainWindow = newWindow;
}

exports.getWindow = function() {
    return mainWindow;
}

exports.isDevelopment = function() {
    try {
        if (electron.app.isPackaged) {
            return true;
        }
        return Number.parseInt(process.env.ELECTRON_IS_DEV, 10) === 1
    } catch (e) {
        return false
    }
}