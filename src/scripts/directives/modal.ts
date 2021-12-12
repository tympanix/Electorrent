
export let modal = function() {
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
            hidden: '&',
            show: '&',
            after: '=',
            data: '=',
        },
        restrict: 'E',
        link: link
    };

    function template(elem, attrs) {
        return attrs.templateUrl || 'some/path/default.html'
    }

    function link(scope, element/*, attrs*/) {
        var accepted = false

        let modal: any = $(element)

        modal.modal({
            onDeny: function () {
                accepted = false
                return scope.deny()
            },
            onApprove: function () {
                accepted = true
                return scope.approve()
            },
            onHidden: function () {
                clearForm(element)
                scope.after && scope.after(accepted)
                return scope.hidden()
            },
            onShow: function() {
                accepted = false
                scope.show()
            },
            onVisible: function() {
                modal.modal('refresh')
            },
            closable: false,
            duration: 150
        });

        scope.applyAndClose = function() {
          if (scope.approve()) {
            modal.modal('hide')
          }
        }

        scope.$on("$destroy", function() {
            element.remove();
        });
    }

    function clearForm(element){
        let form: any = $(element)
        form.form('clear');
        form.find('.error.message').empty()
    }

};

