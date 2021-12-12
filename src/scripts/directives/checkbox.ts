
export let toggleController = ['$scope', function($scope){

    if (angular.isFunction($scope.checked)) { $scope.ngModel = !!$scope.checked(); }

    this.toggle = function() {
        if (angular.isFunction($scope.disabled) && $scope.disabled()) return;
        $scope.ngModel = !$scope.ngModel;
    }

}]

export let toggle = function() {

    function controller() {
        // var vm = this;
        //
        // // TODO: assert this is usefull ?
        // // if(angular.isUndefined(vm.ngModel)) { vm.ngModel = !!vm.ngModel; }
        //
        // if (angular.isFunction(vm.checked)) { vm.ngModel = !!vm.checked(); }
        //
        // vm.toggle = function() {
        //     if (angular.isFunction(vm.disabled) && vm.disabled()) return;
        //     vm.ngModel = !vm.ngModel;
        // }



    }

    function link() {

    }

    return {
        restrict: 'E',
        replace: true,
        transclude: true,
        scope: {
            ngChange: '=?ngChange',
            checked: '&?',
            disabled: '&?',
            ngModel: '=ngModel'
        },
        controller: controller,
        controllerAs: 'vm',
        bindToController: true,
        require: 'ngModel',
        template: '<div class="ui toggle checkbox">' +
            '<input type="checkbox" ng-model="vm.ngModel" ng-change="vm.ngChange">' +
            '<label ng-transclude></label>' +
            '</div>',
        link: link
    };
};
