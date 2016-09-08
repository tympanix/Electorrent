
angular.module("torrentApp").controller("mainController", ["$rootScope", "$scope", "$timeout", "$bittorrent", "electron", "configService", function ($rootScope, $scope, $timeout, $bittorrent, electron, config) {
    const PAGE_SETTINGS = 'settings';
    const PAGE_WELCOME = 'welcome';

    $scope.showTorrents = false;
    $scope.showLoading = true;
    $scope.statusText = "Loading";
    var page = null;

    $rootScope.$on('ready', function() {
        electron.updater.checkForUpdates();

        if (!$scope.$btclient) {
            pageWelcome();
            return;
        }

        var data = config.getServer()
        if (data){
            connectToServer(data.ip, data.port, data.user, data.password);
        } else {
            // First time starting application
            pageWelcome();
        }
    });

    function connectToServer(ip, port, user, password){
        $scope.statusText = "Connecting to " + $scope.$btclient.name;

        $scope.$btclient.connect(ip, port, user, password)
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
            $scope.$btclient.addTorrentUrl(magnet);
        })
    })

    // Listen for incomming torrent files from the main process
    electron.ipc.on('torrentfiles', function uploadTorrent(event, buffer, filename){
        $scope.$btclient.uploadTorrent(buffer, filename)
            .then(function(data) {
                console.log("Upload", data);
            }).catch(function(err) {
                console.error("Error", err);
            })
    })

    function pageTorrents(){
        $scope.showTorrents = true;
        $scope.showLoading = false;
        $scope.$broadcast('start:torrents');
        page = null;
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

    $scope.$on('show:settings', function() {
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
        //event.stopPropagation();
        console.log("Main recieved new settings", data);
        $scope.$broadcast('new:settings', data)
    })

    $scope.showSettings = function(){
        return page === PAGE_SETTINGS;
    }

    $scope.showWelcome = function() {
        return page === PAGE_WELCOME;
    }

}]);
