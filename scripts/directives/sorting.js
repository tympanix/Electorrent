angular.module("torrentApp").directive('sorting', ['$window', function($window) {

    var $last;
    var $sort;

    var sortKey;
    var sortOrder;

    return {
        restrict: 'A',
        scope: true,
        link: link
    };

    function link(scope, element, attr) {
        $sort = scope.$parent.$eval(attr.sorting);

        load();

        $(element).find('th').each(function(index, element) {
            var column = $(element);
            var colSort = column.attr('sort');
            column.append('<i class="ui sorting icon"></i>');
            bindSortAction(column);

            if (colSort === sortKey) {
                console.log("Default sort:", sortKey, sortOrder);
                setSortingArrow(column, sortOrder);
                $sort(sortKey, sortOrder);
            }
        });

    }

    function bindSortAction(element) {
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
                showSortingArrows(element);
            } else {
                console.error("Was dragging!");
            }
        });
    }

    function showSortingArrows(element) {
        if(element.is('.sortdown, .sortup')) {
            element.toggleClass('sortdown sortup');
        } else {
            if ($last) $last.removeClass('sortdown sortup');
            element.addClass('sortdown')
            $last = element;
        }

        var sort = element.attr('sort');
        var desc = element.hasClass('sortdown');
        $sort(sort, desc);
        save(sort, desc);
    }

    function setSortingArrow(element, sortDesc) {
        if ($last) $last.removeClass('sortdown sortup');

        if (sortDesc === true) {
            element.addClass('sortdown')
        } else if (sortDesc === false) {
            element.addClass('sortup')
        } else {
            element.removeClass('sortdown sortup')
        }

        $last = element;
    }

    function save(sort, desc) {
        $window.localStorage.setItem('sort_key', sort);
        $window.localStorage.setItem('sort_desc', desc);
    }

    function load() {
        sortKey = $window.localStorage.getItem('sort_key');
        sortOrder = $window.localStorage.getItem('sort_desc');

        if (!sortOrder) {
            console.log("Sort order init to true");
            sortOrder = true;
        } else {
            sortOrder = (sortOrder === 'true');
        }

        if (typeof sortKey !== 'string') {
            sortKey = 'dateAdded';
        }
    }

}]);