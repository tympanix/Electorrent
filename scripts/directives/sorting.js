angular.module("torrentApp").directive('sorting', ['$window', function($window) {

    return {
        restrict: 'A',
        bindToController: true,
        scope: {
            sorting: '='
        },
        controller: controller
    };

    function controller() {
        console.log("Sorting func main", this.sorting);

        this.sortKey = getSavedSortKey()
        this.sortOrder = getSavedSortOrder()

        this.save = function(key, order) {
            $window.localStorage.setItem('sort_key', key);
            $window.localStorage.setItem('sort_desc', order);
        }
    }

    function getSavedSortKey() {
        let sortKey = $window.localStorage.getItem('sort_key');
        if (!sortKey || typeof sortKey !== 'string') {
            return 'dateAdded';
        } else {
            return sortKey
        }
    }

    function getSavedSortOrder() {
        let sortOrder = $window.localStorage.getItem('sort_desc');
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
        scope: {
            sort: '='
        },
        link: link
    };

    function link(scope, element, attr, ctrl) {

        console.log('Scope', scope);
        console.log('Sort func', ctrl.sorting)
        console.log('Element', element);
        console.log('Controller', ctrl);
        console.log('Sort by', ctrl.sortKey);
        console.log('Sort order', ctrl.sortOrder);

        var column = $(element);
        column.append('<i class="ui sorting icon"></i>');
        bindSortAction(scope, column, ctrl);

        if (scope.sort === ctrl.sortKey) {
            setSortingArrow(scope, column, ctrl, ctrl.sortOrder);
            ctrl.sorting(scope.sort, ctrl.sortOrder);
        }

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