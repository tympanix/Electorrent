'use strict'

angular.module("torrentApp").directive('toggle', function() {

    function controller() {
        var vm = this;

        // TODO: assert this is usefull ?
        // if(angular.isUndefined(vm.ngModel)) { vm.ngModel = !!vm.ngModel; }

        if (angular.isFunction(vm.checked)) { vm.ngModel = !!vm.checked(); }

        vm.toggle = function() {
            if (angular.isFunction(vm.disabled) && vm.disabled()) return;
            vm.ngModel = !vm.ngModel;
        }
    }

    function link() {

    }

    return {
        restrict: 'E',
        replace: true,
        transclude: true,
        scope: {
            checked: '&?',
            disabled: '&?',
            ngModel: '=ngModel'
        },
        controller: controller,
        controllerAs: 'vm',
        bindToController: true,
        require: 'ngModel',
        template: '<div class="ui toggle checkbox">' +
            '<input type="checkbox" ng-model="vm.ngModel">' +
            '<label ng-transclude></label>' +
            '</div>',
        link: link
    };
});
