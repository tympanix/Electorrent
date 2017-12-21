angular.module("torrentApp").controller("themeController", ["$scope", "configService", function ($scope, $config) {
  let settings = $config.getAllSettings()
  $scope.theme = settings.ui.theme

  $scope.$on('new:settings', function(e, settings) {
    $scope.theme = settings.ui.theme || $scope.theme
  })
}]);
