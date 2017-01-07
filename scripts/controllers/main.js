
angular.module("torrentApp").controller("mainController", ["$rootScope", "$scope", "$timeout", "$bittorrent", "electron", "configService", function ($rootScope, $scope, $timeout, $bittorrent, electron, config) {
    const PAGE_SETTINGS = 'settings';
    const PAGE_WELCOME = 'welcome';

    $scope.showTorrents = false;
    $scope.showLoading = true;
    $scope.statusText = "Loading";
    var page = null;

    $rootScope.$on('ready', function() {
        if (!electron.program.debug) {
            electron.updater.checkForUpdates();
        }

        if (!$scope.$btclient) {
            pageWelcome();
            return;
        }

        var data = config.getDefaultServer()
        console.log("Default server", data)
        if (data){
            connectToServer(data.ip, data.port, data.user, data.password);
        } else {
            // First time starting application
            pageWelcome();
        }
    });

    function connectToServer(ip, port, user, password){
        $scope.statusText = "Connecting to " + $rootScope.$btclient.name;

        $rootScope.$btclient.connect(ip, port, user, password)
        .then(function(){
            pageTorrents();
            requestMagnetLinks();
        })
        .catch(function(){
            pageSettings('connection');
        });
    }

    // Send a request to the main process for magnet links
    function requestMagnetLinks(){
        electron.ipc.send('send:magnets');
    }

    // Listen for incomming magnet links from the main process
    electron.ipc.on('magnet', function(event, data){
        data.forEach(function(magnet){
            $rootScope.$btclient.addTorrentUrl(magnet);
        })
    })

    // Listen for incomming torrent files from the main process
    electron.ipc.on('torrentfiles', function uploadTorrent(event, buffer, filename){
        $rootScope.$btclient.uploadTorrent(buffer, filename)
            .catch(function(err) {
                console.error("Error", err);
            })
    })

    function pageTorrents(){
        $scope.showTorrents = true;
        $scope.showLoading = false;
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
        pageLoading()
        $scope.$broadcast('stop:torrents')
        $scope.$broadcast('clear:torrents')
        $rootScope.$btclient = null
        $rootScope.$server = null
        $bittorrent.setServer(server)

        $timeout(function() {
            connectToServer(server.ip, server.port, server.user, server.password)
            $scope.$broadcast('start:torrents', true) // Full update
        }, 250)
        $scope.$apply();
    })

    $scope.$on('show:settings', function() {
        if (page === PAGE_WELCOME) return;
        page = PAGE_SETTINGS;
        $scope.$apply();
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

}]);
