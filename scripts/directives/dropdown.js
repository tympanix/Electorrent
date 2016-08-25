angular.module("torrentApp").directive('dropdown', [function() {
    return {
        restrict: 'A',
        link: link,
        scope: {
            ref: '=?',
            bind: '=?'
        }
    }

    function link(scope, element, attr) {

        $(element).dropdown({
            transition: "vertical flip",
            duration: 100,
            onChange: onChange,
            action: 'hide'
        });

        if ('ref' in attr){
            scope.ref = {
                clear: doAction(element, 'clear'),
                refresh: doAction(element, 'refresh'),
                setSelected: doAction(element, 'set selected'),
                getValue: doAction(element, 'get value')
            };
        }

        scope.$watch(function() {
            return scope.bind;
        }, function(newValue) {
            if (newValue) {
                $(element).dropdown('set selected', newValue);
            }
        });

        function onChange(value /*, text, choice*/){
            if (scope.bind){
                scope.bind = value;
            }
        }

        // scope.$on('update:dropdown', function() {
        //     console.log("UPDATING DROPDOWN!");
        // });

    }

    function doAction(element, action) {
        return function(param) {
            $(element).dropdown(action, param);
        }
    }

}]);

angular.module("torrentApp").directive('dropItem', [function() {
    return {
        restrict: 'A',
        link: link
    }

    function link(scope, element, attr) {
        console.log("Item", attr.value, scope);
        if (scope.bind === attr.value){
            var dropdown = $(element).closest('.dropdown');
            dropdown.dropdown('set selected', attr.value);
        }

        if (scope.$last) {
            console.log("Last item", attr.value);
            scope.$emit('update:dropdown');
        }
    }


}]);
