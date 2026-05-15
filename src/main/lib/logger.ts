import { app } from 'electron'
import path from 'path'
import winston from 'winston'
import yargs from 'yargs'

const program = yargs(process.argv.slice(1)).parse(process.argv.slice(1)) as { debug?: boolean; verbose?: boolean }
const loglevel = getLogLevel()
const logfile = path.join(app.getPath('userData'), 'logfile.log')

const logger = new winston.Logger({
    level: loglevel,
    transports: [
        new winston.transports.File({ filename: logfile }),
    ],
})

function getLogLevel() {
    if (program.debug) {
        return 'debug'
    } else if (program.verbose) {
        return 'verbose'
    }

    return 'info'
}

export default logger
