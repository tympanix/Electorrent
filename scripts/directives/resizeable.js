angular.module("torrentApp").directive('resizeable', [function() {
    var minWidth = 24;

    var modeOverflow = false;
    var modeFixed = false;
    var modeBasic = false;
    var invalidMode = false;

    var columns = null;
    var table = null;
    var container = null;
    var resizer = null;
    var isFirstDrag = true;

    function link(scope, element, attr) {
        // Set global reference to table
        table = element;

        // Set global reference to container
        container = scope.container ? $(scope.container) : $(table).parent();

        // Add css styling/properties to table
        $(table).addClass('resize');

        // Initialise handlers, bindings and modes
        initialiseAll(table, attr, scope);

        // Bind utility functions to scope object
        bindUtilityFunctions(table, attr, scope)

        // Watch for mode changes and update all
        watchModeChange(table, attr, scope);
    }

    function bindUtilityFunctions(table, attr, scope) {
        if (scope.bind === undefined) return;
        scope.bind = {
            update: function() {
                cleanUpAll(table);
                initialiseAll(table, attr, scope);
            }
        }
    }

    function watchModeChange(table, attr, scope) {
        scope.$watch(function() {
            return scope.mode;
        }, function(newMode) {
            console.log("Update!", newMode);
            cleanUpAll(table);
            initialiseAll(table, attr, scope);
        });
    }

    function cleanUpAll(table) {
        cleanUpModes();
        resetTable(table);
        deleteHandles(table);
    }

    function cleanUpModes() {
        modeOverflow = false;
        modeFixed = false;
        modeBasic = false;
        invalidMode = false;
        isFirstDrag = true;
    }

    function resetTable(table) {
        $(table).width('100%');
        $(table).find('th').width('auto');
    }

    function deleteHandles(table) {
        $(table).find('th').find('.handle').remove();
    }

    function initialiseAll(table, attr, scope) {
        // Get all column headers
        columns = $(table).find('th');

        // Set the current resize mode
        setMode(attr, scope);

        // Do not inilitialise when mode is now known
        if (invalidMode) return;

        // Get the resizer object for the current mode
        resizer = getResizer();

        // Execute setup function for the given resizer mode
        if (resizer.setup) {
            resizer.setup();
        }

        // Initialise all handlers for every column
        columns.each(function(index, column) {
            initHandle(table, column);
        })

    }

    function setMode(attributes, scope) {
        if ('overflow' in attributes || scope.mode === 'overflow') {
            // Mode overflow
            modeOverflow = true;
        } else if ('fixed' in attributes || scope.mode === 'fixed') {
            // Mode fixed
            modeFixed = true;
        } else if ('basic' in attributes || scope.mode === 'basic') {
            // Mode basic
            modeBasic = true;
        } else {
            // Mode not regocnized :(
            invalidMode = true;
        }
    }

    function initHandle(table, column) {
        // Prepend a new handle div to the column
        var handle = $('<div>', {
            class: 'handle'
        });
        $(column).prepend(handle);

        // Make handle as tall as the table
        //$(handle).height($(table).height())

        var controlledColumn = column;
        if (resizer.handleMiddlware){
            controlledColumn = resizer.handleMiddlware(handle, column)
        }

        // Bind mousedown, mousemove & mouseup events
        bindEventToHandle(table, handle, controlledColumn);
    }

    function bindEventToHandle(table, handle, column) {

        // This event starts the dragging
        $(handle).mousedown(function(event) {
            if (isFirstDrag) {
                if (resizer.firstdrag) {
                    resizer.firstdrag(column, handle);
                    isFirstDrag = false;
                }
            }

            var optional = {}
            if (resizer.intervene) {
                optional = resizer.intervene.selector(column);
                optional.column = optional;
                optional.orgWidth = $(optional).width();
                console.log("Optional", optional);
            }

            // Prevent text-selection, object dragging ect.
            event.preventDefault();

            // Change css styles for the handle
            $(handle).addClass('active');

            // Show the resize cursor globally
            $('body').addClass('table-resize');

            // Get mouse and column origin measurements
            var orgX = event.clientX;
            var orgWidth = $(column).width();

            // On every mouse move, calculate the new width
            $(window).mousemove(calculateWidthEvent(column, orgX, orgWidth, optional))

            // Stop dragging as soon as the mouse is released
            $(window).one('mouseup', unbindEvent(handle))

        })
    }

    function calculateWidthEvent(column, orgX, orgWidth, optional) {
        return function(event) {
            // Get current mouse position
            var newX = event.clientX;

            // Use calculator function to calculate new width
            var diffX = newX - orgX;
            var newWidth = resizer.calculate(orgWidth, diffX);

            // Use restric function to abort potential restriction
            if (resizer.restrict(newWidth, minWidth)) return;

            // Extra optional column
            if (resizer.intervene){
                var optWidth = resizer.intervene.calculator(optional.orgWidth, diffX);
                if (resizer.intervene.restrict(optWidth, minWidth)) return;
                $(optional).width(optWidth)
            }

            // Set size
            $(column).width(newWidth);
        }
    }

    function getResizer() {
        if (modeOverflow) {
            return overflowResizer();
        } else if (modeFixed) {
            return fixedResizer();
        } else if (modeBasic) {
            return basicResizer();
        }
    }

    function overflowResizer() {

        function setup() {
            // Allow overflow in this mode
            $(container).css({
                overflow: 'auto'
            });
        }

        function firstdrag() {
            // Replace column's width with absolute measurements
            $(columns).each(function(index, column) {
                $(column).width($(column).width());
            })

            // For mode overflow, make table as small as possible
            $(table).width(1);
        }

        function calcOverflowWidth(orgWidth, diffX) {
            return orgWidth + diffX;
        }

        function restrict(newWidth, minWidth) {
            console.log("Base restric!");
            return newWidth < minWidth
        }

        return {
            setup: setup,
            restrict: restrict,
            calculate: calcOverflowWidth,
            firstdrag: firstdrag
        };
    }

    function fixedResizer() {
        var fixedColumn = $(table).find('th').first();
        var bound = false;

        function setup() {
            // Hide overflow in mode fixed
            $(container).css({
                overflowX: 'hidden'
            })

            // First column is auto to compensate for 100% table width
            $(columns).first().css({
                width: 'auto'
            });

            // Mode fixed does not require handler on last column
            columns = columns.not(':last');

            // For mode fixed, make table 100% width always
            $(table).width('100%');
        }

        function firstdrag( /*column, handle*/ ) {
            // Replace each column's width with absolute measurements
            $(table).find('th').not(':first')
                .each(function(index, column) {
                    $(column).width($(column).width());
                })
        }

        function handleMiddleware(handle, column){
            // Fixed mode handles always controll neightbour column
            return $(column).next();
        }

        function fixedRestrict(newWidth, minWidth) {
            if (bound) {
                if (newWidth < bound) {
                    $(fixedColumn).width('auto');
                    bound = false;
                    return false;
                } else {
                    return true;
                }
            } else if (newWidth < minWidth) {
                return true;
            } else if ($(fixedColumn).width() <= minWidth) {
                bound = newWidth;
                $(fixedColumn).width(minWidth);
                return true;
            }
        }

        function newWidth(orgWidth, diffX) {
            // Subtract difference - neightbour grows
            return orgWidth - diffX;
        }

        return {
            setup: setup,
            handleMiddlware: handleMiddleware,
            restrict: fixedRestrict,
            calculate: newWidth,
            firstdrag: firstdrag
        };
    }

    function basicResizer() {

        function setup() {
            // Hide overflow
            $(container).css({
                overflowX: 'hidden'
            })

            // Make table 100% width always
            $(table).width('100%');

            columns = $(columns).not(':last');
        }

        function firstdrag( /*column, handle*/ ) {
            // Replace each column's width with absolute measurements
            $(table).find('th').each(function(index, column) {
                $(column).width($(column).width());
            })
        }

        function calcOverflowWidth(orgWidth, diffX) {
            return orgWidth + diffX;
        }

        function restrict(newWidth, minWidth) {
            return newWidth < minWidth
        }

        function intervene() {

            function selector(column) {
                return $(column).next()
            }

            function calculator(orgWidth, diffX) {
                return orgWidth - diffX;
            }

            function restrict(newWidth, minWidth){
                return newWidth < minWidth;
            }

            return {
                selector: selector,
                calculator: calculator,
                restrict: restrict
            }
        }

        function enddrag() {
            var totWidth = $(table).outerWidth();

            var totPercent = 0;

            $(table).find('th').each(function(index, column) {
                var colWidth = $(column).outerWidth();
                var percentWidth = colWidth / totWidth * 100 + '%';
                totPercent += (colWidth / totWidth * 100);
                $(column).css({ width: percentWidth });
            })

            console.log("Total percent", totPercent);
        }

        return {
            setup: setup,
            restrict: restrict,
            calculate: calcOverflowWidth,
            firstdrag: firstdrag,
            enddrag: enddrag,
            intervene: intervene()
        };
    }

    function unbindEvent(handle) {
        // Event called at end of drag
        return function( /*event*/ ) {
            $(handle).removeClass('active');
            $(window).unbind('mousemove');
            $('body').removeClass('table-resize');

            if (resizer.enddrag) {
                resizer.enddrag();
            }
        }
    }

    // Return this directive as a object literal
    return {
        restrict: 'A',
        link: link,
        scope: {
            mode: '=',
            bind: '=',
            container: '@'
        }
    };

}]);
