
angular.module("torrentApp").controller("mainController", ["$scope", "utorrentService", "electron", "configService", function ($scope, $utorrentService, electron, config) {
    const PAGE_SETTINGS = 'settings';
    const PAGE_WELCOME = 'welcome';

    var showTorrents = false;
    var page = null;

    config.getServer().then(function(data){
        connectToServer(data.ip, data.port, data.user, data.password)
    }).catch(function(){
        // First time starting application
        page = 'welcome';
    })

    function connectToServer(ip, port, user, password){
        $utorrentService.connect(ip, port, user, password)
        .then(function(){
            pageTorrents();
            requestMagnetLinks();
        })
        .catch(function(){
            pageSettings();
        });
    }

    // Send a request to the main process for magnet links
    function requestMagnetLinks(){
        electron.ipc.send('send:magnets');
    }

    // Listen for incomming magnet links from the main process
    electron.ipc.on('magnet', function(event, data){
        data.forEach(function(magnet){
            $utorrentService.addTorrentUrl(magnet);
        })
    })

    function pageTorrents(){
        showTorrents = true;
        $scope.$broadcast('start:torrents');
        page = null;
    }

    function pageSettings(){
        page = PAGE_SETTINGS;
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
        console.info("#Show torrents!");
        pageTorrents();
    })

    $scope.showSettings = function(){
        return page === PAGE_SETTINGS;
    }

    $scope.showWelcome = function() {
        return page === PAGE_WELCOME;
    }

    $scope.showTorrents = function() {
        return showTorrents;
    }

}]);
