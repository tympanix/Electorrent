import { IRootScopeService } from "angular";

export let configService = ['$rootScope', '$bittorrent', 'notificationService', 'electron', '$q', 'Server', function($rootScope: IRootScopeService, $bittorrent, $notify, electron, $q, Server) {

    var settings = {
        startup: 'default',
        refreshRate: 2000,
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

    const readyPromise = electron.ready().then(() => {
        return electron.settings.getAll();
    }).then((org: any) => {
        angular.merge(settings, org);
        settings.servers = settings.servers.map((server) => new Server(server));
        return settings;
    });

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
        this.renderServerMenu()
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
            Object.assign(settings, newSettings)
        }
        return electron.settings.saveAll(settingsToJson()).then(function() {
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
        this.renderServerMenu()
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

    this.updateApplicationMenu = function() {
        let advancedUploadEnabled = false
        if ($rootScope.$btclient && $rootScope.$server) {
            advancedUploadEnabled = !!$rootScope.$btclient.uploadOptionsEnable
        }

        return electron.menu.setState({
            isDebug: !!electron.program.debug,
            hasActiveServer: !!$rootScope.$server,
            advancedUploadEnabled: advancedUploadEnabled,
            servers: this.getServers().map((server, index) => ({
                id: server.id,
                label: server.getDisplayName(),
                accelerator: index < 10 ? 'CmdOrCtrl+' + ((index + 1) % 10) : undefined,
                checked: !!$rootScope.$server && server.id === $rootScope.$server.id,
            })),
        })
    }

    this.renderServerMenu = function() {
        return this.updateApplicationMenu()
    }

}];
