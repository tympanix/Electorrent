
angular.module("torrentApp").controller("mainController", ["$rootScope", "$scope", "$timeout", "$bittorrent", "electron", "configService", "notificationService", function ($rootScope, $scope, $timeout, $bittorrent, electron, config, $notify) {
    const PAGE_SETTINGS = 'settings';
    const PAGE_WELCOME = 'welcome';
    const PAGE_SERVERS = 'servers';

    let settings = config.getAllSettings()
    $scope.servers = config.getServers()

    $scope.showTorrents = false;
    $scope.showLoading = true;
    $scope.statusText = "Loading";
    var page = null;

    $rootScope.$on('ready', function() {
        if (!electron.program.debug) {
            electron.updater.checkForUpdates();
        }

        if (!settings.servers.length) {
            pageWelcome();
            return;
        }

        if (settings.startup === 'default') {
            let server = config.getDefaultServer()
            if (server){
                connectToServer(server);
            } else {
                pageServers();
                $notify.ok('No default server', 'Please choose a server to connect to')
            }
        } else if (settings.startup === 'latest') {
            let server = config.getRecentServer()
            if (server){
                connectToServer(server)
            } else {
                pageServers()
                $notify.ok('No recent servers', 'Please choose a server to connect to')
            }
        } else {
            /* Ask or unknown*/
            pageServers()
        }
    });

    $scope.connectToServer = function(server) {
        connectToServer(server)
    }

    function connectToServer(server){
        pageLoading()
        $bittorrent.setServer(server)
        $scope.statusText = "Connecting to " + $rootScope.$btclient.name;

        $rootScope.$btclient.connect(server.ip, server.port, server.user, server.password)
        .then(function(){
            $scope.statusText = "Loading Torrents"
            pageTorrents();
            requestMagnetLinks();
            requestTorrentFiles();
        }).catch(function(){
            pageSettings('connection');
        }).finally(function() {
            config.renderServerMenu()
        });
    }

    // Send a request to the main process for magnet links
    function requestMagnetLinks(){
        electron.ipc.send('send:magnets');
    }

    function requestTorrentFiles() {
        electron.ipc.send('send:torrentfiles')
    }

    // Listen for incomming magnet links from the main process
    electron.ipc.on('magnet', function(event, data){
        data.forEach(function(magnet){
            $rootScope.$btclient.addTorrentUrl(magnet);
        })
    })

    // Listen for incomming torrent files from the main process
    electron.ipc.on('torrentfiles', function uploadTorrent(event, buffer, filename){
        $rootScope.$btclient.uploadTorrent(buffer, filename).catch(function(err) {
            $notify.alert('Upload Torrent', 'The torrent could not be uploaded')
            console.error("Error", err);
        })
    })

    function pageTorrents(){
        $scope.showTorrents = true;
        //$scope.showLoading = false;
        $scope.$broadcast('start:torrents');
        page = null;
    }

    function pageLoading() {
        $scope.showLoading = true;
    }

    function pageSettings(settingsPage){
        $scope.showLoading = false;
        if (settingsPage){
            $scope.$broadcast('settings:page', settingsPage);
        }
        page = PAGE_SETTINGS;
    }

    function pageServers() {
        $scope.showLoading = false;
        $scope.showTorrents = false;
        page = PAGE_SERVERS;
    }

    function pageWelcome(){
        $scope.showLoading = false;
        page = PAGE_WELCOME;
    }

    $scope.$on('add:server', function() {
        $scope.$broadcast('stop:torrents')
        $rootScope.$btclient = null
        pageWelcome()
        $scope.$apply();
    })

    $scope.$on('connect:server', function(event, server) {
        console.log("Connecting to server", server.getNameAtAddress());
        $scope.statusText = "Connecting to " + server.getName();
        $scope.$broadcast('stop:torrents')
        pageLoading()

        $timeout(function() {
            $scope.$broadcast('wipe:torrents')
            $rootScope.$btclient = null
            $rootScope.$server = null
            $bittorrent.setServer(server)
            connectToServer(server)
            $scope.$broadcast('start:torrents', true) // Full update
        }, 50)
        $scope.$apply();
    })

    $scope.$on('show:settings', function() {
        if (page === PAGE_WELCOME) return;
        if (page === PAGE_SERVERS) return;
        page = PAGE_SETTINGS;
        $scope.$apply();
    })

    $scope.$on('hide:loading', function() {
        $scope.showLoading = false;
    })

    $scope.$on('show:welcome', function() {
        page = PAGE_WELCOME;
        $scope.$apply();
    })

    $scope.$on('show:torrents', function(){
        pageTorrents();
    })

    $scope.$on('emit:new:settings', function(event, data) {
        $scope.$broadcast('new:settings', data)
    })

    $scope.showSettings = function(){
        return page === PAGE_SETTINGS;
    }

    $scope.showWelcome = function() {
        return page === PAGE_WELCOME;
    }

    $scope.showServers = function() {
        return page === PAGE_SERVERS;
    }

}]);
