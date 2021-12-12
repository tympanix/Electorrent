
export let dropdown = [function() {
    return {
        restrict: 'A',
        link: link,
        scope: {
            ref: '=?',
            bind: '=?'
        }
    }

    function link(scope, element, attr) {

        let dropdown: any = $(element)

        dropdown.dropdown({
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
                let dropdown: any = $(element)
                dropdown.dropdown('set selected', newValue);
            }
        });

        function onChange(value /*, text, choice*/){
            if (scope.bind){
                scope.bind = value;
            }
        }

    }

    function doAction(element, action) {
        return function(param) {
            let dropdown: any = $(element)
            dropdown.dropdown(action, param);
        }
    }

}];

export let dropItem = [function() {
    return {
        restrict: 'A',
        link: link
    }

    function link(scope, element, attr) {
        if (scope.bind === attr.value){
            var dropdown: any = $(element).closest('.dropdown');
            dropdown.dropdown('set selected', attr.value);
        }

        if (scope.$last) {
            scope.$emit('update:dropdown');
        }
    }


}];
