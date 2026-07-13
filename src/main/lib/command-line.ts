import { app } from 'electron'
import yargs from 'yargs'

export type SquirrelCommand =
    | '--squirrel-install'
    | '--squirrel-updated'
    | '--squirrel-uninstall'
    | '--squirrel-obsolete'

export interface ParsedLaunchArguments {
    magnetLinks: string[]
    torrentFilePaths: string[]
}

export interface ParsedCommandLineOptions {
    debug: boolean
    verbose: boolean
    forceTitleBarMenu: boolean
    updateUrl?: string
    headless: boolean
    startedAtLogin: boolean
    squirrelCommand?: SquirrelCommand
    launch: ParsedLaunchArguments
}

interface YargsOptions {
    debug?: boolean
    verbose?: boolean
    'force-title-bar-menu'?: boolean
    'update-url'?: string | string[]
}

export const STARTED_AT_LOGIN_ARGUMENT = '--started-at-login'
const SQUIRREL_COMMANDS: readonly SquirrelCommand[] = [
    '--squirrel-install',
    '--squirrel-updated',
    '--squirrel-uninstall',
    '--squirrel-obsolete',
]

export function parseLaunchArguments(args: readonly string[]): ParsedLaunchArguments {
    const isMagnetLink = (argument: string) => /^magnet:\?/i.test(argument)
    const magnetLinks = args.filter(isMagnetLink)
    const torrentFilePaths = args.filter((argument) => (
        !isMagnetLink(argument) && argument.toLowerCase().endsWith('.torrent')
    ))

    return { magnetLinks, torrentFilePaths }
}

function parseCommandLineOptions(args: readonly string[]): ParsedCommandLineOptions {
    const parserArguments = args.slice(1)
    const parser = yargs(parserArguments)
    parser.version(app.getVersion())
    parser.help('h').alias('h', 'help')
    parser.usage(`Electorrent ${app.getVersion()}`)
    parser.boolean('v').alias('v', 'verbose').describe('v', 'Enable verbose logging')
    parser.boolean('d').alias('d', 'debug').describe('d', 'Start in debug mode')
    parser.boolean('force-title-bar-menu')
    parser.string('update-url')

    const parsed = parser.parse(parserArguments) as YargsOptions
    const updateUrl = Array.isArray(parsed['update-url'])
        ? parsed['update-url'][parsed['update-url'].length - 1]
        : parsed['update-url']
    const squirrelCommand = SQUIRREL_COMMANDS.find((command) => command === args[1])

    return {
        debug: !!parsed.debug,
        verbose: !!parsed.verbose,
        forceTitleBarMenu: parsed['force-title-bar-menu'] === true,
        updateUrl,
        headless: app.commandLine.hasSwitch('headless'),
        startedAtLogin: args.includes(STARTED_AT_LOGIN_ARGUMENT),
        squirrelCommand,
        launch: parseLaunchArguments(args),
    }
}

export const commandLineOptions = parseCommandLineOptions(process.argv)
