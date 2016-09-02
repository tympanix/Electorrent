angular.module("torrentApp").directive('sorting', ['configService', function(config) {

    var $last;
    var $sort;

    return {
        restrict: 'A',
        scope: true,
        link: link
    };

    function link(scope, element, attr) {
        $sort = scope.$parent.$eval(attr.sorting);

        $(element).find('th').each(function(index, element) {
            var column = $(element);
            column.append('<i class="ui sorting icon"></i>');
            bindSortAction(column);
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
            $sort(element.attr('sort'), element.hasClass('sortdown'))
        } else {
            if($last) $last.removeClass('sortdown sortup');
            element.addClass('sortdown')
            $sort(element.attr('sort'), true)
            $last = element;
        }
    }

}]);