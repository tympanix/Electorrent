import { IRootScopeService } from "angular";
import type { AppSettings, StoredServerConfig } from "@shared/ipc-contract";

export let settingsService = ['$rootScope', '$bittorrent', 'notificationService', '$q', 'Server', function($rootScope: IRootScopeService, $bittorrent, $notify, $q, Server) {
    const electorrent = window.electorrent

    var settings: AppSettings<any> = {
        startup: 'default',
        refreshRate: 2000,
        automaticUpdates: true,
        closeToTray: true,
        debugMode: false,
        autoRemoveTorrents: false,
        alwaysPromptUploadOptions: false,
        watchDirectory: '',
        ui: {
            resizeMode: '',
            notifications: true,
            displaySize: 'normal',
            displayCompact: false,
            cleanNames: true,
            fixedHeader: false,
            theme: 'light'
        },
        servers: [],
        certificates: []
    };

    function loadServerCertificate(server: any) {
        if (!server?.certificate) {
            server.certificateData = undefined
            return Promise.resolve()
        }

        return electorrent.certificates.load(server.certificate).then((certificateData) => {
            server.certificateData = certificateData ? new Uint8Array(certificateData) : undefined
        })
    }

    function loadServerCertificates(servers: any[]) {
        return Promise.all(servers.map((server) => loadServerCertificate(server))).then(() => undefined)
    }

    function hydrateServer(server: any) {
        return typeof server?.connect === "function" ? server : new Server(server)
    }

    function replaceServers(servers: any[]) {
        settings.servers.splice(0, settings.servers.length, ...servers.map((server) => hydrateServer(server)))
    }

    function mergeSettings(newSettings: Partial<AppSettings<any>>) {
        const { servers, ui, ...rest } = newSettings
        Object.assign(settings, rest)
        settings.ui = Object.assign({}, settings.ui, ui || {})
        if (Array.isArray(servers)) {
            replaceServers(servers)
        }
    }

    const readyPromise = electorrent.settings.getAll().then((org: AppSettings<StoredServerConfig>) => {
        mergeSettings(org)
        return loadServerCertificates(settings.servers).then(() => settings)
    });

    $rootScope.$on("certificate-installed", (_event: unknown, serverId: string, fingerprint: string) => {
        const server = this.getServer(serverId)
        if (!server) {
            return
        }

        server.certificate = fingerprint
        loadServerCertificate(server).then(() => {
            return this.saveAllSettings()
        }).catch((err: unknown) => {
            $notify.alert("Certificate cache error", String(err))
        })
    })

    this.whenReady = function() {
        return readyPromise;
    }

    this.initSettings = function() {
        return readyPromise;
    }

    function isDefault(server) {
        return server.default === true
    }

    this.appendServer = function(server) {
        settings.servers.push(server)
    }

    this.getAllSettings = function() {
        return settings;
    }

    this.getAllSettingsCopy = function() {
      return angular.copy(settings)
    }

    this.setCurrentServerAsDefault = function() {
        if (!$rootScope.$server) {
            $notify.warning('Can\'t set default server', 'You need to chose a server to set it as default')
        }
        this.setDefault($rootScope.$server)
    }

    this.setDefault = function(server, skipsave) {
        let found = this.getServer(server.id)
        if (!found) return
        settings.servers.forEach(function(value) {
            value.default = false
        })
        found.default = true
        if (!skipsave) {
            this.saveAllSettings().then(() => {
                $notify.ok('Default server saved', 'You default server is now ' + server.getNameAtAddress())
            }).catch(function() {
                $notify.alert('I/O Error', 'Could not save default server. Local configuration file could not be written to?!')
            })
        }
    }

    function settingsToJson() {
        let copy: any = {}
        angular.copy(settings, copy)
        copy.servers = copy.servers.map((server) => {
            return server.json()
        })
        return copy
    }


    this.saveAllSettings = function(newSettings) {
        if (newSettings) {
            mergeSettings(newSettings)
        }
        return loadServerCertificates(settings.servers).then(() => electorrent.settings.saveAll(settingsToJson())).then(function() {
            updateServerReference()
        });
    }

    function updateServerReference() {
      if (!$rootScope.$server) return
      let server = settings.servers.find(function(s) {
          return s.id === $rootScope.$server.id
      })
      if (!server) return
      $bittorrent.setServer(server)
    }

    this.trustCertificate = function(cert) {
        settings.certificates.push(cert.fingerprint)
        return this.saveAllSettings()
    }

    this.saveServer = function(ip, port, user, password, client) {
        if(arguments.length === 1) {
            this.appendServer(arguments[0]);
        } else {
            this.appendServer(new Server(ip, port, user, password, client))
        }
        return this.saveAllSettings()
    }

    this.removeServer = function(server) {
        settings.servers = settings.servers.filter((s) => {
            return s.id !== server.id
        })
    }

    this.updateServer = function(update) {
        let server = this.getServer(update.id);
        if(!server) return $q.reject('Server with id ' + update.id + ' not found')
        angular.merge(server, update)
        return this.saveAllSettings()
    }

    this.getServer = function(id) {
        return settings.servers.find((server) => server.id === id)
    }

    this.getServers = function() {
        return settings.servers
    }

    this.getDefaultServer = function() {
        if (settings.servers.length === 1) {
            return settings.servers[0]
        }
        return settings.servers.find(isDefault)
    }

    this.getRecentServer = function() {
        let maxServer = settings.servers[0]
        settings.servers.forEach(function(server){
            if (server.lastused > maxServer.lastused){
                maxServer = server
            }
        })
        return maxServer
    }

}];
