
export let dropDownController = ['$scope', function($scope) {
    $scope.options = [];

    this.add_option = function(title, value) {
        $scope.options.push({
            'title': title,
            'value': value
        });
        if(value === $scope.model) {
            this.update_title(value)
        };
    };

    this.remove_option = function(title, value) {
        for(var index in $scope.options)
            if($scope.options[index].value === value &&
                $scope.options[index].title === title) {

                $scope.options.splice(index, 1);
                // Remove only one item
                break;
            };
    };

    this.update_model = function(title, value) {
        if($scope.model !== value) {
            $scope.model = value;
        }
    };

    this.update_title = function(value) {
        var changed = false;

        for(var index in $scope.options)
            if($scope.options[index].value === value) {
                $scope.title = $scope.options[index].title;
                changed = true;
            }

        if(changed) {
            $scope.text_class = 'text';
        } else {
            $scope.title = $scope.original_title;
            $scope.text_class = 'default text';
        }
    };

    this.active = function(value) {
        return $scope.model === value;
    }

}]

export let dropdown = function() {
    return {
        restrict: 'E',
        replace: true,
        transclude: true,
        controller: 'DropDownController',
        scope: {
            title: '@',
            open: '@',
            model: '=ngModel',
            change: '&?ngChange'
        },
        template: '<div class="{{ dropdown_class }}">' +
            '<div class="{{text_class}}">{{ title }}</div>' +
            '<i class="dropdown icon"></i>' +
            '<div class="{{ menu_class }}"  ng-transclude>' +
            '</div>' +
            '</div>',
        link: function(scope, element, attrs, DropDownController: any) {
            scope.dropdown_class = 'ui selection dropdown';
            scope.menu_class = 'menu transition hidden';
            scope.text_class = 'default text';
            scope.original_title = scope.title;

            if(scope.open === 'true') {
                scope.is_open = true;
                scope.dropdown_class = scope.dropdown_class + ' active visible';
                scope.menu_class = scope.menu_class + ' visible';
            } else {
                scope.is_open = false;
            }

            /*
             * Watch for ng-model changing
             */
            scope.element = element;
            scope.$watch('model', function(value) {
                // update title or reset the original title if its empty
                DropDownController.update_title(value);
                if (scope.change) scope.change()
            });

            /*
             * Click handler
             */
            element.bind('click', function() {
                if(scope.is_open === false) {
                    scope.$apply(function() {
                        scope.dropdown_class = 'ui selection dropdown active visible';
                        scope.menu_class = 'menu transition visible';
                    });
                } else {
                    scope.$apply(function() {
                        scope.dropdown_class = 'ui selection dropdown';
                        scope.menu_class = 'menu transition hidden';
                    });
                }
                scope.is_open = !scope.is_open;
            });
        }
    };
}

export let dropdownGroup = function() {
    return {
        restrict: 'AE',
        replace: true,
        transclude: true,
        require: '^dropdown',
        scope: {
            title: '=title',
            value: '=value'
        },
        template: '<div class="item" ng-class="active()" ng-transclude>{{ item_title }}</div>',
        link: function(scope, element, attrs, DropDownController: any) {

            // Check if title= was set... if not take the contents of the dropdown-group tag
            // title= is for dynamic variables from something like ng-repeat {{variable}}
            if(scope.title === undefined) {
                scope.item_title = attrs.title || element.children()[0].innerHTML;
            } else {
                scope.item_title = scope.title;
            }
            if(scope.value === undefined) {
                scope.item_value = attrs.value || scope.item_title;
            } else {
                scope.item_value = scope.value;
            }

            scope.active = function() {
                if(DropDownController.active(scope.item_value)) {
                    return "selected active";
                }
            }

            // Keep this option
            DropDownController.add_option(scope.item_title, scope.item_value);

            //
            // Menu item click handler
            //
            element.bind('click', function() {
                DropDownController.update_model(scope.item_title, scope.item_value);
            });

            scope.$on('$destroy', function() {
                DropDownController.remove_option(scope.item_title, scope.item_value);
            });

        }
    };
};