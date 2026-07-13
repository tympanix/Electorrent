import { app } from 'electron'
import path from 'path'
import winston from 'winston'

import { commandLineOptions } from './command-line'

const loglevel = getLogLevel()
const logfile = path.join(app.getPath('userData'), 'logfile.log')

const logger = new winston.Logger({
    level: loglevel,
    transports: [
        new winston.transports.File({ filename: logfile }),
    ],
})

function getLogLevel() {
    if (commandLineOptions.debug) {
        return 'debug'
    } else if (commandLineOptions.verbose) {
        return 'verbose'
    }

    return 'info'
}

export default logger
