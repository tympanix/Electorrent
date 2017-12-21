// Imports
const electron = require('electron');
const winston = require('winston');
const path = require('path');
const program = require('yargs').parse(process.argv);

const {app} = electron;

const loglevel = getLogLevel();

const logfile = path.join(app.getPath('userData'), 'logfile.log')
const logger = new (winston.Logger)({
    level: loglevel,
    transports: [
        new (winston.transports.File)({ filename: logfile })
    ]
});

function getLogLevel() {
    if (program.debug){
        return 'debug'
    } else if (program.verbose) {
        return 'verbose'
    } else {
        return 'info'
    }
}

module.exports = logger;
