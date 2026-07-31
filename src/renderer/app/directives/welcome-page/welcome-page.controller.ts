export class WelcomePageController {
    static $inject = ["$scope", "$timeout", "$bittorrent", "$btclients", "settingsService", "notificationService", "Server"];

    constructor(
        $scope: any,
        $timeout: angular.ITimeoutService,
        $bittorrent: any,
        $btclients: any,
        settingsService: any,
        $notify: any,
        Server: any,
    ) {
        $scope.connecting = false;
        $scope.btclients = $btclients;
        $scope.server = new Server();
        function clearForm() {
            $scope.server = new Server();
        }

        $scope.connect = () => {
            $scope.connecting = true;

            $scope.server.connect().then(() => {
                return settingsService.saveServer($scope.server);
            }).then(() => {
                $scope.$emit("connect:server", $scope.server);
                clearForm();
                $notify.ok("Success!", "Hooray! Welcome to Electorrent");
            }).catch((err: unknown) => {
                console.error(err);
            }).finally(() => {
                $scope.connecting = false;
            });
        };

    }
}
