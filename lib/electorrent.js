
// Reference to the main window of the application
var mainWindow;

exports.setWindow = function(newWindow) {
    mainWindow = newWindow;
}

exports.getWindow = function() {
    return mainWindow;
}