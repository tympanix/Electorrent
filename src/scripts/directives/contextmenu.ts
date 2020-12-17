angular.module("torrentApp").directive('contextMenu', ['$rootScope', '$document', '$window', 'electron', function($rootScope, $document, $window, electron) {

    var contextMenu = null;
    var checkboxes = []

    return {
        restrict: 'E',
        scope: {
            menu: '=',
            bind: '=',
            click: '=',
            debug: '=?'
        },
        compile: compile
    };

    function compile(element) {
        contextMenu = element;
        element.addClass('torrent context menu');
        return link;
    }

    function render(scope, element, attr?){
        if (!scope.menu) return;

        element.empty();
        checkboxes = []

        var list = angular.element('<div class="ui vertical menu"></div>');

        element.append(list);

        if (electron.program.debug) {
            appendDebugItem(list, scope);
        }

        scope.menu.forEach(function(item){
            if (item.menu) {
                appendSubmenu(list, item, scope);
            } else {
                appendMenuItem(list, item, scope);
            }
        });

        bindMenuActions(element);

    }

    function appendDebugItem(element, scope) {
        if (typeof scope.debug !== 'function') return;

        var debug = {
            label: 'Debug',
            icon: 'help',
            click: scope.debug
        }
        appendMenuItem(element, debug, scope)
    }

    function appendMenuItem(element, item, scope) {
        var menuItem = angular.element('<a class="item"></a>');

        if (item.role) {
            menuItem.attr('data-role', item.role)
        }

        if (item.icon) {
            addIcon(menuItem, item.icon);
        } else if (item.check) {
            addCheckbox(menuItem, item.check);
        }

        menuItem.bind('click', function() {
            contextMenu.hide();
            scope.click(item.click, item.label);
        });

        menuItem.append(item.label);
        element.append(menuItem);
    }

    function addCheckbox(item, predicate) {
        var check = angular.element('<div class="ui checkbox"></div>')
        var checkbox = angular.element('<input type="checkbox">')
        var label = angular.element('<label></label>')
        check.append(checkbox)
        check.append(label)
        item.append(check)
        checkboxes.push({
            checkbox: checkbox[0],
            predicate: predicate
        })
    }

    function addIcon(item, iconName) {
        var icon = angular.element('<i></i>')
        icon.addClass('ui ' + iconName + ' icon');
        item.append(icon);
    }

    function appendSubmenu(element, submenu, scope) {
        var list = angular.element('<div class="ui context dropdown item">');
        var menu = angular.element('<div class="menu">');

        submenu.menu.forEach(function(item) {
            appendMenuItem(menu, item, scope);
        });

        addIcon(list, 'dropdown');

        list.append(submenu.label);
        list.append(menu);
        element.append(list);

    }

    function bindMenuActions(element) {
        $(element).find('.context.dropdown').each(function(){
            $(this)
            .mouseenter(function(){
                var menu = $(this).find('.menu')
                menu.show();
            })
            .mouseleave(function(){
                $(this).find('.menu').hide();
            });
        });
    }

    function link(scope, element, attr){
        scope.program = electron.program;

        element.data('contextmenu', true);

        render(scope, element, attr);

        // Bind show function to scope variable
        scope.bind = {
            show: showContextMenu(scope, element),
            hide: hideContextMenu(scope, element)
        };

        // Remove context menu when user clicks anywhere not in the context menu
        angular.element($document[0].body).on('click',function(event) {
            var element: any = angular.element(event.target)
            var inContext =  element.inheritedData('contextmenu');
            if (!inContext) {
                $(element).hide();
            }
        });

        // Remove context menu when user presses the escape key
        angular.element($document).on('keyup', function(event){
            if (event.keyCode === 27 /* Escape key */){
                $(element).hide();
            }
        });

        scope.$watch(function() {
            return $rootScope.$btclient;
        }, function(client) {
            if (client) {
                render(scope, element, attr);
            }
        });
    }

    function updateCheckboxes(scope, items) {
        checkboxes.forEach(item => {
            item.checkbox.checked =
                items.every(i => item.predicate(i))
        })
    }

    function bindCloseOperations(element) {
        // Remove context menu when the user scrolls the main content
        $('.main-content').one('scroll', function() {
            $(element).hide();
        });

        // Remove context menu on window resize
        $($window).one('resize', function(){
            $(element).hide();
        });
    }

    function showContextMenu(scope, element){
        return function(event, items){
            bindCloseOperations(element);
            updateCheckboxes(scope, items)

            var totWidth = $(window).width();
            var totHeight = $(window).height();

            var menuWidth = $(element).width();
            var menuHeight = $(element).height();

            var posX = event.pageX;
            var posY = event.pageY;

            var menuX = posX;
            var menuY = posY;

            if (posX + menuWidth >= totWidth) menuX -= menuWidth;
            if (posY + menuHeight >= totHeight) menuY -= menuHeight;

            $(element).css({
                left: menuX,
                top: menuY,
                display: 'block'
            });
        };
    }

    function hideContextMenu(scope, element) {
        return function(){
            $(element).hide();
        };
    }
}]);
