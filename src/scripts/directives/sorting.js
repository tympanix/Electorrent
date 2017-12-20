angular.module("torrentApp").directive('sorting', ['$window', function($window) {

    return {
        restrict: 'A',
        bindToController: true,
        scope: {
            mode: '=',
            sorting: '='
        },
        controller: controller,
        link: link
    };

    function controller() {
        
        this.updateSettings = function() {
            this.sortKey = getSavedSortKey(this)
            this.sortOrder = getSavedSortOrder(this)
        }

        this.save = function(key, order) {
            $window.localStorage.setItem('sort_key.'+this.mode, key);
            $window.localStorage.setItem('sort_desc.'+this.mode, order);
        }

        this.updateSettings()

    }

    function link(scope, element, attr, ctrl) {
        function update(){
            $(element).find('*[sort]').each(function(i, col){
                var scope = angular.element(col).scope()
                scope.update()
            })
        }

        scope.$watch(function() {
            return ctrl.mode
        }, function(newMode, oldMode) {
            if (newMode !== oldMode) {
                ctrl.updateSettings()
                update()
            }
        })
    }

    function getSavedSortKey(ctrl) {
        let sortKey = $window.localStorage.getItem('sort_key.'+ctrl.mode);
        if (!sortKey || typeof sortKey !== 'string') {
            return 'dateAdded';
        } else {
            return sortKey
        }
    }

    function getSavedSortOrder(ctrl) {
        let sortOrder = $window.localStorage.getItem('sort_desc.'+ctrl.mode);
        if (!sortOrder) {
            return true;
        } else {
            return (sortOrder === 'true');
        }
    }

}]);

angular.module("torrentApp").directive('sort', [function() {

    return {
        restrict: 'A',
        require: '^^sorting',
        scope: false,
        link: link
    };

    function link(scope, element, attr, ctrl) {
        scope.sort = scope.$eval(attr.sort);

        scope.update = function() {
            if (scope.sort === ctrl.sortKey) {
                setSortingArrow(scope, column, ctrl, ctrl.sortOrder);
                ctrl.sorting(scope.sort, ctrl.sortOrder);
            }
        }

        var column = $(element);
        column.append('<i class="ui sorting icon"></i>');
        bindSortAction(scope, column, ctrl);
        scope.update()
    }

    function bindSortAction(scope, element, ctrl) {
        var isDragging = false

        element.mousedown(function() {
            $(window).one('mousemove', function() {
                isDragging = true;
            });
        })

        element.mouseup(function() {
            var wasDragging = isDragging;
            isDragging = false;
            $(window).off("mousemove");
            if(!wasDragging) {
                showSortingArrows(scope, element, ctrl);
            }
        });
    }

    function showSortingArrows(scope, element, ctrl) {
        if(element.is('.sortdown, .sortup')) {
            element.toggleClass('sortdown sortup');
        } else {
            if (ctrl.last) ctrl.last.removeClass('sortdown sortup');
            element.addClass('sortdown')
            ctrl.last = element;
        }

        var desc = element.hasClass('sortdown');
        ctrl.sorting(scope.sort, desc);
        ctrl.save(scope.sort, desc);
    }

    function setSortingArrow(scope, element, ctrl, sortDesc) {
        if (ctrl.last) ctrl.last.removeClass('sortdown sortup');

        if (sortDesc === true) {
            element.addClass('sortdown')
        } else if (sortDesc === false) {
            element.addClass('sortup')
        } else {
            element.removeClass('sortdown sortup')
        }

        ctrl.last = element;
    }

}]);