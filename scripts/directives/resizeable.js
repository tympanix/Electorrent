angular.module("torrentApp").directive('resizeable', ["$timeout", function($timeout) {
    var minWidth = 24;

    var modeOverflow = false;
    var modeFixed = false;
    var invalidMode = false;

    var columns = null;
    var table = null;
    var resizer = null;

    function link(scope, element, attr){

        $timeout(function(){
            // Set global reference to table
            table = element;

            // Add css styling/properties to table
            $(table).addClass('resize');

            // Initialise handlers, bindings and modes
            initialiseAll(table, attr, scope);

            // Bind utility functions to scope object
            bindUtilityFunctions(table, attr, scope)

            // Watch for mode changes and update all
            watchModeChange(table, attr, scope);
        }, 100)
    }

    function bindUtilityFunctions(table, attr, scope){
        if (scope.bind === undefined) return;
        scope.bind = {
            update: function(){
                cleanUpAll(table);
                initialiseAll(table, attr, scope);
            }
        }
    }

    function watchModeChange(table, attr, scope){
        scope.$watch(function() {return scope.mode; }, function(newMode){
            console.log("Update!", newMode);
            cleanUpAll(table);
            initialiseAll(table, attr, scope);
        });
    }

    function cleanUpAll(table){
        cleanUpModes();
        resetTable(table);
        deleteHandles(table);
    }

    function cleanUpModes(){
        modeOverflow = false;
        modeFixed = false;
        invalidMode = false;
    }

    function resetTable(table){
        $(table).width('100%');
        $(table).find('th').width('auto');
    }

    function deleteHandles(table){
        $(table).find('th').find('.handle').remove();
    }

    function initialiseAll(table, attr, scope){
        // Get all column headers
        columns = $(table).find('th');

        // Set the current resize mode
        setMode(attr, scope);

        // Do not inilitialise when mode is now known
        if (invalidMode) return;

        // Get the resizer object for the current mode
        resizer = getResizer();

        // Execute setup function for the given resizer mode
        if (resizer.setup){
            resizer.setup();
        }

        // Initialise all handlers for every column
        columns.each(function(index, column){
            initHandle(table, column);
        })

        // At last, execute the resizer finish function
        if (resizer.finish){
            resizer.finish();
        }

    }

    function setMode(attributes, scope){
        if ('overflow' in attributes || scope.mode === 'overflow'){
            // Mode overflow
            modeOverflow = true;
        } else if ('fixed' in attributes || scope.mode === 'fixed') {
            // Mode fixed
            modeFixed = true;
        } else {
            // Mode not regocnized :(
            invalidMode = true;
        }
    }

    function initHandle(table, column){
        // Prepend a new handle div to the column
        var handle = $('<div>', {class: 'handle'});
        $(column).prepend(handle);

        // Make handle as tall as the table
        $(handle).height($(table).height())

        var controlledColumn = column;
        if (modeFixed) {
            // Fixed mode handlers always control
            // neighbour columns instead of itself
            controlledColumn = $(column).next();
        }

        // Bind mousedown, mousemove & mouseup events
        bindEventToHandle(table, handle, controlledColumn);
    }

    function bindEventToHandle(table, handle, column){
        // Replace column's width with absolute measurements
        $(column).width($(column).width())

        // This event starts the dragging
        $(handle).mousedown(function(event){
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
            $(window).mousemove(calculateWidthEvent(column, orgX, orgWidth, resizer.restrict, resizer.calculate))

            // Stop dragging as soon as the mouse is released
            $(window).one('mouseup', unbindEvent(handle))

        })
    }

    function calculateWidthEvent(column, orgX, orgWidth, restrict, calculator){
        return function(event){
            // Get current mouse position
            var newX = event.clientX;

            // Use calculator function to calculate new width
            var diffX = newX - orgX;
            var newWidth = calculator(orgWidth, diffX);

            // Use restric function to abort potential restriction
            if (restrict(newWidth, minWidth)) return;
            $(column).width(newWidth);
        }
    }

    function getResizer(){
        if (modeOverflow){
            return overflowResizer();
        } else if (modeFixed){
            return fixedResizer();
        }
    }

    function overflowResizer(){

        function setup(){
            // Allow overflow in this mode
            $(table).parent().css({ overflow: 'auto'});
        }

        function finish(){
            // For mode overflow, make table as small as possible
            $(table).width(1);
        }

        function calcOverflowWidth(orgX, orgWidth){
            return orgX + orgWidth;
        }

        function restrict(newWidth, minWidth){
            console.log("Base restric!");
            return newWidth < minWidth
        }

        return {
            setup: setup,
            restrict: restrict,
            calculate: calcOverflowWidth,
            finish: finish
        };
    }

    function fixedResizer(){
        var fixedColumn = $(table).find('th').first();
        var bound = false;

        function setup(){
            // Hide overflow in mode fixed
            $(table).parent().css({ overflowX: 'hidden'})

            // First column is auto to compensate for 100% table width
            $(columns).first().css({ width: 'auto' });

            // Mode fixed does not require handler on last column
            columns = columns.not(':last');
        }

        function finish(){
            // For mode fixed, make table 100% width always
            $(table).width('100%');
        }

        function fixedRestrict(newWidth, minWidth){
            if (bound){
                if (newWidth < bound){
                    $(fixedColumn).width('auto');
                    bound = false;
                    return false;
                } else {
                    return true;
                }
            } else if (newWidth < minWidth){
                return true;
            } else if ($(fixedColumn).width() <= minWidth) {
                console.log("Bound!");
                bound = newWidth;
                $(fixedColumn).width(minWidth);
                return true;
            }
        }

        function newWidth(orgX, orgWidth){
            return orgX - orgWidth;
        }

        return {
            setup: setup,
            restrict: fixedRestrict,
            calculate: newWidth,
            finish: finish
        };
    }

    function unbindEvent(handle){
        // Event called at end of drag
        return function(/*event*/){
            $(handle).removeClass('active');
            $(window).unbind('mousemove');
            $('body').removeClass('table-resize');
        }
    }

    // Return this directive as a object literal
    return {
        restrict: 'A',
        link: link,
        scope: {
            mode: '=',
            bind: '='
        }
    };

}]);
