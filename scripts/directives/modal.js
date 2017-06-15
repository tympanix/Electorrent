angular.module('torrentApp').directive('modal', function() {
    return {
        templateUrl: template,
        replace: true,
        transclude: true,
        scope: {
            title: '@',
            btnOk: '@',
            btnCancel: '@',
            icon: '@',
            approve: '&',
            deny: '&',
            data: '='
        },
        restrict: 'E',
        link: link
    };

    function template(elem, attrs) {
        return attrs.templateUrl || 'some/path/default.html'
    }

    function link(scope, element/*, attrs*/) {
        $(element).modal({
            onDeny: function () {
                return scope.deny();
            },
            onApprove: function () {
                return scope.approve();
            },
            onHidden: function () {
                clearForm(element);
            },
            closable: false,
            duration: 150
        });

        scope.applyAndClose = function() {
          if (scope.approve()) {
            $(element).modal('hide')
          }
        }

        scope.$on("$destroy", function() {
            element.remove();
        });
    }

    function clearForm(element){
        $(element).form('clear');
        $(element).find('.error.message').empty()
    }

});
