import { app, autoUpdater, dialog, shell, type BrowserWindow } from 'electron'
import fs from 'fs'
import is from 'electron-is'
import path from 'path'
import request from 'request'
import semver from 'semver'

import { IPC_CHANNELS } from '@shared/ipc'
import * as electorrent from './electorrent'
import logger from './logger'

const ENDPOINT = 'https://electorrent.vercel.app/'
const UPDATE_CONNECTION_ERROR = 'Could not check version automatically. Please visit the website instead'
const version = app.getVersion()

let mainWindow: BrowserWindow | null = null
let update: any = null
let downloadedUpdate: string | null = null
let verbose = false
let configuredUpdateUrl: string | null = null
let configuredTestDownloadPath: string | null = null
let configuredCaptureInstallPath = false
let configuredInstallCaptureMarkerPath: string | null = null

function getDefaultUpdateUrl() {
    if (is.windows()) {
        return `${ENDPOINT}update/win32/${version}`
    }

    if (is.macOS()) {
        return `${ENDPOINT}update/dmg/${version}`
    }

    if (is.linux()) {
        return `${ENDPOINT}update/appimage/${version}`
    }

    return null
}

function getUpdateUrl() {
    return configuredUpdateUrl || getDefaultUpdateUrl()
}

export function checkForUpdates(notifyVerbose: boolean) {
    verbose = notifyVerbose === true

    if (is.windows()) {
        autoUpdater.checkForUpdates()
    } else {
        manualUpdater()
    }
}

export function initialise(initWindow: BrowserWindow, {
    updateUrl,
    downloadsPath,
    testUpdateDownloadPath,
    captureInstallPath,
}: {
    updateUrl?: string
    downloadsPath?: string
    testUpdateDownloadPath?: string
    captureInstallPath?: boolean
} = {}) {
    mainWindow = initWindow
    configuredUpdateUrl = updateUrl || null
    configuredTestDownloadPath = testUpdateDownloadPath || null
    configuredCaptureInstallPath = captureInstallPath === true
    configuredInstallCaptureMarkerPath = testUpdateDownloadPath ? `${testUpdateDownloadPath}.install-target` : null
    if (configuredInstallCaptureMarkerPath) {
        fs.rmSync(configuredInstallCaptureMarkerPath, { force: true })
    }
    if (downloadsPath) {
        app.setPath('downloads', downloadsPath)
    }
    squirrelUpdater()
    manualDownloader()
}

export function manualQuitAndUpdate() {
    if (!downloadedUpdate) return
    const updatePath = downloadedUpdate

    const isExecutable = fs.constants.F_OK | fs.constants.X_OK
    fs.access(updatePath, isExecutable, (err: Error | null) => {
        if (err) {
            logger.error('Error while executing update', err)
            shell.showItemInFolder(updatePath)
        } else {
            launchManualUpdate(updatePath)
        }
    })
}

export function quitAndInstall() {
    autoUpdater.quitAndInstall()
}

export function openUpdateFilePath() {
    if (!downloadedUpdate) return
    shell.showItemInFolder(downloadedUpdate)
}

function downloadUpdate(url: string) {
    if (configuredTestDownloadPath) {
        downloadUpdateForTest(url, configuredTestDownloadPath)
        return
    }

    mainWindow?.webContents.downloadURL(url)
}

function sendManualDownloadedUpdate() {
    sendUpdateStatus({
        type: 'downloaded',
        data: {
            releaseNotes: update.notes,
            releaseName: update.name,
            releaseDate: update.pub_date,
            updateUrl: update.url,
            manual: true,
        },
    })
}

function downloadUpdateForTest(url: string, targetPath: string) {
    const downloadStream = fs.createWriteStream(targetPath)
    let didFinish = false

    const completeDownload = () => {
        if (didFinish) return
        didFinish = true
        downloadedUpdate = targetPath
        sendManualDownloadedUpdate()
    }

    const failDownload = (error: Error) => {
        if (didFinish) return
        didFinish = true
        logger.error('Test update download error', error)
        notifyUpdateError()
    }

    const requestStream = request.get(url)

    requestStream.on('response', (response: { statusCode?: number }) => {
        if ((response.statusCode || 0) >= 400) {
            requestStream.destroy(new Error(`Unexpected update download status ${response.statusCode}`))
        }
    })
    requestStream.on('error', failDownload)
    downloadStream.on('error', failDownload)
    downloadStream.on('finish', () => {
        downloadStream.close((error) => {
            if (error) {
                failDownload(error)
                return
            }

            completeDownload()
        })
    })

    requestStream.pipe(downloadStream)
}

function launchManualUpdate(updatePath: string) {
    if (configuredCaptureInstallPath) {
        if (configuredInstallCaptureMarkerPath) {
            fs.writeFileSync(configuredInstallCaptureMarkerPath, updatePath, 'utf8')
        }
        return
    }

    shell.openPath(updatePath)
    app.quit()
}

