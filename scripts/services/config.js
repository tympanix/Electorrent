'use strict';

angular.module('torrentApp').service('configService', ['$rootScope', 'notificationService', 'electron', '$q', 'Server', function($rootScope, $notify, electron, $q, Server) {

    const MenuItem = electron.menuItem
    const config = electron.config;

    var settings = {
        server: {
            ip: '',
            port: '',
            user: '',
            password: '',
            type: '',
        },
        ui: {
            resizeMode: '',
            notifications: true
        },
        servers: []
    };

    this.initSettings = function() {
        var org = config.settingsReference();
        angular.merge(settings, org)
    }

    // Angular wrapper for saving to config
    function put(key, value) {
        var q = $q.defer();
        config.put(key, value, function(err) {
            if(err) q.reject(err)
            else q.resolve();
        });
        return q.promise;
    }

    // Angular wrapper for getting config
    function get(value) {
        return config.get(value);
    }

    function isDefault(server) {
        return server.default === true
    }

    this.appendServer = function(server) {
        settings.servers.push(server.json())
        this.renderServerMenu()
    }

    this.getAllSettings = function() {
        return settings;
    }

    this.setCurrentServerAsDefault = function() {
        if (!$rootScope.$server) {
            $notify.warning('Can\'t set default server', 'You need to chose a server to set it as default')
        }
        console.log("Set default", $rootScope.$server);
        this.setDefault($rootScope.$server)
    }


    this.setDefault = function(server) {
        let found = this.getServer(server.id)
        if (!found) return
        settings.servers.forEach(function(value) {
            value.default = false
        })
        found.default = true
        this.saveAllSettings().then(() => {
            $notify.ok('Default server saved', 'You default server is now ' + server.getNameAtAddress())
        }).catch(function() {
            $notify.alert('I/O Error', 'Could not save default server. Local configuration file could not be written to?!')
        })
    }

    this.saveAllSettings = function(newSettings) {
        var q = $q.defer();
        angular.merge(settings, newSettings)
        config.saveAll(settings, function(err) {
            if(err) q.reject(err)
            else q.resolve();
        });
        return q.promise;
    }

    this.saveServer = function(ip, port, user, password, client) {
        if(arguments.length === 1) {
            this.appendServer(arguments[0]);
        } else {
            this.appendServer(new Server(ip, port, user, password, client))
        }
        console.info("Servers:", settings.servers);
        return this.saveAllSettings()
    }

    this.updateServer = function(update) {
        let server = this.getServer(update.id);
        if(!server) return $q.reject('Server with id ' + update.id + ' not found')
        angular.merge(server, update)
        console.info("Servers:", settings.servers);
        return this.saveAllSettings()
    }

    this.getServer = function(id) {
        return settings.servers.find((server) => server.id === id)
    }

    this.getServers = function() {
        return settings.servers.map((data) => {
            return new Server(data)
        })
    }

    this.getDefaultServer = function() {
        return settings.servers.find(isDefault)
    }

    function getMenu(name) {
        let menu = electron.menu.getApplicationMenu()
        return menu.items.find((menuItem) => menuItem.label === name)
    }

    this.renderServerMenu = function() {
        let serverMenu = getMenu('Servers').submenu
        serverMenu.clear()
        serverMenu.append(new MenuItem({
            label: 'Add new server...',
            click: () => $rootScope.$broadcast('add:server'),
        }))
        serverMenu.append(new MenuItem({
            label: 'Set current as default',
            click: () => this.setCurrentServerAsDefault()
        }))
        serverMenu.append(new MenuItem({type: 'separator'}))
        renderServerMenuOptions(serverMenu, this.getServers())
    }

    function renderServerMenuOptions(menu, servers) {
        servers.forEach((server) => {
            menu.append(new MenuItem({
                label: server.getNameAtAddress(),
                click: () => $rootScope.$broadcast('connect:server', server),
                checked: server.id === $rootScope.$server.id,
                type: 'radio'
            }))
        })
    }

}]);