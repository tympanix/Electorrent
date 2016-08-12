// Imports
const electron = require('electron');
const winston = require('winston');
const path = require('path');

const {app} = electron;

const logfile = path.join(app.getPath('userData'), 'logfile.log')
const logger = new (winston.Logger)({
    transports: [
        new (winston.transports.File)({ filename: logfile })
    ]
});

module.exports = logger;