function filePostfix() {
    const date = new Date()
    const day = date.getDate()
    const month = date.getMonth() + 1
    const hour = date.getHours()
    const minute = date.getMinutes()
    const seconds = date.getSeconds()

    return `${month}.${day}-${hour}.${minute}.${seconds}`
}

function getUniqueFilename(filename: string) {
    const extension = path.extname(filename)
    const file = path.basename(filename, extension)
    const postfix = filePostfix()
    return `${file} (${postfix})${extension}`
}

function manualDownloader() {
    mainWindow?.webContents.session.on('will-download', (_event, item) => {
        const totalBytes = item.getTotalBytes()
        const filePath = path.join(app.getPath('downloads'), getUniqueFilename(item.getFilename()))

        item.setSavePath(filePath)

        item.on('updated', () => {
            mainWindow?.setProgressBar(item.getReceivedBytes() / totalBytes)
        })

        item.on('done', (_event, state) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.setProgressBar(-1)
            }

            if (state === 'interrupted') {
                logger.error('The download update was interrupted', state)
                dialog.showErrorBox('Download error', `The download of ${item.getFilename()} was interrupted`)
            }

            if (state === 'completed') {
                downloadedUpdate = item.getSavePath()

                sendManualDownloadedUpdate()
            }
        })
    })
}

function manualUpdater() {
    const updateUrl = getUpdateUrl()
    if (!updateUrl) return

    request(updateUrl, function(error: Error | null, response: { statusCode: number }, body: string) {
        if (error) {
            logger.error('Manual updater error', error)
            notifyUpdateError()
            return
        }

        if (response.statusCode === 204) {
            logger.verbose('Manual no new update available', response.statusCode)
            notifyUpToDate()
            return
        }

        if (response.statusCode === 200) {
            logger.verbose('Manual updater found update', response.statusCode)

            const info = JSON.parse(body)
            const newVersion = semver.clean(info.name)
            if (!semver.valid(newVersion)) {
                logger.error('Manual updater invalid semver', info.name)
                return
            }

            if (semver.gt(newVersion, version)) {
                update = info
                downloadUpdate(info.url)
                notifyUpdateAvailable()
            }
        }
    })
}

function notify({ title = '', message = '', type = 'info' }) {
    const win = electorrent.getWindow()
    if (!win) return

    win.webContents.send(IPC_CHANNELS.notifications.push, {
        title,
        message,
        type,
    })
}

function sendUpdateStatus(payload: unknown) {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.send(IPC_CHANNELS.updates.status, payload)
}

function notifyUpdateError() {
    sendUpdateStatus({
        type: 'error',
        message: 'Could not update Electorrent. Please visit the website instead',
    })
    notify({
        title: 'Update Error',
        message: 'Could not update Electorrent. Please visit the website instead',
        type: 'negative',
    })
}

function notifyCheckingUpdate() {
    if (!verbose) return

    sendUpdateStatus({
        type: 'checking',
    })
    notify({
        title: 'Checking for update',
        message: 'Checking for new updates',
        type: 'info',
    })
}

function notifyUpdateAvailable() {
    sendUpdateStatus({
        type: 'available',
        data: {
            releaseNotes: update && update.notes,
            releaseName: update && update.name,
            releaseDate: update && update.pub_date,
            updateUrl: update && update.url,
            manual: !is.windows(),
        },
    })
    notify({
        title: 'Update Available!',
        message: 'We are downloading the newest version of Electorrent for you!',
        type: 'info',
    })
}

function notifyUpToDate() {
    if (!verbose) return

    sendUpdateStatus({
        type: 'up-to-date',
    })
    notify({
        title: 'Up to date!',
        message: 'Your version of Electorrent is up to date',
        type: 'positive',
    })
}

function notifyConnectionError() {
    sendUpdateStatus({
        type: 'error',
        message: UPDATE_CONNECTION_ERROR,
    })
    notify({
        title: 'Update Error',
        message: UPDATE_CONNECTION_ERROR,
        type: 'negative',
    })
}

function squirrelUpdater() {
    const updateUrl = getUpdateUrl()
    if (!updateUrl || !is.windows()) return

    autoUpdater.setFeedURL({ url: updateUrl })

    autoUpdater.on('error', function(err: Error) {
        logger.error('Auto updater error', err)
        notifyConnectionError()
    })

    autoUpdater.on('checking-for-update', function() {
        logger.debug('Checking for update')
        notifyCheckingUpdate()
    })

    autoUpdater.on('update-not-available', function() {
        logger.verbose('No update available')
        notifyUpToDate()
    })

    autoUpdater.on('update-available', function() {
        logger.info('Update available')
        notifyUpdateAvailable()
    })

    autoUpdater.on('update-downloaded', function(...args: any[]) {
        logger.info('Auto update downloaded', args)
        sendUpdateStatus({
            type: 'downloaded',
            data: {
                releaseNotes: args[1],
                releaseName: args[2],
                releaseDate: args[3],
                updateUrl,
                manual: false,
            },
        })
    })
}
