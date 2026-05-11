declare global {
    interface Window {
        electorrent: any;
    }
}

export let electronService = [function() {
    const bridge = window.electorrent;
    const remote = require('@electron/remote');
    const legacyCertificates = remote.require('./lib/certificates');

    var meta: any = {
        appName: "",
        appVersion: "",
        isMacOS: false,
        isWindows: false,
        isLinux: false,
        isDebug: false,
        versions: {
            node: "",
            chrome: "",
            electron: "",
        },
    };

    const ready = bridge.app.getMeta().then((result: any) => {
        meta = result;
        o.program.debug = !!result.isDebug;
        return result;
    });

    function callbackify<T>(promise: Promise<T>, callback?: Function) {
        if (callback) {
            promise.then((value) => callback(null, value)).catch((err) => callback(err));
        }
        return promise;
    }

    var o: any = {};

    o.ready = function() {
        return ready;
    };

    o.program = {
        debug: false,
    };

    o.is = {
        macOS() {
            return meta.isMacOS || process.platform === "darwin";
        },
        windows() {
            return meta.isWindows || process.platform === "win32";
        },
        linux() {
            return meta.isLinux || process.platform === "linux";
        },
    };

    o.app = {
        getMeta() {
            return ready.then(() => meta);
        },
        getVersion() {
            return meta.appVersion;
        },
        isDefaultProtocolClient(protocol: string) {
            return bridge.app.getDefaultProtocolStatus(protocol);
        },
        setAsDefaultProtocolClient(protocol: string) {
            return bridge.app.setDefaultProtocolStatus(protocol, true);
        },
        removeAsDefaultProtocolClient(protocol: string) {
            return bridge.app.setDefaultProtocolStatus(protocol, false);
        },
        quit() {
            return bridge.app.quit();
        },
        reportCorruptSettings() {
            return bridge.app.reportCorruptSettings();
        },
    };

    o.clipboard = {
        readText() {
            return bridge.clipboard.readText();
        },
    };

    o.shell = {
        openExternal(url: string) {
            return bridge.shell.openExternal(url);
        },
    };

    o.settings = {
        getAll() {
            return bridge.settings.getAll();
        },
        saveAll(settings: any) {
            return bridge.settings.saveAll(settings);
        },
        listThemes() {
            return bridge.settings.listThemes();
        },
    };

    o.launch = {
        getPending() {
            return bridge.launch.getPending();
        },
        onMagnets(callback: (magnets: string[]) => void) {
            return bridge.launch.onMagnets(callback);
        },
        onTorrentFiles(callback: (files: any[]) => void) {
            return bridge.launch.onTorrentFiles(callback);
        },
    };

    o.torrents = {
        browse(askUploadOptions: boolean) {
            return bridge.torrents.openFiles(askUploadOptions);
        },
        readFiles(paths: string[], askUploadOptions: boolean) {
            return bridge.torrents.readFiles(paths, askUploadOptions);
        },
    };

    o.notifications = {
        onPush(callback: (notification: any) => void) {
            return bridge.notifications.onPush(callback);
        },
    };

    o.updater = {
        checkForUpdates(verbose?: boolean) {
            return bridge.updates.check(verbose);
        },
        manualQuitAndUpdate() {
            return bridge.updates.installDownloaded();
        },
        onStatus(callback: (event: any) => void) {
            return bridge.updates.onStatus(callback);
        },
    };

    o.autoUpdater = {
        quitAndInstall() {
            return bridge.updates.installAuto();
        },
    };

    o.ca = {
        get(server: any, callback: Function) {
            return callbackify(bridge.certificates.fetch({ server }), callback);
        },
        installCertificate(cert: any, callback: Function) {
            return callbackify(
                bridge.certificates.install({
                    fingerprint: cert.fingerprint,
                    raw: cert.raw,
                }).then((result: any) => result.fingerprint),
                callback,
            );
        },
        loadCertificate(fingerprint: string) {
            return legacyCertificates.loadCertificate(fingerprint);
        },
        onChallenge(callback: (prompt: any) => void) {
            return bridge.certificates.onChallenge(callback);
        },
    };

    o.menu = {
        setState(state: any) {
            return bridge.menu.setState(state);
        },
        onAction(callback: (action: any) => void) {
            return bridge.menu.onAction(callback);
        },
    };

    o.themes = function() {
        return bridge.settings.listThemes();
    };

    return o;
}]
