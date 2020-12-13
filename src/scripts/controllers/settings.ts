angular.module("torrentApp").controller("settingsController", ["$rootScope", "$scope", "$injector", "$q", "$bittorrent", "$btclients", "configService", "notificationService", "electron", function($rootScope, $scope, $injector, $q, $bittorrent, $btclients, config, $notify, electron) {

    let serverCopy

    // External Settings reference
    $scope.settings = {};

    $scope.server = {}

    $scope.themes = electron.themes()

    $scope.btclients = $btclients;

    $scope.is = electron.is;

    // Internal settings reference
    $scope.general = {
        magnet: false
    }

    $scope.renameData = {
      server: undefined,
      name: "",
      reset: function() {
        this.name = this.server.getNameAtAddress()
      }
    }

    $scope.appVersion = electron.app.getVersion()
    $scope.nodeVersion = process.versions.node;
    $scope.chromeVersion = process.versions.chrome;
    $scope.electronVersion = process.versions.electron;

    $scope.connecting = false;
    $scope.page = 'general';

    $scope.layoutSortOptions = {
        handle: '.sort.handle',
        'ui-floating': true
    }

    loadAllSettings();

    function loadAllSettings() {
        $scope.settings = config.getAllSettingsCopy();
        loadServerReference()

        serverCopy = angular.copy($scope.server)

        $scope.general = {
            magnets: electron.app.isDefaultProtocolClient('magnet')
        }
    }

    function loadServerReference() {
      if ($rootScope.$server) {
        $scope.server = $scope.settings.servers.find(function(s) {
          return s.id === $rootScope.$server.id
        });
      }
    }

    function subscribeToMagnets() {
        if ($scope.general.magnets) {
            electron.app.setAsDefaultProtocolClient('magnet');
        } else {
            electron.app.removeAsDefaultProtocolClient('magnet');
        }
    }

    $scope.$on('setting:load', function() {
        console.info("Loading settings");
        loadAllSettings();
    })

    function writeSettings() {
        return config.saveAllSettings($scope.settings)
        .then(function() {
            subscribeToMagnets();
        }).catch(function(err) {
            $notify.alert("Settings could not be saved", err)
            return $q.reject(err)
        })
    }

    $scope.setPath = function() {
      if ($scope.pathPristine) {
        $scope.server.setPath()
      }
    }

    $scope.openRenameModal = function(server) {
      $scope.renameData.server = server
      $scope.renameData.name = server.getDisplayName()
      let modal: any = $('#renameModal')
      modal.modal('show');
    }

    $scope.renameServer = function() {
      if (!$scope.renameData.name) {
        return false
      }
      $scope.renameData.server.name = $scope.renameData.name
      config.renderServerMenu()
      return true
    }

    $scope.moveServerUp = function(server) {
      var index = $scope.settings.servers.indexOf(server)
      if (index && index > 0) {
        var tmp = $scope.settings.servers[index-1]
        $scope.settings.servers[index-1] = server
        $scope.settings.servers[index] = tmp
      }
    }

    $scope.resetPath = function() {
      $scope.server.setPath()
      $scope.pathPristine = true
    }

    $scope.lockPath = function() {
      $scope.pathPristine = false
    }

    $scope.close = function() {
        if ($scope.server.isConnected) {
            $scope.$emit('show:torrents');
            loadAllSettings();
        } else {
            $scope.$emit('show:servers')
        }
    }

    function saveServer() {
        if ($scope.server.equals(serverCopy) && $scope.server.isConnected) return
        serverCopy = angular.copy($scope.server)
        $scope.connecting = true;
        return $scope.server.connect().then(function() {
            return config.updateServer($scope.server)
        })
    }

    $scope.save = function() {
        $scope.$emit('loading', 'Applying Settings')

        $q.when().then(function() {
            return saveServer()
        }).then(function() {
            return writeSettings()
        }).then(function() {
            $scope.close();
            config.renderServerMenu()
            $rootScope.$broadcast('new:settings', $scope.settings)
            $notify.ok("Saved Settings", "Your settings have been updated")
        }).catch(function(err) {
            $scope.$emit('hide:loading')
            console.error("Settings Error", err);
        }).finally(function() {
            $scope.connecting = false;
        })
    }

    $scope.activeOn = function(page) {
        var value = '';
        if ($scope.page === page) value = 'active';
        return value;
    }

    $scope.toggleDefaultServer = function(server) {
        if (server.default === true) {
            $scope.settings.servers.forEach(function(_server) {
                if (server !== _server) {
                    _server.default = false;
                }
            })
        }
    }

    $scope.removeServer = function(server) {
        if ($rootScope.$server.id === server.id) {
            $notify.alert('Server in use', 'Can\'t remove a server that is currently being used')
        } else {
            $scope.settings.servers = $scope.settings.servers.filter((s) => {
                return s.id !== server.id
            })
        }
    }

    $scope.gotoPage = function(page) {
        $scope.page = page;
    }

    $scope.$on('settings:page', function(event, page, force){
        $scope.force = force || false
        $scope.gotoPage(page);
    })

}]);
